/**
 * ContractManager - Comprehensive smart contract integration with ethers.js v6
 * Handles staking contract, ERC20 tokens, ABI management, and transaction handling
 * Implements provider fallback, gas estimation, and retry logic
 */
class ContractManager {
    constructor() {
        // Contract instances
        this.stakingContract = null;
        this.rewardTokenContract = null;
        this.lpTokenContracts = new Map(); // Map of LP token contracts

        // Provider management
        this.provider = null;
        this.signer = null;
        this.fallbackProviders = [];
        this.currentProviderIndex = 0;

        // State management
        this.isInitialized = false;
        this.eventListeners = [];
        this.contractABIs = new Map();
        this.contractAddresses = new Map();

        // Configuration with enhanced provider fallback
        this.config = {
            maxRetries: 3,
            retryDelay: 1000,
            gasLimitMultiplier: 1.2,
            gasEstimationBuffer: 0.1, // 10% buffer for gas estimation
            providerTimeout: 10000, // 10 seconds
            fallbackRPCs: [
                // Primary public RPCs for Polygon Amoy testnet
                'https://rpc-amoy.polygon.technology',
                'https://polygon-amoy-bor-rpc.publicnode.com',
                'https://endpoints.omniatech.io/v1/matic/amoy/public',
                // Backup RPCs (replace with your API keys)
                'https://polygon-amoy.infura.io/v3/YOUR_INFURA_KEY',
                'https://polygon-amoy.g.alchemy.com/v2/YOUR_ALCHEMY_KEY'
            ],
            networkConfig: {
                chainId: 80002, // Polygon Amoy testnet
                name: 'Polygon Amoy Testnet',
                currency: 'MATIC',
                explorerUrl: 'https://amoy.polygonscan.com'
            }
        };

        this.log('ContractManager initialized with comprehensive features');
    }

    /**
     * Initialize contract manager with comprehensive provider setup
     */
    async initialize(provider, signer) {
        try {
            this.log('Initializing ContractManager with provider and signer...');

            // Set primary provider and signer
            this.provider = provider;
            this.signer = signer;

            // Initialize fallback providers
            await this.initializeFallbackProviders();

            // Load contract ABIs
            await this.loadContractABIs();

            // Load contract addresses
            this.loadContractAddresses();

            // Initialize contract instances
            await this.initializeContracts();

            // Verify contract connections
            await this.verifyContractConnections();

            this.isInitialized = true;
            this.log('ContractManager initialized successfully with all features');

            return true;
        } catch (error) {
            this.logError('Failed to initialize ContractManager:', error);
            await this.handleInitializationError(error);
            throw error;
        }
    }

    /**
     * Initialize fallback providers for redundancy
     */
    async initializeFallbackProviders() {
        try {
            this.fallbackProviders = [];

            for (const rpcUrl of this.config.fallbackRPCs) {
                try {
                    const fallbackProvider = new ethers.JsonRpcProvider(rpcUrl);
                    await fallbackProvider.getNetwork(); // Test connection
                    this.fallbackProviders.push(fallbackProvider);
                    this.log('Fallback provider added:', rpcUrl);
                } catch (error) {
                    this.log('Fallback provider failed:', rpcUrl, error.message);
                }
            }

            this.log(`Initialized ${this.fallbackProviders.length} fallback providers`);
        } catch (error) {
            this.logError('Failed to initialize fallback providers:', error);
        }
    }

