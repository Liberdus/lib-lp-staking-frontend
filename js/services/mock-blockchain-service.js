/**
 * Mock Blockchain Service
 * Simulates realistic blockchain interactions for client demo
 */

class MockBlockchainService {
    constructor() {
        this.isInitialized = false;
        this.mockData = null;
        this.eventListeners = new Map();
        this.updateInterval = null;
        
        // Initialize if demo mode is enabled
        if (window.DEMO_CONFIG && window.DEMO_CONFIG.ENABLED) {
            this.init();
        }
    }
    
    async init() {
        if (this.isInitialized) return;
        
        console.log('🎭 Initializing Mock Blockchain Service...');
        
        // Load mock data
        this.mockData = JSON.parse(JSON.stringify(window.DEMO_CONFIG.MOCK_CONTRACT_DATA));
        
        // Start real-time updates simulation
        if (window.DEMO_CONFIG.LIVE_UPDATES.enabled) {
            this.startLiveUpdates();
        }
        
        this.isInitialized = true;
        console.log('✅ Mock Blockchain Service initialized');
    }
    
    // Wallet Connection Simulation
    async connectWallet() {
        console.log('🎭 Simulating wallet connection...');
        
        await this.delay(window.DEMO_CONFIG.TRANSACTION_SIMULATION.delays.walletConnect);
        
        if (Math.random() < window.DEMO_CONFIG.TRANSACTION_SIMULATION.successRates.walletConnect) {
            window.DEMO_CONFIG.MOCK_WALLET.connected = true;
            
            this.emitEvent('walletConnected', {
                address: window.DEMO_CONFIG.MOCK_WALLET.address,
                balance: window.DEMO_CONFIG.MOCK_WALLET.balance,
                chainId: 31337
            });
            
            return {
                address: window.DEMO_CONFIG.MOCK_WALLET.address,
                balance: window.DEMO_CONFIG.MOCK_WALLET.balance,
                chainId: 31337
            };
        } else {
            throw new Error('User rejected wallet connection');
        }
    }
    
    // Contract Data Retrieval
    async getContractData() {
        await this.delay(500); // Small delay for realism
        return {
            pairs: this.mockData.pairs.filter(pair => pair.isActive),
            totalTVL: this.mockData.totalTVL,
            totalStakers: this.mockData.totalStakers,
            averageAPR: this.mockData.averageAPR,
            userPortfolio: this.mockData.userPortfolio
        };
    }
    
    async getPairData(pairAddress) {
        await this.delay(300);
        const pair = this.mockData.pairs.find(p => p.address.toLowerCase() === pairAddress.toLowerCase());
        if (!pair) throw new Error('Pair not found');
        return pair;
    }
    
    async getUserStakeInfo(userAddress, pairAddress) {
        await this.delay(200);
        const pair = this.mockData.pairs.find(p => p.address.toLowerCase() === pairAddress.toLowerCase());
        if (!pair) throw new Error('Pair not found');
        
        return {
            amount: pair.userStaked,
            pendingRewards: pair.userPendingRewards,
            lastRewardTime: pair.lastRewardTime
        };
    }
    
    // Transaction Simulations
    async approveToken(tokenAddress, spenderAddress, amount) {
        console.log(`🎭 Simulating token approval: ${amount} tokens`);
        
        await this.delay(window.DEMO_CONFIG.TRANSACTION_SIMULATION.delays.approve);
        
        const result = await window.DEMO_UTILS.simulateTransaction('approve');
        
        // Update mock allowance
        const pair = this.mockData.pairs.find(p => p.address.toLowerCase() === tokenAddress.toLowerCase());
        if (pair) {
            pair.allowance = parseFloat(amount);
        }
        
        this.emitEvent('tokenApproved', { tokenAddress, amount, txHash: result.hash });
        return result;
    }
    
    async stakeTokens(pairAddress, amount) {
        console.log(`🎭 Simulating stake: ${amount} LP tokens`);
        
        await this.delay(window.DEMO_CONFIG.TRANSACTION_SIMULATION.delays.stake);
        
        const result = await window.DEMO_UTILS.simulateTransaction('stake');
        
        // Update mock data
        const pair = this.mockData.pairs.find(p => p.address.toLowerCase() === pairAddress.toLowerCase());
        if (pair) {
            const stakeAmount = parseFloat(amount);
            pair.userStaked += stakeAmount;
            pair.lpTokenBalance -= stakeAmount;
            pair.tvl += stakeAmount * 100; // Assume 1 LP = $100 for demo
            pair.lastRewardTime = Date.now();
            
            // Update portfolio
            this.mockData.userPortfolio.totalStaked += stakeAmount;
            this.mockData.userPortfolio.totalValue += stakeAmount * 100;
        }
        
        this.emitEvent('tokensStaked', { pairAddress, amount, txHash: result.hash });
        return result;
    }
    
