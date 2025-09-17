/**
 * ContractManager - Handles smart contract interactions
 * Manages staking contract, ERC20 tokens, and transaction handling
 */
class ContractManager {
    constructor() {
        this.stakingContract = null;
        this.rewardTokenContract = null;
        this.provider = null;
        this.signer = null;
        this.isInitialized = false;
        this.eventListeners = [];
        
        this.log('ContractManager initialized');
    }

    /**
     * Initialize contract manager with wallet provider
     */
    async initialize(provider, signer) {
        try {
            this.provider = provider;
            this.signer = signer;
            
            // Initialize contracts
            await this.initializeContracts();
            
            this.isInitialized = true;
            this.log('ContractManager initialized successfully');
            
            return true;
        } catch (error) {
            this.logError('Failed to initialize ContractManager:', error);
            throw error;
        }
    }

    /**
     * Initialize smart contracts
     */
    async initializeContracts() {
        try {
            // For now, just log that contracts would be initialized
            // This will be implemented in Day 2
            this.log('Contract initialization - to be implemented in Day 2');
            
            // Mock contract addresses for testing
            const stakingAddress = window.CONFIG?.CONTRACTS?.STAKING_CONTRACT;
            const rewardTokenAddress = window.CONFIG?.CONTRACTS?.REWARD_TOKEN;
            
            this.log('Staking contract address:', stakingAddress);
            this.log('Reward token address:', rewardTokenAddress);
            
        } catch (error) {
            this.logError('Failed to initialize contracts:', error);
            throw error;
        }
    }

    /**
     * Check if contracts are initialized
     */
    isReady() {
        return this.isInitialized && this.provider && this.signer;
    }

    /**
     * Get staking contract instance
     */
    getStakingContract() {
        return this.stakingContract;
    }

    /**
     * Get reward token contract instance
     */
    getRewardTokenContract() {
        return this.rewardTokenContract;
    }

    /**
     * Cleanup contract manager
     */
    cleanup() {
        this.eventListeners.forEach(cleanup => {
            try {
                cleanup();
            } catch (error) {
                this.logError('Error cleaning up event listener:', error);
            }
        });
        
        this.eventListeners = [];
        this.stakingContract = null;
        this.rewardTokenContract = null;
        this.provider = null;
        this.signer = null;
        this.isInitialized = false;
        
        this.log('ContractManager cleaned up');
    }

    /**
     * Logging utility
     */
    log(...args) {
        if (window.CONFIG?.DEV?.DEBUG_MODE) {
            console.log('[ContractManager]', ...args);
        }
    }

    /**
     * Error logging utility
     */
    logError(...args) {
        console.error('[ContractManager]', ...args);
    }
}

// Create global instance
window.contractManager = new ContractManager();
