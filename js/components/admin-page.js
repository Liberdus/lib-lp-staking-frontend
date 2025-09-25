/**
 * AdminPage Component - Role-based Admin Panel
 * Implements Phase 3, Day 8 requirements for admin panel with access control
 */

class AdminPage {
    constructor() {
        this.isInitialized = false;
        this.isAuthorized = false;
        this.userAddress = null;
        this.adminRole = null;
        this.contractStats = {};
        this.refreshInterval = null;

        // Admin role constant (should match contract)
        this.ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000'; // DEFAULT_ADMIN_ROLE

        // Development mode from centralized config
        this.DEVELOPMENT_MODE = window.DEV_CONFIG?.ADMIN_DEVELOPMENT_MODE ?? true;

        this.init();
    }

    async init() {
        try {
            console.log('🔐 Initializing Admin Panel...');

            // Development mode bypass
            if (this.DEVELOPMENT_MODE) {
                console.log('🚧 DEVELOPMENT MODE: Bypassing access control');
                this.isAuthorized = true;
                this.userAddress = window.DEV_CONFIG?.MOCK_USER_ADDRESS || '0x1234567890123456789012345678901234567890';

                // Use mock contract stats if enabled
                if (window.DEV_CONFIG?.MOCK_CONTRACT_DATA) {
                    this.contractStats = window.DEV_CONFIG.MOCK_STATS || {};
                }

                await this.loadAdminInterface();
                this.startAutoRefresh();
                this.isInitialized = true;
                console.log('✅ Admin Panel initialized (Development Mode)');
                return;
            }

            // Production mode - wait for contract manager and wallet
            console.log('🚀 Production mode: Waiting for contract manager and wallet...');
            await this.waitForSystemReady();

            // Wait for contract manager to be ready
            if (!window.contractManager?.isReady()) {
                console.log('⏳ Waiting for contract manager...');
                await this.waitForContractManager();
            }

            // Check if wallet manager exists and is properly initialized
            if (!window.walletManager) {
                console.log('⚠️ Wallet manager not available, showing connect prompt');
                this.showConnectWalletPrompt();
                return;
            }

            // Check if wallet is connected (with proper error handling)
            let isConnected = false;
            try {
                isConnected = typeof window.walletManager.isConnected === 'function'
                    ? window.walletManager.isConnected()
                    : false;
            } catch (walletError) {
                console.warn('⚠️ Wallet manager error:', walletError.message);
                this.showConnectWalletPrompt();
                return;
            }

            if (!isConnected) {
                this.showConnectWalletPrompt();
                return;
            }

            // Verify admin access
            await this.verifyAdminAccess();

            if (this.isAuthorized) {
                await this.loadAdminInterface();
                this.startAutoRefresh();
            } else {
                this.showUnauthorizedAccess();
            }

            this.isInitialized = true;
            console.log('✅ Admin Panel initialized');

        } catch (error) {
            console.error('❌ Admin Panel initialization failed:', error);
            this.showError('Failed to initialize admin panel', error.message);
        }
    }

