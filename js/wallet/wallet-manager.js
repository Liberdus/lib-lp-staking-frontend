/**
 * WalletManager - Handles multi-wallet connections and management
 * Supports MetaMask, WalletConnect, and other Web3 wallets
 */
console.log('Starting wallet manager...');
console.log('Ethers available:', typeof window.ethers);

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
        
        // Initialize on construction
        this.init();
    }

    /**
     * Initialize wallet manager
     */
    async init() {
        try {
            // Check for previously connected wallet
            await this.checkPreviousConnection();
            
            // Set up event listeners for wallet changes
            this.setupEventListeners();
            
            this.log('WalletManager initialized');
        } catch (error) {
            this.logError('Failed to initialize WalletManager:', error);
        }
    }

    /**
     * Connect to MetaMask wallet
     */
    async connectMetaMask() {
        if (this.isConnecting) {
            throw new Error('Connection already in progress');
        }

        if (!window.ethereum) {
            throw new Error('MetaMask not installed. Please install MetaMask to continue.');
        }

        this.isConnecting = true;

        try {
            this.log('Connecting to MetaMask...');

            // Check if ethers is available
            if (typeof window.ethers === 'undefined') {
                throw new Error('Ethers.js is not loaded. Please refresh the page and try again.');
            }

            // Request account access
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found. Please unlock MetaMask.');
            }

            // Create provider and signer
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();
            this.address = accounts[0];
            this.walletType = 'metamask';

            // Get network information
            const network = await this.provider.getNetwork();
            this.chainId = network.chainId;

            // Store connection info
            this.storeConnectionInfo();

            // Notify listeners
            this.notifyListeners('connected', {
                address: this.address,
                chainId: this.chainId,
                walletType: this.walletType
            });

            this.log('MetaMask connected successfully:', this.address);
            return true;

        } catch (error) {
            this.logError('MetaMask connection failed:', error);
            throw error;
        } finally {
            this.isConnecting = false;
        }
    }

    /**
     * Connect to WalletConnect
     */
    async connectWalletConnect() {
        if (this.isConnecting) {
            throw new Error('Connection already in progress');
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
     * Get current wallet address
     */
    getAddress() {
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
            const connectionInfo = localStorage.getItem(window.CONFIG.UI.WALLET_STORAGE_KEY);
            if (!connectionInfo) return false;

            const { walletType, address } = JSON.parse(connectionInfo);
            
            if (walletType === 'metamask' && window.ethereum) {
                // Check if MetaMask is still connected
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts && accounts.length > 0 && accounts[0] === address) {
                    await this.connectMetaMask();
                    return true;
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
        
        localStorage.setItem(
            window.CONFIG.UI.WALLET_STORAGE_KEY, 
            JSON.stringify(connectionInfo)
        );
    }

    /**
     * Clear stored connection information
     */
    clearConnectionInfo() {
        localStorage.removeItem(window.CONFIG.UI.WALLET_STORAGE_KEY);
    }

    /**
     * Set up event listeners for wallet changes
     */
    setupEventListeners() {
        if (window.ethereum) {
            // MetaMask event listeners
            const accountsChangedHandler = (accounts) => this.handleAccountsChanged(accounts);
            const chainChangedHandler = (chainId) => this.handleChainChanged(chainId);
            const disconnectHandler = () => this.handleDisconnect();

            window.ethereum.on('accountsChanged', accountsChangedHandler);
            window.ethereum.on('chainChanged', chainChangedHandler);
            window.ethereum.on('disconnect', disconnectHandler);

            // Store references for cleanup
            this.eventListeners.push(
                { target: window.ethereum, event: 'accountsChanged', handler: accountsChangedHandler },
                { target: window.ethereum, event: 'chainChanged', handler: chainChangedHandler },
                { target: window.ethereum, event: 'disconnect', handler: disconnectHandler }
            );
        }
    }

    /**
     * Handle accounts changed event
     */
    handleAccountsChanged(accounts) {
        this.log('Accounts changed:', accounts);

        if (!accounts || accounts.length === 0) {
            // User disconnected
            this.disconnect();
        } else if (accounts[0] !== this.address) {
            // User switched accounts
            this.address = accounts[0];
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
        this.log('Wallet disconnected:', code, reason);
        this.disconnect();
    }

    /**
     * Notify all listeners of events
     */
    notifyListeners(event, data) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                this.logError('Listener callback error:', error);
            }
        });
    }

    /**
     * Cleanup event listeners
     */
    cleanup() {
        this.eventListeners.forEach(({ target, event, handler }) => {
            target.removeListener(event, handler);
        });
        this.eventListeners = [];
        this.listeners.clear();
    }

    /**
     * Logging utility
     */
    log(...args) {
        if (window.CONFIG.DEV.DEBUG_MODE) {
            console.log('[WalletManager]', ...args);
        }
    }

    /**
     * Error logging utility
     */
    logError(...args) {
        console.error('[WalletManager]', ...args);
    }
}

// Create global instance
window.walletManager = new WalletManager();