    /**
     * Load contract ABIs from configuration or external sources
     */
    async loadContractABIs() {
        try {
            this.log('Loading contract ABIs...');

            // LP Staking Contract ABI (simplified for demo)
            const stakingABI = [
                "function stake(address lpToken, uint256 amount) external",
                "function unstake(address lpToken, uint256 amount) external",
                "function claimRewards(address lpToken) external",
                "function getUserStake(address user, address lpToken) external view returns (uint256)",
                "function getPendingRewards(address user, address lpToken) external view returns (uint256)",
                "function getPoolInfo(address lpToken) external view returns (uint256 totalStaked, uint256 rewardRate, uint256 lastUpdateTime)",
                "function getSupportedTokens() external view returns (address[] memory)",
                "event StakeAdded(address indexed user, address indexed lpToken, uint256 amount)",
                "event StakeRemoved(address indexed user, address indexed lpToken, uint256 amount)",
                "event RewardsClaimed(address indexed user, address indexed lpToken, uint256 amount)"
            ];

            // ERC20 Token ABI (standard)
            const erc20ABI = [
                "function balanceOf(address owner) external view returns (uint256)",
                "function allowance(address owner, address spender) external view returns (uint256)",
                "function approve(address spender, uint256 amount) external returns (bool)",
                "function transfer(address to, uint256 amount) external returns (bool)",
                "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
                "function name() external view returns (string)",
                "function symbol() external view returns (string)",
                "function decimals() external view returns (uint8)",
                "function totalSupply() external view returns (uint256)",
                "event Transfer(address indexed from, address indexed to, uint256 value)",
                "event Approval(address indexed owner, address indexed spender, uint256 value)"
            ];

            // Store ABIs
            this.contractABIs.set('STAKING', stakingABI);
            this.contractABIs.set('ERC20', erc20ABI);

            this.log('Contract ABIs loaded successfully');
        } catch (error) {
            this.logError('Failed to load contract ABIs:', error);
            throw error;
        }
    }

    /**
     * Load contract addresses from configuration
     */
    loadContractAddresses() {
        try {
            this.log('Loading contract addresses...');

            // Load from global config or use defaults for Polygon Amoy testnet
            const addresses = {
                STAKING_CONTRACT: window.CONFIG?.CONTRACTS?.STAKING_CONTRACT || '0x1234567890123456789012345678901234567890',
                REWARD_TOKEN: window.CONFIG?.CONTRACTS?.REWARD_TOKEN || '0x0987654321098765432109876543210987654321',
                LP_TOKENS: window.CONFIG?.CONTRACTS?.LP_TOKENS || {
                    'LIB-USDT': '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
                    'LIB-WETH': '0xfedcbafedcbafedcbafedcbafedcbafedcbafed'
                }
            };

            // Store addresses
            this.contractAddresses.set('STAKING', addresses.STAKING_CONTRACT);
            this.contractAddresses.set('REWARD_TOKEN', addresses.REWARD_TOKEN);

            // Store LP token addresses
            for (const [pair, address] of Object.entries(addresses.LP_TOKENS)) {
                this.contractAddresses.set(`LP_${pair}`, address);
            }

            this.log('Contract addresses loaded:', addresses);
        } catch (error) {
            this.logError('Failed to load contract addresses:', error);
            throw error;
        }
    }

    /**
     * Initialize smart contract instances with comprehensive error handling
     */
    async initializeContracts() {
        try {
            this.log('Initializing smart contract instances...');

            // Initialize staking contract
            const stakingAddress = this.contractAddresses.get('STAKING');
            const stakingABI = this.contractABIs.get('STAKING');

            if (stakingAddress && stakingABI) {
                this.stakingContract = new ethers.Contract(stakingAddress, stakingABI, this.signer);
                this.log('Staking contract initialized:', stakingAddress);
            } else {
                throw new Error('Staking contract address or ABI not found');
            }

            // Initialize reward token contract
            const rewardTokenAddress = this.contractAddresses.get('REWARD_TOKEN');
            const erc20ABI = this.contractABIs.get('ERC20');

            if (rewardTokenAddress && erc20ABI) {
                this.rewardTokenContract = new ethers.Contract(rewardTokenAddress, erc20ABI, this.signer);
                this.log('Reward token contract initialized:', rewardTokenAddress);
            } else {
                throw new Error('Reward token address or ABI not found');
            }

            // Initialize LP token contracts
            await this.initializeLPTokenContracts();

            this.log('All contract instances initialized successfully');
        } catch (error) {
            this.logError('Failed to initialize contracts:', error);
            throw error;
        }
    }

