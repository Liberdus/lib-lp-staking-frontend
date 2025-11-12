/**
 * MetaMask Connector
 * Handles MetaMask wallet connection and interactions
 */

class MetaMaskConnector {
    constructor() {
        this.isConnected = false;
        this.account = null;
        this.chainId = null;
        this.provider = null;
        this.providerEventHandlers = [];
    }

    /**
     * Check if MetaMask is available
     */
    isAvailable() {
        return !!this.getMetaMaskProvider();
    }

    getMetaMaskProvider() {
        const manager = window.walletManager;
        if (manager && typeof manager.getPreferredInjectedProvider === 'function') {
            const detail = manager.getPreferredInjectedProvider('io.metamask');
            if (detail?.provider) {
                return detail.provider;
            }
        }

        if (typeof window.ethereum !== 'undefined') {
            if (Array.isArray(window.ethereum.providers)) {
                const metamaskProvider = window.ethereum.providers.find((provider) => provider?.isMetaMask);
                if (metamaskProvider) {
                    return metamaskProvider;
                }
            }

            if (window.ethereum.isMetaMask) {
                return window.ethereum;
            }
        }

        return null;
    }

    /**
     * Connect to MetaMask
     */
    async connect() {
        if (!this.isAvailable()) {
            throw new Error('MetaMask is not installed');
        }

        try {
            const provider = this.getMetaMaskProvider();
            if (!provider) {
                throw new Error('MetaMask provider not found');
            }

            // Request account access
            const accounts = await provider.request({
                method: 'eth_requestAccounts'
            });

            if (accounts.length === 0) {
                throw new Error('No accounts found');
            }

            this.account = accounts[0];
            this.isConnected = true;

            // Get chain ID
            this.chainId = await provider.request({
                method: 'eth_chainId'
            });

            // Create provider
            if (window.ethers) {
                this.provider = new ethers.providers.Web3Provider(provider, 'any');
            }

            // Set up event listeners
            this.setupEventListeners(provider);

            return {
                account: this.account,
                chainId: this.chainId,
                provider: this.provider
            };

        } catch (error) {
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * Disconnect from MetaMask
     */
    async disconnect() {
        this.isConnected = false;
        this.account = null;
        this.chainId = null;
        this.provider = null;

        this.removeEventListeners();
    }

    /**
     * Setup event listeners for MetaMask events
     */
    setupEventListeners(provider) {
        const metamaskProvider = provider || this.getMetaMaskProvider();
        if (!metamaskProvider || typeof metamaskProvider.on !== 'function') return;

        this.removeEventListeners();

        const accountsChangedHandler = (accounts) => {
            if (accounts.length === 0) {
                this.disconnect();
                document.dispatchEvent(new CustomEvent('walletDisconnected'));
            } else {
                this.account = accounts[0];
                document.dispatchEvent(new CustomEvent('accountsChanged', {
                    detail: { account: this.account }
                }));
            }
        };

        // Chain changed
        const chainChangedHandler = (chainId) => {
            this.chainId = chainId;
            document.dispatchEvent(new CustomEvent('chainChanged', {
                detail: { chainId }
            }));
        };

        // Connection
        const connectHandler = (connectInfo) => {
            this.chainId = connectInfo.chainId;
            document.dispatchEvent(new CustomEvent('walletConnected', {
                detail: { chainId: this.chainId }
            }));
        };

        // Disconnection
        const disconnectHandler = (error) => {
            this.disconnect();
            document.dispatchEvent(new CustomEvent('walletDisconnected', {
                detail: { error }
            }));
        };

        metamaskProvider.on('accountsChanged', accountsChangedHandler);
        metamaskProvider.on('chainChanged', chainChangedHandler);
        metamaskProvider.on('connect', connectHandler);
        metamaskProvider.on('disconnect', disconnectHandler);

        this.providerEventHandlers = [
            { event: 'accountsChanged', handler: accountsChangedHandler },
            { event: 'chainChanged', handler: chainChangedHandler },
            { event: 'connect', handler: connectHandler },
            { event: 'disconnect', handler: disconnectHandler }
        ];

        this.currentProviderForEvents = metamaskProvider;
    }

    /**
     * Switch to a specific network
     */
    async switchNetwork(chainId) {
        if (!this.isAvailable()) {
            throw new Error('MetaMask is not available');
        }

        try {
            const provider = this.getMetaMaskProvider();
            if (!provider) {
                throw new Error('MetaMask provider not found');
            }

            await provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId }],
            });
        } catch (switchError) {
            // This error code indicates that the chain has not been added to MetaMask
            if (switchError.code === 4902) {
                throw new Error('Network not added to MetaMask');
            }
            throw switchError;
        }
    }

    /**
     * Add a network to MetaMask
     */
    async addNetwork(networkConfig) {
        if (!this.isAvailable()) {
            throw new Error('MetaMask is not available');
        }

        try {
            const provider = this.getMetaMaskProvider();
            if (!provider) {
                throw new Error('MetaMask provider not found');
            }

            await provider.request({
                method: 'wallet_addEthereumChain',
                params: [networkConfig],
            });
        } catch (addError) {
            throw addError;
        }
    }

    removeEventListeners() {
        const provider = this.currentProviderForEvents;
        if (!provider || typeof provider.removeListener !== 'function') {
            this.providerEventHandlers = [];
            this.currentProviderForEvents = null;
            return;
        }

        this.providerEventHandlers.forEach(({ event, handler }) => {
            try {
                provider.removeListener(event, handler);
            } catch (error) {
                // Ignore removal errors
            }
        });

        this.providerEventHandlers = [];
        this.currentProviderForEvents = null;
    }

    /**
     * Get current account
     */
    getAccount() {
        return this.account;
    }

    /**
     * Get current chain ID
     */
    getChainId() {
        return this.chainId;
    }

    /**
     * Get provider
     */
    getProvider() {
        return this.provider;
    }

    /**
     * Get signer
     */
    getSigner() {
        return this.provider ? this.provider.getSigner() : null;
    }
}

// Global MetaMask connector instance
window.MetaMaskConnector = MetaMaskConnector;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MetaMaskConnector;
}
