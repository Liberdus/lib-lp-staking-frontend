/**
 * Staking Modal Component - Matches React StakingModal.tsx exactly
 * Professional modal with tabs, sliders, and form controls
 */

class StakingModalNew {
    constructor() {
        this.isOpen = false;
        this.currentPair = null;
        this.currentTab = 'stake';
        this.stakeAmount = '';
        this.unstakeAmount = '';
        this.userBalance = '0.00';
        this.userStaked = '0.00';
        this.pendingRewards = '0.00';

        // Set global reference immediately
        window.stakingModal = this;
        window.stakingModalNew = this;

        this.init();
    }

    init() {
        this.createModal();
        this.attachEventListeners();
    }

    createModal() {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;

        // Create modal HTML matching React version exactly
        const modalHTML = `
            <div id="staking-modal-new" class="modal-overlay" style="display: none;">
                <div class="modal-backdrop" onclick="safeModalClose()"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-title-section">
                            <h2 class="modal-title">Staking</h2>
                            <div class="pair-info" id="modal-pair-info">
                                <!-- Pair info will be populated -->
                            </div>
                        </div>
                        <button class="modal-close" onclick="safeModalClose()">
                            <span class="material-icons">close</span>
                        </button>
                    </div>
                    
                    <div class="modal-tabs">
                        <button class="tab-button active" data-tab="stake">
                            <span class="material-icons">add</span>
                            Stake
                        </button>
                        <button class="tab-button" data-tab="unstake">
                            <span class="material-icons">remove</span>
                            Unstake
                        </button>
                        <button class="tab-button" data-tab="claim">
                            <span class="material-icons">redeem</span>
                            Claim
                        </button>
                    </div>
                    
                    <div class="modal-body">
                        <div id="tab-content">
                            <!-- Tab content will be rendered here -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        modalContainer.innerHTML = modalHTML;
        this.addModalStyles();
    }

    addModalStyles() {
        if (document.getElementById('staking-modal-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'staking-modal-styles';
        styles.textContent = `
            /* Modal Overlay */
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 1300;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s ease;
            }

            .modal-overlay.open {
                opacity: 1;
            }

