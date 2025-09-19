/**
 * StakingModal - Main staking interface component
 * Matches React StakingModal.tsx functionality with tabs, sliders, and form validation
 * Features: Stake/Unstake/Claim tabs, percentage sliders, balance validation
 */
class StakingModal extends BaseComponent {
    constructor() {
        super();
        
        // Component state
        this.state = {
            selectedPair: null,
            isOpen: false,
            activeTab: 0, // 0: Stake, 1: Unstake, 2: Claim
            
            // Stake tab state
            stakePercent: 100,
            stakeAmount: '',
            
            // Unstake tab state
            unstakePercent: 100,
            unstakeAmount: '',
            
            // Data state
            balance: 0,
            tokenInfo: null,
            pendingRewards: 0,
            userStakeInfo: null,
            
            // UI state
            isLoading: false,
            isStakeSliderChange: false,
            isUnstakeSliderChange: false
        };
        
        // Bind methods
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.handleTabChange = this.handleTabChange.bind(this);
        this.handleStake = this.handleStake.bind(this);
        this.handleUnstake = this.handleUnstake.bind(this);
        this.handleClaimRewards = this.handleClaimRewards.bind(this);
        this.handleStakeAmountChange = this.handleStakeAmountChange.bind(this);
        this.handleUnstakeAmountChange = this.handleUnstakeAmountChange.bind(this);
        this.handleStakeSliderChange = this.handleStakeSliderChange.bind(this);
        this.handleUnstakeSliderChange = this.handleUnstakeSliderChange.bind(this);
    }

    /**
     * Show staking modal
     */
    async show(selectedPair, initialTab = 0) {
        this.setState({
            selectedPair,
            activeTab: initialTab,
            isOpen: true
        });

        // Load data for the selected pair
        await this.loadPairData();

        // Show modal using ModalManager
        const content = await this.render();
        window.modalManager.show('staking-modal', content, {
            title: `${selectedPair.pairName} Staking`,
            size: 'large',
            className: 'staking-modal',
            closeOnBackdrop: false,
            initialFocus: '.tab-button.active'
        });

        // Set up event listeners after modal is shown
        this.setupEventListeners();
    }

    /**
     * Hide staking modal
     */
    hide() {
        this.setState({ isOpen: false });
        window.modalManager.hide('staking-modal');
    }

    /**
     * Load pair data from contracts
     */
    async loadPairData() {
        if (!this.state.selectedPair || !window.walletManager?.isConnected()) {
            return;
        }

        try {
            this.setState({ isLoading: true });

            const { selectedPair } = this.state;
            const userAddress = window.walletManager.getAddress();

            // Get token info
            const tokenInfo = await window.contractManager.getTokenInfo(selectedPair.lpToken);
            
            // Get user balance
            const balance = await window.contractManager.getERC20Balance(userAddress, selectedPair.lpToken);
            
            // Get pending rewards
            const pendingRewards = await window.contractManager.getPendingRewards(userAddress, selectedPair.lpToken);
            
            // Get user stake info
            const userStakeInfo = await window.contractManager.getUserStakeInfo(userAddress, selectedPair.lpToken);

            this.setState({
                tokenInfo,
                balance: parseFloat(window.ethers.formatUnits(balance, tokenInfo.decimals)),
                pendingRewards: parseFloat(window.ethers.formatEther(pendingRewards)),
                userStakeInfo: {
                    amount: parseFloat(window.ethers.formatEther(userStakeInfo.amount)),
                    pendingRewards: parseFloat(window.ethers.formatEther(userStakeInfo.pendingRewards)),
                    lastRewardTime: userStakeInfo.lastRewardTime
                }
            });

        } catch (error) {
            this.logError('Failed to load pair data:', error);
            window.notificationManager?.error('Error', 'Failed to load staking data');
        } finally {
            this.setState({ isLoading: false });
        }
    }

    /**
     * Handle tab change
     */
    handleTabChange(tabIndex) {
        this.setState({ activeTab: tabIndex });
        this.updateModalContent();
    }

