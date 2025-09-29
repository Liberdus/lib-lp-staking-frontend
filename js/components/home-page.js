/**
 * Home Page Component - Matches React home.tsx exactly
 * Displays the main staking interface with data table
 * Implements all functionality from milestones.md
 */

class HomePage {
    constructor() {
        this.pairs = [];
        this.loading = true;
        this.error = null;
        this.refreshInterval = null;
        this.isInitialized = false;
        this.isRefreshing = false; // Prevent overlapping refreshes
        this.hourlyRewardRate = '0.00';
        this.totalWeight = '0';
        this.lastWalletAddress = null;
        this.lastNetworkId = null;
        this.init();
    }

    init() {
        if (this.isInitialized) return;

        console.log('🏠 Initializing HomePage component...');
        this.render();
        this.attachEventListeners();
        this.setupContractManagerListeners();
        this.setupWalletChangeDetection();
        this.loadDataWhenReady();
        this.isInitialized = true;

        console.log('✅ HomePage component initialized successfully');
    }

    /**
     * Set up listeners for contract manager events
     */
    setupContractManagerListeners() {
        // Listen for contract manager ready event
        document.addEventListener('contractManagerReady', () => {
            console.log('🏠 HomePage: ContractManager is ready, loading data...');
            this.loadData();
            this.startAutoRefresh();
        });

        // Listen for contract manager error event
        document.addEventListener('contractManagerError', (event) => {
            console.error('🏠 HomePage: ContractManager error:', event.detail.error);
            this.error = `Contract manager initialization failed: ${event.detail.error}`;
            this.loading = false;
            this.render();
        });

        // Listen for wallet disconnection
        document.addEventListener('contractManagerDisconnected', () => {
            console.log('🏠 HomePage: ContractManager disconnected, stopping refresh...');
            this.stopAutoRefresh();
            this.pairs = [];
            this.loading = true;
            this.error = null;
            this.render();
        });
    }

