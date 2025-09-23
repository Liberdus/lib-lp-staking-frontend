

class MasterInitializer {
    constructor() {
        this.loadedScripts = new Set();
        this.components = new Map();
        this.initializationPromise = null;
        this.isReady = false;

        console.log('🔧 MasterInitializer created (waiting for manual init)');
        // Note: init() will be called manually from DOMContentLoaded event
    }

    async init() {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this.initializeSystem();
        return this.initializationPromise;
    }

    async initializeSystem() {
        try {
            await this.loadConfiguration();
            await this.loadCoreUtilities();
            await this.loadWalletSystems();
            await this.loadUIComponents();
            await this.initializeComponents();
            this.setupGlobalHandlers();
            this.isReady = true;
            
            // Dispatch ready event
            document.dispatchEvent(new CustomEvent('systemReady', {
                detail: { components: Array.from(this.components.keys()) }
            }));

        } catch (error) {
            console.error('❌ System initialization failed:', error);
            this.handleInitializationError(error);
        }
    }

    async loadConfiguration() {
        console.log('⚙️ Loading application configuration...');

        // Load SES-safe handler first
        await this.loadScript('js/utils/ses-safe-handler.js');

        // Load main configuration
        await this.loadScript('js/config/app-config.js');

        // Verify configuration loaded
        if (!window.CONFIG) {
            throw new Error('Failed to load application configuration');
        }

        console.log('✅ Configuration loaded successfully');
    }

    async loadCoreUtilities() {
        const coreScripts = [
            'js/core/theme-manager-new.js',
            'js/core/notification-manager-new.js'
        ];

        for (const script of coreScripts) {
            await this.loadScript(script);
        }
    }

    async loadWalletSystems() {
        const walletScripts = [
            'js/wallet/wallet-manager.js',
            'js/contracts/contract-manager.js'
        ];

        for (const script of walletScripts) {
            await this.loadScript(script);
        }
    }

    async loadUIComponents() {
        // Load CSS for wallet popup
        await this.loadCSS('css/wallet-popup.css');

        const uiScripts = [
            'js/components/wallet-popup.js',
            'js/components/home-page.js',
            'js/components/staking-modal-new.js'
        ];

        for (const script of uiScripts) {
            await this.loadScript(script);
        }
    }

    async initializeComponents() {
        console.log('🔧 Initializing components...');

        // Initialize theme manager
        if (window.ThemeManagerNew) {
            window.themeManager = new window.ThemeManagerNew();
            this.components.set('themeManager', window.themeManager);
            console.log('✅ Theme Manager initialized');
        }

        // Initialize notification manager
        if (window.NotificationManagerNew) {
            window.notificationManager = new window.NotificationManagerNew();
            this.components.set('notificationManager', window.notificationManager);
            console.log('✅ Notification Manager initialized');
        }

        // Initialize wallet manager (from theme-manager-new.js)
        if (window.WalletManagerNew) {
            window.walletManager = new window.WalletManagerNew();
            this.components.set('walletManager', window.walletManager);
            console.log('✅ Wallet Manager (New) initialized');
        }

        // Also try the main wallet manager if available
        if (window.WalletManager && !window.walletManager) {
            window.walletManager = new window.WalletManager();
            this.components.set('walletManager', window.walletManager);
            console.log('✅ Wallet Manager (Main) initialized');
        }

        // Initialize contract manager with read-only provider
        if (window.ContractManager) {
            window.contractManager = new window.ContractManager();
            this.components.set('contractManager', window.contractManager);
            console.log('✅ Contract Manager created');

            // Initialize with read-only provider for data fetching
            try {
                console.log('🔄 Initializing ContractManager with read-only provider...');
                await window.contractManager.initializeReadOnly();
                console.log('✅ ContractManager initialized with read-only provider');

                // Dispatch event for components waiting for contract manager
                document.dispatchEvent(new CustomEvent('contractManagerReady', {
                    detail: { contractManager: window.contractManager }
                }));
            } catch (error) {
                console.error('❌ Failed to initialize ContractManager with read-only provider:', error);
            }
        }

        // Initialize home page with contract manager awareness
        if (window.HomePage) {
            window.homePage = new window.HomePage();
            this.components.set('homePage', window.homePage);
            console.log('✅ Home Page initialized');
        }

        // Initialize staking modal
        if (window.StakingModalNew) {
            window.stakingModal = new window.StakingModalNew();
            this.components.set('stakingModal', window.stakingModal);
            console.log('✅ Staking Modal initialized');
        }

        // Ensure wallet connection is properly set up
        this.setupWalletIntegration();
    }