    /**
     * Handle stake action
     */
    async handleStake() {
        const { selectedPair, stakeAmount, stakePercent, balance } = this.state;
        
        if (!selectedPair || !window.walletManager?.isConnected()) {
            window.notificationManager?.error('Error', 'Please connect your wallet');
            return;
        }

        try {
            const amount = stakeAmount || ((stakePercent * balance) / 100).toString();
            
            if (Number(amount) === 0) {
                window.notificationManager?.warning('Warning', 'Please enter an amount to stake');
                return;
            }

            this.setState({ isLoading: true });

            await window.contractManager.stake(selectedPair.lpToken, amount);
            
            window.notificationManager?.success('Success', 'Tokens staked successfully!');
            this.hide();
            
            // Trigger data refresh
            window.eventManager?.emit('stakingDataChanged');

        } catch (error) {
            this.logError('Stake failed:', error);
            window.notificationManager?.error('Error', 'Failed to stake tokens');
        } finally {
            this.setState({ isLoading: false });
        }
    }

    /**
     * Handle unstake action
     */
    async handleUnstake() {
        const { selectedPair, unstakeAmount, unstakePercent, userStakeInfo } = this.state;
        
        if (!selectedPair || !window.walletManager?.isConnected()) {
            window.notificationManager?.error('Error', 'Please connect your wallet');
            return;
        }

        try {
            const amount = unstakeAmount || ((unstakePercent * userStakeInfo.amount) / 100).toString();
            
            if (Number(amount) === 0) {
                window.notificationManager?.warning('Warning', 'Please enter an amount to unstake');
                return;
            }

            this.setState({ isLoading: true });

            await window.contractManager.unstake(selectedPair.lpToken, amount);
            
            window.notificationManager?.success('Success', 'Tokens unstaked successfully!');
            this.hide();
            
            // Trigger data refresh
            window.eventManager?.emit('stakingDataChanged');

        } catch (error) {
            this.logError('Unstake failed:', error);
            window.notificationManager?.error('Error', 'Failed to unstake tokens');
        } finally {
            this.setState({ isLoading: false });
        }
    }

    /**
     * Handle claim rewards action
     */
    async handleClaimRewards() {
        const { selectedPair } = this.state;
        
        if (!selectedPair || !window.walletManager?.isConnected()) {
            window.notificationManager?.error('Error', 'Please connect your wallet');
            return;
        }

        try {
            this.setState({ isLoading: true });

            await window.contractManager.claimRewards(selectedPair.lpToken);
            
            window.notificationManager?.success('Success', 'Rewards claimed successfully!');
            this.hide();
            
            // Trigger data refresh
            window.eventManager?.emit('stakingDataChanged');

        } catch (error) {
            this.logError('Claim rewards failed:', error);
            window.notificationManager?.error('Error', 'Failed to claim rewards');
        } finally {
            this.setState({ isLoading: false });
        }
    }

    /**
     * Handle stake amount input change
     */
    handleStakeAmountChange(value) {
        const { balance } = this.state;
        
        this.setState({ isStakeSliderChange: false });
        
        if (!value) {
            this.setState({
                stakeAmount: '',
                stakePercent: 0
            });
            return;
        }

        const numValue = Number(value);
        if (isNaN(numValue) || numValue < 0) return;

        if (numValue > balance) {
            this.setState({
                stakeAmount: balance.toString(),
                stakePercent: 100
            });
            return;
        }

        this.setState({
            stakeAmount: value,
            stakePercent: balance > 0 ? (numValue * 100) / balance : 0
        });
    }

    /**
     * Handle unstake amount input change
     */
    handleUnstakeAmountChange(value) {
        const { userStakeInfo } = this.state;
        
        if (!userStakeInfo) return;
        
        this.setState({ isUnstakeSliderChange: false });
        
        if (!value) {
            this.setState({
                unstakeAmount: '',
                unstakePercent: 0
            });
            return;
        }

        const numValue = Number(value);
        if (isNaN(numValue) || numValue < 0) return;

        const stakedAmount = userStakeInfo.amount;
        if (numValue > stakedAmount) {
            this.setState({
                unstakeAmount: stakedAmount.toString(),
                unstakePercent: 100
            });
            return;
        }

        this.setState({
            unstakeAmount: value,
            unstakePercent: stakedAmount > 0 ? (numValue * 100) / stakedAmount : 0
        });
    }

