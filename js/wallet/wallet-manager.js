(function(global) {
    'use strict';

    if (global.WalletManager) {
        console.log('⚠️ WalletManager already defined, skipping redeclaration');
        return;
    }

    const WALLET_SESSION_KEY = 'lib_lp_staking:wallet-session';
    const SCRIPT_SRC = global.document?.currentScript?.src || '';
    const BNB_CHAIN_IDS = new Set([56, 97]);
    const UNSUPPORTED_WALLET_NETWORK = 'UNSUPPORTED_WALLET_NETWORK';
    let walletModulePromise = null;

    function walletModuleUrl() {
        if (SCRIPT_SRC) {
            return new URL('../../vendor/liberdus-wallet-module/index.js', SCRIPT_SRC).href;
        }
        return '../../vendor/liberdus-wallet-module/index.js';
    }

    async function loadWalletModule() {
        if (!walletModulePromise) {
            walletModulePromise = import(walletModuleUrl());
        }
        return walletModulePromise;
    }

    function getStorage() {
        try {
            return global.localStorage;
        } catch {
            return null;
        }
    }

    function parseChainId(chainId) {
        if (typeof chainId === 'number' && Number.isFinite(chainId)) return chainId;
        if (typeof chainId === 'string' && chainId.trim()) {
            return chainId.startsWith('0x') ? Number.parseInt(chainId, 16) : Number(chainId);
        }
        return null;
    }

    function getSelectedChainId() {
        return parseChainId(global.networkSelector?.getCurrentChainId?.());
    }

    function getSelectedNetworkName() {
        return global.networkSelector?.getCurrentNetworkName?.() || 'BNB Smart Chain';
    }

    function walletProviders(wallet) {
        return [wallet?.provider, ...(wallet?.linkedProviders || [])].filter(Boolean);
    }

    function isPhantomProvider(provider) {
        return !!provider?.isPhantom;
    }

    function isPhantomWallet(wallet) {
        const name = String(wallet?.info?.name || '').toLowerCase();
        const rdns = String(wallet?.info?.rdns || '').toLowerCase();
        return name.includes('phantom')
            || rdns.includes('phantom')
            || walletProviders(wallet).some(isPhantomProvider);
    }

    class WalletManager {
        constructor() {
            this.walletCore = null;
            this.provider = null;
            this.signer = null;
            this.address = null;
            this.account = null;
            this.chainId = null;
            this.walletType = null;
            this.listeners = new Set();
            this.connectionPromise = null;
        }

        async init() {
            const { createWalletCore } = await loadWalletModule();
            this.walletCore = createWalletCore({
                storage: getStorage(),
                walletSessionKey: WALLET_SESSION_KEY
            });

            this.walletCore.subscribe((event, data) => this.handleCoreEvent(event, data));
            await this.checkPreviousConnection();
            this.log('WalletManager initialized');
        }

        get isConnecting() {
            return !!(this.connectionPromise || this.walletCore?.getState().isConnecting);
        }

        async discoverWallets() {
            this.assertReady();
            return await this.walletCore.discoverWallets();
        }

        async connectWallet(options = {}) {
            if (this.connectionPromise) return this.connectionPromise;

            this.connectionPromise = this.connect(options);
            try {
                return await this.connectionPromise;
            } finally {
                this.connectionPromise = null;
            }
        }

        async connectMetaMask() {
            return await this.connectWallet('metamask');
        }

        async connect(options) {
            this.assertReady();
            if (this.isConnected()) return this.connectionResult();

            const wallets = await this.walletCore.discoverWallets();
            if (!wallets.length) {
                throw new Error('No compatible wallet was found in this browser.');
            }

            const walletId = await this.resolveWalletId(options, wallets);
            const wallet = this.findWalletById(wallets, walletId);
            this.assertWalletSupportedOnCurrentNetwork(wallet);

            await this.walletCore.connect({ walletId });
            this.syncFromCoreState();
            return this.connectionResult();
        }

        async resolveWalletId(options, wallets) {
            if (typeof options === 'object' && options.walletId) return options.walletId;

            if (typeof options === 'string' && options !== 'auto') {
                const wallet = wallets.find((candidate) => this.matchesWallet(candidate, options));
                if (wallet) return wallet.id;
                throw new Error(`${options} wallet was not found in this browser.`);
            }

            if (wallets.length === 1) return wallets[0].id;

            await this.walletCore.sync();
            const sessionWalletId = this.walletCore.getState().sessionWalletId;
            if (sessionWalletId && wallets.some((wallet) => wallet.id === sessionWalletId)) {
                return sessionWalletId;
            }

            const error = new Error('Wallet selection required.');
            error.code = 'WALLET_SELECTION_REQUIRED';
            error.wallets = wallets;
            throw error;
        }

        matchesWallet(wallet, requestedName) {
            const needle = String(requestedName).toLowerCase();
            const name = String(wallet.info?.name || '').toLowerCase();
            const rdns = String(wallet.info?.rdns || '').toLowerCase();
            return name.includes(needle) || rdns.includes(needle);
        }

        findWalletById(wallets, walletId) {
            return wallets.find((wallet) => wallet.id === walletId) || null;
        }

        assertWalletSupportedOnCurrentNetwork(wallet) {
            const chainId = getSelectedChainId();
            if (!BNB_CHAIN_IDS.has(chainId) || !isPhantomWallet(wallet)) return;

            const networkName = getSelectedNetworkName();
            const error = new Error(
                'Phantom does not support ' + networkName + '. Choose a BNB-compatible wallet such as MetaMask, Rabby, Trust Wallet, or OKX.'
            );
            error.code = UNSUPPORTED_WALLET_NETWORK;
            error.walletName = wallet?.info?.name || 'Phantom';
            error.networkName = networkName;
            error.chainId = chainId;
            throw error;
        }

        currentWalletDescriptor() {
            const state = this.walletCore.getState();
            return {
                provider: this.walletCore.getEip1193Provider(),
                info: {
                    name: state.selectedWalletName,
                    rdns: state.selectedWalletRdns
                }
            };
        }

        async disconnect() {
            this.assertReady();
            await this.revokeWalletPermissions();
            await this.walletCore.disconnect();
        }

        async revokeWalletPermissions() {
            const provider = this.walletCore.getEip1193Provider();
            if (!provider?.request) return;

            try {
                await provider.request({
                    method: 'wallet_revokePermissions',
                    params: [{ eth_accounts: {} }]
                });
            } catch {
                // Not all wallets support permission revocation; local disconnect still applies.
            }
        }

        async checkPreviousConnection() {
            this.assertReady();
            await this.walletCore.sync();
            if (!this.walletCore.getState().account) return false;

            try {
                this.assertWalletSupportedOnCurrentNetwork(this.currentWalletDescriptor());
            } catch (error) {
                if (error.code !== UNSUPPORTED_WALLET_NETWORK) throw error;
                await this.walletCore.disconnect();
                this.clearEthersState();
                return false;
            }

            this.syncFromCoreState();
            this.notifyListeners('connected', { restored: true });
            return true;
        }

        async sync() {
            this.assertReady();
            await this.walletCore.sync();
            this.syncFromCoreState();
            return this.connectionResult();
        }

        handleCoreEvent(event, data) {
            if (event === 'connected') {
                this.syncFromCoreState();
                this.notifyListeners('connected', data);
                return;
            }

            if (event === 'disconnected' || (event === 'accountChanged' && !data)) {
                const wasConnected = this.isConnected();
                this.clearEthersState();
                if (wasConnected) {
                    this.notifyListeners('disconnected', {});
                }
                return;
            }

            if ((event === 'accountChanged' || event === 'chainChanged') && !this.hasActiveWalletSession()) {
                return;
            }

            if (event === 'accountChanged' || event === 'chainChanged') {
                this.syncFromCoreState();
                this.notifyListeners(event, data);
            }
        }

        syncFromCoreState() {
            const state = this.walletCore.getState();
            const injectedProvider = this.walletCore.getEip1193Provider();

            if (!state.account || !injectedProvider || !global.ethers) {
                this.clearEthersState();
                return;
            }

            this.provider = new global.ethers.providers.Web3Provider(injectedProvider);
            this.signer = this.provider.getSigner();
            this.address = state.account;
            this.account = state.account;
            this.chainId = state.chainId;
            this.walletType = state.selectedWalletName || 'wallet';
        }

        clearEthersState() {
            this.provider = null;
            this.signer = null;
            this.address = null;
            this.account = null;
            this.chainId = null;
            this.walletType = null;
        }

        hasActiveWalletSession() {
            const state = this.walletCore.getState();
            return !!(state.sessionWalletId || state.selectedWalletId);
        }

        connectionResult() {
            return {
                success: this.isConnected(),
                address: this.address,
                chainId: this.chainId,
                walletType: this.walletType
            };
        }

        isConnected() {
            return !!(this.provider && this.signer && this.address);
        }

        isWalletConnected() {
            return this.isConnected();
        }

        getAddress() {
            return this.address;
        }

        getAccount() {
            return this.address;
        }

        get currentAccount() {
            return this.address;
        }

        getChainId() {
            return this.chainId;
        }

        getWalletType() {
            return this.walletType;
        }

        getProvider() {
            return this.provider;
        }

        getSigner() {
            return this.signer;
        }

        getEip1193Provider() {
            this.assertReady();
            return this.walletCore.getEip1193Provider();
        }

        subscribe(callback) {
            this.listeners.add(callback);
            return () => this.listeners.delete(callback);
        }

        notifyListeners(event, data) {
            const payload = {
                address: this.address,
                chainId: this.chainId,
                walletType: this.walletType,
                ...data
            };

            this.listeners.forEach((callback) => callback(event, payload));

            const eventName = {
                connected: 'walletConnected',
                disconnected: 'walletDisconnected',
                accountChanged: 'walletAccountChanged',
                chainChanged: 'walletChainChanged'
            }[event] || `wallet${event.charAt(0).toUpperCase()}${event.slice(1)}`;

            global.document?.dispatchEvent(new CustomEvent(eventName, {
                detail: { event, data: payload }
            }));
        }

        assertReady() {
            if (!this.walletCore) {
                throw new Error('WalletManager is not initialized.');
            }
        }

        log(...args) {
            if (global.CONFIG?.DEV?.DEBUG || global.CONFIG?.DEV?.DEBUG_MODE) {
                console.log('[WalletManager]', ...args);
            }
        }
    }

    global.WalletManager = WalletManager;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = WalletManager;
    }
})(typeof window !== 'undefined' ? window : globalThis);