    setupWalletIntegration() {
        // Ensure MetaMask detection works
        if (typeof window.ethereum !== 'undefined') {
            console.log('✅ MetaMask detected');

            // Add wallet detection to global scope for tests
            window.isMetaMaskAvailable = true;

            // Setup account change listeners
            if (window.ethereum.on) {
                window.ethereum.on('accountsChanged', (accounts) => {
                    console.log('Accounts changed:', accounts);
                    if (window.walletManager) {
                        if (accounts.length === 0) {
                            window.walletManager.disconnect?.();
                        } else {
                            window.walletManager.account = accounts[0];
                            window.walletManager.updateUI?.();
                        }
                    }
                });

                window.ethereum.on('chainChanged', (chainId) => {
                    console.log('Chain changed:', chainId);
                    if (window.notificationManager) {
                        window.notificationManager.info('Network changed. Please refresh if needed.');
                    }
                });
            }
        } else {
            console.log('❌ MetaMask not detected');
            window.isMetaMaskAvailable = false;

            // For testing purposes, create a mock ethereum object
            if (window.location.href.includes('test') || window.location.href.includes('localhost')) {
                console.log('🧪 Creating mock MetaMask for testing...');
                window.ethereum = {
                    isMetaMask: true,
                    request: async (params) => {
                        if (params.method === 'eth_requestAccounts') {
                            return ['0x1234567890123456789012345678901234567890'];
                        } else if (params.method === 'eth_accounts') {
                            return ['0x1234567890123456789012345678901234567890'];
                        }
                        return [];
                    },
                    on: (event, callback) => {
                        console.log(`Mock MetaMask: Registered listener for ${event}`);
                    }
                };
                window.isMetaMaskAvailable = true;
                console.log('✅ Mock MetaMask created for testing');
            }
        }

        // Ensure connect button is properly set up
        const connectBtn = document.getElementById('connect-wallet-btn');
        if (connectBtn && window.walletManager) {
            // Remove any existing listeners
            connectBtn.replaceWith(connectBtn.cloneNode(true));
            const newConnectBtn = document.getElementById('connect-wallet-btn');

            newConnectBtn.addEventListener('click', async (e) => {
                console.log('Connect wallet button clicked');

                // Check if wallet is connected
                const isConnected = window.walletManager.isWalletConnected ?
                                  window.walletManager.isWalletConnected() :
                                  window.walletManager.isConnected ? window.walletManager.isConnected() : false;

                if (isConnected) {
                    // Show wallet popup for connected wallet
                    if (window.walletPopup) {
                        window.walletPopup.show(newConnectBtn);
                    } else {
                        console.warn('Wallet popup not available');
                    }
                } else {
                    // Connect wallet
                    try {
                        if (window.walletManager.connect) {
                            await window.walletManager.connect();
                        } else if (window.walletManager.toggleConnection) {
                            await window.walletManager.toggleConnection();
                        }
                    } catch (error) {
                        console.error('Failed to connect wallet:', error);
                    }
                }
            });

            console.log('✅ Connect button event listener attached');
        }
    }

    setupGlobalHandlers() {
        // Global error handler with SES lockdown protection
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);

            // Handle SES lockdown errors gracefully
            if (event.error && event.error.message && event.error.message.includes('SES')) {
                console.warn('SES lockdown detected, continuing with limited functionality');
                return true; // Prevent default error handling
            }