    /**
     * Handle stake slider change
     */
    handleStakeSliderChange(percent) {
        const { balance } = this.state;
        
        this.setState({
            isStakeSliderChange: true,
            stakePercent: percent,
            stakeAmount: ((percent * balance) / 100).toString()
        });
    }

    /**
     * Handle unstake slider change
     */
    handleUnstakeSliderChange(percent) {
        const { userStakeInfo } = this.state;

        if (!userStakeInfo) return;

        this.setState({
            isUnstakeSliderChange: true,
            unstakePercent: percent,
            unstakeAmount: ((percent * userStakeInfo.amount) / 100).toString()
        });
    }

    /**
     * Render component
     */
    async render() {
        const { selectedPair, activeTab, tokenInfo, isLoading } = this.state;

        if (!selectedPair || !tokenInfo) {
            return this.renderLoading();
        }

        return `
            <div class="staking-modal-content">
                ${this.renderHeader()}
                ${this.renderTabs()}
                <div class="modal-divider"></div>
                ${this.renderTabContent()}
            </div>
        `;
    }

    /**
     * Render loading state
     */
    renderLoading() {
        return `
            <div class="staking-modal-loading">
                <div class="loading-spinner"></div>
                <p>Loading staking data...</p>
            </div>
        `;
    }

    /**
     * Render modal header
     */
    renderHeader() {
        const { selectedPair } = this.state;

        return `
            <div class="staking-modal-header">
                <div class="header-icon">
                    <svg class="icon-swap" viewBox="0 0 24 24" width="28" height="28">
                        <path fill="currentColor" d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"/>
                    </svg>
                </div>
                <h2 class="modal-title">${selectedPair.pairName}</h2>
            </div>
        `;
    }

    /**
     * Render tab navigation
     */
    renderTabs() {
        const { activeTab } = this.state;

        return `
            <div class="staking-tabs">
                <button class="tab-button ${activeTab === 0 ? 'active' : ''}" data-tab="0">
                    <svg class="tab-icon" viewBox="0 0 24 24" width="20" height="20">
                        <path fill="currentColor" d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 21H5V3H13V9H19V21Z"/>
                    </svg>
                    <span>Stake</span>
                </button>
                <button class="tab-button ${activeTab === 1 ? 'active' : ''}" data-tab="1">
                    <svg class="tab-icon" viewBox="0 0 24 24" width="20" height="20">
                        <path fill="currentColor" d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 21H5V3H13V9H19V21Z"/>
                    </svg>
                    <span>Unstake</span>
                </button>
                <button class="tab-button ${activeTab === 2 ? 'active' : ''}" data-tab="2">
                    <svg class="tab-icon" viewBox="0 0 24 24" width="20" height="20">
                        <path fill="currentColor" d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 21H5V3H13V9H19V21Z"/>
                    </svg>
                    <span>Claim</span>
                </button>
            </div>
        `;
    }

    /**
     * Render active tab content
     */
    renderTabContent() {
        const { activeTab } = this.state;

        switch (activeTab) {
            case 0:
                return this.renderStakeTab();
            case 1:
                return this.renderUnstakeTab();
            case 2:
                return this.renderClaimTab();
            default:
                return this.renderStakeTab();
        }
    }

