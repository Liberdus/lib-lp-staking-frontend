/**
 * HomePage Component
 * Main landing page showing staking pairs and user portfolio
 */
class HomePage extends BaseComponent {
    constructor() {
        super('#app-content');
        this.stakingPairs = [];
        this.userStakes = [];
        this.isLoading = false;
    }

    /**
     * Render home page content
     */
    async render() {
        const isConnected = this.getState('wallet.isConnected');
        const walletAddress = this.getState('wallet.address');
        
        return `
            <div class="container">
                ${this.renderHeader()}
                ${isConnected ? this.renderConnectedContent() : this.renderWelcomeContent()}
            </div>
        `;
    }

    /**
     * Render page header
     */
    renderHeader() {
        return `
            <div class="page-header">
                <h1>LP Staking Platform</h1>
                <p class="text-lg text-secondary">
                    Earn rewards by staking your liquidity provider tokens
                </p>
            </div>
        `;
    }

    /**
     * Render welcome content for non-connected users
     */
    renderWelcomeContent() {
        return `
            <div class="welcome-section">
                <div class="card">
                    <div class="card-body text-center">
                        <h2>Welcome to LP Staking</h2>
                        <p>Connect your wallet to start earning rewards on your liquidity provider tokens.</p>
                        
                        <div class="features-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem; margin: 2rem 0;">
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
                        
                        <button id="connect-wallet-home" class="btn btn-primary btn-large">
                            <span class="wallet-icon">👛</span>
                            Connect Wallet to Get Started
                        </button>
                    </div>
                </div>
                
                ${this.renderInfoSection()}
            </div>
        `;
    }

    /**
     * Render connected user content
     */
    renderConnectedContent() {
        return `
            <div class="connected-content">
                ${this.renderUserStats()}
                ${this.renderStakingPairs()}
            </div>
        `;
    }