            if (window.notificationManager) {
                window.notificationManager.error('An unexpected error occurred');
            }
        });

        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            if (window.notificationManager) {
                window.notificationManager.error('An unexpected error occurred');
            }
        });

        // Wallet account change handler
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                if (window.walletManager) {
                    if (accounts.length === 0) {
                        window.walletManager.disconnect();
                    } else {
                        window.walletManager.account = accounts[0];
                        window.walletManager.updateUI();
                    }
                }
            });

            window.ethereum.on('chainChanged', (chainId) => {
                console.log('Chain changed:', chainId);
                if (window.notificationManager) {
                    window.notificationManager.info('Network changed. Please refresh if needed.');
                }
            });
        }

        // Set up wallet connection event listeners for contract manager initialization
        this.setupContractManagerIntegration();
    }

    /**
     * Set up contract manager integration with wallet events
     */
    setupContractManagerIntegration() {
        // Listen for wallet connection events
        document.addEventListener('walletConnected', (event) => {
            console.log('🔗 Wallet connected event received:', event.detail);
            this.handleWalletConnection(event.detail);
        });

        document.addEventListener('walletDisconnected', (event) => {
            console.log('🔌 Wallet disconnected event received');
            this.handleWalletDisconnection();
        });
    }

    /**
     * Handle wallet connection and initialize contract manager
     */
    async handleWalletConnection(walletDetails) {
        try {
            console.log('🔄 Handling wallet connection and initializing contracts...');

            if (window.contractManager && window.walletManager) {
                const provider = window.walletManager.provider;
                const signer = window.walletManager.signer;

                if (provider && signer) {
                    console.log('🔗 Upgrading ContractManager to wallet mode...');

                    if (window.contractManager.isReady()) {
                        // Already initialized in read-only mode, upgrade to wallet mode
                        await window.contractManager.upgradeToWalletMode(provider, signer);
                        console.log('✅ ContractManager upgraded to wallet mode');
                    } else {
                        // Initialize with wallet provider
                        await window.contractManager.initialize(provider, signer);
                        console.log('✅ ContractManager initialized with wallet');
                    }

                    // Dispatch event for components waiting for contract manager
                    document.dispatchEvent(new CustomEvent('contractManagerWalletReady', {
                        detail: { contractManager: window.contractManager }
                    }));
                } else {
                    console.warn('⚠️ Provider or signer not available from wallet manager');
                }
            }
        } catch (error) {
            console.error('❌ Failed to initialize contract manager:', error);

            // Dispatch error event
            document.dispatchEvent(new CustomEvent('contractManagerError', {
                detail: { error: error.message }
            }));
        }
    }

    /**
     * Handle wallet disconnection
     */
    handleWalletDisconnection() {
        try {
            console.log('🔌 Handling wallet disconnection...');

            if (window.contractManager) {
                // Reset contract manager state
                window.contractManager.cleanup();
                console.log('✅ ContractManager cleaned up');
            }

            // Dispatch event for components
            document.dispatchEvent(new CustomEvent('contractManagerDisconnected'));
        } catch (error) {
            console.error('❌ Error during wallet disconnection:', error);
        }
    }

    async loadScript(src) {
        if (this.loadedScripts.has(src)) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;

            script.onload = () => {
                this.loadedScripts.add(src);
                console.log(`✅ Loaded: ${src}`);
                resolve();
            };

            script.onerror = (error) => {
                console.error(`❌ Failed to load: ${src}`, error);
                reject(new Error(`Failed to load script: ${src}`));
            };

            document.head.appendChild(script);
        });
    }

    async loadCSS(href) {
        if (this.loadedScripts.has(href)) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;

            link.onload = () => {
                this.loadedScripts.add(href);
                console.log(`✅ Loaded CSS: ${href}`);
                resolve();
            };

            link.onerror = (error) => {
                console.error(`❌ Failed to load CSS: ${href}`, error);
                reject(new Error(`Failed to load CSS: ${href}`));
            };

            document.head.appendChild(link);
        });
    }

    handleInitializationError(error) {
        const errorContainer = document.getElementById('alert-container');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div style="
                    background: #f8d7da;
                    color: #721c24;
                    padding: 16px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                    border: 1px solid #f5c6cb;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                ">
                    <span class="material-icons">error</span>
                    <div style="flex: 1;">
                        <strong>System Initialization Failed</strong><br>
                        ${error.message || 'An unknown error occurred'}
                    </div>
                    <button onclick="window.masterInitializer.retryInitialization()" style="
                        background: #721c24;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    ">
                        <span class="material-icons" style="font-size: 16px;">refresh</span>
                        Retry
                    </button>
                </div>
            `;
        }
    }

    // Public API
    getComponent(name) {
        return this.components.get(name);
    }

    isSystemReady() {
        return this.isReady;
    }

    getLoadedComponents() {
        return Array.from(this.components.keys());
    }

    // Retry initialization without full page reload
    async retryInitialization() {
        console.log('🔄 Retrying system initialization...');

        // Clear error state
        const errorContainer = document.getElementById('alert-container');
        if (errorContainer) {
            errorContainer.innerHTML = '';
        }

        // Reset initialization state
        this.isReady = false;
        this.initializationPromise = null;

        // Retry initialization
        try {
            await this.init();
            console.log('✅ System initialization retry successful');
        } catch (error) {
            console.error('❌ System initialization retry failed:', error);
            this.handleInitializationError(error);
        }
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM loaded, starting system initialization...');
    window.masterInitializer = new MasterInitializer();

    try {
        await window.masterInitializer.init();
        console.log('✅ System initialization completed successfully');
    } catch (error) {
        console.error('❌ System initialization failed:', error);
        window.masterInitializer.handleInitializationError(error);
    }
});

// Export for global access
window.MasterInitializer = MasterInitializer;

// Provide backward compatibility
window.SystemInitializerNew = MasterInitializer;
