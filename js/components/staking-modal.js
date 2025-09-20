/**
 * StakingModal - Enhanced staking interface component for Phase 2
 * Comprehensive staking modal with advanced features, validation, and mobile responsiveness
 * Features: Advanced validation, real-time balance updates, accessibility, mobile-first design
 */
class StakingModal extends BaseComponent {
    constructor() {
        super();

        // Component state with enhanced features
        this.state = {
            selectedPair: null,
            isOpen: false,
            activeTab: 0, // 0: Stake, 1: Unstake, 2: Claim

            // Stake tab state with validation
            stakePercent: 0,
            stakeAmount: '',
            stakeAmountError: '',
            stakeIsValid: false,

            // Unstake tab state with validation
            unstakePercent: 0,
            unstakeAmount: '',
            unstakeAmountError: '',
            unstakeIsValid: false,

            // Enhanced data state
            balance: 0,
            tokenInfo: null,
            pendingRewards: 0,
            userStakeInfo: null,
            balanceRefreshTime: null,

            // Advanced UI state
            isLoading: false,
            isLoadingBalance: false,
            isLoadingStakeInfo: false,
            isLoadingRewards: false,
            isStakeSliderChange: false,
            isUnstakeSliderChange: false,

            // Error handling
            loadError: null,
            lastRefreshError: null,

            // Accessibility state
            announceMessage: '',
            focusedElement: null
        };
        
        // Bind methods - enhanced with new features
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

        // Enhanced methods
        this.validateStakeAmount = this.validateStakeAmount.bind(this);
        this.validateUnstakeAmount = this.validateUnstakeAmount.bind(this);
        this.refreshBalanceData = this.refreshBalanceData.bind(this);
        this.handleKeyboardNavigation = this.handleKeyboardNavigation.bind(this);
        this.announceToScreenReader = this.announceToScreenReader.bind(this);
        this.formatTokenAmount = this.formatTokenAmount.bind(this);
        this.sanitizeInput = this.sanitizeInput.bind(this);
        this.handleMaxAmount = this.handleMaxAmount.bind(this);
        this.handleQuickPercentage = this.handleQuickPercentage.bind(this);

        // Auto-refresh timer
        this.refreshTimer = null;
        this.REFRESH_INTERVAL = 30000; // 30 seconds

        // Debounce timers
        this.validationDebounce = null;
        this.balanceRefreshDebounce = null;
    }

    /**
     * Show staking modal with enhanced features
     */
    async show(selectedPair, initialTab = 0) {
        try {
            // Clear any existing timers
            this.clearTimers();

            // Reset state for new pair
            this.setState({
                selectedPair,
                activeTab: initialTab,
                isOpen: true,
                stakeAmount: '',
                unstakeAmount: '',
                stakePercent: 0,
                unstakePercent: 0,
                stakeAmountError: '',
                unstakeAmountError: '',
                stakeIsValid: false,
                unstakeIsValid: false,
                loadError: null,
                lastRefreshError: null,
                announceMessage: ''
            });

            // Announce modal opening to screen readers
            this.announceToScreenReader(`Opening staking modal for ${selectedPair.pairName}`);

            // Show loading modal first
            const loadingContent = this.renderLoadingModal();
            window.modalManager.show('staking-modal', loadingContent, {
                title: `${selectedPair.pairName} Staking`,
                size: 'large',
                className: 'staking-modal loading',
                closeOnBackdrop: false,
                showCloseButton: true,
                onClose: () => this.hide()
            });

            // Load data for the selected pair
            await this.loadPairData();

            // Render full modal content
            const content = await this.render();
            window.modalManager.updateContent('staking-modal', content);

            // Remove loading class
            const modal = document.getElementById('staking-modal-backdrop');
            if (modal) {
                modal.classList.remove('loading');
            }

            // Set up event listeners after modal is shown
            this.setupEventListeners();

            // Start auto-refresh timer
            this.startAutoRefresh();

            // Set initial focus based on tab
            this.setInitialFocus(initialTab);

        } catch (error) {
            this.logError('Failed to show staking modal:', error);
            window.notificationManager?.error('Error', 'Failed to open staking modal');
            this.hide();
        }
    }