    async waitForSystemReady(timeout = 30000) {
        console.log('⏳ Waiting for system components to be ready...');

        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const checkReady = () => {
                const elapsed = Date.now() - startTime;

                // Check if timeout exceeded
                if (elapsed > timeout) {
                    console.warn(`⚠️ System readiness timeout after ${timeout}ms - proceeding with available components`);
                    // Don't reject, just resolve with what we have
                    resolve();
                    return;
                }

                // Check system components (ENHANCED: More flexible requirements)
                const ethersAvailable = !!window.ethers;
                const configAvailable = !!window.CONFIG;
                const contractManagerExists = !!window.contractManager;

                console.log(`🔍 System check (${Math.round(elapsed/1000)}s):`, {
                    ethers: ethersAvailable,
                    config: configAvailable,
                    contractManager: contractManagerExists,
                    contractManagerReady: contractManagerExists ? window.contractManager.isReady() : false
                });

                // ENHANCED: More flexible requirements - proceed if we have basic components
                if (ethersAvailable && configAvailable) {
                    console.log('✅ Basic system components ready - proceeding with initialization');
                    resolve();
                } else {
                    // Show what's missing
                    const missing = [];
                    if (!ethersAvailable) missing.push('ethers');
                    if (!configAvailable) missing.push('config');

                    console.log(`⏳ Still waiting for: ${missing.join(', ')}`);

                    // Continue checking with shorter interval
                    setTimeout(checkReady, 1000);
                }
            };

            checkReady();
        });
    }

    async waitForContractManager(timeout = 30000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const checkReady = () => {
                if (window.contractManager?.isReady()) {
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error('Contract manager timeout'));
                } else {
                    setTimeout(checkReady, 1000);
                }
            };

            checkReady();
        });
    }

    async verifyAdminAccess() {
        try {
            console.log('🔍 Verifying admin access...');

            // Get current user address
            if (window.walletManager?.isConnected()) {
                this.userAddress = await window.walletManager.getAddress();
            } else {
                throw new Error('Wallet not connected');
            }

            console.log('👤 User address:', this.userAddress);

            // Check against authorized admin list first (development/fallback)
            if (window.DEV_CONFIG?.AUTHORIZED_ADMINS) {
                const isAuthorizedAdmin = window.DEV_CONFIG.AUTHORIZED_ADMINS.some(
                    adminAddress => adminAddress.toLowerCase() === this.userAddress.toLowerCase()
                );

                if (isAuthorizedAdmin) {
                    this.isAuthorized = true;
                    console.log('✅ Admin access granted: Address in authorized list');
                    return;
                }
            }

            // Check if user has admin role via contract
            if (window.contractManager?.stakingContract) {
                try {
                    // Try to call hasRole function
                    const hasAdminRole = await window.contractManager.stakingContract.hasRole(
                        this.ADMIN_ROLE,
                        this.userAddress
                    );

                    this.isAuthorized = hasAdminRole;
                    console.log(`🔐 Contract role check: ${hasAdminRole ? 'AUTHORIZED' : 'DENIED'}`);

                    if (this.isAuthorized) return;

                } catch (roleError) {
                    console.warn('⚠️ Role check failed, checking contract owner as fallback:', roleError.message);

                    // Fallback: check if user is contract owner
                    try {
                        const owner = await window.contractManager.stakingContract.owner();
                        this.isAuthorized = owner.toLowerCase() === this.userAddress.toLowerCase();
                        console.log(`🔐 Owner check: ${this.isAuthorized ? 'AUTHORIZED' : 'DENIED'}`);

                        if (this.isAuthorized) return;

                    } catch (ownerError) {
                        console.warn('⚠️ Owner check also failed:', ownerError.message);
                    }
                }
            } else {
                console.warn('⚠️ Staking contract not available for role verification');
            }

            // Final fallback - deny access
            this.isAuthorized = false;
            console.log('❌ Admin access denied: No authorization method succeeded');

        } catch (error) {
            console.error('❌ Admin access verification failed:', error);
            this.isAuthorized = false;
            throw error;
        }
    }

    showConnectWalletPrompt() {
        const container = document.getElementById('admin-content') || document.body;
        container.innerHTML = `
            <div class="admin-connect-prompt">
                <div class="connect-card">
                    <h2>🔐 Admin Panel Access</h2>
                    <p>Please connect your wallet to access the admin panel.</p>
                    <button class="btn btn-primary" onclick="connectWallet()">
                        Connect Wallet
                    </button>
                </div>
            </div>
        `;
    }

    showUnauthorizedAccess() {
        const container = document.getElementById('admin-content') || document.body;
        container.innerHTML = `
            <div class="admin-unauthorized">
                <div class="unauthorized-card">
                    <h2>🚫 Access Denied</h2>
                    <p>You don't have administrator privileges for this contract.</p>
                    <div class="access-details">
                        <p><strong>Your Address:</strong> ${this.userAddress}</p>
                        <p><strong>Required Role:</strong> ADMIN_ROLE or Contract Owner</p>
                    </div>
                    <button class="btn btn-secondary" onclick="connectWallet()">
                        Try Different Wallet
                    </button>
                </div>
            </div>
        `;
    }

    async loadAdminInterface() {
        console.log('🎨 Loading admin interface...');

        // Create admin layout
        this.createAdminLayout();

        // Load contract statistics
        await this.loadContractStats();

        // Load main components
        await this.loadMultiSignPanel();
        await this.loadInfoCard();

        // Setup event listeners
        this.setupEventListeners();

        // Start auto-refresh
        this.startAutoRefresh();
    }

    /**
     * Setup event listeners for admin panel interactions
     */
    setupEventListeners() {
        console.log('🎧 Setting up admin panel event listeners...');

        try {
            // Navigation event listeners
            this.setupNavigationListeners();

            // Wallet connection event listeners
            this.setupWalletListeners();

            // Contract interaction event listeners
            this.setupContractListeners();

            // Modal and form event listeners
            this.setupModalListeners();

            // Refresh and update event listeners
            this.setupRefreshListeners();

            console.log('✅ Admin panel event listeners setup complete');

        } catch (error) {
            console.error('❌ Failed to setup event listeners:', error);
        }
    }

    /**
     * Setup navigation event listeners
     */
    setupNavigationListeners() {
        // Navigation buttons
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const section = button.getAttribute('data-section');
                if (section) {
                    this.navigateToSection(section);
                }
            });
        });

        // Active navigation highlighting
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-btn')) {
                // Remove active class from all nav buttons
                navButtons.forEach(btn => btn.classList.remove('active'));
                // Add active class to clicked button
                e.target.classList.add('active');
            }
        });
    }

    /**
     * Setup wallet connection event listeners
     */
    setupWalletListeners() {
        // Listen for wallet connection events
        window.addEventListener('walletConnected', (event) => {
            console.log('🎉 Wallet connected event received:', event.detail);
            this.handleWalletConnected(event.detail);
        });

        window.addEventListener('walletDisconnected', () => {
            console.log('👋 Wallet disconnected event received');
            this.handleWalletDisconnected();
        });

        // Listen for account changes
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                console.log('🔄 Accounts changed:', accounts);
                this.handleAccountsChanged(accounts);
            });

            window.ethereum.on('chainChanged', (chainId) => {
                console.log('🌐 Chain changed:', chainId);
                this.handleChainChanged(chainId);
            });
        }
    }

    /**
     * Setup contract interaction event listeners
     */
    setupContractListeners() {
        // Listen for contract events
        window.addEventListener('contractReady', () => {
            console.log('📋 Contract ready event received');
            this.handleContractReady();
        });

        window.addEventListener('contractError', (event) => {
            console.log('❌ Contract error event received:', event.detail);
            this.handleContractError(event.detail);
        });

        // Listen for transaction events
        window.addEventListener('transactionStarted', (event) => {
            console.log('🚀 Transaction started:', event.detail);
            this.handleTransactionStarted(event.detail);
        });

        window.addEventListener('transactionCompleted', (event) => {
            console.log('✅ Transaction completed:', event.detail);
            this.handleTransactionCompleted(event.detail);
        });

        window.addEventListener('transactionFailed', (event) => {
            console.log('❌ Transaction failed:', event.detail);
            this.handleTransactionFailed(event.detail);
        });
    }

    /**
     * Setup modal and form event listeners
     */
    setupModalListeners() {
        // Global modal close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });

        // ENHANCED: Global click handler for modal buttons
        document.addEventListener('click', (e) => {
            // Modal close buttons
            if (e.target.classList.contains('modal-close') ||
                e.target.closest('.modal-close')) {
                e.preventDefault();
                this.closeModal();
                return;
            }

            // Modal overlay click (close modal)
            if (e.target.classList.contains('modal-overlay')) {
                e.preventDefault();
                this.closeModal();
                return;
            }

            // Action buttons in modals
            if (e.target.classList.contains('btn') && e.target.closest('.modal-content')) {
                const buttonText = e.target.textContent.trim();
                const form = e.target.closest('form');

                if (buttonText === 'Cancel' || e.target.classList.contains('btn-secondary')) {
                    e.preventDefault();
                    this.closeModal();
                    return;
                }
            }
        });

        // Form validation listeners
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('form-input')) {
                this.validateFormInput(e.target);
            }
        });

        // ENHANCED: Form submission handling
        document.addEventListener('submit', (e) => {
            const form = e.target;

            // Handle admin forms
            if (form.classList.contains('admin-form') || form.closest('.modal-content')) {
                console.log('📝 Form submitted:', form.id);

                // Validate form
                if (!this.validateForm(form)) {
                    e.preventDefault();
                    console.warn('⚠️ Form validation failed');
                    return;
                }

                // Handle specific form types
                switch (form.id) {
                    case 'hourly-rate-form':
                        e.preventDefault();
                        this.submitHourlyRateProposal(e);
                        break;
                    case 'add-pair-form':
                        e.preventDefault();
                        this.submitAddPairProposal(e);
                        break;
                    case 'remove-pair-form':
                        e.preventDefault();
                        this.submitRemovePairProposal(e);
                        break;
                    case 'change-signer-form':
                        e.preventDefault();
                        this.submitChangeSignerProposal(e);
                        break;
                    case 'withdrawal-form':
                        e.preventDefault();
                        this.submitWithdrawalProposal(e);
                        break;
                    default:
                        console.log('📝 Unhandled form submission:', form.id);
                }
            }
        });
    }

    /**
     * Setup refresh and update event listeners
     */
    setupRefreshListeners() {
        // Manual refresh button
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('refresh-btn')) {
                e.preventDefault();
                this.refreshData();
            }
        });

        // Auto-refresh toggle
        document.addEventListener('change', (e) => {
            if (e.target.id === 'auto-refresh-toggle') {
                if (e.target.checked) {
                    this.startAutoRefresh();
                } else {
                    this.stopAutoRefresh();
                }
            }
        });

        // Page visibility change (pause refresh when tab not active)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseAutoRefresh();
            } else {
                this.resumeAutoRefresh();
            }
        });
    }

    /**
     * Event handler methods
     */
    navigateToSection(section) {
        console.log(`🧭 Navigating to section: ${section}`);

        // Update active navigation
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-section') === section) {
                btn.classList.add('active');
            }
        });

        // Load section content
        switch (section) {
            case 'dashboard':
                this.showDashboard();
                break;
            case 'pairs':
                this.showPairsManagement();
                break;
            case 'users':
                this.showUsersManagement();
                break;
            case 'settings':
                this.showSettings();
                break;
            default:
                console.warn(`Unknown section: ${section}`);
                this.showDashboard();
        }
    }

    handleWalletConnected(detail) {
        console.log('🎉 Handling wallet connected:', detail);

        // Update UI to reflect connected state
        const connectButtons = document.querySelectorAll('.connect-wallet-btn');
        connectButtons.forEach(btn => {
            btn.textContent = 'Wallet Connected';
            btn.disabled = true;
            btn.classList.add('connected');
        });

        // Refresh admin data
        this.refreshData();

        // Re-verify admin access
        this.verifyAdminAccess();
    }

    handleWalletDisconnected() {
        console.log('👋 Handling wallet disconnected');

        // Update UI to reflect disconnected state
        const connectButtons = document.querySelectorAll('.connect-wallet-btn');
        connectButtons.forEach(btn => {
            btn.textContent = 'Connect Wallet';
            btn.disabled = false;
            btn.classList.remove('connected');
        });

        // Show connect prompt
        this.showConnectWalletPrompt();
    }

    handleAccountsChanged(accounts) {
        console.log('🔄 Handling accounts changed:', accounts);

        if (accounts.length === 0) {
            // No accounts connected
            this.handleWalletDisconnected();
        } else {
            // Account switched
            const newAddress = accounts[0];
            console.log('🔄 Account switched to:', newAddress);

            // Update wallet connection info
            if (window.walletConnection) {
                window.walletConnection.address = newAddress;
            }

            // Re-verify admin access with new account
            this.verifyAdminAccess();
        }
    }

    handleChainChanged(chainId) {
        console.log('🌐 Handling chain changed:', chainId);

        const expectedChainId = '0x13882'; // Polygon Amoy (80002 in hex)

        if (chainId !== expectedChainId) {
            console.warn('⚠️ Wrong network detected');
            this.showError('Wrong Network', 'Please switch to Polygon Amoy Testnet');
        } else {
            console.log('✅ Correct network detected');
            // Refresh data after network change
            this.refreshData();
        }
    }

    handleContractReady() {
        console.log('📋 Handling contract ready');

        // Refresh contract data
        this.loadContractStats();
        this.refreshData();
    }

    handleContractError(error) {
        console.error('❌ Handling contract error:', error);

        this.showError('Contract Error', error.message || 'Contract interaction failed');
    }

    handleTransactionStarted(detail) {
        console.log('🚀 Handling transaction started:', detail);

        // Show loading indicator
        this.showTransactionStatus('pending', 'Transaction submitted...', detail.hash);
    }

    handleTransactionCompleted(detail) {
        console.log('✅ Handling transaction completed:', detail);

        // Show success message
        this.showTransactionStatus('success', 'Transaction completed!', detail.hash);

        // Refresh data
        setTimeout(() => {
            this.refreshData();
        }, 2000);
    }

    handleTransactionFailed(detail) {
        console.error('❌ Handling transaction failed:', detail);

        // Show error message
        this.showTransactionStatus('error', 'Transaction failed', detail.hash, detail.error);
    }

    validateFormInput(input) {
        const value = input.value.trim();
        const type = input.getAttribute('data-validation');

        let isValid = true;
        let errorMessage = '';

        switch (type) {
            case 'address':
                isValid = /^0x[a-fA-F0-9]{40}$/.test(value);
                errorMessage = 'Please enter a valid Ethereum address';
                break;
            case 'number':
                isValid = !isNaN(value) && parseFloat(value) > 0;
                errorMessage = 'Please enter a valid positive number';
                break;
            case 'required':
                isValid = value.length > 0;
                errorMessage = 'This field is required';
                break;
        }

        // Update input styling
        if (isValid) {
            input.classList.remove('invalid');
            input.classList.add('valid');
        } else {
            input.classList.remove('valid');
            input.classList.add('invalid');
        }

        // Show/hide error message
        const errorElement = input.parentNode.querySelector('.error-message');
        if (errorElement) {
            errorElement.textContent = isValid ? '' : errorMessage;
            errorElement.style.display = isValid ? 'none' : 'block';
        }

        return isValid;
    }

    validateForm(form) {
        const inputs = form.querySelectorAll('.form-input[data-validation]');
        let isFormValid = true;

        inputs.forEach(input => {
            if (!this.validateFormInput(input)) {
                isFormValid = false;
            }
        });

        return isFormValid;
    }

    showTransactionStatus(status, message, hash, error = null) {
        const statusContainer = document.getElementById('transaction-status') || this.createTransactionStatusContainer();

        let statusClass = '';
        let icon = '';

        switch (status) {
            case 'pending':
                statusClass = 'status-pending';
                icon = '⏳';
                break;
            case 'success':
                statusClass = 'status-success';
                icon = '✅';
                break;
            case 'error':
                statusClass = 'status-error';
                icon = '❌';
                break;
        }

        statusContainer.className = `transaction-status ${statusClass}`;
        statusContainer.innerHTML = `
            <div class="status-content">
                <span class="status-icon">${icon}</span>
                <span class="status-message">${message}</span>
                ${hash ? `<a href="https://amoy.polygonscan.com/tx/${hash}" target="_blank" class="tx-link">View Transaction</a>` : ''}
                ${error ? `<div class="error-details">${error}</div>` : ''}
            </div>
            <button class="close-status" onclick="this.parentNode.style.display='none'">×</button>
        `;

        statusContainer.style.display = 'block';

        // Auto-hide success messages after 5 seconds
        if (status === 'success') {
            setTimeout(() => {
                statusContainer.style.display = 'none';
            }, 5000);
        }
    }

    createTransactionStatusContainer() {
        const container = document.createElement('div');
        container.id = 'transaction-status';
        container.className = 'transaction-status';

        // Insert at top of admin content
        const adminContent = document.getElementById('admin-content');
        if (adminContent) {
            adminContent.insertBefore(container, adminContent.firstChild);
        } else {
            document.body.appendChild(container);
        }

        return container;
    }

    pauseAutoRefresh() {
        this.autoRefreshPaused = true;
        console.log('⏸️ Auto-refresh paused (tab not active)');
    }

    resumeAutoRefresh() {
        this.autoRefreshPaused = false;
        console.log('▶️ Auto-refresh resumed (tab active)');

        // Refresh data immediately when tab becomes active
        this.refreshData();
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            console.log('⏹️ Auto-refresh stopped');
        }
    }

    createAdminLayout() {
        const container = document.getElementById('admin-content') || document.body;
        const devModeIndicator = this.DEVELOPMENT_MODE
            ? '<div class="dev-mode-banner">🚧 DEVELOPMENT MODE - Access Control Bypassed</div>'
            : '';

        container.innerHTML = `
            <div class="admin-panel">
                ${devModeIndicator}

                <!-- Container maxWidth="lg" with py: 4 (matching React) -->
                <div class="admin-container">
                    <!-- Typography variant="h3" align="center" gutterBottom sx={{ my: 4 }} -->
                    <h1 class="admin-title">Admin Panel</h1>

                    <!-- Grid container spacing={3} -->
                    <div class="admin-grid">
                        <!-- Grid item xs={12} md={9} - MultiSign Panel -->
                        <div class="admin-grid-main">
                            <div id="multisign-panel">
                                <!-- MultiSign Panel will be loaded here -->
                            </div>
                        </div>

                        <!-- Grid item xs={12} md={3} - New Proposal -->
                        <div class="admin-grid-sidebar">
                            <!-- Typography variant="h5" gutterBottom -->
                            <h2 class="proposal-title">New Proposal</h2>

                            <!-- Stack direction="column" spacing={2} -->
                            <div class="proposal-actions">
                                <!-- Button variant="contained" color="primary" -->
                                <button class="proposal-btn" onclick="adminPage.openModal('hourly-rate')">
                                    Update Hourly Rate
                                </button>
                                <button class="proposal-btn" onclick="adminPage.openModal('add-pair')">
                                    Add Pair
                                </button>
                                <button class="proposal-btn" onclick="adminPage.openModal('remove-pair')">
                                    Remove Pair
                                </button>
                                <button class="proposal-btn" onclick="adminPage.openModal('update-weights')">
                                    Update Pair Weight
                                </button>
                                <button class="proposal-btn" onclick="adminPage.openModal('change-signer')">
                                    Change Signer
                                </button>
                                <button class="proposal-btn" onclick="adminPage.openModal('withdraw-rewards')">
                                    Withdraw Rewards
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Box sx={{ mt: 4 }} - Info Card Section -->
                    <div class="info-card-section">
                        <div id="info-card">
                            <!-- Info Card will be loaded here -->
                        </div>
                    </div>
                </div>

                <div class="admin-footer">
                    <div class="refresh-status">
                        <span id="last-refresh">Last updated: Loading...</span>
                        <button class="btn btn-sm" onclick="adminPage.refreshData()">
                            🔄 Refresh
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async loadMultiSignPanel() {
        console.log('📋 Loading MultiSign Panel...');
        const panelDiv = document.getElementById('multisign-panel');

        try {
            // Load proposals data
            const proposals = await this.loadProposals();

            panelDiv.innerHTML = `
                <div class="multisign-panel">
                    <div class="panel-header">
                        <h2>Multi-Signature Proposals</h2>
                        <div class="panel-controls">
                            <label class="checkbox-label">
                                <input type="checkbox" id="hide-executed" checked>
                                Hide executed transactions
                            </label>
                            <div class="panel-stats">
                                <span class="stat-chip">Total Proposals: ${proposals.length}</span>
                                <span class="stat-chip">Required Approvals: ${this.contractStats.requiredApprovals || 2}</span>
                            </div>
                        </div>
                    </div>

                    <div class="proposals-table">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th></th>
                                    <th>ID</th>
                                    <th>Action Type</th>
                                    <th>Approvals</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="proposals-tbody">
                                ${this.renderProposalsRows(proposals)}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('❌ Failed to load MultiSign Panel:', error);
            panelDiv.innerHTML = `
                <div class="error-panel">
                    <h3>⚠️ Failed to load proposals</h3>
                    <p>${error.message}</p>
                    <button class="btn btn-secondary" onclick="adminPage.loadMultiSignPanel()">
                        🔄 Retry
                    </button>
                </div>
            `;
        }
    }

    async loadInfoCard() {
        console.log('📊 Loading Info Card...');
        const cardDiv = document.getElementById('info-card');

        try {
            // Load contract info
            const contractInfo = await this.loadContractInfo();

            cardDiv.innerHTML = `
                <div class="info-card">
                    <div class="card-header">
                        <h3>Contract Information</h3>
                        <button class="btn btn-sm" onclick="adminPage.refreshContractInfo()">
                            🔄 Refresh
                        </button>
                    </div>

                    <div class="card-content">
                        <div class="info-grid">
                            <div class="info-item">
                                <div class="info-label">💰 Reward Balance</div>
                                <div class="info-value">${contractInfo.rewardBalance} USDC</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">⏰ Hourly Rate</div>
                                <div class="info-value">${contractInfo.hourlyRate} USDC/hour</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">⚖️ Total Weight</div>
                                <div class="info-value">${contractInfo.totalWeight}</div>
                            </div>
                        </div>

                        <div class="pairs-section">
                            <h4>🔗 LP Pairs</h4>
                            <div class="pairs-list">
                                ${this.renderPairsList(contractInfo.pairs)}
                            </div>
                        </div>

                        <div class="signers-section">
                            <h4>👥 Current Signers</h4>
                            <div class="signers-list">
                                ${this.renderSignersList(contractInfo.signers)}
                            </div>
                        </div>
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('❌ Failed to load Info Card:', error);
            cardDiv.innerHTML = `
                <div class="error-panel">
                    <h3>⚠️ Failed to load contract info</h3>
                    <p>${error.message}</p>
                    <button class="btn btn-secondary" onclick="adminPage.loadInfoCard()">
                        🔄 Retry
                    </button>
                </div>
            `;
        }
    }

    async loadProposals() {
        console.log('📋 Loading proposals...');

        try {
            const contractManager = await this.ensureContractReady();

            // Check if governance features are disabled
            if (contractManager.disabledFeatures?.has('getProposals')) {
                console.log('📋 Governance features disabled - contract does not support proposals');
                this.displayNoGovernance();
                return [];
            }

            // Get action counter and required approvals with enhanced error handling
            const actionCounter = await contractManager.retryContractCall(
                () => contractManager.stakingContract.actionCounter().then(result => result.toNumber()),
                3,
                'actionCounter'
            );

            const requiredApprovals = await contractManager.getRequiredApprovals(); // Enhanced with retry logic

            console.log(`📊 Found ${actionCounter} total actions, ${requiredApprovals} approvals required`);

            const proposals = [];

            // Load recent proposals (last 20 or all if less)
            const startId = Math.max(1, actionCounter - 19);

            for (let i = actionCounter; i >= startId; i--) {
                try {
                    const action = await contractManager.getAction(i);

                    // Convert action to proposal format
                    const proposal = {
                        id: i,
                        actionType: this.getActionTypeName(action.actionType),
                        approvals: action.approvals,
                        requiredApprovals: requiredApprovals,
                        executed: action.executed,
                        rejected: action.rejected,
                        expired: action.expired,
                        proposedTime: action.proposedTime,
                        approvedBy: action.approvedBy,
                        details: this.formatActionDetails(action)
                    };

                    proposals.push(proposal);
                } catch (error) {
                    console.warn(`⚠️ Failed to load action ${i}:`, error.message);
                }
            }

            console.log(`✅ Loaded ${proposals.length} proposals`);
            return proposals;

        } catch (error) {
            console.error('❌ Failed to load proposals from contract:', error);

            // Enhanced error handling
            if (error.code === 'CALL_EXCEPTION' || error.message.includes('CALL_EXCEPTION')) {
                console.error('🔍 Contract call failed - governance functions may not be available');
                console.error('🔍 Error details:', {
                    code: error.code,
                    method: error.method,
                    data: error.data,
                    reason: error.reason
                });

                // Display no governance message
                this.displayNoGovernance();
                return [];
            }

            // Fallback to mock data in development mode
            if (this.DEVELOPMENT_MODE) {
                console.log('🔧 Using mock proposals in development mode');
                return this.getMockProposals();
            }

            // Show user-friendly error
            if (window.notificationManager) {
                window.notificationManager.error(
                    'Contract Error',
                    'Failed to load proposals. Please check your connection and try again.'
                );
            }

            return [];
        }
    }

    getMockProposals() {
        return [
            {
                id: 1,
                actionType: 'SET_HOURLY_REWARD_RATE',
                approvals: 1,
                requiredApprovals: 2,
                executed: false,
                rejected: false,
                details: { newHourlyRewardRate: '100' }
            },
            {
                id: 2,
                actionType: 'ADD_PAIR',
                approvals: 2,
                requiredApprovals: 2,
                executed: true,
                rejected: false,
                details: { pairToAdd: '0x1234...5678' }
            }
        ];
    }

    getActionTypeName(actionType) {
        const types = {
            0: 'SET_HOURLY_REWARD_RATE',
            1: 'UPDATE_PAIR_WEIGHTS',
            2: 'ADD_PAIR',
            3: 'REMOVE_PAIR',
            4: 'CHANGE_SIGNER',
            5: 'WITHDRAW_REWARDS'
        };
        return types[actionType] || 'UNKNOWN';
    }

    formatActionDetails(action) {
        const actionType = this.getActionTypeName(action.actionType);

        switch (actionType) {
            case 'SET_HOURLY_REWARD_RATE':
                return {
                    newHourlyRewardRate: ethers.utils.formatEther(action.newHourlyRewardRate)
                };
            case 'UPDATE_PAIR_WEIGHTS':
                return {
                    pairs: action.pairs,
                    weights: action.weights.map(w => ethers.utils.formatEther(w))
                };
            case 'ADD_PAIR':
                return {
                    pairToAdd: action.pairToAdd,
                    pairNameToAdd: action.pairNameToAdd,
                    platformToAdd: action.platformToAdd,
                    weightToAdd: ethers.utils.formatEther(action.weightToAdd)
                };
            case 'REMOVE_PAIR':
                return {
                    pairToRemove: action.pairToRemove
                };
            case 'CHANGE_SIGNER':
                return {
                    // Note: old/new signer info would need to be extracted from pairs array
                    pairs: action.pairs
                };
            case 'WITHDRAW_REWARDS':
                return {
                    recipient: action.recipient,
                    withdrawAmount: ethers.utils.formatEther(action.withdrawAmount)
                };
            default:
                return {};
        }
    }

    async loadContractInfo() {
        console.log('📊 Loading contract info...');

        try {
            // Mock data for now - replace with actual contract calls
            return {
                rewardBalance: '50,000',
                hourlyRate: '100',
                totalWeight: '1000',
                pairs: [
                    { address: '0x1234...5678', name: 'USDC/ETH', weight: 500 },
                    { address: '0x8765...4321', name: 'USDC/MATIC', weight: 500 }
                ],
                signers: [
                    '0x0B046B290C50f3FDf1C61ecE442d42D9D79BD814',
                    '0x742d35Cc6634C0532925a3b8D0C9C0E5C5F0E5E5'
                ]
            };
        } catch (error) {
            console.error('❌ Failed to load contract info:', error);
            throw error;
        }
    }

    renderProposalsRows(proposals) {
        if (!proposals || proposals.length === 0) {
            return '<tr><td colspan="6" class="no-data">No proposals found</td></tr>';
        }

        return proposals.map(proposal => {
            const canExecute = proposal.approvals >= proposal.requiredApprovals && !proposal.executed && !proposal.rejected;
            const statusClass = proposal.executed ? 'executed' : proposal.rejected ? 'rejected' : canExecute ? 'ready' : 'pending';
            const statusText = proposal.executed ? 'Executed' : proposal.rejected ? 'Rejected' : canExecute ? 'Ready' : 'Pending';

            return `
                <tr class="proposal-row ${statusClass}">
                    <td>
                        <button class="expand-btn" onclick="adminPage.toggleProposal(${proposal.id})">
                            ▶
                        </button>
                    </td>
                    <td><span class="proposal-id">${proposal.id}</span></td>
                    <td><span class="action-type">${proposal.actionType}</span></td>
                    <td><span class="approvals">${proposal.approvals} / ${proposal.requiredApprovals}</span></td>
                    <td><span class="status ${statusClass}">${statusText}</span></td>
                    <td>
                        <div class="action-buttons">
                            ${!proposal.executed && !proposal.rejected ? `
                                <button class="btn btn-sm btn-success" onclick="adminPage.approveAction(${proposal.id})" title="Approve">
                                    ✓
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="adminPage.rejectAction(${proposal.id})" title="Reject">
                                    ✗
                                </button>
                                ${canExecute ? `
                                    <button class="btn btn-sm btn-primary" onclick="adminPage.executeAction(${proposal.id})" title="Execute">
                                        ▶
                                    </button>
                                ` : ''}
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderPairsList(pairs) {
        if (!pairs || pairs.length === 0) {
            return '<div class="no-data">No pairs configured</div>';
        }

        return pairs.map(pair => `
            <div class="pair-item">
                <div class="pair-name">${pair.name}</div>
                <div class="pair-address">${this.formatAddress(pair.address)}</div>
                <div class="pair-weight">Weight: ${pair.weight}</div>
            </div>
        `).join('');
    }

    renderSignersList(signers) {
        if (!signers || signers.length === 0) {
            return '<div class="no-data">No signers configured</div>';
        }

        return signers.map(signer => `
            <div class="signer-item">
                <div class="signer-address">${this.formatAddress(signer)}</div>
            </div>
        `).join('');
    }

    async showDashboard() {
        const contentDiv = document.getElementById('admin-section-content');
        
        contentDiv.innerHTML = `
            <div class="dashboard-section">
                <h2>📊 Contract Statistics</h2>
                
                <div class="stats-grid">
                    <div class="info-card">
                        <div class="card-header">
                            <h3>🔗 Active LP Pairs</h3>
                        </div>
                        <div class="card-content">
                            <div class="stat-value" id="active-pairs-count">
                                ${this.contractStats.activePairs || 0}
                            </div>
                            <div class="stat-label">Active Pairs</div>
                        </div>
                    </div>
                    
                    <div class="info-card">
                        <div class="card-header">
                            <h3>💰 Total Value Locked</h3>
                        </div>
                        <div class="card-content">
                            <div class="stat-value" id="total-tvl">
                                $${this.formatNumber(this.contractStats.totalTVL || 0)}
                            </div>
                            <div class="stat-label">USD Value</div>
                        </div>
                    </div>
                    
                    <div class="info-card">
                        <div class="card-header">
                            <h3>👥 Total Stakers</h3>
                        </div>
                        <div class="card-content">
                            <div class="stat-value" id="total-stakers">
                                ${this.contractStats.totalStakers || 0}
                            </div>
                            <div class="stat-label">Unique Users</div>
                        </div>
                    </div>
                    
                    <div class="info-card">
                        <div class="card-header">
                            <h3>🏆 Total Rewards</h3>
                        </div>
                        <div class="card-content">
                            <div class="stat-value" id="total-rewards">
                                ${this.formatNumber(this.contractStats.totalRewards || 0)}
                            </div>
                            <div class="stat-label">LIB Tokens</div>
                        </div>
                    </div>
                </div>
                
                <div class="recent-activity">
                    <h3>📈 Recent Activity</h3>
                    <div class="activity-list" id="recent-activity-list">
                        <div class="activity-item">
                            <span class="activity-time">Loading...</span>
                            <span class="activity-desc">Fetching recent transactions...</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Load real-time data
        await this.loadDashboardData();
    }

    async loadContractStats() {
        try {
            console.log('📊 Loading contract statistics...');

            // Ensure contract manager is ready
            const contractManager = await this.ensureContractReady();

            console.log('📊 Contract manager ready, loading stats...');

            // Initialize stats object
            this.contractStats = {
                activePairs: 0,
                totalPairs: 0,
                totalTVL: 0,
                totalStakers: 0,
                totalRewards: 0,
                rewardToken: null,
                hourlyRewardRate: 0,
                requiredApprovals: 0,
                actionCounter: 0
            };

            // Get basic contract info (ENHANCED with proper error handling)
            try {
                // Validate contract initialization first
                if (!contractManager.stakingContract) {
                    throw new Error('Staking contract not initialized');
                }

                // Test contract functions individually with fallbacks
                const contractCalls = [
                    {
                        name: 'rewardToken',
                        call: () => contractManager.stakingContract.rewardToken(),
                        fallback: 'Contract Error'
                    },
                    {
                        name: 'hourlyRewardRate',
                        call: () => contractManager.stakingContract.hourlyRewardRate(),
                        fallback: '0'
                    },
                    {
                        name: 'requiredApprovals',
                        call: () => contractManager.stakingContract.REQUIRED_APPROVALS(),
                        fallback: 2
                    },
                    {
                        name: 'actionCounter',
                        call: () => contractManager.stakingContract.actionCounter(),
                        fallback: 0
                    }
                ];

                // Execute calls with individual error handling
                for (const contractCall of contractCalls) {
                    try {
                        const result = await contractCall.call();
                        let value = result;

                        // Handle BigInt conversion
                        if (typeof result === 'bigint') {
                            value = Number(result);
                        } else if (result && typeof result.toNumber === 'function') {
                            value = result.toNumber();
                        } else if (result && typeof result.toString === 'function') {
                            value = result.toString();
                        }

                        this.contractStats[contractCall.name] = value;
                        console.log(`📊 ${contractCall.name}:`, value);
                    } catch (callError) {
                        console.warn(`⚠️ ${contractCall.name} failed:`, callError.message);
                        this.contractStats[contractCall.name] = contractCall.fallback;
                    }
                }

            } catch (error) {
                console.warn('⚠️ Could not load basic contract info:', error.message);
                // Set all fallback values
                this.contractStats.rewardToken = 'Contract Error';
                this.contractStats.hourlyRewardRate = '0';
                this.contractStats.requiredApprovals = 2;
                this.contractStats.actionCounter = 0;
            }

            // Get pairs information (with error handling)
            try {
                const allPairs = await contractManager.stakingContract.getPairs();
                this.contractStats.totalPairs = allPairs.length;
                this.contractStats.activePairs = allPairs.filter(pair => pair.isActive).length;
                console.log('📊 Total pairs:', allPairs.length, 'Active:', this.contractStats.activePairs);
            } catch (error) {
                console.warn('⚠️ Could not load pairs info:', error.message);
                this.contractStats.totalPairs = this.contractStats.activePairs;
            }

            // Calculate estimated TVL (placeholder - would need price feeds in real implementation)
            this.contractStats.totalTVL = this.contractStats.activePairs * 10000; // Placeholder

            // Estimate total stakers (placeholder - would need event parsing in real implementation)
            this.contractStats.totalStakers = this.contractStats.activePairs * 25; // Placeholder
            
            // Estimate total rewards (placeholder)
            this.contractStats.totalRewards = this.contractStats.activePairs * 5000; // Placeholder
            
            console.log('✅ Contract stats loaded:', this.contractStats);
            
        } catch (error) {
            console.error('❌ Failed to load contract stats:', error);
            // Set default values
            this.contractStats = {
                activePairs: 0,
                totalPairs: 0,
                totalTVL: 0,
                totalStakers: 0,
                totalRewards: 0
            };
        }
    }

    async loadDashboardData() {
        // Refresh contract stats
        await this.loadContractStats();
        
        // Update dashboard display
        this.updateDashboardDisplay();
        
        // Update last refresh time
        document.getElementById('last-refresh').textContent = 
            `Last updated: ${new Date().toLocaleTimeString()}`;
    }

    updateDashboardDisplay() {
        // Update stat values
        const elements = {
            'active-pairs-count': this.contractStats.activePairs || 0,
            'total-tvl': this.formatNumber(this.contractStats.totalTVL || 0),
            'total-stakers': this.contractStats.totalStakers || 0,
            'total-rewards': this.formatNumber(this.contractStats.totalRewards || 0)
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    // Utility methods
    formatAddress(address) {
        if (!address) return 'Unknown';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    showError(title, message) {
        const container = document.getElementById('admin-section-content') || document.body;
        container.innerHTML = `
            <div class="error-display">
                <h3>❌ ${title}</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="adminPage.init()">
                    Retry
                </button>
            </div>
        `;
    }

    startAutoRefresh() {
        // Clear existing interval if any
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Initialize pause state
        this.autoRefreshPaused = false;

        // Refresh data every 30 seconds
        this.refreshInterval = setInterval(() => {
            // Only refresh if authorized, content exists, and not paused
            if (this.isAuthorized &&
                document.getElementById('admin-section-content') &&
                !this.autoRefreshPaused) {
                this.refreshData();
            }
        }, 30000);

        console.log('🔄 Auto-refresh started (30s interval)');
    }

    async refreshData() {
        console.log('🔄 Refreshing admin data...');
        try {
            await this.loadContractStats();
            this.updateDashboardDisplay();
            
            // Update last refresh time
            const refreshElement = document.getElementById('last-refresh');
            if (refreshElement) {
                refreshElement.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
            }
        } catch (error) {
            console.error('❌ Failed to refresh data:', error);
        }
    }

    // Placeholder methods for other sections (to be implemented)
    async showPairsManagement() {
        document.getElementById('admin-section-content').innerHTML = `
            <div class="section-placeholder">
                <h2>🔗 LP Pairs Management</h2>
                <p>This section will allow administrators to:</p>
                <ul>
                    <li>Add new LP pairs</li>
                    <li>Configure reward rates</li>
                    <li>Enable/disable pairs</li>
                    <li>Monitor pair performance</li>
                </ul>
                <p><em>Implementation coming in next phase...</em></p>
            </div>
        `;
    }

    async showUsersManagement() {
        document.getElementById('admin-section-content').innerHTML = `
            <div class="section-placeholder">
                <h2>👥 Users Management</h2>
                <p>This section will allow administrators to:</p>
                <ul>
                    <li>View all stakers</li>
                    <li>Monitor user activities</li>
                    <li>Handle user support issues</li>
                    <li>Generate user reports</li>
                </ul>
                <p><em>Implementation coming in next phase...</em></p>
            </div>
        `;
    }

    async showSettings() {
        document.getElementById('admin-section-content').innerHTML = `
            <div class="section-placeholder">
                <h2>⚙️ Contract Settings</h2>
                <p>This section will allow administrators to:</p>
                <ul>
                    <li>Update contract parameters</li>
                    <li>Manage admin roles</li>
                    <li>Configure system settings</li>
                    <li>Emergency controls</li>
                </ul>
                <p><em>Implementation coming in next phase...</em></p>
            </div>
        `;
    }

    // Modal and Action Methods
    openModal(modalType) {
        console.log(`🔧 Opening modal: ${modalType}`);

        // Create modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.id = 'modal-overlay';

        let modalContent = '';

        switch (modalType) {
            case 'hourly-rate':
                modalContent = this.createHourlyRateModal();
                break;
            case 'add-pair':
                modalContent = this.createAddPairModal();
                break;
            case 'remove-pair':
                modalContent = this.createRemovePairModal();
                break;
            case 'update-weights':
                modalContent = this.createUpdateWeightsModal();
                break;
            case 'change-signer':
                modalContent = this.createChangeSignerModal();
                break;
            case 'withdraw-rewards':
                modalContent = this.createWithdrawRewardsModal();
                break;
            default:
                console.error('Unknown modal type:', modalType);
                return;
        }

        modalOverlay.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${this.getModalTitle(modalType)}</h3>
                    <button class="modal-close" onclick="adminPage.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    ${modalContent}
                </div>
            </div>
        `;

        document.body.appendChild(modalOverlay);

        // Close modal when clicking overlay
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                this.closeModal();
            }
        });
    }

    closeModal() {
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.remove();
        }
    }

    getModalTitle(modalType) {
        const titles = {
            'hourly-rate': 'Update Hourly Rate',
            'add-pair': 'Add LP Pair',
            'remove-pair': 'Remove LP Pair',
            'update-weights': 'Update Pair Weights',
            'change-signer': 'Change Signer',
            'withdraw-rewards': 'Withdraw Rewards'
        };
        return titles[modalType] || 'Admin Action';
    }

    createHourlyRateModal() {
        return `
            <form onsubmit="adminPage.submitHourlyRate(event)">
                <div class="form-group">
                    <label for="hourly-rate-input">New Hourly Rate (USDC)</label>
                    <input type="number" id="hourly-rate-input" step="0.01" min="0" required>
                    <small>Current rate: ${this.contractStats.hourlyRate || 'Loading...'} USDC/hour</small>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="adminPage.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Create Proposal</button>
                </div>
            </form>
        `;
    }

    createAddPairModal() {
        return `
            <form onsubmit="adminPage.submitAddPair(event)">
                <div class="form-group">
                    <label for="pair-address-input">LP Pair Address</label>
                    <input type="text" id="pair-address-input" placeholder="0x..." required>
                </div>
                <div class="form-group">
                    <label for="pair-weight-input">Weight</label>
                    <input type="number" id="pair-weight-input" min="1" required>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="adminPage.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Create Proposal</button>
                </div>
            </form>
        `;
    }

    createRemovePairModal() {
        return `
            <form onsubmit="adminPage.submitRemovePair(event)">
                <div class="form-group">
                    <label for="remove-pair-select">Select Pair to Remove</label>
                    <select id="remove-pair-select" required>
                        <option value="">Select a pair...</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="adminPage.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-danger">Create Removal Proposal</button>
                </div>
            </form>
        `;
    }

    createUpdateWeightsModal() {
        return `
            <form onsubmit="adminPage.submitUpdateWeights(event)">
                <div class="form-group">
                    <label>Update Pair Weights</label>
                    <div id="weights-inputs">
                        <p>Weight inputs will be loaded dynamically</p>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="adminPage.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Create Proposal</button>
                </div>
            </form>
        `;
    }

    createChangeSignerModal() {
        return `
            <form onsubmit="adminPage.submitChangeSigner(event)">
                <div class="form-group">
                    <label for="old-signer-input">Old Signer Address</label>
                    <input type="text" id="old-signer-input" placeholder="0x..." required>
                </div>
                <div class="form-group">
                    <label for="new-signer-input">New Signer Address</label>
                    <input type="text" id="new-signer-input" placeholder="0x..." required>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="adminPage.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-warning">Create Proposal</button>
                </div>
            </form>
        `;
    }

    createWithdrawRewardsModal() {
        return `
            <form onsubmit="adminPage.submitWithdrawRewards(event)">
                <div class="form-group">
                    <label for="withdraw-amount-input">Amount to Withdraw (USDC)</label>
                    <input type="number" id="withdraw-amount-input" step="0.01" min="0" required>
                    <small>Available balance: ${this.contractStats.rewardBalance || 'Loading...'} USDC</small>
                </div>
                <div class="form-group">
                    <label for="withdraw-to-input">Withdraw to Address</label>
                    <input type="text" id="withdraw-to-input" placeholder="0x..." required>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="adminPage.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-warning">Create Withdrawal Proposal</button>
                </div>
            </form>
        `;
    }

    // Proposal Actions
    async approveAction(proposalId) {
        console.log(`✅ Approving proposal ${proposalId}`);

        try {
            // Show loading notification
            if (window.notificationManager) {
                window.notificationManager.info('Approving Proposal', `Submitting approval for proposal #${proposalId}...`);
            }

            const contractManager = await this.ensureContractReady();
            const result = await contractManager.approveAction(proposalId);

            console.log('✅ Approval transaction completed:', result);

            // Show success notification
            if (window.notificationManager) {
                window.notificationManager.success('Proposal Approved', `Successfully approved proposal #${proposalId}`);
            }

            // Refresh the proposals list
            await this.loadMultiSignPanel();

        } catch (error) {
            console.error('❌ Failed to approve proposal:', error);

            if (window.notificationManager) {
                window.notificationManager.error('Approval Failed', `Failed to approve proposal #${proposalId}: ${error.message}`);
            }
        }
    }

    async rejectAction(proposalId) {
        console.log(`❌ Rejecting proposal ${proposalId}`);

        try {
            // Show loading notification
            if (window.notificationManager) {
                window.notificationManager.info('Rejecting Proposal', `Submitting rejection for proposal #${proposalId}...`);
            }

            const contractManager = await this.ensureContractReady();
            const result = await contractManager.rejectAction(proposalId);

            console.log('✅ Rejection transaction completed:', result);

            // Show success notification
            if (window.notificationManager) {
                window.notificationManager.success('Proposal Rejected', `Successfully rejected proposal #${proposalId}`);
            }

            // Refresh the proposals list
            await this.loadMultiSignPanel();

        } catch (error) {
            console.error('❌ Failed to reject proposal:', error);

            if (window.notificationManager) {
                window.notificationManager.error('Rejection Failed', `Failed to reject proposal #${proposalId}: ${error.message}`);
            }
        }
    }

    async executeAction(proposalId) {
        console.log(`▶ Executing proposal ${proposalId}`);

        try {
            // Show loading notification
            if (window.notificationManager) {
                window.notificationManager.info('Executing Proposal', `Executing proposal #${proposalId}...`);
            }

            const contractManager = await this.ensureContractReady();
            const result = await contractManager.executeAction(proposalId);

            console.log('✅ Execution transaction completed:', result);

            // Show success notification
            if (window.notificationManager) {
                window.notificationManager.success('Proposal Executed', `Successfully executed proposal #${proposalId}`);
            }

            // Refresh the proposals list and contract stats
            await this.loadMultiSignPanel();
            await this.loadContractStats();

        } catch (error) {
            console.error('❌ Failed to execute proposal:', error);

            if (window.notificationManager) {
                window.notificationManager.error('Execution Failed', `Failed to execute proposal #${proposalId}: ${error.message}`);
            }
        }
    }

    toggleProposal(proposalId) {
        console.log(`🔄 Toggling proposal ${proposalId} details`);
        // TODO: Implement expand/collapse functionality
    }

    // Form Submission Methods
    async submitHourlyRate(event) {
        event.preventDefault();
        const rate = document.getElementById('hourly-rate-input').value;
        console.log(`💰 Creating hourly rate proposal: ${rate}`);
        // TODO: Implement contract call
        alert(`Create hourly rate proposal: ${rate} USDC/hour`);
        this.closeModal();
    }

    async submitAddPair(event) {
        event.preventDefault();
        const address = document.getElementById('pair-address-input').value;
        const weight = document.getElementById('pair-weight-input').value;
        console.log(`➕ Creating add pair proposal: ${address}, weight: ${weight}`);
        // TODO: Implement contract call
        alert(`Create add pair proposal: ${address} with weight ${weight}`);
        this.closeModal();
    }

    async submitRemovePair(event) {
        event.preventDefault();
        const pairAddress = document.getElementById('remove-pair-select').value;
        console.log(`➖ Creating remove pair proposal: ${pairAddress}`);
        // TODO: Implement contract call
        alert(`Create remove pair proposal: ${pairAddress}`);
        this.closeModal();
    }

    async submitUpdateWeights(event) {
        event.preventDefault();
        console.log(`⚖️ Creating update weights proposal`);
        // TODO: Implement contract call
        alert(`Create update weights proposal`);
        this.closeModal();
    }

    async submitChangeSigner(event) {
        event.preventDefault();
        const oldSigner = document.getElementById('old-signer-input').value;
        const newSigner = document.getElementById('new-signer-input').value;
        console.log(`🔄 Creating change signer proposal: ${oldSigner} -> ${newSigner}`);
        // TODO: Implement contract call
        alert(`Create change signer proposal: ${oldSigner} -> ${newSigner}`);
        this.closeModal();
    }

    async submitWithdrawRewards(event) {
        event.preventDefault();
        const amount = document.getElementById('withdraw-amount-input').value;
        const toAddress = document.getElementById('withdraw-to-input').value;
        console.log(`💸 Creating withdraw proposal: ${amount} to ${toAddress}`);
        // TODO: Implement contract call
        alert(`Create withdraw proposal: ${amount} USDC to ${toAddress}`);
        this.closeModal();
    }

    // Additional utility methods
    async waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Enhanced error handling
    handleError(error, context = 'Admin Panel') {
        console.error(`❌ ${context} Error:`, error);

        // Show user-friendly error message
        const errorMessage = error.message || 'An unexpected error occurred';
        this.showError(context, errorMessage);

        // Log additional error details for debugging
        if (error.stack) {
            console.error('Error stack:', error.stack);
        }
    }

    // Network status checking
    async checkNetworkStatus() {
        try {
            if (!window.ethereum) {
                throw new Error('MetaMask not available');
            }

            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            const expectedChainId = '0x13882'; // Polygon Amoy

            if (chainId !== expectedChainId) {
                console.warn(`⚠️ Wrong network: ${chainId}, expected: ${expectedChainId}`);
                return false;
            }

            return true;
        } catch (error) {
            console.error('❌ Network status check failed:', error);
            return false;
        }
    }

    // Contract readiness check
    async ensureContractReady() {
        if (!window.contractManager) {
            throw new Error('Contract manager not available');
        }

        if (!window.contractManager.isReady()) {
            console.log('⏳ Waiting for contract manager to be ready...');
            await this.waitForContractManager();
        }

        return window.contractManager;
    }

    // Safe contract call wrapper
    async safeContractCall(contractMethod, ...args) {
        try {
            await this.ensureContractReady();

            const result = await contractMethod(...args);
            return { success: true, data: result };

        } catch (error) {
            console.error('❌ Contract call failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Multi-signature utility methods
    getTimeRemaining(expiryTimestamp) {
        const now = Date.now();
        const expiry = new Date(expiryTimestamp).getTime();
        const remaining = expiry - now;

        if (remaining <= 0) {
            return { expired: true, text: 'Expired' };
        }

        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) {
            return { expired: false, text: `${days}d ${hours}h remaining` };
        } else if (hours > 0) {
            return { expired: false, text: `${hours}h ${minutes}m remaining` };
        } else {
            return { expired: false, text: `${minutes}m remaining` };
        }
    }

    renderSignersList(signers, signatures) {
        if (!signers || signers.length === 0) {
            return '<div class="no-signers">No signers</div>';
        }

        return signers.map(signer => {
            const hasSigned = signatures && signatures.includes(signer);
            return `
                <div class="signer-item ${hasSigned ? 'signed' : 'pending'}">
                    <span class="signer-address">${this.formatAddress(signer)}</span>
                    <span class="signature-status">${hasSigned ? '✓' : '○'}</span>
                </div>
            `;
        }).join('');
    }

    renderDetailedSignatures(signers, signatures) {
        if (!signers || signers.length === 0) {
            return '<div class="no-signers">No signers configured</div>';
        }

        return signers.map(signer => {
            const hasSigned = signatures && signatures.includes(signer);
            const isCurrentUser = signer.toLowerCase() === (this.userAddress || '').toLowerCase();

            return `
                <div class="signature-item ${hasSigned ? 'signed' : 'pending'} ${isCurrentUser ? 'current-user' : ''}">
                    <div class="signer-info">
                        <span class="signer-address">${this.formatAddress(signer)}</span>
                        ${isCurrentUser ? '<span class="user-badge">You</span>' : ''}
                    </div>
                    <div class="signature-status">
                        ${hasSigned ?
                            '<span class="signed-badge">✓ Signed</span>' :
                            '<span class="pending-badge">○ Pending</span>'
                        }
                    </div>
                </div>
            `;
        }).join('');
    }

    renderProposalParameters(type, parameters) {
        if (!parameters) return '<div class="no-parameters">No parameters</div>';

        switch (type.toLowerCase()) {
            case 'hourly-rate':
            case 'update-hourly-rate':
                return `
                    <div class="parameter-item">
                        <strong>New Hourly Rate:</strong>
                        <span class="parameter-value">${parameters.rate} USDC/hour</span>
                    </div>
                `;

            case 'add-pair':
                return `
                    <div class="parameter-item">
                        <strong>Pair Address:</strong>
                        <span class="parameter-value address-display">${parameters.pairAddress}</span>
                    </div>
                    <div class="parameter-item">
                        <strong>Weight:</strong>
                        <span class="parameter-value">${parameters.weight}</span>
                    </div>
                `;

            case 'remove-pair':
                return `
                    <div class="parameter-item">
                        <strong>Pair Address:</strong>
                        <span class="parameter-value address-display">${parameters.pairAddress}</span>
                    </div>
                `;

            case 'update-weights':
            case 'update-pair-weight':
                return `
                    <div class="parameter-item">
                        <strong>Pair Address:</strong>
                        <span class="parameter-value address-display">${parameters.pairAddress}</span>
                    </div>
                    <div class="parameter-item">
                        <strong>New Weight:</strong>
                        <span class="parameter-value">${parameters.newWeight}</span>
                    </div>
                `;

            case 'change-signer':
                return `
                    <div class="parameter-item">
                        <strong>Old Signer:</strong>
                        <span class="parameter-value address-display">${parameters.oldSigner}</span>
                    </div>
                    <div class="parameter-item">
                        <strong>New Signer:</strong>
                        <span class="parameter-value address-display">${parameters.newSigner}</span>
                    </div>
                `;

            case 'withdraw-rewards':
            case 'withdrawal':
                return `
                    <div class="parameter-item">
                        <strong>Amount:</strong>
                        <span class="parameter-value">${parameters.amount} USDC</span>
                    </div>
                    <div class="parameter-item">
                        <strong>To Address:</strong>
                        <span class="parameter-value address-display">${parameters.toAddress}</span>
                    </div>
                `;

            default:
                return Object.entries(parameters).map(([key, value]) => `
                    <div class="parameter-item">
                        <strong>${key}:</strong>
                        <span class="parameter-value">${value}</span>
                    </div>
                `).join('');
        }
    }

    // Multi-signature modal components
    showHourlyRateModal() {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;

        modalContainer.innerHTML = `
            <div class="modal-overlay" onclick="adminPage.closeModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>Update Hourly Rate</h3>
                        <button class="modal-close" onclick="adminPage.closeModal()">×</button>
                    </div>

                    <div class="modal-body">
                        <form id="hourly-rate-form" onsubmit="adminPage.submitHourlyRateProposal(event)">
                            <div class="form-group">
                                <label for="new-rate">New Hourly Rate (USDC)</label>
                                <input type="number" id="new-rate" step="0.01" min="0" required
                                       placeholder="Enter new hourly rate">
                                <small class="form-help">Current rate: ${this.contractStats?.hourlyRate || 'Loading...'} USDC/hour</small>
                            </div>

                            <div class="form-group">
                                <label for="rate-description">Description</label>
                                <textarea id="rate-description" rows="3" required
                                          placeholder="Explain the reason for this rate change..."></textarea>
                            </div>

                            <div class="proposal-info">
                                <div class="info-item">
                                    <span class="info-label">Required Approvals:</span>
                                    <span class="info-value">3 of 4 signers</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Proposal Expiry:</span>
                                    <span class="info-value">7 days from creation</span>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="adminPage.closeModal()">
                            Cancel
                        </button>
                        <button type="submit" form="hourly-rate-form" class="btn btn-primary">
                            Create Proposal
                        </button>
                    </div>
                </div>
            </div>
        `;

        modalContainer.style.display = 'flex';
    }

    showAddPairModal() {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;

        modalContainer.innerHTML = `
            <div class="modal-overlay" onclick="adminPage.closeModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>Add New Pair</h3>
                        <button class="modal-close" onclick="adminPage.closeModal()">×</button>
                    </div>

                    <div class="modal-body">
                        <form id="add-pair-form" onsubmit="adminPage.submitAddPairProposal(event)">
                            <div class="form-group">
                                <label for="pair-address">Pair Contract Address</label>
                                <input type="text" id="pair-address" required
                                       placeholder="0x..." pattern="^0x[a-fA-F0-9]{40}$">
                                <small class="form-help">Enter the LP token contract address</small>
                            </div>

                            <div class="form-group">
                                <label for="pair-weight">Initial Weight</label>
                                <input type="number" id="pair-weight" step="1" min="1" required
                                       placeholder="Enter weight (e.g., 100)">
                                <small class="form-help">Higher weight = more rewards allocation</small>
                            </div>

                            <div class="form-group">
                                <label for="pair-description">Description</label>
                                <textarea id="pair-description" rows="3" required
                                          placeholder="Describe this pair and why it should be added..."></textarea>
                            </div>

                            <div class="proposal-info">
                                <div class="info-item">
                                    <span class="info-label">Required Approvals:</span>
                                    <span class="info-value">3 of 4 signers</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Proposal Expiry:</span>
                                    <span class="info-value">7 days from creation</span>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="adminPage.closeModal()">
                            Cancel
                        </button>
                        <button type="submit" form="add-pair-form" class="btn btn-primary">
                            Create Proposal
                        </button>
                    </div>
                </div>
            </div>
        `;

        modalContainer.style.display = 'flex';
    }

    showRemovePairModal() {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;

        modalContainer.innerHTML = `
            <div class="modal-overlay" onclick="adminPage.closeModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>Remove Pair</h3>
                        <button class="modal-close" onclick="adminPage.closeModal()">×</button>
                    </div>

                    <div class="modal-body">
                        <form id="remove-pair-form" onsubmit="adminPage.submitRemovePairProposal(event)">
                            <div class="form-group">
                                <label for="remove-pair-select">Select Pair to Remove</label>
                                <select id="remove-pair-select" required>
                                    <option value="">Choose a pair...</option>
                                    ${this.renderPairOptions()}
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="remove-description">Reason for Removal</label>
                                <textarea id="remove-description" rows="3" required
                                          placeholder="Explain why this pair should be removed..."></textarea>
                            </div>

                            <div class="warning-box">
                                <div class="warning-icon">⚠️</div>
                                <div class="warning-text">
                                    <strong>Warning:</strong> Removing a pair will stop all reward distributions for that pair.
                                    Existing stakers will need to unstake before removal.
                                </div>
                            </div>

                            <div class="proposal-info">
                                <div class="info-item">
                                    <span class="info-label">Required Approvals:</span>
                                    <span class="info-value">3 of 4 signers</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Proposal Expiry:</span>
                                    <span class="info-value">7 days from creation</span>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="adminPage.closeModal()">
                            Cancel
                        </button>
                        <button type="submit" form="remove-pair-form" class="btn btn-danger">
                            Create Removal Proposal
                        </button>
                    </div>
                </div>
            </div>
        `;

        modalContainer.style.display = 'flex';
    }

    showChangeSignerModal() {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;

        modalContainer.innerHTML = `
            <div class="modal-overlay" onclick="adminPage.closeModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>Change Signer</h3>
                        <button class="modal-close" onclick="adminPage.closeModal()">×</button>
                    </div>

                    <div class="modal-body">
                        <form id="change-signer-form" onsubmit="adminPage.submitChangeSignerProposal(event)">
                            <div class="form-group">
                                <label for="old-signer">Current Signer to Replace</label>
                                <select id="old-signer" required>
                                    <option value="">Choose current signer...</option>
                                    ${this.renderSignerOptions()}
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="new-signer">New Signer Address</label>
                                <input type="text" id="new-signer" required
                                       placeholder="0x..." pattern="^0x[a-fA-F0-9]{40}$">
                                <small class="form-help">Enter the new signer's wallet address</small>
                            </div>

                            <div class="form-group">
                                <label for="signer-description">Reason for Change</label>
                                <textarea id="signer-description" rows="3" required
                                          placeholder="Explain why this signer change is necessary..."></textarea>
                            </div>

                            <div class="warning-box">
                                <div class="warning-icon">⚠️</div>
                                <div class="warning-text">
                                    <strong>Important:</strong> The new signer will have full admin privileges.
                                    Ensure the address is correct and trusted.
                                </div>
                            </div>

                            <div class="proposal-info">
                                <div class="info-item">
                                    <span class="info-label">Required Approvals:</span>
                                    <span class="info-value">3 of 4 signers</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Proposal Expiry:</span>
                                    <span class="info-value">7 days from creation</span>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="adminPage.closeModal()">
                            Cancel
                        </button>
                        <button type="submit" form="change-signer-form" class="btn btn-warning">
                            Create Signer Change Proposal
                        </button>
                    </div>
                </div>
            </div>
        `;

        modalContainer.style.display = 'flex';
    }

    showWithdrawalModal() {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;

        modalContainer.innerHTML = `
            <div class="modal-overlay" onclick="adminPage.closeModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>Withdraw Rewards</h3>
                        <button class="modal-close" onclick="adminPage.closeModal()">×</button>
                    </div>

                    <div class="modal-body">
                        <form id="withdrawal-form" onsubmit="adminPage.submitWithdrawalProposal(event)">
                            <div class="form-group">
                                <label for="withdrawal-amount">Amount (USDC)</label>
                                <input type="number" id="withdrawal-amount" step="0.01" min="0" required
                                       placeholder="Enter amount to withdraw">
                                <small class="form-help">Available balance: ${this.contractStats?.rewardBalance || 'Loading...'} USDC</small>
                            </div>

                            <div class="form-group">
                                <label for="withdrawal-address">Recipient Address</label>
                                <input type="text" id="withdrawal-address" required
                                       placeholder="0x..." pattern="^0x[a-fA-F0-9]{40}$">
                                <small class="form-help">Address to receive the withdrawn funds</small>
                            </div>

                            <div class="form-group">
                                <label for="withdrawal-description">Purpose</label>
                                <textarea id="withdrawal-description" rows="3" required
                                          placeholder="Explain the purpose of this withdrawal..."></textarea>
                            </div>

                            <div class="warning-box">
                                <div class="warning-icon">💰</div>
                                <div class="warning-text">
                                    <strong>Note:</strong> Withdrawn funds will reduce the available reward pool.
                                    Ensure sufficient balance remains for ongoing rewards.
                                </div>
                            </div>

                            <div class="proposal-info">
                                <div class="info-item">
                                    <span class="info-label">Required Approvals:</span>
                                    <span class="info-value">3 of 4 signers</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Proposal Expiry:</span>
                                    <span class="info-value">7 days from creation</span>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="adminPage.closeModal()">
                            Cancel
                        </button>
                        <button type="submit" form="withdrawal-form" class="btn btn-primary">
                            Create Withdrawal Proposal
                        </button>
                    </div>
                </div>
            </div>
        `;

        modalContainer.style.display = 'flex';
    }

    closeModal() {
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) {
            modalContainer.style.display = 'none';
            modalContainer.innerHTML = '';
        }
    }

    // Proposal submission methods
    async submitHourlyRateProposal(event) {
        event.preventDefault();

        const rate = document.getElementById('new-rate').value;
        const description = document.getElementById('rate-description').value;

        try {
            if (window.notificationManager) {
                window.notificationManager.info('Creating proposal...', 'Submitting hourly rate change proposal');
            }

            // Call contract method to create proposal
            const contractManager = await this.ensureContractReady();
            const result = await contractManager.proposeSetHourlyRewardRate(rate);

            if (result.success) {
                this.closeModal();
                if (window.notificationManager) {
                    window.notificationManager.success('Proposal Created', 'Hourly rate change proposal submitted successfully');
                }
                await this.refreshData();
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Failed to create hourly rate proposal:', error);
            if (window.notificationManager) {
                window.notificationManager.error('Proposal Failed', error.message);
            }
        }
    }

    async submitAddPairProposal(event) {
        event.preventDefault();

        const pairAddress = document.getElementById('pair-address').value;
        const weight = document.getElementById('pair-weight').value;
        const pairName = document.getElementById('pair-name').value || 'Unknown Pair';
        const platform = document.getElementById('pair-platform').value || 'Unknown Platform';

        try {
            if (window.notificationManager) {
                window.notificationManager.info('Creating Proposal', 'Submitting add pair proposal...');
            }

            const contractManager = await this.ensureContractReady();
            const result = await contractManager.proposeAddPair(pairAddress, pairName, platform, weight);

            if (result.success) {
                this.closeModal();
                if (window.notificationManager) {
                    window.notificationManager.success('Proposal Created', 'Add pair proposal submitted successfully');
                }
                await this.refreshData();
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Failed to create add pair proposal:', error);
            if (window.notificationManager) {
                window.notificationManager.error('Proposal Failed', error.message);
            }
        }
    }

    async submitRemovePairProposal(event) {
        event.preventDefault();

        const pairAddress = document.getElementById('remove-pair-select').value;
        const description = document.getElementById('remove-description').value;

        try {
            if (window.notificationManager) {
                window.notificationManager.info('Creating proposal...', 'Submitting remove pair proposal');
            }

            const result = await window.contractManager.proposeRemovePair(pairAddress, description);

            if (result.success) {
                this.closeModal();
                if (window.notificationManager) {
                    window.notificationManager.success('Proposal Created', 'Remove pair proposal submitted successfully');
                }
                await this.refreshData();
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Failed to create remove pair proposal:', error);
            if (window.notificationManager) {
                window.notificationManager.error('Proposal Failed', error.message);
            }
        }
    }

    async submitChangeSignerProposal(event) {
        event.preventDefault();

        const oldSigner = document.getElementById('old-signer').value;
        const newSigner = document.getElementById('new-signer').value;
        const description = document.getElementById('signer-description').value;

        try {
            if (window.notificationManager) {
                window.notificationManager.info('Creating proposal...', 'Submitting signer change proposal');
            }

            const result = await window.contractManager.proposeChangeSigner(oldSigner, newSigner, description);

            if (result.success) {
                this.closeModal();
                if (window.notificationManager) {
                    window.notificationManager.success('Proposal Created', 'Signer change proposal submitted successfully');
                }
                await this.refreshData();
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Failed to create signer change proposal:', error);
            if (window.notificationManager) {
                window.notificationManager.error('Proposal Failed', error.message);
            }
        }
    }

    async submitWithdrawalProposal(event) {
        event.preventDefault();

        const amount = document.getElementById('withdrawal-amount').value;
        const toAddress = document.getElementById('withdrawal-address').value;
        const description = document.getElementById('withdrawal-description').value;

        try {
            if (window.notificationManager) {
                window.notificationManager.info('Creating proposal...', 'Submitting withdrawal proposal');
            }

            const result = await window.contractManager.proposeWithdrawal(amount, toAddress, description);

            if (result.success) {
                this.closeModal();
                if (window.notificationManager) {
                    window.notificationManager.success('Proposal Created', 'Withdrawal proposal submitted successfully');
                }
                await this.refreshData();
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Failed to create withdrawal proposal:', error);
            if (window.notificationManager) {
                window.notificationManager.error('Proposal Failed', error.message);
            }
        }
    }

    // Utility methods for modals
    renderPairOptions() {
        if (!this.contractStats?.pairs || this.contractStats.pairs.length === 0) {
            return '<option value="">No pairs available</option>';
        }

        return this.contractStats.pairs.map(pair => `
            <option value="${pair.address}" data-weight="${pair.weight}">
                ${pair.name || this.formatAddress(pair.address)} (Weight: ${pair.weight})
            </option>
        `).join('');
    }

    renderSignerOptions() {
        if (!this.contractStats?.signers || this.contractStats.signers.length === 0) {
            return '<option value="">No signers available</option>';
        }

        return this.contractStats.signers.map(signer => `
            <option value="${signer}">
                ${this.formatAddress(signer)}
            </option>
        `).join('');
    }

    // Proposal action methods
    async approveAction(proposalId) {
        try {
            if (window.notificationManager) {
                window.notificationManager.info('Approving proposal...', `Submitting approval for proposal #${proposalId}`);
            }

            const result = await window.contractManager.approveProposal(proposalId);

            if (result.success) {
                if (window.notificationManager) {
                    window.notificationManager.success('Proposal Approved', `Successfully approved proposal #${proposalId}`);
                }
                await this.refreshData();
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Failed to approve proposal:', error);
            if (window.notificationManager) {
                window.notificationManager.error('Approval Failed', error.message);
            }
        }
    }

    async rejectAction(proposalId) {
        try {
            if (window.notificationManager) {
                window.notificationManager.info('Rejecting proposal...', `Submitting rejection for proposal #${proposalId}`);
            }

            const result = await window.contractManager.rejectProposal(proposalId);

            if (result.success) {
                if (window.notificationManager) {
                    window.notificationManager.success('Proposal Rejected', `Successfully rejected proposal #${proposalId}`);
                }
                await this.refreshData();
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Failed to reject proposal:', error);
            if (window.notificationManager) {
                window.notificationManager.error('Rejection Failed', error.message);
            }
        }
    }

    async executeAction(proposalId) {
        try {
            if (window.notificationManager) {
                window.notificationManager.info('Executing proposal...', `Executing proposal #${proposalId}`);
            }

            const result = await window.contractManager.executeProposal(proposalId);

            if (result.success) {
                if (window.notificationManager) {
                    window.notificationManager.success('Proposal Executed', `Successfully executed proposal #${proposalId}`);
                }
                await this.refreshData();
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Failed to execute proposal:', error);
            if (window.notificationManager) {
                window.notificationManager.error('Execution Failed', error.message);
            }
        }
    }

    async cancelAction(proposalId) {
        try {
            if (window.notificationManager) {
                window.notificationManager.info('Cancelling proposal...', `Cancelling proposal #${proposalId}`);
            }

            const result = await window.contractManager.cancelProposal(proposalId);

            if (result.success) {
                if (window.notificationManager) {
                    window.notificationManager.success('Proposal Cancelled', `Successfully cancelled proposal #${proposalId}`);
                }
                await this.refreshData();
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Failed to cancel proposal:', error);
            if (window.notificationManager) {
                window.notificationManager.error('Cancellation Failed', error.message);
            }
        }
    }

    toggleProposal(proposalId) {
        const detailsRow = document.getElementById(`details-${proposalId}`);
        const toggleBtn = document.querySelector(`[onclick="adminPage.toggleProposal('${proposalId}')"] .toggle-icon, [onclick="adminPage.toggleProposal(${proposalId})"]`);

        if (detailsRow) {
            const isVisible = detailsRow.style.display !== 'none';
            detailsRow.style.display = isVisible ? 'none' : 'table-row';

            if (toggleBtn) {
                toggleBtn.textContent = isVisible ? '▶' : '▼';
            }
        }
    }

    // Cleanup
    destroy() {
        // Clear intervals
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }

        // Remove event listeners
        if (window.ethereum) {
            try {
                window.ethereum.removeAllListeners('accountsChanged');
                window.ethereum.removeAllListeners('chainChanged');
            } catch (error) {
                console.warn('⚠️ Error removing ethereum listeners:', error);
            }
        }

        // Remove custom event listeners
        window.removeEventListener('walletConnected', this.handleWalletConnected);
        window.removeEventListener('walletDisconnected', this.handleWalletDisconnected);
        window.removeEventListener('contractReady', this.handleContractReady);
        window.removeEventListener('contractError', this.handleContractError);

        // Clear references
        this.isInitialized = false;
        this.isAuthorized = false;
        this.contractStats = {};

        console.log('🧹 Admin Panel destroyed');
    }

    /**
     * Display message when governance features are not available
     */
    displayNoGovernance() {
        const governanceSection = document.querySelector('.governance-section');
        if (governanceSection) {
            governanceSection.innerHTML = `
                <div class="no-governance-message" style="text-align: center; padding: 2rem; background: var(--card-bg); border-radius: 8px; border: 1px solid var(--border-color);">
                    <h3 style="color: var(--text-primary); margin-bottom: 1rem;">🏛️ Governance Features</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">Governance features are not available for this contract.</p>
                    <div style="text-align: left; max-width: 400px; margin: 0 auto;">
                        <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">This may be because:</p>
                        <ul style="color: var(--text-secondary); padding-left: 1.5rem;">
                            <li>The contract doesn't implement multi-signature governance</li>
                            <li>Governance functions are not yet deployed</li>
                            <li>You don't have the required permissions</li>
                            <li>Network connectivity issues</li>
                        </ul>
                    </div>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 1rem;">
                        Basic staking functions should still work normally.
                    </p>
                </div>
            `;
        }
    }

    /**
     * Format numbers for display
     */
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(2) + 'K';
        }
        return num.toFixed(2);
    }
}

// Export for global access
window.AdminPage = AdminPage;