    /**
     * Initialize LP token contracts dynamically
     */
    async initializeLPTokenContracts() {
        try {
            const erc20ABI = this.contractABIs.get('ERC20');

            for (const [key, address] of this.contractAddresses.entries()) {
                if (key.startsWith('LP_')) {
                    const pairName = key.replace('LP_', '');
                    const lpContract = new ethers.Contract(address, erc20ABI, this.signer);
                    this.lpTokenContracts.set(pairName, lpContract);
                    this.log(`LP token contract initialized for ${pairName}:`, address);
                }
            }

            this.log(`Initialized ${this.lpTokenContracts.size} LP token contracts`);
        } catch (error) {
            this.logError('Failed to initialize LP token contracts:', error);
            throw error;
        }
    }

    /**
     * Verify contract connections and basic functionality
     */
    async verifyContractConnections() {
        try {
            this.log('Verifying contract connections...');

            // Test staking contract connection
            if (this.stakingContract) {
                try {
                    await this.stakingContract.getSupportedTokens();
                    this.log('✅ Staking contract connection verified');
                } catch (error) {
                    this.log('⚠️ Staking contract verification failed (may be expected in testnet)');
                }
            }

            // Test reward token contract connection
            if (this.rewardTokenContract) {
                try {
                    await this.rewardTokenContract.name();
                    this.log('✅ Reward token contract connection verified');
                } catch (error) {
                    this.log('⚠️ Reward token contract verification failed (may be expected in testnet)');
                }
            }

            this.log('Contract connection verification completed');
        } catch (error) {
            this.logError('Contract verification failed:', error);
            // Don't throw here as this is just verification
        }
    }

    /**
     * Handle initialization errors with fallback strategies
     */
    async handleInitializationError(error) {
        try {
            this.log('Handling initialization error with fallback strategies...');

            // Try fallback provider if available
            if (this.fallbackProviders.length > 0 && this.currentProviderIndex < this.fallbackProviders.length - 1) {
                this.currentProviderIndex++;
                const fallbackProvider = this.fallbackProviders[this.currentProviderIndex];

                this.log(`Attempting fallback provider ${this.currentProviderIndex + 1}...`);
                this.provider = fallbackProvider;
                this.signer = fallbackProvider.getSigner();

                // Retry initialization with fallback
                await this.initializeContracts();
                return;
            }

            // Log comprehensive error information
            this.logError('All initialization attempts failed:', {
                error: error.message,
                providerIndex: this.currentProviderIndex,
                fallbackProvidersCount: this.fallbackProviders.length
            });

        } catch (fallbackError) {
            this.logError('Fallback initialization also failed:', fallbackError);
        }
    }

    /**
     * Check if contracts are initialized and ready for use
     */
    isReady() {
        return this.isInitialized &&
               this.provider &&
               this.signer &&
               this.stakingContract &&
               this.rewardTokenContract;
    }

    /**
     * Get staking contract instance
     */
    getStakingContract() {
        if (!this.stakingContract) {
            throw new Error('Staking contract not initialized');
        }
        return this.stakingContract;
    }

    /**
     * Get reward token contract instance
     */
    getRewardTokenContract() {
        if (!this.rewardTokenContract) {
            throw new Error('Reward token contract not initialized');
        }
        return this.rewardTokenContract;
    }

    /**
     * Get LP token contract by pair name
     */
    getLPTokenContract(pairName) {
        const contract = this.lpTokenContracts.get(pairName);
        if (!contract) {
            throw new Error(`LP token contract not found for pair: ${pairName}`);
        }
        return contract;
    }

    // ==================== CONTRACT READ OPERATIONS ====================

    /**
     * Get user's stake amount for a specific LP token
     */
    async getUserStake(userAddress, lpTokenAddress) {
        return await this.executeWithRetry(async () => {
            const stake = await this.stakingContract.getUserStake(userAddress, lpTokenAddress);
            return ethers.formatEther(stake);
        }, 'getUserStake');
    }