    /**
     * Render user statistics
     */
    renderUserStats() {
        const totalStaked = this.getState('staking.totalStaked') || '0';
        const totalRewards = this.getState('staking.totalRewards') || '0';
        
        return `
            <div class="user-stats">
                <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                    <div class="stat-card card">
                        <div class="card-body">
                            <h3 class="stat-title">Total Staked</h3>
                            <div class="stat-value">${window.Formatter?.formatTokenAmount(totalStaked) || '0'}</div>
                            <div class="stat-label">LP Tokens</div>
                        </div>
                    </div>
                    <div class="stat-card card">
                        <div class="card-body">
                            <h3 class="stat-title">Total Rewards</h3>
                            <div class="stat-value">${window.Formatter?.formatTokenAmount(totalRewards) || '0'}</div>
                            <div class="stat-label">LIB Tokens</div>
                        </div>
                    </div>
                    <div class="stat-card card">
                        <div class="card-body">
                            <h3 class="stat-title">Active Stakes</h3>
                            <div class="stat-value">${this.userStakes.length}</div>
                            <div class="stat-label">Positions</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render staking pairs table
     */
    renderStakingPairs() {
        if (this.isLoading) {
            return this.renderLoadingState();
        }
        
        if (this.stakingPairs.length === 0) {
            return this.renderEmptyState();
        }
        
        return `
            <div class="staking-pairs">
                <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2>Available Staking Pairs</h2>
                    <button id="refresh-data" class="btn btn-secondary">
                        <span>🔄</span>
                        Refresh
                    </button>
                </div>
                
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Pair</th>
                                <th>APR</th>
                                <th>TVL</th>
                                <th>Your Stake</th>
                                <th>Pending Rewards</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.stakingPairs.map(pair => this.renderPairRow(pair)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Render individual pair row
     */
    renderPairRow(pair) {
        const userStake = this.userStakes.find(stake => stake.pairId === pair.id);
        const stakedAmount = userStake ? userStake.amount : '0';
        const pendingRewards = userStake ? userStake.pendingRewards : '0';
        
        return `
            <tr>
                <td>
                    <div class="pair-info">
                        <div class="pair-name">${pair.name}</div>
                        <div class="pair-address text-sm text-secondary">
                            ${window.Formatter?.formatAddress(pair.lpToken) || pair.lpToken}
                        </div>
                    </div>
                </td>
                <td>
                    <div class="apr-display">
                        <span class="apr-value">${window.Formatter?.formatPercentage(pair.apr) || '0%'}</span>
                    </div>
                </td>
                <td>
                    <div class="tvl-display">
                        ${window.Formatter?.formatUSD(pair.tvl) || '$0.00'}
                    </div>
                </td>
                <td>
                    <div class="stake-amount">
                        ${window.Formatter?.formatTokenAmount(stakedAmount) || '0'}
                    </div>
                </td>
                <td>
                    <div class="pending-rewards">
                        ${window.Formatter?.formatTokenAmount(pendingRewards) || '0'}
                    </div>
                </td>
                <td>
                    <div class="pair-actions">
                        <button 
                            class="btn btn-primary btn-small stake-btn" 
                            data-pair-id="${pair.id}"
                        >
                            Stake
                        </button>
                        ${userStake ? `
                            <button 
                                class="btn btn-secondary btn-small unstake-btn" 
                                data-pair-id="${pair.id}"
                            >
                                Unstake
                            </button>
                            <button 
                                class="btn btn-success btn-small claim-btn" 
                                data-pair-id="${pair.id}"
                            >
                                Claim
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Render loading state
     */
    renderLoadingState() {
        return `
            <div class="loading-state">
                <div class="card">
                    <div class="card-body text-center">
                        <div class="loading-spinner"></div>
                        <p>Loading staking pairs...</p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render empty state
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="card">
                    <div class="card-body text-center">
                        <h3>No Staking Pairs Available</h3>
                        <p>There are currently no staking pairs available. Please check back later.</p>
                        <button id="refresh-data" class="btn btn-primary">
                            Refresh Data
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render info section
     */
    renderInfoSection() {
        return `
            <div class="info-section" style="margin-top: 3rem;">
                <div class="card">
                    <div class="card-header">
                        <h3>How It Works</h3>
                    </div>
                    <div class="card-body">
                        <div class="steps-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem;">
                            <div class="step">
                                <div class="step-number">1</div>
                                <h4>Provide Liquidity</h4>
                                <p>Add liquidity to supported DEX pairs to receive LP tokens</p>
                            </div>
                            <div class="step">
                                <div class="step-number">2</div>
                                <h4>Stake LP Tokens</h4>
                                <p>Stake your LP tokens in our secure smart contract</p>
                            </div>
                            <div class="step">
                                <div class="step-number">3</div>
                                <h4>Earn Rewards</h4>
                                <p>Automatically earn rewards that you can claim anytime</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Connect wallet button
        const connectBtn = this.$('#connect-wallet-home');
        if (connectBtn) {
            this.addEventListener(connectBtn, 'click', () => {
                this.handleWalletConnect();
            });
        }

        // Refresh data button
        const refreshBtn = this.$('#refresh-data');
        if (refreshBtn) {
            this.addEventListener(refreshBtn, 'click', () => {
                this.refreshData();
            });
        }

        // Stake buttons
        this.$$('.stake-btn').forEach(btn => {
            this.addEventListener(btn, 'click', (e) => {
                const pairId = e.target.getAttribute('data-pair-id');
                this.handleStake(pairId);
            });
        });

        // Unstake buttons
        this.$$('.unstake-btn').forEach(btn => {
            this.addEventListener(btn, 'click', (e) => {
                const pairId = e.target.getAttribute('data-pair-id');
                this.handleUnstake(pairId);
            });
        });

        // Claim buttons
        this.$$('.claim-btn').forEach(btn => {
            this.addEventListener(btn, 'click', (e) => {
                const pairId = e.target.getAttribute('data-pair-id');
                this.handleClaim(pairId);
            });
        });
    }

    /**
     * Set up state subscriptions
     */
    setupStateSubscriptions() {
        // Subscribe to wallet state changes
        this.subscribeToState('wallet', () => {
            this.update();
        });

        // Subscribe to staking data changes
        this.subscribeToState('staking', () => {
            this.update();
        });
    }

    /**
     * Handle wallet connect
     */
    async handleWalletConnect() {
        try {
            await window.walletManager?.connectMetaMask();
        } catch (error) {
            window.ErrorHandler?.handleWalletError(error);
        }
    }

    /**
     * Handle stake action
     */
    handleStake(pairId) {
        // This will be implemented with the staking modal
        console.log('Stake pair:', pairId);
        window.notificationManager?.info('Coming Soon', 'Staking functionality will be implemented in Day 4');
    }

    /**
     * Handle unstake action
     */
    handleUnstake(pairId) {
        // This will be implemented with the staking modal
        console.log('Unstake pair:', pairId);
        window.notificationManager?.info('Coming Soon', 'Unstaking functionality will be implemented in Day 4');
    }

    /**
     * Handle claim action
     */
    handleClaim(pairId) {
        // This will be implemented with the staking modal
        console.log('Claim rewards for pair:', pairId);
        window.notificationManager?.info('Coming Soon', 'Claim functionality will be implemented in Day 4');
    }

    /**
     * Refresh data
     */
    async refreshData() {
        this.isLoading = true;
        this.update();

        try {
            // This will be implemented with contract integration
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate loading
            
            // Mock data for now
            this.stakingPairs = [
                {
                    id: '1',
                    name: 'LIB-USDC',
                    lpToken: '0x1234567890123456789012345678901234567890',
                    apr: 25.5,
                    tvl: 150000,
                    weight: 100
                }
            ];
            
            window.notificationManager?.success('Data Refreshed', 'Staking data has been updated');
        } catch (error) {
            window.ErrorHandler?.handleNetworkError(error);
        } finally {
            this.isLoading = false;
            this.update();
        }
    }

    /**
     * Component lifecycle - after mount
     */
    async afterMount() {
        // Load initial data
        await this.refreshData();
    }
}

// Make available globally
window.HomePage = HomePage;