    /**
     * Hide staking modal with cleanup
     */
    hide() {
        this.setState({ isOpen: false });
        this.clearTimers();
        this.announceToScreenReader('Staking modal closed');
        window.modalManager.hide('staking-modal');
    }

    /**
     * Clear all timers
     */
    clearTimers() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        if (this.validationDebounce) {
            clearTimeout(this.validationDebounce);
            this.validationDebounce = null;
        }
        if (this.balanceRefreshDebounce) {
            clearTimeout(this.balanceRefreshDebounce);
            this.balanceRefreshDebounce = null;
        }
    }

    /**
     * Start auto-refresh timer
     */
    startAutoRefresh() {
        this.refreshTimer = setInterval(() => {
            if (this.state.isOpen && !this.state.isLoading) {
                this.refreshBalanceData();
            }
        }, this.REFRESH_INTERVAL);
    }

    /**
     * Set initial focus based on active tab
     */
    setInitialFocus(tabIndex) {
        setTimeout(() => {
            let focusSelector;
            switch (tabIndex) {
                case 0:
                    focusSelector = '.stake-tab .amount-input';
                    break;
                case 1:
                    focusSelector = '.unstake-tab .amount-input';
                    break;
                case 2:
                    focusSelector = '.claim-button';
                    break;
                default:
                    focusSelector = '.tab-button.active';
            }

            const element = document.querySelector(focusSelector);
            if (element && !element.disabled) {
                element.focus();
                this.setState({ focusedElement: focusSelector });
            }
        }, 100);
    }

    /**
     * Announce message to screen readers
     */
    announceToScreenReader(message) {
        this.setState({ announceMessage: message });

        // Clear message after announcement
        setTimeout(() => {
            this.setState({ announceMessage: '' });
        }, 1000);
    }

    /**
     * Load pair data from contracts with enhanced error handling
     */
    async loadPairData() {
        if (!this.state.selectedPair || !window.walletManager?.isConnected()) {
            this.setState({
                loadError: 'Wallet not connected',
                isLoading: false
            });
            return;
        }

        try {
            this.setState({
                isLoading: true,
                loadError: null,
                isLoadingBalance: true,
                isLoadingStakeInfo: true,
                isLoadingRewards: true
            });

            const { selectedPair } = this.state;
            const userAddress = window.walletManager.getAddress();

            // Load data in parallel with individual error handling
            const [tokenInfo, balance, pendingRewards, userStakeInfo] = await Promise.allSettled([
                window.contractManager.getTokenInfo(selectedPair.lpToken),
                window.contractManager.getERC20Balance(userAddress, selectedPair.lpToken),
                window.contractManager.getPendingRewards(userAddress, selectedPair.lpToken),
                window.contractManager.getUserStakeInfo(userAddress, selectedPair.lpToken)
            ]);

            // Process token info
            if (tokenInfo.status === 'fulfilled') {
                this.setState({ tokenInfo: tokenInfo.value });
            } else {
                throw new Error('Failed to load token information');
            }

            // Process balance
            if (balance.status === 'fulfilled') {
                const formattedBalance = parseFloat(
                    window.ethers.formatUnits(balance.value, tokenInfo.value.decimals)
                );
                this.setState({
                    balance: formattedBalance,
                    isLoadingBalance: false,
                    balanceRefreshTime: Date.now()
                });
            } else {
                this.setState({
                    balance: 0,
                    isLoadingBalance: false,
                    lastRefreshError: 'Failed to load balance'
                });
            }

            // Process pending rewards
            if (pendingRewards.status === 'fulfilled') {
                this.setState({
                    pendingRewards: parseFloat(window.ethers.formatEther(pendingRewards.value)),
                    isLoadingRewards: false
                });
            } else {
                this.setState({
                    pendingRewards: 0,
                    isLoadingRewards: false
                });
            }

            // Process user stake info
            if (userStakeInfo.status === 'fulfilled') {
                this.setState({
                    userStakeInfo: {
                        amount: parseFloat(window.ethers.formatEther(userStakeInfo.value.amount)),
                        pendingRewards: parseFloat(window.ethers.formatEther(userStakeInfo.value.pendingRewards)),
                        lastRewardTime: userStakeInfo.value.lastRewardTime
                    },
                    isLoadingStakeInfo: false
                });
            } else {
                this.setState({
                    userStakeInfo: {
                        amount: 0,
                        pendingRewards: 0,
                        lastRewardTime: 0
                    },
                    isLoadingStakeInfo: false
                });
            }

            // Announce successful load
            this.announceToScreenReader('Staking data loaded successfully');

        } catch (error) {
            this.logError('Failed to load pair data:', error);
            this.setState({
                loadError: error.message || 'Failed to load staking data',
                isLoadingBalance: false,
                isLoadingStakeInfo: false,
                isLoadingRewards: false
            });
            window.notificationManager?.error('Error', 'Failed to load staking data');
        } finally {
            this.setState({ isLoading: false });
        }
    }

    /**
     * Refresh balance data without full reload
     */
    async refreshBalanceData() {
        if (!this.state.selectedPair || !window.walletManager?.isConnected() || this.state.isLoading) {
            return;
        }

        try {
            const { selectedPair, tokenInfo } = this.state;
            const userAddress = window.walletManager.getAddress();

            // Refresh balance and rewards in parallel
            const [balance, pendingRewards] = await Promise.allSettled([
                window.contractManager.getERC20Balance(userAddress, selectedPair.lpToken),
                window.contractManager.getPendingRewards(userAddress, selectedPair.lpToken)
            ]);

            let hasUpdates = false;

            if (balance.status === 'fulfilled' && tokenInfo) {
                const newBalance = parseFloat(
                    window.ethers.formatUnits(balance.value, tokenInfo.decimals)
                );
                if (Math.abs(newBalance - this.state.balance) > 0.0001) {
                    this.setState({
                        balance: newBalance,
                        balanceRefreshTime: Date.now()
                    });
                    hasUpdates = true;
                }
            }

            if (pendingRewards.status === 'fulfilled') {
                const newRewards = parseFloat(window.ethers.formatEther(pendingRewards.value));
                if (Math.abs(newRewards - this.state.pendingRewards) > 0.0001) {
                    this.setState({ pendingRewards: newRewards });
                    hasUpdates = true;
                }
            }

            if (hasUpdates) {
                this.announceToScreenReader('Balance updated');
                // Re-validate amounts if they changed
                this.validateCurrentAmounts();
            }

        } catch (error) {
            this.logError('Failed to refresh balance data:', error);
            this.setState({ lastRefreshError: 'Failed to refresh data' });
        }
    }

    /**
     * Validate current amounts after balance updates
     */
    validateCurrentAmounts() {
        if (this.state.stakeAmount) {
            this.validateStakeAmount(this.state.stakeAmount);
        }
        if (this.state.unstakeAmount) {
            this.validateUnstakeAmount(this.state.unstakeAmount);
        }
    }

    /**
     * Advanced stake amount validation
     */
    validateStakeAmount(amount) {
        const { balance, tokenInfo, selectedPair } = this.state;

        // Clear previous validation timer
        if (this.validationDebounce) {
            clearTimeout(this.validationDebounce);
        }

        this.validationDebounce = setTimeout(() => {
            let error = '';
            let isValid = false;

            if (!amount || amount === '') {
                error = '';
                isValid = false;
            } else {
                const numAmount = parseFloat(amount);

                if (isNaN(numAmount)) {
                    error = 'Please enter a valid number';
                } else if (numAmount < 0) {
                    error = 'Amount cannot be negative';
                } else if (numAmount === 0) {
                    error = 'Amount must be greater than zero';
                } else if (selectedPair?.weight === 0) {
                    error = 'This pair is currently disabled for staking';
                } else if (numAmount > balance) {
                    error = `Insufficient balance. Available: ${this.formatTokenAmount(balance, tokenInfo?.symbol)}`;
                } else if (tokenInfo && this.hasExcessiveDecimals(amount, tokenInfo.decimals)) {
                    error = `Maximum ${tokenInfo.decimals} decimal places allowed`;
                } else if (numAmount < 0.0001) {
                    error = 'Minimum stake amount is 0.0001';
                } else {
                    isValid = true;
                }
            }

            this.setState({
                stakeAmountError: error,
                stakeIsValid: isValid
            });

            if (error) {
                this.announceToScreenReader(`Stake validation error: ${error}`);
            }
        }, 300);
    }

    /**
     * Advanced unstake amount validation
     */
    validateUnstakeAmount(amount) {
        const { userStakeInfo, tokenInfo } = this.state;

        // Clear previous validation timer
        if (this.validationDebounce) {
            clearTimeout(this.validationDebounce);
        }

        this.validationDebounce = setTimeout(() => {
            let error = '';
            let isValid = false;
            const stakedAmount = userStakeInfo?.amount || 0;

            if (!amount || amount === '') {
                error = '';
                isValid = false;
            } else {
                const numAmount = parseFloat(amount);

                if (isNaN(numAmount)) {
                    error = 'Please enter a valid number';
                } else if (numAmount < 0) {
                    error = 'Amount cannot be negative';
                } else if (numAmount === 0) {
                    error = 'Amount must be greater than zero';
                } else if (stakedAmount === 0) {
                    error = 'No tokens staked to unstake';
                } else if (numAmount > stakedAmount) {
                    error = `Insufficient staked amount. Available: ${this.formatTokenAmount(stakedAmount, tokenInfo?.symbol)}`;
                } else if (tokenInfo && this.hasExcessiveDecimals(amount, tokenInfo.decimals)) {
                    error = `Maximum ${tokenInfo.decimals} decimal places allowed`;
                } else if (numAmount < 0.0001) {
                    error = 'Minimum unstake amount is 0.0001';
                } else {
                    isValid = true;
                }
            }

            this.setState({
                unstakeAmountError: error,
                unstakeIsValid: isValid
            });

            if (error) {
                this.announceToScreenReader(`Unstake validation error: ${error}`);
            }
        }, 300);
    }

    /**
     * Check if amount has excessive decimal places
     */
    hasExcessiveDecimals(amount, maxDecimals) {
        const decimalPart = amount.toString().split('.')[1];
        return decimalPart && decimalPart.length > maxDecimals;
    }

    /**
     * Sanitize input to prevent injection and ensure valid format
     */
    sanitizeInput(value) {
        if (!value) return '';

        // Remove any non-numeric characters except decimal point
        let sanitized = value.toString().replace(/[^0-9.]/g, '');

        // Ensure only one decimal point
        const parts = sanitized.split('.');
        if (parts.length > 2) {
            sanitized = parts[0] + '.' + parts.slice(1).join('');
        }

        // Remove leading zeros except for decimal numbers
        if (sanitized.length > 1 && sanitized[0] === '0' && sanitized[1] !== '.') {
            sanitized = sanitized.substring(1);
        }

        return sanitized;
    }

    /**
     * Format token amount for display
     */
    formatTokenAmount(amount, symbol = '') {
        if (amount === 0) return `0 ${symbol}`.trim();

        const formatted = amount < 0.0001
            ? amount.toExponential(2)
            : amount.toFixed(4).replace(/\.?0+$/, '');

        return `${formatted} ${symbol}`.trim();
    }

    /**
     * Handle tab change with validation
     */
    handleTabChange(tabIndex) {
        this.setState({ activeTab: tabIndex });
        this.updateModalContent();
        this.setInitialFocus(tabIndex);

        // Announce tab change
        const tabNames = ['Stake', 'Unstake', 'Claim'];
        this.announceToScreenReader(`Switched to ${tabNames[tabIndex]} tab`);
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
     * Handle stake amount input change with enhanced validation
     */
    handleStakeAmountChange(value) {
        const { balance } = this.state;

        // Sanitize input
        const sanitizedValue = this.sanitizeInput(value);

        this.setState({
            isStakeSliderChange: false,
            stakeAmount: sanitizedValue
        });

        if (!sanitizedValue) {
            this.setState({
                stakePercent: 0,
                stakeAmountError: '',
                stakeIsValid: false
            });
            return;
        }

        const numValue = parseFloat(sanitizedValue);
        if (!isNaN(numValue) && numValue >= 0) {
            // Update percentage
            const newPercent = balance > 0 ? Math.min((numValue * 100) / balance, 100) : 0;
            this.setState({ stakePercent: newPercent });
        }

        // Validate the amount
        this.validateStakeAmount(sanitizedValue);
    }

    /**
     * Handle unstake amount input change with enhanced validation
     */
    handleUnstakeAmountChange(value) {
        const { userStakeInfo } = this.state;

        // Sanitize input
        const sanitizedValue = this.sanitizeInput(value);

        this.setState({
            isUnstakeSliderChange: false,
            unstakeAmount: sanitizedValue
        });

        if (!sanitizedValue) {
            this.setState({
                unstakePercent: 0,
                unstakeAmountError: '',
                unstakeIsValid: false
            });
            return;
        }

        if (!userStakeInfo) {
            this.setState({
                unstakePercent: 0,
                unstakeAmountError: 'No staking information available',
                unstakeIsValid: false
            });
            return;
        }

        const numValue = parseFloat(sanitizedValue);
        if (!isNaN(numValue) && numValue >= 0) {
            // Update percentage
            const stakedAmount = userStakeInfo.amount;
            const newPercent = stakedAmount > 0 ? Math.min((numValue * 100) / stakedAmount, 100) : 0;
            this.setState({ unstakePercent: newPercent });
        }

        // Validate the amount
        this.validateUnstakeAmount(sanitizedValue);
    }

    /**
     * Handle stake slider change with smooth updates
     */
    handleStakeSliderChange(percent) {
        const { balance } = this.state;

        const amount = (percent * balance) / 100;
        const formattedAmount = amount > 0 ? amount.toFixed(6).replace(/\.?0+$/, '') : '';

        this.setState({
            isStakeSliderChange: true,
            stakePercent: percent,
            stakeAmount: formattedAmount,
            stakeAmountError: '',
            stakeIsValid: amount > 0 && amount <= balance
        });

        // Announce percentage change
        if (percent % 25 === 0) { // Announce at quarter intervals
            this.announceToScreenReader(`Stake percentage: ${percent}%`);
        }
    }

    /**
     * Handle unstake slider change with smooth updates
     */
    handleUnstakeSliderChange(percent) {
        const { userStakeInfo } = this.state;

        if (!userStakeInfo) return;

        const amount = (percent * userStakeInfo.amount) / 100;
        const formattedAmount = amount > 0 ? amount.toFixed(6).replace(/\.?0+$/, '') : '';

        this.setState({
            isUnstakeSliderChange: true,
            unstakePercent: percent,
            unstakeAmount: formattedAmount,
            unstakeAmountError: '',
            unstakeIsValid: amount > 0 && amount <= userStakeInfo.amount
        });

        // Announce percentage change
        if (percent % 25 === 0) { // Announce at quarter intervals
            this.announceToScreenReader(`Unstake percentage: ${percent}%`);
        }
    }

    /**
     * Handle max amount button click
     */
    handleMaxAmount(type) {
        if (type === 'stake') {
            const { balance } = this.state;
            this.handleStakeAmountChange(balance.toString());
            this.announceToScreenReader(`Set to maximum stake amount: ${this.formatTokenAmount(balance)}`);
        } else if (type === 'unstake') {
            const { userStakeInfo } = this.state;
            if (userStakeInfo) {
                this.handleUnstakeAmountChange(userStakeInfo.amount.toString());
                this.announceToScreenReader(`Set to maximum unstake amount: ${this.formatTokenAmount(userStakeInfo.amount)}`);
            }
        }
    }

    /**
     * Handle quick percentage buttons
     */
    handleQuickPercentage(percent, type) {
        if (type === 'stake') {
            this.handleStakeSliderChange(percent);
        } else if (type === 'unstake') {
            this.handleUnstakeSliderChange(percent);
        }

        this.announceToScreenReader(`Set ${type} percentage to ${percent}%`);
    }

    /**
     * Handle keyboard navigation
     */
    handleKeyboardNavigation(event) {
        const { activeTab } = this.state;

        switch (event.key) {
            case 'ArrowLeft':
                if (activeTab > 0) {
                    event.preventDefault();
                    this.handleTabChange(activeTab - 1);
                }
                break;
            case 'ArrowRight':
                if (activeTab < 2) {
                    event.preventDefault();
                    this.handleTabChange(activeTab + 1);
                }
                break;
            case 'Escape':
                event.preventDefault();
                this.hide();
                break;
            case 'Enter':
                if (event.target.classList.contains('tab-button')) {
                    event.preventDefault();
                    const tabIndex = parseInt(event.target.dataset.tab);
                    this.handleTabChange(tabIndex);
                }
                break;
        }
    }

    /**
     * Render component with enhanced features
     */
    async render() {
        const { selectedPair, activeTab, tokenInfo, isLoading, loadError, announceMessage } = this.state;

        if (loadError) {
            return this.renderError();
        }

        if (!selectedPair || !tokenInfo || isLoading) {
            return this.renderLoading();
        }

        return `
            <div class="staking-modal-content" role="dialog" aria-labelledby="staking-modal-title" aria-describedby="staking-modal-description">
                ${announceMessage ? `<div class="sr-only" aria-live="polite" aria-atomic="true">${announceMessage}</div>` : ''}
                ${this.renderHeader()}
                ${this.renderTabs()}
                <div class="modal-divider"></div>
                ${this.renderTabContent()}
                ${this.renderRefreshIndicator()}
            </div>
        `;
    }

    /**
     * Render loading modal for initial display
     */
    renderLoadingModal() {
        const { selectedPair } = this.state;

        return `
            <div class="staking-modal-loading" role="dialog" aria-labelledby="loading-title" aria-describedby="loading-description">
                <div class="loading-header">
                    <h2 id="loading-title">${selectedPair?.pairName || 'Loading'} Staking</h2>
                </div>
                <div class="loading-content">
                    <div class="loading-spinner" aria-hidden="true"></div>
                    <p id="loading-description">Loading staking data...</p>
                    <div class="loading-steps">
                        <div class="loading-step ${this.state.isLoadingBalance ? 'active' : 'complete'}">
                            <span class="step-icon">${this.state.isLoadingBalance ? '⏳' : '✅'}</span>
                            <span>Loading balance</span>
                        </div>
                        <div class="loading-step ${this.state.isLoadingStakeInfo ? 'active' : 'complete'}">
                            <span class="step-icon">${this.state.isLoadingStakeInfo ? '⏳' : '✅'}</span>
                            <span>Loading stake info</span>
                        </div>
                        <div class="loading-step ${this.state.isLoadingRewards ? 'active' : 'complete'}">
                            <span class="step-icon">${this.state.isLoadingRewards ? '⏳' : '✅'}</span>
                            <span>Loading rewards</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render enhanced loading state
     */
    renderLoading() {
        const { selectedPair } = this.state;

        return `
            <div class="staking-modal-loading" aria-live="polite">
                <div class="loading-spinner" aria-hidden="true"></div>
                <p>Loading ${selectedPair?.pairName || 'staking'} data...</p>
                <div class="loading-progress">
                    <div class="progress-bar" style="width: 60%"></div>
                </div>
            </div>
        `;
    }

    /**
     * Render error state with recovery options
     */
    renderError() {
        const { loadError, selectedPair } = this.state;

        return `
            <div class="staking-modal-error" role="alert" aria-labelledby="error-title">
                <div class="error-icon" aria-hidden="true">⚠️</div>
                <h3 id="error-title">Failed to Load Staking Data</h3>
                <p class="error-message">${loadError}</p>
                <div class="error-actions">
                    <button class="retry-button" onclick="window.stakingModal.loadPairData()">
                        <svg class="button-icon" viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"/>
                        </svg>
                        Retry
                    </button>
                    <button class="close-button" onclick="window.stakingModal.hide()">
                        Close
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render refresh indicator
     */
    renderRefreshIndicator() {
        const { balanceRefreshTime, lastRefreshError } = this.state;

        if (!balanceRefreshTime && !lastRefreshError) return '';

        const timeAgo = balanceRefreshTime ? Math.floor((Date.now() - balanceRefreshTime) / 1000) : 0;

        return `
            <div class="refresh-indicator">
                ${lastRefreshError ? `
                    <div class="refresh-error" role="alert">
                        <span class="error-icon" aria-hidden="true">⚠️</span>
                        <span>${lastRefreshError}</span>
                        <button class="refresh-retry" onclick="window.stakingModal.refreshBalanceData()" aria-label="Retry refresh">
                            🔄
                        </button>
                    </div>
                ` : `
                    <div class="refresh-success">
                        <span class="success-icon" aria-hidden="true">✅</span>
                        <span>Updated ${timeAgo}s ago</span>
                    </div>
                `}
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
     * Render enhanced stake tab with validation and accessibility
     */
    renderStakeTab() {
        const {
            stakeAmount,
            stakePercent,
            balance,
            tokenInfo,
            isLoading,
            selectedPair,
            stakeAmountError,
            stakeIsValid,
            isLoadingBalance
        } = this.state;

        const isDisabled = selectedPair?.weight === 0 || !stakeIsValid || isLoading;
        const hasError = !!stakeAmountError;

        return `
            <div class="tab-content stake-tab" role="tabpanel" aria-labelledby="stake-tab-button" tabindex="0">
                <div class="input-section">
                    <div class="input-group ${hasError ? 'has-error' : ''}">
                        <label class="input-label" for="stakeAmountInput">
                            Amount to Stake
                            <span class="required-indicator" aria-label="required">*</span>
                        </label>
                        <div class="input-wrapper">
                            <input
                                type="text"
                                id="stakeAmountInput"
                                class="amount-input ${hasError ? 'error' : ''}"
                                data-ref="stakeAmountInput"
                                placeholder="0.0"
                                value="${stakeAmount}"
                                aria-describedby="stake-amount-error stake-amount-help"
                                aria-invalid="${hasError}"
                                autocomplete="off"
                                inputmode="decimal"
                            />
                            <span class="input-suffix">${tokenInfo?.symbol || ''}</span>
                            <button
                                class="max-button"
                                type="button"
                                onclick="window.stakingModal.handleMaxAmount('stake')"
                                aria-label="Set maximum amount"
                                ${isLoadingBalance ? 'disabled' : ''}
                            >
                                MAX
                            </button>
                        </div>
                        ${hasError ? `
                            <div id="stake-amount-error" class="error-message" role="alert" aria-live="polite">
                                <svg class="error-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                                    <path fill="currentColor" d="M12,2L13.09,8.26L22,9L13.09,9.74L12,16L10.91,9.74L2,9L10.91,8.26L12,2Z"/>
                                </svg>
                                ${stakeAmountError}
                            </div>
                        ` : ''}
                        <div id="stake-amount-help" class="input-help">
                            Enter the amount of ${tokenInfo?.symbol || 'tokens'} you want to stake
                        </div>
                    </div>

                    <div class="slider-group">
                        <label class="slider-label" for="stakeSlider">
                            Percentage: ${stakePercent.toFixed(1)}%
                        </label>
                        <div class="slider-wrapper">
                            <input
                                type="range"
                                id="stakeSlider"
                                class="percentage-slider"
                                data-ref="stakeSlider"
                                min="0"
                                max="100"
                                value="${stakePercent}"
                                step="1"
                                aria-describedby="slider-help"
                                aria-label="Stake percentage slider"
                            />
                            <div class="slider-marks" aria-hidden="true">
                                <span>0%</span>
                                <span>25%</span>
                                <span>50%</span>
                                <span>75%</span>
                                <span>100%</span>
                            </div>
                        </div>
                        <div id="slider-help" class="slider-help">
                            Use the slider or quick buttons to set percentage
                        </div>
                        <div class="quick-percentage-buttons">
                            <button type="button" class="quick-btn" onclick="window.stakingModal.handleQuickPercentage(25, 'stake')" aria-label="Set 25 percent">25%</button>
                            <button type="button" class="quick-btn" onclick="window.stakingModal.handleQuickPercentage(50, 'stake')" aria-label="Set 50 percent">50%</button>
                            <button type="button" class="quick-btn" onclick="window.stakingModal.handleQuickPercentage(75, 'stake')" aria-label="Set 75 percent">75%</button>
                            <button type="button" class="quick-btn" onclick="window.stakingModal.handleQuickPercentage(100, 'stake')" aria-label="Set 100 percent">100%</button>
                        </div>
                    </div>

                    <div class="balance-info" ${isLoadingBalance ? 'aria-busy="true"' : ''}>
                        <svg class="wallet-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                            <path fill="currentColor" d="M21 18V19C21 20.1 20.1 21 19 21H5C3.89 21 3 20.1 3 19V5C3 3.9 3.89 3 5 3H19C20.1 3 21 3.9 21 5V6H12C10.89 6 10 6.89 10 8V16C10 17.11 10.89 18 12 18H21M12 16H22V8H12V16M16 13.5C15.17 13.5 14.5 12.83 14.5 12S15.17 10.5 16 10.5 17.5 11.17 17.5 12 16.83 13.5 16 13.5Z"/>
                        </svg>
                        <span>
                            Available Balance:
                            ${isLoadingBalance ?
                                '<span class="loading-text">Loading...</span>' :
                                `<strong>${this.formatTokenAmount(balance, tokenInfo?.symbol)}</strong>`
                            }
                        </span>
                    </div>

                    ${selectedPair?.weight === 0 ? `
                        <div class="warning-message" role="alert">
                            <svg class="warning-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                                <path fill="currentColor" d="M12,2L13.09,8.26L22,9L13.09,9.74L12,16L10.91,9.74L2,9L10.91,8.26L12,2Z"/>
                            </svg>
                            This pair is currently disabled for staking
                        </div>
                    ` : ''}
                </div>

                <button
                    class="action-button stake-button ${isDisabled ? 'disabled' : ''}"
                    data-ref="stakeButton"
                    type="button"
                    ${isDisabled ? 'disabled' : ''}
                    aria-describedby="stake-button-help"
                >
                    <svg class="button-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                        <path fill="currentColor" d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 21H5V3H13V9H19V21Z"/>
                    </svg>
                    ${isLoading ? 'Staking...' : 'Stake Tokens'}
                </button>
                <div id="stake-button-help" class="button-help">
                    ${isDisabled ?
                        (selectedPair?.weight === 0 ? 'Staking disabled for this pair' :
                         !stakeIsValid ? 'Enter a valid amount to stake' :
                         'Please wait...') :
                        `Stake ${stakeAmount || '0'} ${tokenInfo?.symbol || 'tokens'}`
                    }
                </div>
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