    /**
     * Get user's pending rewards for a specific LP token
     */
    async getPendingRewards(userAddress, lpTokenAddress) {
        return await this.executeWithRetry(async () => {
            const rewards = await this.stakingContract.getPendingRewards(userAddress, lpTokenAddress);
            return ethers.formatEther(rewards);
        }, 'getPendingRewards');
    }

    /**
     * Get pool information for a specific LP token
     */
    async getPoolInfo(lpTokenAddress) {
        return await this.executeWithRetry(async () => {
            const poolInfo = await this.stakingContract.getPoolInfo(lpTokenAddress);
            return {
                totalStaked: ethers.formatEther(poolInfo.totalStaked),
                rewardRate: ethers.formatEther(poolInfo.rewardRate),
                lastUpdateTime: Number(poolInfo.lastUpdateTime)
            };
        }, 'getPoolInfo');
    }

    /**
     * Get all supported LP tokens
     */
    async getSupportedTokens() {
        return await this.executeWithRetry(async () => {
            return await this.stakingContract.getSupportedTokens();
        }, 'getSupportedTokens');
    }

    /**
     * Get LP token balance for user
     */
    async getLPTokenBalance(userAddress, pairName) {
        return await this.executeWithRetry(async () => {
            const lpContract = this.getLPTokenContract(pairName);
            const balance = await lpContract.balanceOf(userAddress);
            return ethers.formatEther(balance);
        }, 'getLPTokenBalance');
    }

    /**
     * Get LP token allowance for staking contract
     */
    async getLPTokenAllowance(userAddress, pairName) {
        return await this.executeWithRetry(async () => {
            const lpContract = this.getLPTokenContract(pairName);
            const stakingAddress = this.contractAddresses.get('STAKING');
            const allowance = await lpContract.allowance(userAddress, stakingAddress);
            return ethers.formatEther(allowance);
        }, 'getLPTokenAllowance');
    }

    // ==================== CONTRACT WRITE OPERATIONS ====================

    /**
     * Approve LP token for staking with enhanced gas estimation
     */
    async approveLPToken(pairName, amount) {
        return await this.executeTransactionWithRetry(async () => {
            const lpContract = this.getLPTokenContract(pairName);
            const stakingAddress = this.contractAddresses.get('STAKING');
            const amountWei = ethers.parseEther(amount.toString());

            // Enhanced gas estimation
            const gasLimit = await this.estimateGasWithBuffer(lpContract, 'approve', [stakingAddress, amountWei]);
            const gasPrice = await this.getGasPrice();

            // Execute transaction with optimized gas settings
            const tx = await lpContract.approve(stakingAddress, amountWei, {
                gasLimit,
                gasPrice
            });

            this.log('Approve transaction sent:', tx.hash, `Gas: ${gasLimit}, Price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);

            return await tx.wait();
        }, 'approveLPToken');
    }

    /**
     * Stake LP tokens with enhanced gas estimation
     */
    async stakeLPTokens(pairName, amount) {
        return await this.executeTransactionWithRetry(async () => {
            const lpTokenAddress = this.contractAddresses.get(`LP_${pairName}`);
            const amountWei = ethers.parseEther(amount.toString());

            // Enhanced gas estimation
            const gasLimit = await this.estimateGasWithBuffer(this.stakingContract, 'stake', [lpTokenAddress, amountWei]);
            const gasPrice = await this.getGasPrice();

            // Execute transaction with optimized gas settings
            const tx = await this.stakingContract.stake(lpTokenAddress, amountWei, {
                gasLimit,
                gasPrice
            });

            this.log('Stake transaction sent:', tx.hash, `Gas: ${gasLimit}, Price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);

            return await tx.wait();
        }, 'stakeLPTokens');
    }