    /**
     * Render stake tab
     */
    renderStakeTab() {
        const { stakeAmount, stakePercent, balance, tokenInfo, isLoading, selectedPair } = this.state;

        const isDisabled = selectedPair?.weight === 0 || Number(stakeAmount) === 0 || isLoading;

        return `
            <div class="tab-content stake-tab">
                <div class="input-section">
                    <div class="input-group">
                        <label class="input-label">Amount to Stake</label>
                        <div class="input-wrapper">
                            <input
                                type="number"
                                class="amount-input"
                                data-ref="stakeAmountInput"
                                placeholder="0.0"
                                value="${stakeAmount}"
                                min="0"
                                max="${balance}"
                                step="0.0001"
                            />
                            <span class="input-suffix">${tokenInfo?.symbol || ''}</span>
                        </div>
                    </div>

                    <div class="slider-group">
                        <label class="slider-label">Percentage: ${stakePercent.toFixed(1)}%</label>
                        <div class="slider-wrapper">
                            <input
                                type="range"
                                class="percentage-slider"
                                data-ref="stakeSlider"
                                min="0"
                                max="100"
                                value="${stakePercent}"
                                step="1"
                            />
                            <div class="slider-marks">
                                <span>0%</span>
                                <span>25%</span>
                                <span>50%</span>
                                <span>75%</span>
                                <span>100%</span>
                            </div>
                        </div>
                    </div>

                    <div class="balance-info">
                        <svg class="wallet-icon" viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M21 18V19C21 20.1 20.1 21 19 21H5C3.89 21 3 20.1 3 19V5C3 3.9 3.89 3 5 3H19C20.1 3 21 3.9 21 5V6H12C10.89 6 10 6.89 10 8V16C10 17.11 10.89 18 12 18H21M12 16H22V8H12V16M16 13.5C15.17 13.5 14.5 12.83 14.5 12S15.17 10.5 16 10.5 17.5 11.17 17.5 12 16.83 13.5 16 13.5Z"/>
                        </svg>
                        <span>Balance: ${balance.toFixed(4)} ${tokenInfo?.symbol || ''}</span>
                    </div>
                </div>

                <button
                    class="action-button stake-button ${isDisabled ? 'disabled' : ''}"
                    data-ref="stakeButton"
                    ${isDisabled ? 'disabled' : ''}
                >
                    <svg class="button-icon" viewBox="0 0 24 24" width="20" height="20">
                        <path fill="currentColor" d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 21H5V3H13V9H19V21Z"/>
                    </svg>
                    ${isLoading ? 'Staking...' : 'Stake Tokens'}
                </button>
            </div>
        `;
    }

    /**
     * Render unstake tab
     */
    renderUnstakeTab() {
        const { unstakeAmount, unstakePercent, userStakeInfo, tokenInfo, isLoading } = this.state;

        const stakedAmount = userStakeInfo?.amount || 0;
        const isDisabled = Number(unstakeAmount) === 0 || isLoading;

        return `
            <div class="tab-content unstake-tab">
                <div class="input-section">
                    <div class="input-group">
                        <label class="input-label">Amount to Unstake</label>
                        <div class="input-wrapper">
                            <input
                                type="number"
                                class="amount-input"
                                data-ref="unstakeAmountInput"
                                placeholder="0.0"
                                value="${unstakeAmount}"
                                min="0"
                                max="${stakedAmount}"
                                step="0.0001"
                            />
                            <span class="input-suffix">${tokenInfo?.symbol || ''}</span>
                        </div>
                    </div>

                    <div class="slider-group">
                        <label class="slider-label">Percentage: ${unstakePercent.toFixed(1)}%</label>
                        <div class="slider-wrapper">
                            <input
                                type="range"
                                class="percentage-slider"
                                data-ref="unstakeSlider"
                                min="0"
                                max="100"
                                value="${unstakePercent}"
                                step="1"
                            />
                            <div class="slider-marks">
                                <span>0%</span>
                                <span>25%</span>
                                <span>50%</span>
                                <span>75%</span>
                                <span>100%</span>
                            </div>
                        </div>
                    </div>

                    <div class="balance-info">
                        <svg class="wallet-icon" viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M21 18V19C21 20.1 20.1 21 19 21H5C3.89 21 3 20.1 3 19V5C3 3.9 3.89 3 5 3H19C20.1 3 21 3.9 21 5V6H12C10.89 6 10 6.89 10 8V16C10 17.11 10.89 18 12 18H21M12 16H22V8H12V16M16 13.5C15.17 13.5 14.5 12.83 14.5 12S15.17 10.5 16 10.5 17.5 11.17 17.5 12 16.83 13.5 16 13.5Z"/>
                        </svg>
                        <span>Staked: ${stakedAmount.toFixed(4)} ${tokenInfo?.symbol || ''}</span>
                    </div>
                </div>

                <button
                    class="action-button unstake-button ${isDisabled ? 'disabled' : ''}"
                    data-ref="unstakeButton"
                    ${isDisabled ? 'disabled' : ''}
                >
                    <svg class="button-icon" viewBox="0 0 24 24" width="20" height="20">
                        <path fill="currentColor" d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 21H5V3H13V9H19V21Z"/>
                    </svg>
                    ${isLoading ? 'Unstaking...' : 'Unstake Tokens'}
                </button>
            </div>
        `;
    }