    /**
     * Set up wallet and network change detection
     */
    setupWalletChangeDetection() {
        // Listen for wallet connection changes
        document.addEventListener('walletConnected', (event) => {
            console.log('🏠 HomePage: Wallet connected, refreshing data...');
            this.refreshDataAfterWalletChange();
        });

        document.addEventListener('walletDisconnected', () => {
            console.log('🏠 HomePage: Wallet disconnected, refreshing data...');
            this.refreshDataAfterWalletChange();
        });

        // Listen for account changes (MetaMask)
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                console.log('🏠 HomePage: Accounts changed:', accounts);
                this.refreshDataAfterWalletChange();
            });

            window.ethereum.on('chainChanged', (chainId) => {
                console.log('🏠 HomePage: Chain changed:', chainId);
                this.refreshDataAfterWalletChange();
            });
        }
    }

    /**
     * Refresh data after wallet or network changes
     */
    async refreshDataAfterWalletChange() {
        try {
            // Small delay to allow wallet state to settle
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Reload data
            await this.loadData();

            console.log('✅ Data refreshed after wallet change');
        } catch (error) {
            console.error('❌ Failed to refresh data after wallet change:', error);
        }
    }

    /**
     * Load data when contract manager is ready
     */
    async loadDataWhenReady() {
        if (window.contractManager && window.contractManager.isReady()) {
            console.log('🏠 HomePage: ContractManager already ready, loading data immediately...');
            this.loadData();
            this.startAutoRefresh();
        } else {
            console.log('🏠 HomePage: Waiting for ContractManager to be ready...');
            this.loading = true;
            this.error = null;
            this.render();
        }
    }

    // Helper method to safely check wallet connection
    isWalletConnected() {
        try {
            return window.walletManager &&
                   typeof window.walletManager.isWalletConnected === 'function' &&
                   window.walletManager.isWalletConnected();
        } catch (error) {
            console.warn('Error checking wallet connection:', error);
            return false;
        }
    }

    render() {
        const container = document.getElementById('content-container');
        if (!container) return;

        if (this.loading) {
            container.innerHTML = this.renderSkeleton();
        } else if (this.error) {
            container.innerHTML = this.renderError();
        } else {
            container.innerHTML = this.renderHomepage();
        }

        // Update the hourly rate in the existing HTML header
        this.updateHourlyRateDisplay();
    }

    renderHomepage() {
        return this.renderTable();
    }

    /**
     * Update the hourly rate display in the existing HTML header
     */
    updateHourlyRateDisplay() {
        const hourlyRateElement = document.getElementById('hourly-rate');
        if (hourlyRateElement) {
            const formattedRate = parseFloat(this.hourlyRewardRate || '0').toFixed(2);
            hourlyRateElement.textContent = formattedRate;
            console.log(`📊 Updated hourly rate display: ${formattedRate} LIB`);
        }
    }

    renderSkeleton() {
        return `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>
                                <span class="material-icons">swap_horiz</span>
                                Pair
                            </th>
                            <th>
                                <span class="material-icons">business</span>
                                Platform
                            </th>
                            <th>
                                <span class="material-icons">trending_up</span>
                                APR
                            </th>
                            <th>
                                <span class="material-icons">account_balance</span>
                                TVL
                            </th>
                            <th>
                                <span class="material-icons">pie_chart</span>
                                Your Shares
                            </th>
                            <th>
                                <span class="material-icons">monetization_on</span>
                                Your Earnings
                            </th>
                            <th>
                                <span class="material-icons">settings</span>
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Array(5).fill(0).map(() => `
                            <tr>
                                <td><div class="skeleton" style="height: 20px; width: 120px;"></div></td>
                                <td><div class="skeleton" style="height: 20px; width: 80px;"></div></td>
                                <td><div class="skeleton" style="height: 20px; width: 60px;"></div></td>
                                <td><div class="skeleton" style="height: 20px; width: 100px;"></div></td>
                                <td><div class="skeleton" style="height: 20px; width: 80px;"></div></td>
                                <td><div class="skeleton" style="height: 20px; width: 80px;"></div></td>
                                <td><div class="skeleton" style="height: 20px; width: 120px;"></div></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderError() {
        return `
            <div class="error-container" style="text-align: center; padding: 48px; color: var(--error-main);">
                <span class="material-icons" style="font-size: 48px; margin-bottom: 16px;">error</span>
                <h3>Failed to load staking data</h3>
                <p>${this.error}</p>
                <button class="btn btn-primary" onclick="homePage.loadData()" style="margin-top: 16px;">
                    <span class="material-icons">refresh</span>
                    Retry
                </button>
            </div>
        `;
    }

    renderTable() {
        return `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>
                                <span class="material-icons">swap_horiz</span>
                                Pair
                            </th>
                            <th>
                                <span class="material-icons">business</span>
                                Platform
                            </th>
                            <th>
                                <span class="material-icons">trending_up</span>
                                APR
                            </th>
                            <th>
                                <span class="material-icons">fitness_center</span>
                                Weight
                            </th>
                            <th>
                                <span class="material-icons">account_balance</span>
                                TVL
                            </th>
                            <th>
                                <span class="material-icons">pie_chart</span>
                                Your Shares
                            </th>
                            <th>
                                <span class="material-icons">monetization_on</span>
                                Your Earnings
                            </th>
                            <th>
                                <span class="material-icons">settings</span>
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.pairs.map(pair => this.renderPairRow(pair)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderPairRow(pair) {
        const isConnected = this.isWalletConnected();
        const userShares = pair.userShares || '0.00';
        const userEarnings = pair.userEarnings || '0.00';
        
        return `
            <tr class="pair-row" data-pair-id="${pair.id}" style="cursor: pointer;">
                <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 32px; height: 32px; background: linear-gradient(45deg, #2196F3, #21CBF3); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">
                                ${pair.token0Symbol}
                            </div>
                            <div style="width: 32px; height: 32px; background: linear-gradient(45deg, #FF9800, #FFC107); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; margin-left: -8px;">
                                ${pair.token1Symbol}
                            </div>
                        </div>
                        <div>
                            <div style="font-weight: 600; font-size: 16px;">
                                ${pair.token0Symbol}/${pair.token1Symbol}
                            </div>
                            <div style="color: var(--text-secondary); font-size: 14px;">
                                ${pair.name || 'LP Token'}
                            </div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="chip chip-primary">${pair.platform || 'Uniswap V2'}</span>
                </td>
                <td>
                    <span style="color: var(--success-main); font-weight: bold;">${pair.apr || '0.00'}%</span>
                </td>
                <td>
                    <span class="chip chip-secondary">
                        ${parseFloat(pair.weight || '0').toFixed(1)} (${pair.weightPercentage || '0.00'}%)
                    </span>
                </td>
                <td>
                    <span style="font-weight: 600;">$${this.formatNumber(pair.tvl || 0)}</span>
                </td>
                <td>
                    <span style="font-weight: 600;">${userShares} LP</span>
                </td>
                <td>
                    <span style="font-weight: 600; color: var(--success-main);">
                        ${userEarnings} LIB
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-primary btn-stake" data-pair-id="${pair.id}" data-pair-address="${pair.address}" ${!isConnected || !pair.stakingEnabled ? 'disabled' : ''}>
                            <span class="material-icons">add</span>
                            Stake
                        </button>
                        <button class="btn btn-secondary btn-unstake" data-pair-id="${pair.id}" data-pair-address="${pair.address}" ${!isConnected || parseFloat(userShares) === 0 ? 'disabled' : ''}>
                            <span class="material-icons">remove</span>
                            Unstake
                        </button>
                        <button class="btn btn-text btn-claim" data-pair-id="${pair.id}" data-pair-address="${pair.address}" ${!isConnected || parseFloat(userEarnings) === 0 ? 'disabled' : ''}>
                            <span class="material-icons">redeem</span>
                            Claim
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    attachEventListeners() {
        // Refresh button with enhanced functionality
        const refreshBtn = document.getElementById('refresh-button');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.handleRefreshClick());
        }
    }

    /**
     * Handle refresh button click with loading state
     */
    async handleRefreshClick() {
        console.log('🔄 Manual refresh requested');
        const refreshButton = document.getElementById('refresh-button');

        // Add loading state
        if (refreshButton) {
            refreshButton.disabled = true;
            refreshButton.innerHTML = '<span class="material-icons">hourglass_empty</span>';
        }

        try {
            await this.refreshData();
            this.showNotification('success', 'Data refreshed successfully!');
        } catch (error) {
            console.error('❌ Manual refresh failed:', error);
            this.showNotification('error', 'Failed to refresh data');
        } finally {
            // Reset button state
            if (refreshButton) {
                refreshButton.disabled = false;
                refreshButton.innerHTML = '<span class="material-icons">refresh</span>';
            }
        }

        // Delegate event listeners for dynamic content
        document.addEventListener('click', (e) => {
            if (e.target.closest('.pair-row')) {
                const pairId = e.target.closest('.pair-row').dataset.pairId;
                if (!e.target.closest('button')) {
                    this.openStakingModal(pairId);
                }
            }

            if (e.target.closest('.btn-stake')) {
                e.stopPropagation();
                const pairId = e.target.closest('.btn-stake').dataset.pairId;
                this.openStakingModal(pairId, 'stake');
            }

            if (e.target.closest('.btn-unstake')) {
                e.stopPropagation();
                const pairId = e.target.closest('.btn-unstake').dataset.pairId;
                this.openStakingModal(pairId, 'unstake');
            }

            if (e.target.closest('.btn-claim')) {
                e.stopPropagation();
                const pairId = e.target.closest('.btn-claim').dataset.pairId;
                this.claimRewards(pairId);
            }
        });
    }

    async loadData() {
        try {
            this.loading = true;
            this.error = null;
            this.render();

            console.log('📊 Loading staking data...');

            // Check if contract manager is ready
            if (!window.contractManager) {
                throw new Error('Contract manager not available');
            }

            if (!window.contractManager.isReady()) {
                console.log('⏳ Waiting for contract manager to be ready...');
                const isReady = await window.contractManager.waitForReady(10000);
                if (!isReady) {
                    throw new Error('Contract manager not ready after timeout');
                }
            }

            // Add small delay to ensure everything is settled
            await new Promise(resolve => setTimeout(resolve, 200));

            // Try to load real blockchain data first
            try {
                await this.loadBlockchainData();
            } catch (blockchainError) {
                console.warn('📊 Failed to load blockchain data, using fallback:', blockchainError.message);
                this.loadFallbackData();
            }

            this.loading = false;
            this.render();

            console.log('✅ Staking data loaded successfully');

        } catch (error) {
            console.error('❌ Failed to load staking data:', error);
            this.error = `Failed to load blockchain data: ${error.message}`;
            this.loading = false;
            this.render();
        }
    }

    /**
     * Load real blockchain data from contracts
     */
    async loadBlockchainData() {
        console.log('🔗 Loading real blockchain data...');

        if (!window.contractManager || !window.contractManager.isReady()) {
            throw new Error('Contract manager not ready');
        }

        try {
            // Get hourly reward rate
            console.log('💰 Loading hourly reward rate...');
            const hourlyRateWei = await window.contractManager.getHourlyRewardRate();
            this.hourlyRewardRate = ethers.utils.formatEther(hourlyRateWei);
            console.log(`✅ Hourly reward rate: ${this.hourlyRewardRate} LIB/hour`);

            // Get total weight for percentage calculations
            console.log('⚖️ Loading total weight...');
            const totalWeightWei = await window.contractManager.getTotalWeight();
            this.totalWeight = ethers.utils.formatEther(totalWeightWei);
            console.log(`✅ Total weight: ${this.totalWeight}`);

            // Get all pairs info from the staking contract
            console.log('📋 Loading pairs info...');
            const allPairsInfo = await window.contractManager.getAllPairsInfo();
            console.log('📋 Retrieved pairs from contract:', allPairsInfo);

            this.pairs = [];

            if (allPairsInfo.length === 0) {
                console.log('⚠️ No pairs configured in the staking contract yet');
                // Create a placeholder pair to show the UI structure
                this.pairs = [{
                    id: '1',
                    address: '0x0000000000000000000000000000000000000000',
                    token0Symbol: 'LIB',
                    token1Symbol: 'USDC',
                    name: 'No Pairs Configured',
                    platform: 'Waiting for Setup',
                    apr: '0.00',
                    tvl: 0,
                    userShares: '0.00',
                    userEarnings: '0.00',
                    totalStaked: '0',
                    rewardRate: '0',
                    stakingEnabled: false,
                    weight: '0',
                    weightPercentage: '0.00'
                }];
            } else {
                for (let i = 0; i < allPairsInfo.length; i++) {
                    const pairInfo = allPairsInfo[i];

                    try {
                        // Get user stake info if wallet is connected
                        let userStake = { amount: '0', rewards: '0' };
                        if (this.isWalletConnected() && pairInfo.address !== '0x0000000000000000000000000000000000000000') {
                            userStake = await window.contractManager.getUserStake(
                                window.walletManager.address,
                                pairInfo.address
                            );
                        }

                        // Calculate weight percentage
                        const weightPercentage = this.totalWeight > 0 ?
                            ((parseFloat(pairInfo.weight || '0') * 100) / parseFloat(this.totalWeight)).toFixed(2) :
                            '0.00';

                        // Create pair data from contract info
                        const pairData = {
                            id: pairInfo.id || (i + 1).toString(),
                            address: pairInfo.address,
                            token0Symbol: 'LIB',
                            token1Symbol: this.extractTokenSymbol(pairInfo.name) || 'TOKEN',
                            name: pairInfo.name || `LP Token ${i + 1}`,
                            platform: pairInfo.platform || 'Unknown',
                            apr: pairInfo.apr || '0.00',
                            tvl: pairInfo.tvl || 0,
                            userShares: userStake.amount || '0.00',
                            userEarnings: userStake.rewards || '0.00',
                            totalStaked: pairInfo.totalStaked || '0',
                            rewardRate: pairInfo.rewardRate || '0',
                            stakingEnabled: pairInfo.isActive !== false,
                            weight: pairInfo.weight || '0',
                            weightPercentage: weightPercentage
                        };

                        this.pairs.push(pairData);
                    } catch (error) {
                        console.warn(`⚠️ Failed to load data for pair ${pairInfo.address}:`, error.message);
                    }
                }
            }

            console.log('✅ Blockchain data loaded:', this.pairs.length, 'pairs');
        } catch (error) {
            console.error('❌ Failed to load blockchain data:', error);
            throw error;
        }
    }

    /**
     * Load fallback data when blockchain data is not available
     */
    loadFallbackData() {
        console.log('📊 Loading fallback data...');

        if (window.CONFIG?.DEV?.MOCK_DATA) {
                // Enhanced mock data with all features from milestones.md
            this.pairs = [
                {
                    id: '1',
                    token0Symbol: 'LIB',
                    token1Symbol: 'USDC',
                    name: 'LIB/USDC LP',
                    platform: 'Uniswap V2',
                    apr: '125.50',
                    tvl: 1250000,
                    userShares: this.isWalletConnected() ? '15.75' : '0.00',
                    userEarnings: this.isWalletConnected() ? '2.45' : '0.00',
                    totalStaked: '850000',
                    rewardRate: '0.125',
                    stakingEnabled: true
                },
                {
                    id: '2',
                    token0Symbol: 'LIB',
                    token1Symbol: 'ETH',
                    name: 'LIB/ETH LP',
                    platform: 'Uniswap V2',
                    apr: '98.75',
                    tvl: 850000,
                    userShares: this.isWalletConnected() ? '8.25' : '0.00',
                    userEarnings: this.isWalletConnected() ? '1.12' : '0.00',
                    totalStaked: '620000',
                    rewardRate: '0.098',
                    stakingEnabled: true
                },
                {
                    id: '3',
                    token0Symbol: 'LIB',
                    token1Symbol: 'BTC',
                    name: 'LIB/BTC LP',
                    platform: 'Uniswap V2',
                    apr: '87.25',
                    tvl: 650000,
                    userShares: this.isWalletConnected() ? '5.50' : '0.00',
                    userEarnings: this.isWalletConnected() ? '0.87' : '0.00',
                    totalStaked: '480000',
                    rewardRate: '0.087',
                    stakingEnabled: true
                },
                {
                    id: '4',
                    token0Symbol: 'LIB',
                    token1Symbol: 'DAI',
                    name: 'LIB/DAI LP',
                    platform: 'Uniswap V2',
                    apr: '76.80',
                    tvl: 420000,
                    userShares: this.isWalletConnected() ? '3.25' : '0.00',
                    userEarnings: this.isWalletConnected() ? '0.54' : '0.00',
                    totalStaked: '320000',
                    rewardRate: '0.076',
                    stakingEnabled: true
                },
                {
                    id: '5',
                    token0Symbol: 'LIB',
                    token1Symbol: 'MATIC',
                    name: 'LIB/MATIC LP',
                    platform: 'Uniswap V2',
                    apr: '65.40',
                    tvl: 280000,
                    userShares: this.isWalletConnected() ? '2.10' : '0.00',
                    userEarnings: this.isWalletConnected() ? '0.32' : '0.00',
                    totalStaked: '210000',
                    rewardRate: '0.065',
                    stakingEnabled: true
                }
            ];
        } else {
            // Use minimal fallback data when no mock data is configured
            this.pairs = [
                {
                    id: '1',
                    token0Symbol: 'LIB',
                    token1Symbol: 'USDC',
                    name: 'LIB/USDC LP',
                    platform: 'Uniswap V2',
                    apr: '0.00',
                    tvl: 0,
                    userShares: '0.00',
                    userEarnings: '0.00',
                    totalStaked: '0',
                    rewardRate: '0',
                    stakingEnabled: false
                }
            ];
        }

        console.log('📊 Fallback data loaded:', this.pairs.length, 'pairs');
    }

    /**
     * Extract token symbol from pair name
     */
    extractTokenSymbol(pairName) {
        if (!pairName) return 'TOKEN';

        // Try to extract the second token from patterns like "LIB/USDC" or "LIB-USDC"
        const match = pairName.match(/LIB[\/\-](\w+)/i);
        if (match) {
            return match[1].toUpperCase();
        }

        // Fallback patterns
        if (pairName.toLowerCase().includes('usdc')) return 'USDC';
        if (pairName.toLowerCase().includes('eth')) return 'ETH';
        if (pairName.toLowerCase().includes('btc')) return 'BTC';
        if (pairName.toLowerCase().includes('dai')) return 'DAI';
        if (pairName.toLowerCase().includes('matic')) return 'MATIC';

        return 'TOKEN';
    }

    /**
     * Build real pair data from contract information
     */
    async buildRealPairData(pairInfo, index) {
        try {
            // Extract pair name from platform or use address
            const pairName = this.extractPairName(pairInfo.address, pairInfo.platform);
            const tokens = this.extractTokenSymbols(pairName);

            // Get additional data if available
            let tvl = 0;
            let totalStaked = 0;
            let apr = 0;
            let rewardRate = 0;

            try {
                // Try to get pool info if available
                const poolInfo = await window.contractManager.getPoolInfo(pairInfo.address);
                totalStaked = parseFloat(poolInfo.totalStaked || '0');
                rewardRate = parseFloat(poolInfo.rewardRate || '0');

                // Calculate TVL and APR if rewards calculator is available
                if (window.rewardsCalculator) {
                    const aprData = await window.rewardsCalculator.calculateAPR(pairName);
                    apr = aprData.apr || 0;
                    tvl = aprData.tvl || totalStaked;
                }
            } catch (dataError) {
                console.log(`Could not get additional data for ${pairName}:`, dataError.message);
            }

            // Get user-specific data if wallet is connected
            let userShares = '0.00';
            let userEarnings = '0.00';

            if (this.isWalletConnected() && window.walletManager?.currentAccount) {
                try {
                    const userStake = await window.contractManager.getUserStake(
                        window.walletManager.currentAccount,
                        pairInfo.address
                    );
                    const pendingRewards = await window.contractManager.getPendingRewards(
                        window.walletManager.currentAccount,
                        pairInfo.address
                    );

                    userShares = parseFloat(userStake || '0').toFixed(2);
                    userEarnings = parseFloat(pendingRewards || '0').toFixed(2);
                } catch (userError) {
                    console.log(`Could not get user data for ${pairName}:`, userError.message);
                }
            }

            return {
                id: index.toString(),
                token0Symbol: tokens.token0,
                token1Symbol: tokens.token1,
                name: `${tokens.token0}/${tokens.token1} LP`,
                platform: pairInfo.platform || 'Unknown',
                apr: apr.toFixed(2),
                tvl: tvl,
                userShares: userShares,
                userEarnings: userEarnings,
                totalStaked: totalStaked.toString(),
                rewardRate: rewardRate.toFixed(3),
                stakingEnabled: pairInfo.isActive
            };
        } catch (error) {
            console.error('Failed to build real pair data:', error);
            return null;
        }
    }

    /**
     * Extract pair name from address or platform
     */
    extractPairName(address, platform) {
        // Try to find a known pair name from config
        const lpTokens = window.CONFIG?.CONTRACTS?.LP_TOKENS || {};
        for (const [pairName, pairAddress] of Object.entries(lpTokens)) {
            if (pairAddress.toLowerCase() === address.toLowerCase()) {
                return pairName;
            }
        }

        // Use platform if available
        if (platform && platform !== 'Unknown') {
            return platform;
        }

        // Fallback to shortened address
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    /**
     * Extract token symbols from pair name
     */
    extractTokenSymbols(pairName) {
        // Handle common pair name formats
        if (pairName.includes('/')) {
            const parts = pairName.split('/');
            return { token0: parts[0].trim(), token1: parts[1].trim() };
        } else if (pairName.includes('-')) {
            const parts = pairName.split('-');
            return { token0: parts[0].trim(), token1: parts[1].trim() };
        } else if (pairName.includes('_')) {
            const parts = pairName.split('_');
            return { token0: parts[0].trim(), token1: parts[1].trim() };
        }

        // Fallback for unknown formats
        return { token0: 'TOKEN', token1: 'PAIR' };
    }

    openStakingModal(pairId, tab = 'stake') {
        const pair = this.pairs.find(p => p.id === pairId);
        if (!pair) return;

        if (window.stakingModal) {
            window.stakingModal.open(pair, tab);
        } else {
            console.warn('Staking modal not available');
        }
    }

    async claimRewards(pairId) {
        console.log(`🎁 Claiming rewards for pair ${pairId}`);

        const pair = this.pairs.find(p => p.id === pairId);
        if (!pair) {
            console.error('Pair not found:', pairId);
            return;
        }

        if (!this.isWalletConnected()) {
            this.showNotification('error', 'Please connect your wallet first');
            return;
        }

        try {
            // Show loading state
            const button = document.querySelector(`.btn-claim[data-pair-id="${pairId}"]`);
            if (button) {
                button.disabled = true;
                button.innerHTML = '<span class="material-icons">hourglass_empty</span> Claiming...';
            }

            this.showNotification('info', 'Claiming rewards...');

            // Call contract manager to claim rewards
            if (window.contractManager && window.contractManager.claimRewards) {
                console.log(`🎁 Claiming rewards for LP token: ${pair.address}`);
                const result = await window.contractManager.claimRewards(pair.address);

                if (result && result.success) {
                    console.log('✅ Rewards claimed successfully');
                    this.showNotification('success', `Successfully claimed ${pair.userEarnings} LIB rewards!`);

                    // Refresh data after successful transaction
                    setTimeout(() => this.refreshData(), 2000);
                } else {
                    throw new Error(result?.error || 'Transaction failed');
                }
            } else {
                throw new Error('Contract manager not available');
            }

        } catch (error) {
            console.error('❌ Failed to claim rewards:', error);
            this.showNotification('error', `Failed to claim rewards: ${error.message}`);
        } finally {
            // Reset button state
            const button = document.querySelector(`.btn-claim[data-pair-id="${pairId}"]`);
            if (button) {
                button.disabled = false;
                button.innerHTML = '<span class="material-icons">redeem</span> Claim';
            }
        }
    }

    showNotification(type, message) {
        // Use existing notification system if available
        if (window.notificationManager) {
            window.notificationManager.show(message, type);
        } else if (window.notification) {
            window.notification.show(type, message);
        } else {
            // Fallback to console and alert
            console.log(`${type.toUpperCase()}: ${message}`);
            if (type === 'error') {
                alert(`Error: ${message}`);
            }
        }
    }

    /**
     * Public method to refresh data (called by staking modal after transactions)
     */
    async refreshData() {
        if (this.isRefreshing) {
            console.log('🔄 Refresh already in progress, skipping...');
            return;
        }

        this.isRefreshing = true;
        console.log('🔄 Refreshing homepage data...');
        try {
            await this.loadData();
            console.log('✅ Homepage data refreshed successfully');
        } catch (error) {
            console.error('❌ Failed to refresh homepage data:', error);
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * Enhanced auto-refresh with intelligent timing
     */
    startAutoRefresh() {
        // Clear any existing interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Auto-refresh every 30 seconds when wallet is connected, 60 seconds when not
        const refreshRate = this.isWalletConnected() ? 30000 : 60000;

        this.refreshInterval = setInterval(async () => {
            if (!this.loading && this.isInitialized) {
                console.log('🔄 Auto-refreshing homepage data...');
                try {
                    await this.loadData();
                } catch (error) {
                    console.error('❌ Auto-refresh failed:', error);
                }
            }
        }, refreshRate);

        console.log(`✅ Auto-refresh started (${refreshRate/1000}s interval)`);
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(2) + 'K';
        }
        return num.toFixed(2);
    }



    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            console.log('⏹️ HomePage: Auto-refresh stopped');
        }
    }

    destroy() {
        this.stopAutoRefresh();
    }
}

// Initialize home page
let homePage;
document.addEventListener('DOMContentLoaded', () => {
    homePage = new HomePage();
});

// Export for global access
window.HomePage = HomePage;