    async unstakeTokens(pairAddress, amount) {
        console.log(`🎭 Simulating unstake: ${amount} LP tokens`);
        
        await this.delay(window.DEMO_CONFIG.TRANSACTION_SIMULATION.delays.unstake);
        
        const result = await window.DEMO_UTILS.simulateTransaction('unstake');
        
        // Update mock data
        const pair = this.mockData.pairs.find(p => p.address.toLowerCase() === pairAddress.toLowerCase());
        if (pair) {
            const unstakeAmount = parseFloat(amount);
            pair.userStaked = Math.max(0, pair.userStaked - unstakeAmount);
            pair.lpTokenBalance += unstakeAmount;
            pair.tvl = Math.max(0, pair.tvl - unstakeAmount * 100);
            
            // Update portfolio
            this.mockData.userPortfolio.totalStaked = Math.max(0, this.mockData.userPortfolio.totalStaked - unstakeAmount);
            this.mockData.userPortfolio.totalValue = Math.max(0, this.mockData.userPortfolio.totalValue - unstakeAmount * 100);
        }
        
        this.emitEvent('tokensUnstaked', { pairAddress, amount, txHash: result.hash });
        return result;
    }
    
    async claimRewards(pairAddress) {
        console.log(`🎭 Simulating claim rewards for pair: ${pairAddress}`);
        
        await this.delay(window.DEMO_CONFIG.TRANSACTION_SIMULATION.delays.claim);
        
        const result = await window.DEMO_UTILS.simulateTransaction('claim');
        
        // Update mock data
        const pair = this.mockData.pairs.find(p => p.address.toLowerCase() === pairAddress.toLowerCase());
        if (pair && pair.userPendingRewards > 0) {
            const claimedAmount = pair.userPendingRewards;
            pair.userPendingRewards = 0;
            pair.lastRewardTime = Date.now();
            
            // Update portfolio
            this.mockData.userPortfolio.totalPendingRewards = Math.max(0, this.mockData.userPortfolio.totalPendingRewards - claimedAmount);
            this.mockData.userPortfolio.totalEarned += claimedAmount;
            
            this.emitEvent('rewardsClaimed', { pairAddress, amount: claimedAmount, txHash: result.hash });
        }
        
        return result;
    }
    
    // Admin Functions
    async getAdminData() {
        if (!window.DEMO_CONFIG.MOCK_WALLET.connected) {
            throw new Error('Wallet not connected');
        }
        
        await this.delay(500);
        return this.mockData.adminData;
    }
    
    async proposeAdminAction(actionType, params) {
        console.log(`🎭 Simulating admin proposal: ${actionType}`);
        
        await this.delay(window.DEMO_CONFIG.TRANSACTION_SIMULATION.delays.adminAction);
        
        const result = await window.DEMO_UTILS.simulateTransaction('adminAction');
        
        // Add to pending actions
        const newAction = {
            id: this.mockData.adminData.pendingActions.length + 1,
            type: actionType,
            proposer: window.DEMO_CONFIG.MOCK_WALLET.address,
            ...params,
            approvals: 1,
            requiredApprovals: 3,
            status: 'pending',
            createdAt: Date.now(),
            expiresAt: Date.now() + 604800000 // 7 days
        };
        
        this.mockData.adminData.pendingActions.push(newAction);
        
        this.emitEvent('adminActionProposed', { action: newAction, txHash: result.hash });
        return result;
    }
    
    // Real-time Updates Simulation
    startLiveUpdates() {
        this.updateInterval = setInterval(() => {
            this.simulateRealtimeUpdates();
        }, window.DEMO_CONFIG.LIVE_UPDATES.interval);
    }
    
    simulateRealtimeUpdates() {
        // Update pending rewards
        this.mockData.pairs.forEach(pair => {
            if (pair.userStaked > 0 && pair.isActive) {
                const timeSinceLastUpdate = Date.now() - pair.lastRewardTime;
                const additionalRewards = (pair.rewardRate * timeSinceLastUpdate / 1000) * pair.userStaked;
                pair.userPendingRewards += additionalRewards;
                pair.lastRewardTime = Date.now();
            }
        });
        
        // Update portfolio totals
        this.mockData.userPortfolio.totalPendingRewards = this.mockData.pairs
            .reduce((sum, pair) => sum + pair.userPendingRewards, 0);
        
        // Simulate small price/TVL fluctuations
        this.mockData.pairs.forEach(pair => {
            if (pair.isActive) {
                const fluctuation = (Math.random() - 0.5) * window.DEMO_CONFIG.LIVE_UPDATES.tvlFluctuation;
                pair.tvl *= (1 + fluctuation);
                pair.apr += (Math.random() - 0.5) * 0.5; // Small APR changes
            }
        });
        
        // Update global stats
        this.mockData.totalTVL = this.mockData.pairs.reduce((sum, pair) => sum + pair.tvl, 0);
        this.mockData.averageAPR = this.mockData.pairs
            .filter(pair => pair.isActive)
            .reduce((sum, pair) => sum + pair.apr, 0) / this.mockData.pairs.filter(pair => pair.isActive).length;
        
        // Emit update event
        this.emitEvent('dataUpdated', {
            pairs: this.mockData.pairs,
            userPortfolio: this.mockData.userPortfolio,
            totalTVL: this.mockData.totalTVL,
            averageAPR: this.mockData.averageAPR
        });
    }
    
    // Event System
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }
    
    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }
    
    emitEvent(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }
    
    // Utility Methods
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Cleanup
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.eventListeners.clear();
        this.isInitialized = false;
    }
}

// Global instance
window.mockBlockchainService = new MockBlockchainService();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MockBlockchainService;
}