    /**
     * Unstake LP tokens with enhanced gas estimation
     */
    async unstakeLPTokens(pairName, amount) {
        return await this.executeTransactionWithRetry(async () => {
            const lpTokenAddress = this.contractAddresses.get(`LP_${pairName}`);
            const amountWei = ethers.parseEther(amount.toString());

            // Enhanced gas estimation
            const gasLimit = await this.estimateGasWithBuffer(this.stakingContract, 'unstake', [lpTokenAddress, amountWei]);
            const gasPrice = await this.getGasPrice();

            // Execute transaction with optimized gas settings
            const tx = await this.stakingContract.unstake(lpTokenAddress, amountWei, {
                gasLimit,
                gasPrice
            });

            this.log('Unstake transaction sent:', tx.hash, `Gas: ${gasLimit}, Price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);

            return await tx.wait();
        }, 'unstakeLPTokens');
    }

    /**
     * Claim rewards for LP token with enhanced gas estimation
     */
    async claimRewards(pairName) {
        return await this.executeTransactionWithRetry(async () => {
            const lpTokenAddress = this.contractAddresses.get(`LP_${pairName}`);

            // Enhanced gas estimation
            const gasLimit = await this.estimateGasWithBuffer(this.stakingContract, 'claimRewards', [lpTokenAddress]);
            const gasPrice = await this.getGasPrice();

            // Execute transaction with optimized gas settings
            const tx = await this.stakingContract.claimRewards(lpTokenAddress, {
                gasLimit,
                gasPrice
            });

            this.log('Claim rewards transaction sent:', tx.hash, `Gas: ${gasLimit}, Price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);

            return await tx.wait();
        }, 'claimRewards');
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Execute read operation with enhanced retry logic and error handling
     */
    async executeWithRetry(operation, operationName, retries = this.config.maxRetries) {
        const context = { operation: operationName, contractManager: true };

        return await window.errorHandler.executeWithRetry(async () => {
            try {
                this.log(`Executing ${operationName}`);
                const result = await operation();
                this.log(`${operationName} completed successfully`);
                return result;
            } catch (error) {
                // Enhanced error processing
                const processedError = window.errorHandler.processError(error, context);

                // Try fallback provider for network errors
                if (processedError.category === 'network' && this.canUseFallbackProvider()) {
                    this.log('Network error detected, trying fallback provider...');
                    await this.tryFallbackProvider();
                }

                throw error; // Re-throw for retry logic
            }
        }, context, {
            maxRetries: retries,
            baseDelay: this.config.retryDelay
        });
    }

    /**
     * Execute transaction with enhanced retry logic, gas estimation, and error handling
     */
    async executeTransactionWithRetry(operation, operationName, retries = this.config.maxRetries) {
        const context = { operation: operationName, contractManager: true, transaction: true };

        return await window.errorHandler.executeWithRetry(async () => {
            try {
                this.log(`Executing transaction ${operationName}`);
                const result = await operation();
                this.log(`Transaction ${operationName} completed successfully:`, result.hash);

                // Display success notification
                if (window.stateManager) {
                    const notifications = window.stateManager.get('ui.notifications') || [];
                    window.stateManager.set('ui.notifications', [
                        ...notifications,
                        {
                            id: `tx_${Date.now()}`,
                            type: 'success',
                            title: 'Transaction Successful',
                            message: `${operationName} completed successfully`,
                            timestamp: Date.now(),
                            metadata: { transactionHash: result.hash }
                        }
                    ]);
                }

                return result;
            } catch (error) {
                // Enhanced error processing with user-friendly messages
                const processedError = window.errorHandler.processError(error, context);

                // Display error to user
                window.errorHandler.displayError(processedError, {
                    context: { operation: operationName },
                    showTechnical: window.CONFIG?.DEV?.DEBUG_MODE
                });

                // Try fallback provider for network errors
                if (processedError.category === 'network' && this.canUseFallbackProvider()) {
                    this.log('Network error detected, trying fallback provider...');
                    await this.tryFallbackProvider();
                }

                throw error; // Re-throw for retry logic
            }
        }, context, {
            maxRetries: retries,
            baseDelay: this.config.retryDelay
        });
    }

    /**
     * Enhanced gas estimation with buffer and fallback
     */
    async estimateGasWithBuffer(contract, methodName, args = [], options = {}) {
        try {
            this.log(`Estimating gas for ${methodName}...`);

            // Get base gas estimate
            const gasEstimate = await contract[methodName].estimateGas(...args, options);

            // Add buffer for safety
            const buffer = this.config.gasEstimationBuffer;
            const gasWithBuffer = Math.floor(Number(gasEstimate) * (1 + buffer));

            // Apply multiplier from config
            const finalGasLimit = Math.floor(gasWithBuffer * this.config.gasLimitMultiplier);

            this.log(`Gas estimation: base=${gasEstimate}, withBuffer=${gasWithBuffer}, final=${finalGasLimit}`);

            return finalGasLimit;
        } catch (error) {
            this.logError('Gas estimation failed:', error);

            // Fallback to default gas limits based on operation type
            const fallbackGasLimits = {
                'approve': 60000,
                'stake': 150000,
                'unstake': 120000,
                'claimRewards': 100000,
                'transfer': 21000
            };

            const fallbackGas = fallbackGasLimits[methodName] || 200000;
            this.log(`Using fallback gas limit: ${fallbackGas}`);

            return fallbackGas;
        }
    }

    /**
     * Get current gas price with fallback
     */
    async getGasPrice() {
        try {
            const gasPrice = await this.provider.getGasPrice();
            this.log('Current gas price:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei');
            return gasPrice;
        } catch (error) {
            this.logError('Failed to get gas price:', error);
            // Fallback to 30 gwei for Polygon
            return ethers.parseUnits('30', 'gwei');
        }
    }

    /**
     * Check if fallback provider can be used
     */
    canUseFallbackProvider() {
        return this.currentProviderIndex < this.fallbackProviders.length - 1;
    }

    /**
     * Try switching to fallback provider with enhanced error handling
     */
    async tryFallbackProvider() {
        if (!this.canUseFallbackProvider()) {
            this.log('No more fallback providers available');
            return false;
        }

        try {
            this.currentProviderIndex++;
            const fallbackProvider = this.fallbackProviders[this.currentProviderIndex];

            this.log(`Switching to fallback provider ${this.currentProviderIndex + 1}/${this.fallbackProviders.length}`);

            // Test the fallback provider first
            await Promise.race([
                fallbackProvider.getNetwork(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Provider timeout')), this.config.providerTimeout))
            ]);

            // Update provider and signer
            this.provider = fallbackProvider;

            // Get signer if wallet is connected
            if (window.ethereum) {
                this.signer = new ethers.BrowserProvider(window.ethereum).getSigner();
            }

            // Reinitialize contracts with new provider
            await this.initializeContracts();

            this.log('Successfully switched to fallback provider');
            return true;
        } catch (error) {
            this.logError('Fallback provider switch failed:', error);
            return false;
        }
    }

    /**
     * Test provider connection and performance
     */
    async testProvider(provider, timeout = 5000) {
        try {
            const startTime = Date.now();

            await Promise.race([
                provider.getBlockNumber(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
            ]);

            const responseTime = Date.now() - startTime;
            this.log(`Provider test successful, response time: ${responseTime}ms`);

            return { success: true, responseTime };
        } catch (error) {
            this.log('Provider test failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get provider health status
     */
    async getProviderHealth() {
        try {
            const health = {
                currentProvider: this.currentProviderIndex,
                totalProviders: this.fallbackProviders.length,
                isConnected: !!this.provider,
                networkId: null,
                blockNumber: null,
                responseTime: null
            };

            if (this.provider) {
                const startTime = Date.now();
                const network = await this.provider.getNetwork();
                const blockNumber = await this.provider.getBlockNumber();
                const responseTime = Date.now() - startTime;

                health.networkId = Number(network.chainId);
                health.blockNumber = blockNumber;
                health.responseTime = responseTime;
            }

            return health;
        } catch (error) {
            this.logError('Failed to get provider health:', error);
            return { error: error.message };
        }
    }

    /**
     * Delay utility for retry logic
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
        this.lpTokenContracts.clear();
        this.provider = null;
        this.signer = null;
        this.fallbackProviders = [];
        this.contractABIs.clear();
        this.contractAddresses.clear();
        this.isInitialized = false;

        this.log('ContractManager cleaned up completely');
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