            .modal-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
            }

            /* Modal Content */
            .modal-content {
                position: relative;
                background: var(--background-paper);
                border-radius: 12px;
                box-shadow: var(--shadow-8);
                width: 90%;
                max-width: 600px;
                max-height: 90vh;
                overflow: hidden;
                transform: scale(0.9) translateY(20px);
                transition: transform 0.3s ease;
            }

            .modal-overlay.open .modal-content {
                transform: scale(1) translateY(0);
            }

            /* Modal Header */
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                padding: var(--spacing-3);
                border-bottom: 1px solid var(--divider);
            }

            .modal-title-section {
                flex: 1;
            }

            .modal-title {
                font-size: 24px;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: var(--spacing-1);
            }

            .pair-info {
                display: flex;
                align-items: center;
                gap: var(--spacing-1);
                color: var(--text-secondary);
                font-size: 14px;
            }

            .modal-close {
                background: transparent;
                border: none;
                color: var(--text-secondary);
                cursor: pointer;
                padding: var(--spacing-1);
                border-radius: 50%;
                transition: all 0.2s;
            }

            .modal-close:hover {
                background: var(--action-hover);
                color: var(--text-primary);
            }

            /* Modal Tabs */
            .modal-tabs {
                display: flex;
                border-bottom: 1px solid var(--divider);
            }

            .tab-button {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: var(--spacing-1);
                padding: var(--spacing-2);
                border: none;
                background: transparent;
                color: var(--text-secondary);
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                border-bottom: 2px solid transparent;
            }

            .tab-button:hover {
                background: var(--action-hover);
                color: var(--text-primary);
            }

            .tab-button.active {
                color: var(--primary-main);
                border-bottom-color: var(--primary-main);
                background: var(--action-selected);
            }

            /* Modal Body */
            .modal-body {
                padding: var(--spacing-3);
                max-height: 60vh;
                overflow-y: auto;
            }

            /* Form Styles */
            .form-group {
                margin-bottom: var(--spacing-3);
            }

            .form-label {
                display: block;
                margin-bottom: var(--spacing-1);
                font-weight: 600;
                color: var(--text-primary);
            }

            .form-input {
                width: 100%;
                padding: var(--spacing-2);
                border: 2px solid var(--divider);
                border-radius: var(--border-radius);
                background: var(--background-default);
                color: var(--text-primary);
                font-size: var(--font-size);
                transition: border-color 0.2s;
            }

            .form-input:focus {
                outline: none;
                border-color: var(--primary-main);
            }

            .form-input:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            /* Slider Styles */
            .slider-container {
                margin: var(--spacing-2) 0;
            }

            .slider {
                width: 100%;
                height: 6px;
                border-radius: 3px;
                background: var(--divider);
                outline: none;
                -webkit-appearance: none;
                appearance: none;
            }

            .slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: var(--primary-main);
                cursor: pointer;
                box-shadow: var(--shadow-1);
            }

            .slider::-moz-range-thumb {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: var(--primary-main);
                cursor: pointer;
                border: none;
                box-shadow: var(--shadow-1);
            }

            /* Percentage Buttons */
            .percentage-buttons {
                display: flex;
                gap: var(--spacing-1);
                margin-top: var(--spacing-1);
            }

            .percentage-btn {
                flex: 1;
                padding: var(--spacing-1);
                border: 1px solid var(--divider);
                background: transparent;
                color: var(--text-secondary);
                border-radius: var(--border-radius);
                cursor: pointer;
                transition: all 0.2s;
                font-size: 12px;
            }

            .percentage-btn:hover {
                border-color: var(--primary-main);
                color: var(--primary-main);
            }

            .percentage-btn.active {
                background: var(--primary-main);
                color: white;
                border-color: var(--primary-main);
            }

            /* Balance Info */
            .balance-info {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: var(--spacing-2);
                padding: var(--spacing-2);
                background: var(--action-hover);
                border-radius: var(--border-radius);
            }

            .balance-label {
                color: var(--text-secondary);
                font-size: 14px;
            }

            .balance-value {
                color: var(--text-primary);
                font-weight: 600;
            }

            /* Action Buttons */
            .modal-actions {
                display: flex;
                gap: var(--spacing-2);
                margin-top: var(--spacing-3);
            }

            .modal-actions .btn {
                flex: 1;
                padding: var(--spacing-2);
                font-size: var(--font-size);
            }

            /* Responsive */
            @media (max-width: 768px) {
                .modal-content {
                    width: 95%;
                    margin: var(--spacing-2);
                }

                .modal-header {
                    padding: var(--spacing-2);
                }

                .modal-body {
                    padding: var(--spacing-2);
                }

                .tab-button {
                    padding: var(--spacing-1);
                    font-size: 14px;
                }

                .tab-button span:not(.material-icons) {
                    display: none;
                }
            }
        `;

        document.head.appendChild(styles);
    }

    attachEventListeners() {
        // Tab switching
        document.addEventListener('click', (e) => {
            if (e.target.closest('.tab-button')) {
                const tab = e.target.closest('.tab-button').dataset.tab;
                this.switchTab(tab);
            }

            // Percentage buttons
            if (e.target.closest('.percentage-btn')) {
                const percentage = parseInt(e.target.closest('.percentage-btn').dataset.percentage);
                this.setPercentage(percentage);
            }
        });

        // Input changes
        document.addEventListener('input', (e) => {
            if (e.target.id === 'stake-amount-input') {
                this.stakeAmount = e.target.value;
                this.updateSlider('stake');
            }

            if (e.target.id === 'unstake-amount-input') {
                this.unstakeAmount = e.target.value;
                this.updateSlider('unstake');
            }

            if (e.target.classList.contains('amount-slider')) {
                this.updateAmountFromSlider(e.target);
            }
        });

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    async open(pair, tab = 'stake') {
        this.currentPair = pair;
        this.currentTab = tab;
        this.isOpen = true;

        // Update pair info
        this.updatePairInfo();

        // Load user balances if contract manager is ready
        await this.loadUserBalances();

        // Switch to specified tab
        this.switchTab(tab);

        // Show modal
        const modal = document.getElementById('staking-modal-new');
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('open'), 10);
        }

        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    /**
     * Load user balances from contract manager
     */
    async loadUserBalances() {
        try {
            if (!window.contractManager || !window.contractManager.isReady()) {
                console.log('🔄 Contract manager not ready, using default balances');
                this.userBalance = '0.00';
                this.userStaked = '0.00';
                this.pendingRewards = '0.00';
                return;
            }

            if (!window.walletManager || !window.walletManager.address) {
                console.log('🔄 Wallet not connected, using default balances');
                this.userBalance = '0.00';
                this.userStaked = '0.00';
                this.pendingRewards = '0.00';
                return;
            }

            const userAddress = window.walletManager.address;
            const tokenAddress = this.currentPair.address;

            // Get LP token balance
            const lpTokenContract = await window.contractManager.getLPTokenContract(tokenAddress);
            if (lpTokenContract) {
                const balance = await lpTokenContract.balanceOf(userAddress);
                this.userBalance = window.ethers.formatEther(balance);
            }

            // Get user stake info
            const stakeInfo = await window.contractManager.getUserStake(userAddress, tokenAddress);
            if (stakeInfo) {
                this.userStaked = window.ethers.formatEther(stakeInfo.amount || '0');
                this.pendingRewards = window.ethers.formatEther(stakeInfo.rewards || '0');
            }

            console.log('✅ User balances loaded:', {
                balance: this.userBalance,
                staked: this.userStaked,
                rewards: this.pendingRewards
            });

        } catch (error) {
            console.error('❌ Failed to load user balances:', error);
            // Use fallback values
            this.userBalance = '0.00';
            this.userStaked = '0.00';
            this.pendingRewards = '0.00';
        }
    }

    close() {
        const modal = document.getElementById('staking-modal-new');
        if (modal) {
            modal.classList.remove('open');
            setTimeout(() => {
                modal.style.display = 'none';
                this.isOpen = false;
            }, 300);
        }

        // Restore body scroll
        document.body.style.overflow = '';
    }

    updatePairInfo() {
        const pairInfoElement = document.getElementById('modal-pair-info');
        if (!pairInfoElement || !this.currentPair) return;

        pairInfoElement.innerHTML = `
            <span class="material-icons" style="font-size: 16px;">swap_horiz</span>
            ${this.currentPair.token0Symbol}/${this.currentPair.token1Symbol}
            <span class="chip chip-primary" style="margin-left: 8px;">${this.currentPair.platform}</span>
        `;
    }

    switchTab(tab) {
        this.currentTab = tab;

        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Render tab content
        this.renderTabContent();
    }

    renderTabContent() {
        const tabContent = document.getElementById('tab-content');
        if (!tabContent) return;

        switch (this.currentTab) {
            case 'stake':
                tabContent.innerHTML = this.renderStakeTab();
                break;
            case 'unstake':
                tabContent.innerHTML = this.renderUnstakeTab();
                break;
            case 'claim':
                tabContent.innerHTML = this.renderClaimTab();
                break;
        }
    }

    renderStakeTab() {
        return `
            <div class="balance-info">
                <span class="balance-label">Available LP Tokens:</span>
                <span class="balance-value">${this.userBalance} LP</span>
            </div>

            <div class="form-group">
                <label class="form-label">Amount to Stake</label>
                <input
                    type="number"
                    id="stake-amount-input"
                    class="form-input"
                    placeholder="0.00"
                    value="${this.stakeAmount}"
                    min="0"
                    step="0.001"
                >
                <div class="slider-container">
                    <input
                        type="range"
                        class="slider amount-slider"
                        id="stake-slider"
                        min="0"
                        max="100"
                        value="0"
                        data-type="stake"
                    >
                </div>
                <div class="percentage-buttons">
                    <button class="percentage-btn" data-percentage="25">25%</button>
                    <button class="percentage-btn" data-percentage="50">50%</button>
                    <button class="percentage-btn" data-percentage="75">75%</button>
                    <button class="percentage-btn" data-percentage="100">MAX</button>
                </div>
            </div>

            <div class="balance-info">
                <span class="balance-label">Estimated APR:</span>
                <span class="balance-value success-text">${this.currentPair?.apr || '0.00'}%</span>
            </div>

            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="safeModalClose()">Cancel</button>
                <button class="btn btn-primary" onclick="safeModalExecuteStake()" ${!this.stakeAmount || parseFloat(this.stakeAmount) === 0 ? 'disabled' : ''}>
                    <span class="material-icons">add</span>
                    Stake LP Tokens
                </button>
            </div>
        `;
    }

    renderUnstakeTab() {
        return `
            <div class="balance-info">
                <span class="balance-label">Staked LP Tokens:</span>
                <span class="balance-value">${this.userStaked} LP</span>
            </div>

            <div class="form-group">
                <label class="form-label">Amount to Unstake</label>
                <input
                    type="number"
                    id="unstake-amount-input"
                    class="form-input"
                    placeholder="0.00"
                    value="${this.unstakeAmount}"
                    min="0"
                    step="0.001"
                >
                <div class="slider-container">
                    <input
                        type="range"
                        class="slider amount-slider"
                        id="unstake-slider"
                        min="0"
                        max="100"
                        value="0"
                        data-type="unstake"
                    >
                </div>
                <div class="percentage-buttons">
                    <button class="percentage-btn" data-percentage="25">25%</button>
                    <button class="percentage-btn" data-percentage="50">50%</button>
                    <button class="percentage-btn" data-percentage="75">75%</button>
                    <button class="percentage-btn" data-percentage="100">MAX</button>
                </div>
            </div>

            <div class="balance-info">
                <span class="balance-label">Pending Rewards:</span>
                <span class="balance-value success-text">${this.pendingRewards} LIB</span>
            </div>

            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="safeModalClose()">Cancel</button>
                <button class="btn btn-primary" onclick="safeModalExecuteUnstake()" ${!this.unstakeAmount || parseFloat(this.unstakeAmount) === 0 ? 'disabled' : ''}>
                    <span class="material-icons">remove</span>
                    Unstake LP Tokens
                </button>
            </div>
        `;
    }

    renderClaimTab() {
        return `
            <div class="balance-info">
                <span class="balance-label">Pending Rewards:</span>
                <span class="balance-value success-text">${this.pendingRewards} LIB</span>
            </div>

            <div class="balance-info">
                <span class="balance-label">Staked Amount:</span>
                <span class="balance-value">${this.userStaked} LP</span>
            </div>

            <div class="balance-info">
                <span class="balance-label">Current APR:</span>
                <span class="balance-value success-text">${this.currentPair?.apr || '0.00'}%</span>
            </div>

            <div style="text-align: center; margin: var(--spacing-3) 0; color: var(--text-secondary);">
                <span class="material-icons" style="font-size: 48px; color: var(--success-main);">redeem</span>
                <p>Claim your earned rewards</p>
            </div>

            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="safeModalClose()">Cancel</button>
                <button class="btn btn-primary" onclick="safeModalExecuteClaim()" ${parseFloat(this.pendingRewards) === 0 ? 'disabled' : ''}>
                    <span class="material-icons">redeem</span>
                    Claim Rewards
                </button>
            </div>
        `;
    }

    setPercentage(percentage) {
        const maxAmount = this.currentTab === 'stake' ? parseFloat(this.userBalance) : parseFloat(this.userStaked);
        const amount = (maxAmount * percentage / 100).toFixed(6);

        if (this.currentTab === 'stake') {
            this.stakeAmount = amount;
            const input = document.getElementById('stake-amount-input');
            if (input) input.value = amount;
            this.updateSlider('stake');
        } else if (this.currentTab === 'unstake') {
            this.unstakeAmount = amount;
            const input = document.getElementById('unstake-amount-input');
            if (input) input.value = amount;
            this.updateSlider('unstake');
        }

        // Update percentage button states
        document.querySelectorAll('.percentage-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.percentage) === percentage);
        });

        // Re-render to update button states
        this.renderTabContent();
    }

    updateSlider(type) {
        const slider = document.getElementById(`${type}-slider`);
        if (!slider) return;

        const amount = parseFloat(type === 'stake' ? this.stakeAmount : this.unstakeAmount) || 0;
        const maxAmount = parseFloat(type === 'stake' ? this.userBalance : this.userStaked) || 1;
        const percentage = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;

        slider.value = percentage;
    }

    updateAmountFromSlider(slider) {
        const type = slider.dataset.type;
        const percentage = parseFloat(slider.value);
        const maxAmount = parseFloat(type === 'stake' ? this.userBalance : this.userStaked) || 0;
        const amount = (maxAmount * percentage / 100).toFixed(6);

        if (type === 'stake') {
            this.stakeAmount = amount;
            const input = document.getElementById('stake-amount-input');
            if (input) input.value = amount;
        } else if (type === 'unstake') {
            this.unstakeAmount = amount;
            const input = document.getElementById('unstake-amount-input');
            if (input) input.value = amount;
        }
    }

    async executeStake() {
        if (!this.stakeAmount || parseFloat(this.stakeAmount) === 0) return;

        try {
            // Check if contract manager is ready
            if (!window.contractManager || !window.contractManager.isReady()) {
                if (window.notificationManager) {
                    window.notificationManager.show('Contract manager not ready. Please connect your wallet first.', 'error');
                }
                return;
            }

            if (window.notificationManager) {
                window.notificationManager.show('Staking LP tokens...', 'info');
            }

            // Execute real staking transaction
            const result = await window.contractManager.stake(
                this.currentPair.address,
                this.stakeAmount
            );

            if (!result.success) {
                throw new Error(result.error || 'Staking transaction failed');
            }

            if (window.notificationManager) {
                window.notificationManager.show('LP tokens staked successfully!', 'success');
            }

            console.log('✅ Staking transaction successful:', result.hash);
            this.close();

            // Refresh home page data with enhanced method
            if (window.homePage && window.homePage.refreshData) {
                await window.homePage.refreshData();
            } else if (window.homePage && window.homePage.loadData) {
                await window.homePage.loadData();
            }

        } catch (error) {
            console.error('❌ Staking failed:', error);
            if (window.notificationManager) {
                window.notificationManager.show(`Staking failed: ${error.message}`, 'error');
            }
        }
    }

    async executeUnstake() {
        if (!this.unstakeAmount || parseFloat(this.unstakeAmount) === 0) return;

        try {
            // Check if contract manager is ready
            if (!window.contractManager || !window.contractManager.isReady()) {
                if (window.notificationManager) {
                    window.notificationManager.show('Contract manager not ready. Please connect your wallet first.', 'error');
                }
                return;
            }

            if (window.notificationManager) {
                window.notificationManager.show('Unstaking LP tokens...', 'info');
            }

            // Execute real unstaking transaction
            const result = await window.contractManager.unstake(
                this.currentPair.address,
                this.unstakeAmount
            );

            if (!result.success) {
                throw new Error(result.error || 'Unstaking transaction failed');
            }

            if (window.notificationManager) {
                window.notificationManager.show('LP tokens unstaked successfully!', 'success');
            }

            console.log('✅ Unstaking transaction successful:', result.hash);
            this.close();

            // Refresh home page data with enhanced method
            if (window.homePage && window.homePage.refreshData) {
                await window.homePage.refreshData();
            } else if (window.homePage && window.homePage.loadData) {
                await window.homePage.loadData();
            }

        } catch (error) {
            console.error('❌ Unstaking failed:', error);
            if (window.notificationManager) {
                window.notificationManager.show(`Unstaking failed: ${error.message}`, 'error');
            }
        }
    }

    async executeClaim() {
        if (parseFloat(this.pendingRewards) === 0) return;

        try {
            // Check if contract manager is ready
            if (!window.contractManager || !window.contractManager.isReady()) {
                if (window.notificationManager) {
                    window.notificationManager.show('Contract manager not ready. Please connect your wallet first.', 'error');
                }
                return;
            }

            if (window.notificationManager) {
                window.notificationManager.show('Claiming rewards...', 'info');
            }

            // Execute real claim transaction
            const result = await window.contractManager.claimRewards(
                this.currentPair.address
            );

            if (!result.success) {
                throw new Error(result.error || 'Claim transaction failed');
            }

            if (window.notificationManager) {
                window.notificationManager.show('Rewards claimed successfully!', 'success');
            }

            console.log('✅ Claim transaction successful:', result.hash);
            this.close();

            // Refresh home page data with enhanced method
            if (window.homePage && window.homePage.refreshData) {
                await window.homePage.refreshData();
            } else if (window.homePage && window.homePage.loadData) {
                await window.homePage.loadData();
            }

        } catch (error) {
            console.error('❌ Claim failed:', error);
            if (window.notificationManager) {
                window.notificationManager.show(`Claim failed: ${error.message}`, 'error');
            }
        }
    }
}

// Export for global access
window.StakingModalNew = StakingModalNew;

// Initialize staking modal with robust global registration
let stakingModalNew;

// Function to safely initialize modal
function initializeStakingModal() {
    try {
        if (!stakingModalNew) {
            stakingModalNew = new StakingModalNew();

            // Set multiple global references for compatibility
            window.stakingModal = stakingModalNew;
            window.stakingModalNew = stakingModalNew;

            console.log('✅ Staking modal initialized successfully');

            // Dispatch custom event to notify other components
            window.dispatchEvent(new CustomEvent('stakingModalReady', {
                detail: { modal: stakingModalNew }
            }));
        }
        return stakingModalNew;
    } catch (error) {
        console.error('❌ Failed to initialize staking modal:', error);
        return null;
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initializeStakingModal);

// Also initialize immediately if DOM is already ready
if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
} else {
    // DOM is already ready, initialize immediately
    initializeStakingModal();
}

// Provide a global function to get the modal instance safely
window.getStakingModal = function() {
    return stakingModalNew || initializeStakingModal();
};

// Safe modal action handlers for onclick events
window.safeModalClose = function() {
    try {
        const modal = window.stakingModal || window.stakingModalNew || window.getStakingModal();
        if (modal && typeof modal.close === 'function') {
            modal.close();
        } else {
            console.warn('⚠️ Modal close method not available');
        }
    } catch (error) {
        console.error('❌ Error closing modal:', error);
    }
};

window.safeModalExecuteStake = function() {
    try {
        const modal = window.stakingModal || window.stakingModalNew || window.getStakingModal();
        if (modal && typeof modal.executeStake === 'function') {
            modal.executeStake();
        } else {
            console.warn('⚠️ Modal executeStake method not available');
        }
    } catch (error) {
        console.error('❌ Error executing stake:', error);
    }
};

window.safeModalExecuteUnstake = function() {
    try {
        const modal = window.stakingModal || window.stakingModalNew || window.getStakingModal();
        if (modal && typeof modal.executeUnstake === 'function') {
            modal.executeUnstake();
        } else {
            console.warn('⚠️ Modal executeUnstake method not available');
        }
    } catch (error) {
        console.error('❌ Error executing unstake:', error);
    }
};

window.safeModalExecuteClaim = function() {
    try {
        const modal = window.stakingModal || window.stakingModalNew || window.getStakingModal();
        if (modal && typeof modal.executeClaim === 'function') {
            modal.executeClaim();
        } else {
            console.warn('⚠️ Modal executeClaim method not available');
        }
    } catch (error) {
        console.error('❌ Error executing claim:', error);
    }
};
