/**
 * Main Application Class
 * Initializes and coordinates all application components
 */
class App {
    constructor() {
        this.isInitialized = false;
        this.components = new Map();
        this.eventListeners = [];
        
        this.init();
    }

    /**
     * Initialize application
     */
    async init() {
        try {
            this.log('Initializing LP Staking Platform...');
            
            // Show loading screen
            this.showLoadingScreen();
            
            // Initialize core systems
            await this.initializeCore();
            
            // Set up global event listeners
            this.setupGlobalEventListeners();
            
            // Initialize theme
            this.initializeTheme();
            
            // Set up routes
            this.setupRoutes();
            
            // Initialize wallet connection check
            await this.initializeWallet();
            
            // Initialize network management
            this.initializeNetwork();
            
            // Hide loading screen
            setTimeout(() => {
                this.hideLoadingScreen();
            }, window.CONFIG.UI.LOADING_DELAY);
            
            this.isInitialized = true;
            this.log('Application initialized successfully');
            
        } catch (error) {
            this.logError('Failed to initialize application:', error);
            this.showInitializationError(error);
        }
    }

    /**
     * Initialize core systems
     */
    async initializeCore() {
        // Validate configuration
        if (!window.CONFIG) {
            throw new Error('Configuration not loaded');
        }
        
        // Initialize state management
        if (!window.appState) {
            throw new Error('State manager not initialized');
        }
        
        // Initialize router
        if (!window.router) {
            throw new Error('Router not initialized');
        }
        
        // Initialize notification manager
        if (!window.notificationManager) {
            throw new Error('Notification manager not initialized');
        }
        
        this.log('Core systems initialized');
    }

