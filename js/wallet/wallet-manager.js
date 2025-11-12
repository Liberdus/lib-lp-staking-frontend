
// Prevent duplicate class declaration
if (typeof window.WalletManager !== 'undefined') {
    console.log('⚠️ WalletManager already defined, skipping redeclaration');
} else {

class WalletManager {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.chainId = null;
        this.walletType = null;
        this.isConnecting = false;
        this.listeners = new Set();
        this.eventListeners = [];

        // Rate limiting for MetaMask requests
        this.lastRequestTime = 0;
        this.requestCooldown = 2000; // 2 seconds between requests (increased)
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 3;
        this.connectionCooldownTime = 10000; // 10 seconds between connection attempts (increased)

        // Connection state management
        this.connectionPromise = null; // Track ongoing connection attempts
        this.pendingPreferredProvider = null;

        // Injected provider discovery (EIP-6963 compliant)
        this.injectedProviders = new Map();
        this.activeInjectedProvider = null;
        this._handleProviderAnnouncement = this.handleInjectedProviderAnnouncement.bind(this);

        this.initializeInjectedProviderDiscovery();

        this.init();
    }

    initializeInjectedProviderDiscovery() {
        if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
            return;
        }

        try {
            window.addEventListener('eip6963:announceProvider', this._handleProviderAnnouncement);
            window.dispatchEvent(new CustomEvent('eip6963:requestProvider'));
        } catch (error) {
            console.warn('⚠️ Failed to request EIP-6963 providers:', error);
        }

        // Fallback to window.ethereum if no providers announce themselves
        setTimeout(() => {
            if (!this.injectedProviders.size && typeof window.ethereum !== 'undefined') {
                const candidates = Array.isArray(window.ethereum.providers) && window.ethereum.providers.length
                    ? window.ethereum.providers
                    : [window.ethereum];

                candidates.forEach((candidate, index) => {
                    if (!candidate) {
                        return;
                    }

                    const rdns = candidate.isMetaMask ? 'io.metamask' :
                        candidate.isCoinbaseWallet ? 'com.coinbase.wallet' :
                        candidate.isBraveWallet ? 'com.brave.wallet' :
                        'injected';

                    const infoOverride = {
                        uuid: `fallback-${rdns}-${index}`,
                        name: candidate.isMetaMask ? 'MetaMask' : (candidate.name || `Injected Wallet ${index + 1}`),
                        icon: candidate.isMetaMask ? 'https://metamask.io/images/favicon-32x32.png' : '',
                        rdns
                    };

                    this.registerFallbackInjectedProvider(candidate, infoOverride);
                });
            }

            window.detectedInjectedProviders = this.getInjectedProviders();
            window.isMetaMaskAvailable = this.isInjectedProviderAvailable('io.metamask');
        }, 0);
    }

    handleInjectedProviderAnnouncement(event) {
        const detail = event?.detail;
        if (!detail || !detail.provider || !detail.info?.uuid) {
            return;
        }

        const providerDetail = {
            info: detail.info,
            provider: detail.provider
        };

        this.injectedProviders.set(detail.info.uuid, providerDetail);

        if (!this.activeInjectedProvider || detail.info.rdns === 'io.metamask') {
            this.activeInjectedProvider = providerDetail;
        }

        window.detectedInjectedProviders = this.getInjectedProviders();

        if (detail.info.rdns === 'io.metamask') {
            window.isMetaMaskAvailable = true;
        }

        // Ensure wallet event listeners are attached to the preferred provider
        this.setupEventListeners(providerDetail);
    }

    registerFallbackInjectedProvider(provider, infoOverride) {
        if (!provider) {
            return;
        }

        const inferredRdns = provider.isMetaMask ? 'io.metamask' :
            provider.isCoinbaseWallet ? 'com.coinbase.wallet' :
            provider.isBraveWallet ? 'com.brave.wallet' :
            'injected';

        const info = infoOverride || {
            uuid: `fallback-${inferredRdns}`,
            name: provider.isMetaMask ? 'MetaMask' : (provider.name || 'Injected Wallet'),
            icon: provider.isMetaMask ? 'https://metamask.io/images/favicon-32x32.png' : '',
            rdns: inferredRdns
        };

        const providerDetail = { info, provider };
        this.injectedProviders.set(info.uuid, providerDetail);

        if (!this.activeInjectedProvider || inferredRdns === 'io.metamask') {
            this.activeInjectedProvider = providerDetail;
        }
    }

    getInjectedProviders() {
        return Array.from(this.injectedProviders.values());
    }

    getInjectedProviderByUuid(uuid) {
        if (!uuid) {
            return null;
        }

        return this.injectedProviders.get(uuid) || null;
    }

    hasInjectedProviders() {
        return this.injectedProviders.size > 0;
    }

    isInjectedProviderAvailable(rdns = null) {
        if (!this.hasInjectedProviders()) {
            return false;
        }

        if (!rdns) {
            return true;
        }

        return this.getInjectedProviders().some((detail) => detail.info?.rdns === rdns);
    }

    getPreferredInjectedProvider(preferredRdns = 'io.metamask') {
        if (!this.hasInjectedProviders()) {
            return null;
        }

        const providers = this.getInjectedProviders();
        const exactMatch = providers.find((detail) => detail.info?.rdns === preferredRdns);
        if (exactMatch) {
            return exactMatch;
        }

        return providers[0];
    }

    getActiveInjectedProvider() {
        return this.activeInjectedProvider || this.getPreferredInjectedProvider();
    }

    setActiveInjectedProvider(providerDetail) {
        if (providerDetail && providerDetail.provider) {
            this.activeInjectedProvider = providerDetail;
        }
    }

    resolveWalletType(providerDetail, provider) {
        const rdns = providerDetail?.info?.rdns || providerDetail?.rdns;
        if (rdns === 'io.metamask') return 'metamask';
        if (rdns === 'com.coinbase.wallet') return 'coinbase';
        if (rdns === 'com.brave.wallet') return 'brave';

        if (provider?.isMetaMask) return 'metamask';
        if (provider?.isCoinbaseWallet) return 'coinbase';
        if (provider?.isBraveWallet) return 'brave';

        return 'injected';
    }

    getProviderName(providerDetail, provider) {
        if (providerDetail?.info?.name) {
            return providerDetail.info.name;
        }

        if (provider?.isMetaMask) return 'MetaMask';
        if (provider?.isCoinbaseWallet) return 'Coinbase Wallet';
        if (provider?.isBraveWallet) return 'Brave Wallet';

        return 'Injected Wallet';
    }

    /**
     * Rate-limited request wrapper to prevent circuit breaker errors
     */
    async safeProviderRequest(provider, method, params = [], retryCount = 0) {
        const maxRetries = 3;
        const baseDelay = 1000; // 1 second base delay

        // Implement exponential backoff for rate limiting
        const now = Date.now();
        const minDelay = this.requestCooldown * (retryCount + 1);
        if (now - this.lastRequestTime < minDelay) {
            const waitTime = minDelay - (now - this.lastRequestTime);
            console.log(`Rate limiting wallet provider request: waiting ${waitTime}ms (attempt ${retryCount + 1})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        this.lastRequestTime = Date.now();

        try {
            if (!provider || typeof provider.request !== 'function') {
                throw new Error('No injected wallet provider available');
            }

            console.log(`Making provider request: ${method} (attempt ${retryCount + 1})`);
            return await provider.request({ method, params });
        } catch (error) {
            console.error(`Provider request failed (attempt ${retryCount + 1}):`, error);

            // Handle circuit breaker errors specifically
            if (error.code === -32603 && error.message.includes('circuit breaker')) {
                if (retryCount < maxRetries) {
                    const backoffDelay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
                    console.warn(`Wallet provider circuit breaker triggered, retrying in ${backoffDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                    return this.safeProviderRequest(provider, method, params, retryCount + 1);
                } else {
                    throw new Error('Wallet provider is temporarily overloaded. Please wait a few minutes and refresh the page.');
                }
            }

            // Handle other common MetaMask errors
            if (error.code === -32002) {
                throw new Error('MetaMask is already processing a request. Please wait and try again.');
            }

            if (error.code === 4001) {
                throw new Error('Connection cancelled by user.');
            }

            throw error;
        }
    }

    async init() {
        this.isConnecting = true;
        try {

            await this.checkPreviousConnection();

            // Set up event listeners for wallet changes
            this.setupEventListeners();

            this.log('WalletManager initialized');
        } catch (error) {
            this.logError('Failed to initialize WalletManager:', error);
        } finally {
            this.isConnecting = false;
        }
    }

    /**
     * General connect method that chooses the best available wallet
     */
    async connectWallet(preferredType = 'auto') {
        try {
            this.log(`Connecting wallet (preferred: ${preferredType})...`);

            if (preferredType === 'metamask' || (preferredType === 'auto' && this.isInjectedProviderAvailable())) {
                return await this.connectMetaMask();
            } else if (preferredType === 'walletconnect' || preferredType === 'auto') {
                return await this.connectWalletConnect();
            } else {
                throw new Error('No supported wallet found');
            }
        } catch (error) {
            this.logError('Wallet connection failed:', error);
            throw error;
        }
    }

    /**
     * CRITICAL FIX: Connect to MetaMask wallet with circuit breaker protection
     */
    async connectMetaMask(preferredUuid = null) {
        // Return existing connection promise if one is in progress
        if (this.connectionPromise) {
            console.log('Connection already in progress, returning existing promise...');
            return this.connectionPromise;
        }

        if (preferredUuid) {
            const preferredProviderDetail = this.getInjectedProviderByUuid(preferredUuid);
            if (preferredProviderDetail) {
                this.pendingPreferredProvider = preferredProviderDetail;
                this.setActiveInjectedProvider(preferredProviderDetail);
            }
        }

        // Create new connection promise
        this.connectionPromise = this._performConnection();

        try {
            const result = await this.connectionPromise;
            return result;
        } finally {
            // Clear the connection promise when done (success or failure)
            this.connectionPromise = null;
            this.pendingPreferredProvider = null;
        }
    }

    /**
     * Internal method to perform the actual connection
     */
    async _performConnection() {
        // Rate limiting and attempt limiting
        const now = Date.now();
        if (this.connectionAttempts >= this.maxConnectionAttempts) {
            const timeSinceLastAttempt = now - this.lastRequestTime;
            if (timeSinceLastAttempt < this.connectionCooldownTime) {
                const waitTime = this.connectionCooldownTime - timeSinceLastAttempt;
                throw new Error(`Too many connection attempts. Please wait ${Math.ceil(waitTime / 1000)} seconds before trying again.`);
            } else {
                // Reset attempts after cooldown
                this.connectionAttempts = 0;
            }
        }

        const preferredProviderDetail = this.pendingPreferredProvider || this.getPreferredInjectedProvider();
        const injectedProvider = preferredProviderDetail?.provider;
        const providerName = this.getProviderName(preferredProviderDetail, injectedProvider);

        // Check if already connected
        if (this.isConnected()) {
            console.log(`${providerName} already connected:`, this.address);
            return {
                success: true,
                address: this.address,
                chainId: this.chainId,
                walletType: this.walletType
            };
        }

        // Check injected provider availability
        if (!injectedProvider) {
            this.connectionAttempts++;
            throw new Error('No injected wallet provider detected. Please install MetaMask or another compatible wallet.');
        }

        this.setActiveInjectedProvider(preferredProviderDetail);

        // Set connection state with timeout protection
        this.isConnecting = true;
        this.connectionAttempts++;

        const connectionTimeout = setTimeout(() => {
            if (this.isConnecting) {
                console.error('Injected wallet connection timeout');
                this.isConnecting = false;
            }
        }, 30000); // 30 second timeout (reduced from 60)

        try {
            this.log(`Connecting to ${providerName}...`);

            // Check if ethers is available
            if (typeof window.ethers === 'undefined') {
                throw new Error('Ethers.js is not loaded. Please refresh the page and try again.');
            }

            // Request account access with rate limiting
            const accounts = await this.safeProviderRequest(injectedProvider, 'eth_requestAccounts');

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found. Please unlock your wallet.');
            }

            // Create provider and signer
            this.provider = new ethers.providers.Web3Provider(injectedProvider, 'any');
            this.signer = this.provider.getSigner();
            this.address = accounts[0];
            this.walletType = this.resolveWalletType(preferredProviderDetail, injectedProvider);

            // Get network information
            const network = await this.provider.getNetwork();
            this.chainId = network.chainId;

            // Store connection info
            this.storeConnectionInfo();

            // CRITICAL FIX: Notify listeners with enhanced error handling
            this.notifyListeners('connected', {
                address: this.address,
                chainId: this.chainId,
                walletType: this.walletType
            });

            // Show success notification if NotificationManager is available
            if (window.notificationManager && typeof window.notificationManager.success === 'function') {
                window.notificationManager.success(
                    `${providerName} Connected Successfully!`,
                    `Address: ${this.address.slice(0, 6)}...${this.address.slice(-4)}`,
                    { duration: 3000 }
                );
            }

            this.log(`${providerName} connected successfully:`, this.address);

            // Reset connection attempts on success
            this.connectionAttempts = 0;

            return {
                success: true,
                address: this.address,
                chainId: this.chainId,
                walletType: this.walletType
            };

        } catch (error) {
            this.logError(`${providerName} connection failed:`, error);

            // Show user-friendly error message
            if (window.notificationManager) {
                if (error.code === 4001) {
                    window.notificationManager.warning('You cancelled the connection request');
                } else if (error.code === -32002) {
                    window.notificationManager.warning('Wallet provider is already processing a request. Please wait.');
                } else {
                    window.notificationManager.error(error.message || 'An error occurred while connecting');
                }
            }

            throw error;
        } finally {
            clearTimeout(connectionTimeout);
            this.isConnecting = false;
        }
    }

    /**
     * CRITICAL FIX: Connect to WalletConnect with enhanced connection guards
     */
    async connectWalletConnect() {
        // CRITICAL FIX: Enhanced connection state checking
        if (this.isConnecting) {
            console.warn('WalletConnect connection already in progress, waiting...');
            // Wait for current connection to complete
            return new Promise((resolve, reject) => {
                const checkConnection = () => {
                    if (!this.isConnecting) {
                        if (this.isConnected()) {
                            resolve(true);
                        } else {
                            reject(new Error('Previous connection attempt failed'));
                        }
                    } else {
                        setTimeout(checkConnection, 100);
                    }
                };
                setTimeout(checkConnection, 100);
            });
        }

        if (this.isConnected()) {
            console.log('WalletConnect already connected:', this.address);
            return true;
        }

        this.isConnecting = true;

        try {
            this.log('Connecting to WalletConnect...');

            // Load WalletConnect dynamically if not already loaded
            if (!window.WalletConnectProvider) {
                await this.loadWalletConnect();
            }

            // Initialize WalletConnect provider
            const provider = new window.WalletConnectProvider({
                rpc: {
                    [window.CONFIG.DEFAULT_NETWORK]: window.CONFIG.RPC.POLYGON_AMOY[0]
                },
                chainId: window.CONFIG.DEFAULT_NETWORK,
                qrcode: true,
                qrcodeModalOptions: {
                    mobileLinks: [
                        'rainbow',
                        'metamask',
                        'argent',
                        'trust',
                        'imtoken',
                        'pillar'
                    ]
                }
            });

            // Enable session (triggers QR Code modal)
            await provider.enable();

            // Create ethers provider
            this.provider = new ethers.providers.Web3Provider(provider);
            this.signer = this.provider.getSigner();
            this.address = provider.accounts[0];
            this.chainId = provider.chainId;
            this.walletType = 'walletconnect';
            this.walletConnectProvider = provider;

            // Store connection info
            this.storeConnectionInfo();

            // Set up WalletConnect event listeners
            provider.on('accountsChanged', (accounts) => {
                this.handleAccountsChanged(accounts);
            });

            provider.on('chainChanged', (chainId) => {
                this.handleChainChanged(chainId);
            });

            provider.on('disconnect', (code, reason) => {
                this.handleDisconnect(code, reason);
            });

            // Notify listeners
            this.notifyListeners('connected', {
                address: this.address,
                chainId: this.chainId,
                walletType: this.walletType
            });

            this.log('WalletConnect connected successfully:', this.address);
            return true;

        } catch (error) {
            this.logError('WalletConnect connection failed:', error);
            throw error;
        } finally {
            this.isConnecting = false;
        }
    }

    /**
     * Load WalletConnect SDK dynamically
     */
    async loadWalletConnect() {
        return new Promise((resolve, reject) => {
            if (window.WalletConnectProvider) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@walletconnect/web3-provider@1.8.0/dist/umd/index.min.js';
            script.onload = () => {
                this.log('WalletConnect SDK loaded successfully');
                resolve();
            };
            script.onerror = () => {
                reject(new Error('Failed to load WalletConnect SDK'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Disconnect wallet
     */
    async disconnect() {
        try {
            this.log('Disconnecting wallet...');

            // Clear stored connection info
            this.clearConnectionInfo();

            // Disconnect WalletConnect if active
            if (this.walletType === 'walletconnect' && this.walletConnectProvider) {
                await this.walletConnectProvider.disconnect();
            }

            // Reset state
            this.provider = null;
            this.signer = null;
            this.address = null;
            this.chainId = null;
            this.walletType = null;
            this.walletConnectProvider = null;

            // Notify listeners
            this.notifyListeners('disconnected', {});

            this.cleanupProviderEventListeners();

            this.log('Wallet disconnected successfully');

        } catch (error) {
            this.logError('Failed to disconnect wallet:', error);
            throw error;
        }
    }

    /**
     * Check if wallet is connected
     */
    isConnected() {
        return !!(this.provider && this.signer && this.address);
    }

    /**
     * Check if wallet is connected (alias for compatibility)
     */
    isWalletConnected() {
        return this.isConnected();
    }

    /**
     * Get current wallet address
     */
    getAddress() {
        return this.address;
    }

    /**
     * Get current account (alias for address for compatibility)
     */
    get currentAccount() {
        return this.address;
    }

    /**
     * Get current chain ID
     */
    getChainId() {
        return this.chainId;
    }

    /**
     * Get wallet type
     */
    getWalletType() {
        return this.walletType;
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
        return this.signer;
    }

    /**
     * Subscribe to wallet events
     */
    subscribe(callback) {
        this.listeners.add(callback);
        
        // Return unsubscribe function
        return () => {
            this.listeners.delete(callback);
        };
    }

    /**
     * Check for previously connected wallet
     */
    async checkPreviousConnection() {
        try {
            // Use safe localStorage access
            const storageKey = window.CONFIG?.UI?.WALLET_STORAGE_KEY || 'lp_staking_wallet_connection';
            const connectionInfo = window.sesSafeHandler?.safeLocalStorage?.getItem(storageKey) ||
                                 localStorage.getItem(storageKey);
            if (!connectionInfo) return false;

            const { walletType, address } = JSON.parse(connectionInfo);

            if (walletType !== 'walletconnect') {
                const preferredRdns = walletType === 'metamask' ? 'io.metamask' : undefined;
                const providerDetail = preferredRdns
                    ? this.getPreferredInjectedProvider(preferredRdns)
                    : this.getPreferredInjectedProvider();
                const injectedProvider = providerDetail?.provider;

                if (injectedProvider) {
                    try {
                        const accounts = await injectedProvider.request({ method: 'eth_accounts' });
                        if (accounts && accounts.length > 0 && accounts[0].toLowerCase() === address.toLowerCase()) {
                            const providerName = this.getProviderName(providerDetail, injectedProvider);
                            console.log(`✅ Previous ${providerName} connection found, restoring...`);

                            this.provider = new ethers.providers.Web3Provider(injectedProvider, 'any');
                            this.signer = this.provider.getSigner();
                            this.address = accounts[0];
                            this.walletType = this.resolveWalletType(providerDetail, injectedProvider);
                            this.setActiveInjectedProvider(providerDetail);

                            const network = await this.provider.getNetwork();
                            this.chainId = network.chainId;

                            this.notifyListeners('connected', {
                                address: this.address,
                                chainId: this.chainId,
                                walletType: this.walletType,
                                restored: true
                            });

                            console.log(`✅ ${providerName} connection restored successfully:`, this.address);
                            return true;
                        }
                    } catch (error) {
                        console.warn('Could not check previous connection:', error);
                    }
                }
            }

            // Clear invalid connection info
            this.clearConnectionInfo();
            return false;

        } catch (error) {
            this.logError('Failed to check previous connection:', error);
            this.clearConnectionInfo();
            return false;
        }
    }

    /**
     * Store connection information
     */
    storeConnectionInfo() {
        const connectionInfo = {
            walletType: this.walletType,
            address: this.address,
            chainId: this.chainId,
            timestamp: Date.now()
        };
        
        const storageKey = window.CONFIG?.UI?.WALLET_STORAGE_KEY || 'lp_staking_wallet_connection';
        const success = window.sesSafeHandler?.safeLocalStorage?.setItem(storageKey, JSON.stringify(connectionInfo));

        if (!success) {
            // Fallback to regular localStorage
            try {
                localStorage.setItem(storageKey, JSON.stringify(connectionInfo));
            } catch (error) {
                console.warn('Failed to save connection info:', error.message);
            }
        }
    }

    /**
     * Clear stored connection information
     */
    clearConnectionInfo() {
        const storageKey = window.CONFIG?.UI?.WALLET_STORAGE_KEY || 'lp_staking_wallet_connection';
        const success = window.sesSafeHandler?.safeLocalStorage?.removeItem(storageKey);

        if (!success) {
            // Fallback to regular localStorage
            try {
                localStorage.removeItem(storageKey);
            } catch (error) {
                console.warn('Failed to clear connection info:', error.message);
            }
        }
    }

    cleanupProviderEventListeners() {
        this.eventListeners.forEach(({ target, event, handler }) => {
            if (!target) {
                return;
            }

            if (typeof target.removeListener === 'function') {
                target.removeListener(event, handler);
            } else if (typeof target.removeEventListener === 'function') {
                target.removeEventListener(event, handler);
            }
        });

        this.eventListeners = [];
    }

    /**
     * Set up event listeners for wallet changes
     */
    setupEventListeners(providerDetail = null) {
        const detail = providerDetail || this.getActiveInjectedProvider();
        const provider = detail?.provider;

        if (!provider || typeof provider.on !== 'function') {
            return;
        }

        this.cleanupProviderEventListeners();

        const accountsChangedHandler = (accounts) => this.handleAccountsChanged(accounts);
        const chainChangedHandler = (chainId) => this.handleChainChanged(chainId);
        const disconnectHandler = () => this.handleDisconnect();

        provider.on('accountsChanged', accountsChangedHandler);
        provider.on('chainChanged', chainChangedHandler);
        provider.on('disconnect', disconnectHandler);

        this.eventListeners.push(
            { target: provider, event: 'accountsChanged', handler: accountsChangedHandler },
            { target: provider, event: 'chainChanged', handler: chainChangedHandler },
            { target: provider, event: 'disconnect', handler: disconnectHandler }
        );
    }

    /**
     * Handle accounts changed event
     */
    async handleAccountsChanged(accounts) {
        this.log('Accounts changed:', accounts);

        if (!accounts || accounts.length === 0) {
            // Check if this is a network change (we have a stored address)
            // MetaMask sometimes sends empty accounts during network switches
            if (this.address) {
                this.log('Empty accounts during network change - ignoring');
                return; // Don't disconnect during network changes
            }
            
            // User disconnected
            this.disconnect();
        } else if (accounts[0] !== this.address) {
            const wasDisconnected = !this.address;
            
            // User switched accounts or reconnected
            this.address = accounts[0];
            
            // Re-initialize provider/signer if reconnecting after disconnect
            if (wasDisconnected) {
                this.log('Re-initializing provider and signer after reconnection');
                try {
                    const providerDetail = this.getActiveInjectedProvider();
                    const injectedProvider = providerDetail?.provider;

                    if (!injectedProvider) {
                        throw new Error('No injected provider available during reconnection');
                    }

                    this.provider = new ethers.providers.Web3Provider(injectedProvider, 'any');
                    this.signer = this.provider.getSigner();
                    this.chainId = (await this.provider.getNetwork()).chainId;
                    this.walletType = this.resolveWalletType(providerDetail, injectedProvider);
                    this.setActiveInjectedProvider(providerDetail);
                } catch (error) {
                    this.logError('Failed to re-initialize provider/signer:', error);
                }
            }
            
            this.storeConnectionInfo();
            
            this.notifyListeners('accountChanged', {
                address: this.address,
                chainId: this.chainId
            });
        }
    }

    /**
     * Handle chain changed event
     */
    handleChainChanged(chainId) {
        const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 16) : chainId;
        this.log('Chain changed:', numericChainId);

        this.chainId = numericChainId;
        this.storeConnectionInfo();

        this.notifyListeners('chainChanged', {
            address: this.address,
            chainId: this.chainId
        });
    }

    /**
     * Handle disconnect event
     */
    handleDisconnect(code, reason) {
        this.log('Disconnect event - code:', code, 'reason:', reason);
        
        // Don't disconnect if we still have an address (likely a network change)
        // MetaMask sometimes fires disconnect during network switches
        if (this.address) {
            this.log('Disconnect during network change - ignoring');
            return;
        }
        
        this.disconnect();
    }

    /**
     * Notify all listeners of events and dispatch DOM events
     */
    notifyListeners(event, data) {
        // Notify registered listeners
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                this.logError('Listener callback error:', error);
            }
        });

        // Dispatch DOM events for global listening
        try {
            let eventName;
            switch (event) {
                case 'connected':
                    eventName = 'walletConnected';
                    break;
                case 'disconnected':
                    eventName = 'walletDisconnected';
                    break;
                case 'accountChanged':
                    eventName = 'walletAccountChanged';
                    break;
                case 'chainChanged':
                    eventName = 'walletChainChanged';
                    break;
                default:
                    eventName = `wallet${event.charAt(0).toUpperCase() + event.slice(1)}`;
            }

            document.dispatchEvent(new CustomEvent(eventName, {
                detail: { event, data }
            }));

            console.log(`📡 Dispatched ${eventName} event:`, data);

        } catch (error) {
            this.logError('Failed to dispatch DOM event:', error);
        }
    }

    /**
     * Cleanup event listeners
     */
    cleanup() {
        this.cleanupProviderEventListeners();
        if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
            window.removeEventListener('eip6963:announceProvider', this._handleProviderAnnouncement);
        }
        this.listeners.clear();
    }

    /**
     * Logging utility
     */
    log(...args) {
        try {
            if (window.CONFIG?.DEV?.DEBUG_MODE) {
                if (window.safeConsole) {
                    window.safeConsole.log('[WalletManager]', ...args);
                } else {
                    console.log('[WalletManager]', ...args);
                }
            }
        } catch (error) {
            // Fallback - do nothing if logging fails
        }
    }

    /**
     * Error logging utility
     */
    logError(...args) {
        try {
            if (window.safeConsole) {
                window.safeConsole.error('[WalletManager]', ...args);
            } else {
                console.error('[WalletManager]', ...args);
            }
        } catch (error) {
            // Fallback - do nothing if logging fails
        }
    }
}

// Export the class to global scope
window.WalletManager = WalletManager;

// Create global instance (only if not already created)
if (!window.walletManager) {
    try {
        window.walletManager = new WalletManager();
        console.log('✅ WalletManager instance created successfully');

        // Verify methods are available
        console.log('🔍 WalletManager methods check:');
        console.log('  - connectMetaMask:', typeof window.walletManager.connectMetaMask);
        console.log('  - connectWalletConnect:', typeof window.walletManager.connectWalletConnect);
        console.log('  - connectWallet:', typeof window.walletManager.connectWallet);
        console.log('  - isConnected:', typeof window.walletManager.isConnected);
        console.log('  - disconnect:', typeof window.walletManager.disconnect);

    } catch (error) {
        console.error('❌ Failed to create WalletManager instance:', error);
    }
} else {
    console.log('⚠️ WalletManager instance already exists');
}

} // End of duplicate prevention guard