    /**
     * Render claim rewards tab
     */
    renderClaimTab() {
        const { pendingRewards, isLoading } = this.state;

        const isDisabled = pendingRewards === 0 || isLoading;

        return `
            <div class="tab-content claim-tab">
                <div class="rewards-display">
                    <div class="rewards-header">
                        <svg class="rewards-icon" viewBox="0 0 24 24" width="32" height="32">
                            <path fill="currentColor" d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 21H5V3H13V9H19V21Z"/>
                        </svg>
                        <h3>Available Rewards</h3>
                    </div>
                    <div class="rewards-amount">
                        ${pendingRewards.toFixed(4)} LIB
                    </div>
                </div>

                <button
                    class="action-button claim-button ${isDisabled ? 'disabled' : ''}"
                    data-ref="claimButton"
                    ${isDisabled ? 'disabled' : ''}
                >
                    <svg class="button-icon" viewBox="0 0 24 24" width="20" height="20">
                        <path fill="currentColor" d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 21H5V3H13V9H19V21Z"/>
                    </svg>
                    ${isLoading ? 'Claiming...' : 'Claim Rewards'}
                </button>
            </div>
        `;
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Tab buttons
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            this.addEventListener(button, 'click', (e) => {
                const tabIndex = parseInt(e.target.closest('.tab-button').dataset.tab);
                this.handleTabChange(tabIndex);
            });
        });

        // Stake tab listeners
        const stakeAmountInput = this.ref('stakeAmountInput');
        if (stakeAmountInput) {
            this.addEventListener(stakeAmountInput, 'input', (e) => {
                this.handleStakeAmountChange(e.target.value);
            });
        }

        const stakeSlider = this.ref('stakeSlider');
        if (stakeSlider) {
            this.addEventListener(stakeSlider, 'input', (e) => {
                this.handleStakeSliderChange(Number(e.target.value));
            });
        }

        const stakeButton = this.ref('stakeButton');
        if (stakeButton) {
            this.addEventListener(stakeButton, 'click', this.handleStake);
        }

        // Unstake tab listeners
        const unstakeAmountInput = this.ref('unstakeAmountInput');
        if (unstakeAmountInput) {
            this.addEventListener(unstakeAmountInput, 'input', (e) => {
                this.handleUnstakeAmountChange(e.target.value);
            });
        }

        const unstakeSlider = this.ref('unstakeSlider');
        if (unstakeSlider) {
            this.addEventListener(unstakeSlider, 'input', (e) => {
                this.handleUnstakeSliderChange(Number(e.target.value));
            });
        }

        const unstakeButton = this.ref('unstakeButton');
        if (unstakeButton) {
            this.addEventListener(unstakeButton, 'click', this.handleUnstake);
        }

        // Claim button
        const claimButton = this.ref('claimButton');
        if (claimButton) {
            this.addEventListener(claimButton, 'click', this.handleClaimRewards);
        }
    }

    /**
     * Update modal content after state change
     */
    async updateModalContent() {
        const modal = document.getElementById('staking-modal-backdrop');
        if (modal) {
            const content = await this.render();
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = content;
                this.setupEventListeners();
            }
        }
    }
}

// Export for use in other components
window.StakingModal = StakingModal;