    /**
     * Set up global event listeners
     */
    setupGlobalEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            this.addEventListener(themeToggle, 'click', () => {
                this.toggleTheme();
            });
        }
        
        // Connect wallet button
        const connectWalletBtn = document.getElementById('connect-wallet-btn');
        if (connectWalletBtn) {
            this.addEventListener(connectWalletBtn, 'click', () => {
                this.handleWalletConnect();
            });
        }
        
        // Network warning buttons
        const switchNetworkBtn = document.getElementById('switch-network-btn');
        if (switchNetworkBtn) {
            this.addEventListener(switchNetworkBtn, 'click', () => {
                this.handleNetworkSwitch();
            });
        }
        
        const dismissWarningBtn = document.getElementById('dismiss-warning-btn');
        if (dismissWarningBtn) {
            this.addEventListener(dismissWarningBtn, 'click', () => {
                this.dismissNetworkWarning();
            });
        }
        
        // Global error handling
        window.addEventListener('error', (event) => {
            this.handleGlobalError(event.error);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.handleGlobalError(event.reason);
        });
        
        this.log('Global event listeners set up');
    }

    /**
     * Initialize theme system
     */
    initializeTheme() {
        // Get saved theme or default
        const savedTheme = localStorage.getItem(window.CONFIG.UI.THEME_STORAGE_KEY) || 'light';
        this.setTheme(savedTheme);
        
        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.addEventListener(mediaQuery, 'change', (e) => {
            if (window.appState.getState('ui.theme') === 'auto') {
                this.updateThemeDisplay();
            }
        });
        
        this.log('Theme system initialized');
    }

    /**
     * Set up application routes
     */
    setupRoutes() {
        // Home page
        window.router.register('/', HomePage, {
            title: 'LP Staking Platform - Home'
        });
        
        // Admin page
        window.router.register('/admin', AdminPage, {
            title: 'LP Staking Platform - Admin',
            requiresAuth: true,
            requiresAdmin: true
        });
        
        this.log('Routes registered');
    }

    /**
     * Initialize wallet connection
     */
    async initializeWallet() {
        try {
            // Check for previous connection
            if (window.walletManager) {
                await window.walletManager.checkPreviousConnection();

                // Update UI based on current connection state
                if (window.walletManager.isConnected()) {
                    const walletData = {
                        address: window.walletManager.getAddress(),
                        walletType: window.walletManager.getWalletType(),
                        chainId: window.walletManager.getChainId()
                    };
                    this.updateWalletUI(walletData);
                    this.updateMainContent(walletData);
                } else {
                    this.updateWalletUI(null);
                    this.updateMainContent(null);
                }

                // Subscribe to wallet events
                window.walletManager.subscribe((event, data) => {
                    this.handleWalletEvent(event, data);
                });
            }
        } catch (error) {
            this.logError('Wallet initialization error:', error);
        }
    }

    /**
     * Initialize network management
     */
    initializeNetwork() {
        if (window.networkManager) {
            // Subscribe to network events
            window.networkManager.subscribe((event, data) => {
                this.handleNetworkEvent(event, data);
            });
            
            // Initial network check
            window.networkManager.updateNetworkWarning();
        }
    }

    /**
     * Handle wallet events
     */
    handleWalletEvent(event, data) {
        switch (event) {
            case 'connected':
                this.updateWalletUI(data);
                this.updateMainContent(data); // Add main content update
                window.notificationManager.success(
                    'Wallet Connected',
                    `Connected to ${data.address.slice(0, 6)}...${data.address.slice(-4)}`
                );
                break;

            case 'disconnected':
                this.updateWalletUI(null);
                this.updateMainContent(null); // Add main content update
                window.notificationManager.info('Wallet Disconnected', 'Your wallet has been disconnected');
                break;

            case 'accountChanged':
                this.updateWalletUI(data);
                this.updateMainContent(data); // Add main content update
                window.notificationManager.info('Account Changed', 'Wallet account has been changed');
                break;

            case 'chainChanged':
                window.notificationManager.info('Network Changed', 'Network has been changed');
                break;
        }
    }

    /**
     * Handle network events
     */
    handleNetworkEvent(event, data) {
        switch (event) {
            case 'networkChanged':
                if (!data.isCorrect) {
                    window.notificationManager.warning(
                        'Wrong Network',
                        'Please switch to the correct network'
                    );
                }
                break;
        }
    }

    /**
     * Update wallet UI
     */
    updateWalletUI(walletData) {
        const connectBtn = document.getElementById('connect-wallet-btn');
        if (!connectBtn) return;
        
        if (walletData) {
            // Connected state
            connectBtn.innerHTML = `
                <span class="wallet-icon">👛</span>
                <span class="wallet-text">${walletData.address.slice(0, 6)}...${walletData.address.slice(-4)}</span>
            `;
            connectBtn.classList.add('connected');
        } else {
            // Disconnected state
            connectBtn.innerHTML = `
                <span class="wallet-icon">👛</span>
                <span class="wallet-text">Connect Wallet</span>
            `;
            connectBtn.classList.remove('connected');
        }
    }

    /**
     * Update main content based on wallet connection state
     */
    updateMainContent(walletData) {
        const appContent = document.getElementById('app-content');
        if (!appContent) {
            console.error('app-content container not found');
            return;
        }

        if (walletData && walletData.address) {
            // Connected state - show staking interface
            this.showStakingInterface(walletData);
        } else {
            // Disconnected state - show welcome message
            this.showWelcomeMessage();
        }
    }

    /**
     * Show welcome message for disconnected users
     */
    showWelcomeMessage() {
        const appContent = document.getElementById('app-content');
        if (!appContent) return;

        appContent.innerHTML = `
            <div class="container">
                <div class="welcome-message">
                    <h1>Welcome to LP Staking Platform</h1>
                    <p>Connect your wallet to start earning rewards on your liquidity provider tokens.</p>

                    <div class="features-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem; margin: 3rem 0;">
                        <div class="feature-card">
                            <div class="feature-icon">💰</div>
                            <h3>Earn Rewards</h3>
                            <p>Stake your LP tokens and earn rewards automatically</p>
                        </div>
                        <div class="feature-card">
                            <div class="feature-icon">🔒</div>
                            <h3>Secure Staking</h3>
                            <p>Multi-signature governance ensures platform security</p>
                        </div>
                        <div class="feature-card">
                            <div class="feature-icon">📊</div>
                            <h3>Real-time APR</h3>
                            <p>Track your earnings with live APR calculations</p>
                        </div>
                    </div>

                    <div class="cta-section" style="text-align: center; margin-top: 2rem;">
                        <button onclick="window.app.handleWalletConnect()" class="btn btn-primary btn-large">
                            Connect Wallet to Get Started
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Show staking interface for connected users
     */
    showStakingInterface(walletData) {
        const appContent = document.getElementById('app-content');
        if (!appContent) return;

        appContent.innerHTML = `
            <div class="container">
                <div class="staking-dashboard">
                    <div class="dashboard-header">
                        <h1>LP Staking Dashboard</h1>
                        <div class="wallet-info">
                            <span class="wallet-label">Connected:</span>
                            <span class="wallet-address">${walletData.address.slice(0, 6)}...${walletData.address.slice(-4)}</span>
                            <span class="wallet-type">(${walletData.walletType || 'MetaMask'})</span>
                        </div>
                    </div>

                    <div class="dashboard-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin: 2rem 0;">
                        <div class="stat-card card">
                            <div class="card-body">
                                <h3>Your Staked Amount</h3>
                                <div class="stat-value">$0.00</div>
                                <div class="stat-label">LP Tokens Staked</div>
                            </div>
                        </div>
                        <div class="stat-card card">
                            <div class="card-body">
                                <h3>Pending Rewards</h3>
                                <div class="stat-value">0.00</div>
                                <div class="stat-label">Reward Tokens</div>
                            </div>
                        </div>
                        <div class="stat-card card">
                            <div class="card-body">
                                <h3>Current APR</h3>
                                <div class="stat-value">0.00%</div>
                                <div class="stat-label">Annual Percentage Rate</div>
                            </div>
                        </div>
                    </div>

                    <div class="staking-actions" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; margin: 2rem 0;">
                        <div class="action-card card">
                            <div class="card-header">
                                <h3>Stake LP Tokens</h3>
                            </div>
                            <div class="card-body">
                                <p>Stake your LP tokens to start earning rewards.</p>
                                <button class="btn btn-primary btn-full" onclick="window.notificationManager.info('Coming Soon', 'Staking functionality will be implemented in Day 4-7')">
                                    Stake Tokens
                                </button>
                            </div>
                        </div>

                        <div class="action-card card">
                            <div class="card-header">
                                <h3>Claim Rewards</h3>
                            </div>
                            <div class="card-body">
                                <p>Claim your accumulated staking rewards.</p>
                                <button class="btn btn-success btn-full" onclick="window.notificationManager.info('Coming Soon', 'Rewards claiming will be implemented in Day 4-7')">
                                    Claim Rewards
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="staking-pairs">
                        <h2>Available Staking Pairs</h2>
                        <div class="pairs-placeholder card">
                            <div class="card-body text-center">
                                <h3>Loading Staking Pairs...</h3>
                                <p>Staking pairs will be loaded from the smart contract in Day 2-3.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Handle wallet connect button click
     */
    async handleWalletConnect() {
        if (!window.walletManager) return;

        try {
            if (window.walletManager.isConnected()) {
                // Show disconnect option or wallet info
                this.showWalletMenu();
            } else {
                // Show wallet selection modal
                this.showWalletSelectionModal();
            }
        } catch (error) {
            window.ErrorHandler.handleWalletError(error);
        }
    }

    /**
     * Handle network switch
     */
    async handleNetworkSwitch() {
        if (!window.networkManager) return;
        
        try {
            await window.networkManager.switchToDefaultNetwork();
            window.notificationManager.success('Network Switched', 'Successfully switched to the correct network');
        } catch (error) {
            window.ErrorHandler.handleNetworkError(error);
        }
    }

    /**
     * Dismiss network warning
     */
    dismissNetworkWarning() {
        const warning = document.getElementById('network-warning');
        if (warning) {
            warning.style.display = 'none';
        }
    }

    /**
     * Show wallet selection modal
     */
    showWalletSelectionModal() {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;

        const modalHTML = `
            <div class="modal-backdrop" id="wallet-modal-backdrop">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">Connect Wallet</h2>
                        <button class="modal-close" id="close-wallet-modal">×</button>
                    </div>
                    <div class="modal-body">
                        <p class="text-secondary mb-6">Choose your preferred wallet to connect to the LP Staking Platform.</p>

                        <div class="wallet-options">
                            <button class="wallet-option" id="connect-metamask">
                                <div class="wallet-icon">🦊</div>
                                <div class="wallet-info">
                                    <h3>MetaMask</h3>
                                    <p>Connect using browser extension</p>
                                </div>
                                <div class="wallet-arrow">→</div>
                            </button>

                            <button class="wallet-option" id="connect-walletconnect">
                                <div class="wallet-icon">📱</div>
                                <div class="wallet-info">
                                    <h3>WalletConnect</h3>
                                    <p>Connect using mobile wallet</p>
                                </div>
                                <div class="wallet-arrow">→</div>
                            </button>
                        </div>

                        <div class="wallet-help">
                            <p class="text-sm text-tertiary">
                                Don't have a wallet?
                                <a href="https://metamask.io" target="_blank" rel="noopener">Get MetaMask</a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modalContainer.innerHTML = modalHTML;
        modalContainer.style.display = 'block';

        // Add event listeners
        const closeBtn = document.getElementById('close-wallet-modal');
        const backdrop = document.getElementById('wallet-modal-backdrop');
        const metamaskBtn = document.getElementById('connect-metamask');
        const walletconnectBtn = document.getElementById('connect-walletconnect');

        const closeModal = () => {
            modalContainer.style.display = 'none';
            modalContainer.innerHTML = '';
        };

        closeBtn?.addEventListener('click', closeModal);
        backdrop?.addEventListener('click', (e) => {
            if (e.target === backdrop) closeModal();
        });

        metamaskBtn?.addEventListener('click', async () => {
            closeModal();
            try {
                await window.walletManager.connectMetaMask();
            } catch (error) {
                window.ErrorHandler.handleWalletError(error);
            }
        });

        walletconnectBtn?.addEventListener('click', async () => {
            closeModal();
            try {
                await window.walletManager.connectWalletConnect();
            } catch (error) {
                window.ErrorHandler.handleWalletError(error);
            }
        });
    }

    /**
     * Show wallet menu for connected users
     */
    showWalletMenu() {
        const walletData = {
            address: window.walletManager.getAddress(),
            walletType: window.walletManager.getWalletType(),
            chainId: window.walletManager.getChainId()
        };

        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;

        const modalHTML = `
            <div class="modal-backdrop" id="wallet-menu-backdrop">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">Wallet Info</h2>
                        <button class="modal-close" id="close-wallet-menu">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="wallet-info-card">
                            <div class="wallet-type">
                                <span class="wallet-icon">${walletData.walletType === 'metamask' ? '🦊' : '📱'}</span>
                                <span class="wallet-name">${walletData.walletType === 'metamask' ? 'MetaMask' : 'WalletConnect'}</span>
                            </div>

                            <div class="wallet-address">
                                <label>Address:</label>
                                <div class="address-display">
                                    <span class="address">${window.Formatter?.formatAddress(walletData.address) || walletData.address}</span>
                                    <button class="btn btn-small btn-ghost copy-address" data-address="${walletData.address}">
                                        📋 Copy
                                    </button>
                                </div>
                            </div>

                            <div class="wallet-network">
                                <label>Network:</label>
                                <span class="network-name">${window.networkManager?.getCurrentNetworkInfo()?.name || 'Unknown'}</span>
                            </div>
                        </div>

                        <div class="wallet-actions">
                            <button class="btn btn-error btn-full" id="disconnect-wallet">
                                Disconnect Wallet
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modalContainer.innerHTML = modalHTML;
        modalContainer.style.display = 'block';

        // Add event listeners
        const closeBtn = document.getElementById('close-wallet-menu');
        const backdrop = document.getElementById('wallet-menu-backdrop');
        const disconnectBtn = document.getElementById('disconnect-wallet');
        const copyBtn = document.querySelector('.copy-address');

        const closeModal = () => {
            modalContainer.style.display = 'none';
            modalContainer.innerHTML = '';
        };

        closeBtn?.addEventListener('click', closeModal);
        backdrop?.addEventListener('click', (e) => {
            if (e.target === backdrop) closeModal();
        });

        disconnectBtn?.addEventListener('click', async () => {
            closeModal();
            try {
                await window.walletManager.disconnect();
            } catch (error) {
                window.ErrorHandler.handleWalletError(error);
            }
        });

        copyBtn?.addEventListener('click', async (e) => {
            const address = e.target.getAttribute('data-address');
            try {
                await navigator.clipboard.writeText(address);
                window.notificationManager?.success('Copied!', 'Address copied to clipboard');
            } catch (error) {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = address;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                window.notificationManager?.success('Copied!', 'Address copied to clipboard');
            }
        });
    }

    /**
     * Toggle theme
     */
    toggleTheme() {
        const currentTheme = window.appState.getState('ui.theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    /**
     * Set theme
     */
    setTheme(theme) {
        window.appState.setState('ui.theme', theme);
        this.updateThemeDisplay();
        
        // Update theme toggle button
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('.theme-icon');
            if (icon) {
                icon.textContent = theme === 'light' ? '🌙' : '☀️';
            }
        }
    }

    /**
     * Update theme display
     */
    updateThemeDisplay() {
        const theme = window.appState.getState('ui.theme');
        document.documentElement.setAttribute('data-theme', theme);
    }

    /**
     * Show loading screen
     */
    showLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }
    }

    /**
     * Hide loading screen
     */
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 300);
        }
    }

    /**
     * Show initialization error
     */
    showInitializationError(error) {
        this.hideLoadingScreen();
        
        const appContent = document.getElementById('app-content');
        if (appContent) {
            appContent.innerHTML = `
                <div class="container">
                    <div class="card" style="max-width: 500px; margin: 2rem auto;">
                        <div class="card-body text-center">
                            <h2>Initialization Error</h2>
                            <p>Failed to initialize the application. Please refresh the page and try again.</p>
                            <p class="text-sm text-secondary">${error.message}</p>
                            <button onclick="window.location.reload()" class="btn btn-primary">
                                Refresh Page
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Handle global errors
     */
    handleGlobalError(error) {
        this.logError('Global error:', error);
        
        if (window.notificationManager) {
            window.notificationManager.error(
                'Application Error',
                'An unexpected error occurred. Please refresh the page if the problem persists.'
            );
        }
    }

    /**
     * Add event listener with cleanup tracking
     */
    addEventListener(element, event, handler, options = {}) {
        element.addEventListener(event, handler, options);
        
        this.eventListeners.push({
            element,
            event,
            handler,
            options
        });
    }

    /**
     * Cleanup application
     */
    destroy() {
        // Clean up event listeners
        this.eventListeners.forEach(({ element, event, handler, options }) => {
            element.removeEventListener(event, handler, options);
        });
        this.eventListeners = [];
        
        // Destroy components
        this.components.forEach(component => {
            if (component && typeof component.destroy === 'function') {
                component.destroy();
            }
        });
        this.components.clear();
        
        this.log('Application destroyed');
    }

    /**
     * Logging utility
     */
    log(...args) {
        if (window.CONFIG.DEV.DEBUG_MODE) {
            console.log('[App]', ...args);
        }
    }

    /**
     * Error logging utility
     */
    logError(...args) {
        console.error('[App]', ...args);
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
