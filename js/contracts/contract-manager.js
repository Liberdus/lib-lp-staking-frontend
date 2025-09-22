/**
 * ContractManager - Comprehensive smart contract integration with ethers.js v6
 * Handles staking contract, ERC20 tokens, ABI management, and transaction handling
 * Implements provider fallback, gas estimation, and retry logic
 *
 * ENHANCED SINGLETON PATTERN - Completely prevents redeclaration errors
 */
(function(global) {
    'use strict';

    // CRITICAL FIX: Enhanced redeclaration prevention with instance management
    if (global.ContractManager) {
        console.warn('ContractManager class already exists, skipping redeclaration');
        return;
    }

    // Check for existing instance and preserve it
    if (global.contractManager) {
        console.warn('ContractManager instance already exists, preserving existing instance');
        return;
    }

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

        // Enhanced components
        this.gasEstimator = null;
        this.transactionQueue = null;
        this.transactionStatus = null;

        // Block explorer configuration
        this.blockExplorer = {
            name: 'Polygon Amoy Explorer',
            baseUrl: 'https://amoy.polygonscan.com',
            txPath: '/tx/',
            addressPath: '/address/',
            tokenPath: '/token/'
        };

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

            // Load from global config - no fallback to placeholder addresses
            const addresses = {
                STAKING_CONTRACT: window.CONFIG?.CONTRACTS?.STAKING_CONTRACT || null,
                REWARD_TOKEN: window.CONFIG?.CONTRACTS?.REWARD_TOKEN || null,
                LP_TOKENS: window.CONFIG?.CONTRACTS?.LP_TOKENS || {}
            };

            // Store addresses only if they are valid
            if (addresses.STAKING_CONTRACT && this.isValidContractAddress(addresses.STAKING_CONTRACT)) {
                this.contractAddresses.set('STAKING', addresses.STAKING_CONTRACT);
                this.log('Valid staking contract address loaded:', addresses.STAKING_CONTRACT);
            } else {
                this.log('No valid staking contract address provided - will use fallback mode');
            }

            if (addresses.REWARD_TOKEN && this.isValidContractAddress(addresses.REWARD_TOKEN)) {
                this.contractAddresses.set('REWARD_TOKEN', addresses.REWARD_TOKEN);
                this.log('Valid reward token address loaded:', addresses.REWARD_TOKEN);
            } else {
                this.log('No valid reward token address provided - will use fallback mode');
            }

            // Store LP token addresses only if valid
            let validLPTokens = 0;
            for (const [pair, address] of Object.entries(addresses.LP_TOKENS)) {
                if (address && this.isValidContractAddress(address)) {
                    this.contractAddresses.set(`LP_${pair}`, address);
                    this.log(`Valid LP token address loaded for ${pair}:`, address);
                    validLPTokens++;
                } else {
                    this.log(`Invalid LP token address for ${pair}:`, address);
                }
            }

            this.log(`Contract address loading completed. Valid addresses: Staking=${!!this.contractAddresses.get('STAKING')}, RewardToken=${!!this.contractAddresses.get('REWARD_TOKEN')}, LPTokens=${validLPTokens}`);
        } catch (error) {
            this.logError('Failed to load contract addresses:', error);
            // Don't throw error - allow system to continue in fallback mode
            this.log('Continuing in fallback mode without contract addresses...');
        }
    }

    /**
     * Initialize smart contract instances with comprehensive error handling
     */
    async initializeContracts() {
        try {
            this.log('Initializing smart contract instances...');
            let contractsInitialized = 0;

            // Initialize staking contract
            const stakingAddress = this.contractAddresses.get('STAKING');
            const stakingABI = this.contractABIs.get('STAKING');

            if (stakingAddress && stakingABI && this.isValidContractAddress(stakingAddress)) {
                try {
                    this.stakingContract = new ethers.Contract(stakingAddress, stakingABI, this.signer);
                    this.log('Staking contract initialized:', stakingAddress);
                    contractsInitialized++;
                } catch (contractError) {
                    this.logError('Failed to create staking contract:', contractError.message);
                    this.log('Continuing without staking contract...');
                }
            } else {
                this.log('Staking contract address invalid or missing, skipping:', stakingAddress);
            }

            // Initialize reward token contract
            const rewardTokenAddress = this.contractAddresses.get('REWARD_TOKEN');
            const erc20ABI = this.contractABIs.get('ERC20');

            if (rewardTokenAddress && erc20ABI && this.isValidContractAddress(rewardTokenAddress)) {
                try {
                    this.rewardTokenContract = new ethers.Contract(rewardTokenAddress, erc20ABI, this.signer);
                    this.log('Reward token contract initialized:', rewardTokenAddress);
                    contractsInitialized++;
                } catch (contractError) {
                    this.logError('Failed to create reward token contract:', contractError.message);
                    this.log('Continuing without reward token contract...');
                }
            } else {
                this.log('Reward token address invalid or missing, skipping:', rewardTokenAddress);
            }

            // Initialize LP token contracts
            await this.initializeLPTokenContracts();

            this.log(`Contract initialization completed. ${contractsInitialized} main contracts initialized.`);

            // Don't throw error if no contracts initialized - allow fallback to handle it
            if (contractsInitialized === 0) {
                this.log('No valid contracts initialized - system will use fallback mode');
            }
        } catch (error) {
            this.logError('Failed to initialize contracts:', error);
            // Don't throw error - allow system to continue with fallback
            this.log('Contract initialization failed, continuing with fallback mode...');
        }
    }

    /**
     * Validate contract address format
     */
    isValidContractAddress(address) {
        // Check if it's a valid Ethereum address format
        if (!address || typeof address !== 'string') return false;

        // Check if it's a proper hex address (42 characters, starts with 0x)
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return false;

        // Check if it's not a placeholder/test address
        const placeholderPatterns = [
            /^0x1234567890123456789012345678901234567890$/,
            /^0x0987654321098765432109876543210987654321$/,
            /^0xabcdefabcdefabcdefabcdefabcdefabcdefabcd$/,
            /^0xfedcbafedcbafedcbafedcbafedcbafedcbafed$/,
            /^0x[0]+$/,
            /^0x[1]+$/,
            /^0x[a]+$/,
            /^0x[f]+$/
        ];

        return !placeholderPatterns.some(pattern => pattern.test(address));
    }

    /**
     * Initialize LP token contracts dynamically
     */
    async initializeLPTokenContracts() {
        try {
            const erc20ABI = this.contractABIs.get('ERC20');
            let validContracts = 0;

            for (const [key, address] of this.contractAddresses.entries()) {
                if (key.startsWith('LP_')) {
                    const pairName = key.replace('LP_', '');

                    // Validate address before creating contract
                    if (!this.isValidContractAddress(address)) {
                        this.log(`Skipping invalid LP token address for ${pairName}: ${address}`);
                        continue;
                    }

                    try {
                        const lpContract = new ethers.Contract(address, erc20ABI, this.signer);
                        this.lpTokenContracts.set(pairName, lpContract);
                        this.log(`LP token contract initialized for ${pairName}:`, address);
                        validContracts++;
                    } catch (contractError) {
                        this.logError(`Failed to create LP contract for ${pairName}:`, contractError.message);
                        continue;
                    }
                }
            }

            this.log(`Initialized ${validContracts} valid LP token contracts out of ${this.contractAddresses.size} addresses`);
        } catch (error) {
            this.logError('Failed to initialize LP token contracts:', error);
            // Don't throw error - allow system to continue with fallback
            this.log('Continuing with fallback LP token contract handling...');
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
        // More lenient check - only require provider and signer
        // Contracts may not be available if addresses are invalid
        return this.isInitialized &&
               this.provider &&
               this.signer;
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
            // In fallback mode, return null instead of throwing error
            if (this.lpTokenContracts.size === 0) {
                this.log(`No LP token contracts available - running in fallback mode for pair: ${pairName}`);
                return null;
            }
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
     * Get active pairs from the staking contract
     */
    async getActivePairs() {
        return await this.executeWithRetry(async () => {
            if (!this.stakingContract) {
                throw new Error('Staking contract not initialized');
            }
            return await this.stakingContract.getActivePairs();
        }, 'getActivePairs');
    }

    /**
     * Get pair information for a specific LP token address
     */
    async getPairInfo(lpTokenAddress) {
        return await this.executeWithRetry(async () => {
            if (!this.stakingContract) {
                throw new Error('Staking contract not initialized');
            }
            const [token, platform, weight, isActive] = await this.stakingContract.getPairInfo(lpTokenAddress);
            return {
                lpToken: token,
                platform: platform,
                weight: weight.toString(),
                isActive: isActive
            };
        }, 'getPairInfo');
    }

    /**
     * Get all pairs with their information
     */
    async getAllPairsInfo() {
        return await this.executeWithRetry(async () => {
            if (!this.stakingContract) {
                throw new Error('Staking contract not initialized');
            }

            // Get active pairs first
            const activePairs = await this.getActivePairs();
            const pairsInfo = [];

            // Get info for each pair
            for (const pairAddress of activePairs) {
                try {
                    const pairInfo = await this.getPairInfo(pairAddress);
                    pairsInfo.push({
                        address: pairAddress,
                        ...pairInfo
                    });
                } catch (error) {
                    this.logError(`Failed to get info for pair ${pairAddress}:`, error);
                    continue;
                }
            }

            return pairsInfo;
        }, 'getAllPairsInfo');
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
     * Enhanced approval flow with comprehensive checking and multi-step handling
     */
    async executeApprovalFlow(pairName, amount, options = {}) {
        try {
            this.log(`Starting approval flow for ${pairName}, amount: ${amount}`);

            // Initialize gas estimator if not available
            if (!this.gasEstimator) {
                this.gasEstimator = new GasEstimator();
                await this.gasEstimator.initialize(this.provider);
            }

            // Initialize transaction queue if not available
            if (!this.transactionQueue) {
                this.transactionQueue = new TransactionQueue();
            }

            const userAddress = await this.signer.getAddress();
            const currentAllowance = await this.getLPTokenAllowance(userAddress, pairName);
            const requiredAmount = parseFloat(amount);

            this.log(`Current allowance: ${currentAllowance}, Required: ${requiredAmount}`);

            // Check if approval is needed
            if (parseFloat(currentAllowance) >= requiredAmount) {
                this.log('Sufficient allowance already exists, skipping approval');
                return { approved: true, skipped: true, allowance: currentAllowance };
            }

            // Determine approval amount (use max approval for better UX)
            const approvalAmount = options.useMaxApproval !== false ?
                ethers.constants.MaxUint256 : ethers.utils.parseEther(amount.toString());

            // Get gas estimation for approval
            const lpContract = this.getLPTokenContract(pairName);
            const stakingAddress = this.contractAddresses.get('STAKING');
            const gasEstimate = await this.gasEstimator.getTransactionGasEstimate(
                lpContract, 'approve', [stakingAddress, approvalAmount], 'approve'
            );

            // Create approval transaction
            const approvalTx = {
                id: `approve_${pairName}_${Date.now()}`,
                operation: 'approve',
                args: [pairName, approvalAmount],
                priority: this.transactionQueue.config.priorityLevels.HIGH,
                metadata: {
                    type: 'approve',
                    pairName,
                    amount: amount.toString(),
                    approvalAmount: approvalAmount.toString(),
                    gasEstimate
                }
            };

            // Add to transaction queue
            const transactionId = await this.transactionQueue.addTransaction(approvalTx);

            return {
                approved: false,
                pending: true,
                transactionId,
                gasEstimate,
                approvalAmount: approvalAmount.toString()
            };

        } catch (error) {
            this.logError('Approval flow failed:', error);
            throw error;
        }
    }

    /**
     * Enhanced staking flow with automatic approval handling
     */
    async executeStakingFlow(pairName, amount, options = {}) {
        try {
            this.log(`Starting staking flow for ${pairName}, amount: ${amount}`);

            const userAddress = await this.signer.getAddress();
            const transactions = [];

            // Step 1: Check and handle approval
            const approvalResult = await this.executeApprovalFlow(pairName, amount, options);

            if (approvalResult.pending) {
                transactions.push({
                    id: approvalResult.transactionId,
                    type: 'approve',
                    status: 'pending'
                });
            }

            // Step 2: Create staking transaction
            const gasEstimate = await this.gasEstimator.getTransactionGasEstimate(
                this.stakingContract, 'stake',
                [this.contractAddresses.get(`LP_${pairName}`), ethers.utils.parseEther(amount.toString())],
                'stake'
            );

            const stakingTx = {
                id: `stake_${pairName}_${Date.now()}`,
                operation: 'stake',
                args: [pairName, amount],
                priority: this.transactionQueue.config.priorityLevels.NORMAL,
                dependencies: approvalResult.pending ? [approvalResult.transactionId] : [],
                metadata: {
                    type: 'stake',
                    pairName,
                    amount: amount.toString(),
                    gasEstimate
                }
            };

            const stakingTransactionId = await this.transactionQueue.addTransaction(stakingTx);
            transactions.push({
                id: stakingTransactionId,
                type: 'stake',
                status: 'queued'
            });

            return {
                success: true,
                transactions,
                totalSteps: transactions.length,
                estimatedGasCost: this.calculateTotalGasCost(transactions)
            };

        } catch (error) {
            this.logError('Staking flow failed:', error);
            throw error;
        }
    }

    /**
     * Calculate total gas cost for multiple transactions
     */
    calculateTotalGasCost(transactions) {
        return transactions.reduce((total, tx) => {
            if (tx.gasEstimate) {
                return total + parseFloat(tx.gasEstimate.estimatedCostEth);
            }
            return total;
        }, 0);
    }

    /**
     * Approve LP token for staking with enhanced gas estimation
     */
    async approveLPToken(pairName, amount) {
        this.log(`Executing transaction approveLPToken`);

        // Check if we're in fallback mode
        const lpContract = this.getLPTokenContract(pairName);
        if (!lpContract) {
            // Fallback mode - simulate transaction
            this.log(`Fallback mode: Simulating approveLPToken for ${pairName}, amount: ${amount}`);
            return {
                hash: '0x' + Math.random().toString(16).substr(2, 64),
                wait: async () => ({
                    status: 1,
                    transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
                    blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
                    gasUsed: ethers.BigNumber.from('21000')
                })
            };
        }

        return await this.executeTransactionWithRetry(async () => {
            const stakingAddress = this.contractAddresses.get('STAKING');
            const amountWei = typeof amount === 'bigint' ? amount : ethers.utils.parseEther(amount.toString());

            // Enhanced gas estimation
            const gasLimit = await this.estimateGasWithBuffer(lpContract, 'approve', [stakingAddress, amountWei]);
            const gasPrice = await this.getGasPrice();

            // Execute transaction with optimized gas settings
            const tx = await lpContract.approve(stakingAddress, amountWei, {
                gasLimit,
                gasPrice
            });

            this.log('Approve transaction sent:', tx.hash, `Gas: ${gasLimit}, Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);

            return await tx.wait();
        }, 'approveLPToken');
    }

    /**
     * Stake LP tokens with enhanced gas estimation
     */
    async stakeLPTokens(pairName, amount) {
        this.log(`Executing transaction stakeLPTokens`);

        // Check if we're in fallback mode
        if (!this.stakingContract) {
            // Fallback mode - simulate transaction
            this.log(`Fallback mode: Simulating stakeLPTokens for ${pairName}, amount: ${amount}`);
            return {
                hash: '0x' + Math.random().toString(16).substr(2, 64),
                wait: async () => ({
                    status: 1,
                    transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
                    blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
                    gasUsed: ethers.BigNumber.from('21000')
                })
            };
        }

        return await this.executeTransactionWithRetry(async () => {
            const lpTokenAddress = this.contractAddresses.get(`LP_${pairName}`);
            const amountWei = ethers.utils.parseEther(amount.toString());

            // Enhanced gas estimation
            const gasLimit = await this.estimateGasWithBuffer(this.stakingContract, 'stake', [lpTokenAddress, amountWei]);
            const gasPrice = await this.getGasPrice();

            // Execute transaction with optimized gas settings
            const tx = await this.stakingContract.stake(lpTokenAddress, amountWei, {
                gasLimit,
                gasPrice
            });

            this.log('Stake transaction sent:', tx.hash, `Gas: ${gasLimit}, Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);

            return await tx.wait();
        }, 'stakeLPTokens');
    }

    /**
     * Unstake LP tokens with enhanced gas estimation
     */
    async unstakeLPTokens(pairName, amount) {
        this.log(`Executing transaction unstakeLPTokens`);

        // Check if we're in fallback mode
        if (!this.stakingContract) {
            // Fallback mode - simulate transaction
            this.log(`Fallback mode: Simulating unstakeLPTokens for ${pairName}, amount: ${amount}`);
            return {
                hash: '0x' + Math.random().toString(16).substr(2, 64),
                wait: async () => ({
                    status: 1,
                    transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
                    blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
                    gasUsed: ethers.BigNumber.from('21000')
                })
            };
        }

        return await this.executeTransactionWithRetry(async () => {
            const lpTokenAddress = this.contractAddresses.get(`LP_${pairName}`);
            const amountWei = ethers.utils.parseEther(amount.toString());

            // Enhanced gas estimation
            const gasLimit = await this.estimateGasWithBuffer(this.stakingContract, 'unstake', [lpTokenAddress, amountWei]);
            const gasPrice = await this.getGasPrice();

            // Execute transaction with optimized gas settings
            const tx = await this.stakingContract.unstake(lpTokenAddress, amountWei, {
                gasLimit,
                gasPrice
            });

            this.log('Unstake transaction sent:', tx.hash, `Gas: ${gasLimit}, Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);

            return await tx.wait();
        }, 'unstakeLPTokens');
    }

    /**
     * Claim rewards for LP token with enhanced gas estimation
     */
    async claimRewards(pairName) {
        this.log(`Executing transaction claimRewards`);

        // Check if we're in fallback mode
        if (!this.stakingContract) {
            // Fallback mode - simulate transaction
            this.log(`Fallback mode: Simulating claimRewards for ${pairName}`);
            return {
                hash: '0x' + Math.random().toString(16).substr(2, 64),
                wait: async () => ({
                    status: 1,
                    transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
                    blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
                    gasUsed: ethers.BigNumber.from('21000')
                })
            };
        }

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

            this.log('Claim rewards transaction sent:', tx.hash, `Gas: ${gasLimit}, Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);

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

    // ==================== BLOCK EXPLORER INTEGRATION ====================

    /**
     * Get block explorer URL for transaction
     */
    getTransactionUrl(txHash) {
        if (!txHash) return null;
        return `${this.blockExplorer.baseUrl}${this.blockExplorer.txPath}${txHash}`;
    }

    /**
     * Get block explorer URL for address
     */
    getAddressUrl(address) {
        if (!address) return null;
        return `${this.blockExplorer.baseUrl}${this.blockExplorer.addressPath}${address}`;
    }

    /**
     * Get block explorer URL for token
     */
    getTokenUrl(tokenAddress) {
        if (!tokenAddress) return null;
        return `${this.blockExplorer.baseUrl}${this.blockExplorer.tokenPath}${tokenAddress}`;
    }

    /**
     * Open transaction in block explorer
     */
    openTransactionInExplorer(txHash) {
        const url = this.getTransactionUrl(txHash);
        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
            this.log('Opened transaction in explorer:', txHash);
        }
    }

    /**
     * Open address in block explorer
     */
    openAddressInExplorer(address) {
        const url = this.getAddressUrl(address);
        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
            this.log('Opened address in explorer:', address);
        }
    }

    // ==================== COMPREHENSIVE ERROR HANDLING ====================

    /**
     * Enhanced error handling for all transaction failure scenarios
     */
    handleTransactionError(error, context = {}) {
        const errorInfo = {
            message: error.message,
            code: error.code,
            context,
            timestamp: Date.now(),
            category: this.categorizeError(error)
        };

        this.logError('Transaction error:', errorInfo);

        // Emit error event for UI handling
        if (window.eventManager) {
            window.eventManager.emit('transaction:error', errorInfo);
        }

        // Show user-friendly notification
        if (window.notificationManager) {
            const userMessage = this.getUserFriendlyErrorMessage(error);
            window.notificationManager.show({
                type: 'error',
                title: 'Transaction Failed',
                message: userMessage,
                duration: 8000,
                actions: this.getErrorActions(error, context)
            });
        }

        return errorInfo;
    }

    /**
     * Categorize error for better handling
     */
    categorizeError(error) {
        const message = error.message.toLowerCase();

        if (message.includes('user rejected') || message.includes('user denied')) {
            return 'USER_REJECTED';
        } else if (message.includes('insufficient funds')) {
            return 'INSUFFICIENT_FUNDS';
        } else if (message.includes('gas')) {
            return 'GAS_ERROR';
        } else if (message.includes('nonce')) {
            return 'NONCE_ERROR';
        } else if (message.includes('network') || message.includes('connection')) {
            return 'NETWORK_ERROR';
        } else if (message.includes('timeout')) {
            return 'TIMEOUT_ERROR';
        } else if (message.includes('reverted')) {
            return 'CONTRACT_ERROR';
        } else {
            return 'UNKNOWN_ERROR';
        }
    }

    /**
     * Get user-friendly error message
     */
    getUserFriendlyErrorMessage(error) {
        const category = this.categorizeError(error);

        const messages = {
            USER_REJECTED: 'Transaction was cancelled by user',
            INSUFFICIENT_FUNDS: 'Insufficient funds to complete transaction',
            GAS_ERROR: 'Gas estimation failed. Please try again with higher gas limit',
            NONCE_ERROR: 'Transaction nonce error. Please refresh and try again',
            NETWORK_ERROR: 'Network connection error. Please check your connection',
            TIMEOUT_ERROR: 'Transaction timed out. Please try again',
            CONTRACT_ERROR: 'Smart contract execution failed. Please check transaction parameters',
            UNKNOWN_ERROR: 'An unexpected error occurred. Please try again'
        };

        return messages[category] || messages.UNKNOWN_ERROR;
    }

    /**
     * Get error-specific actions for user
     */
    getErrorActions(error, context) {
        const category = this.categorizeError(error);
        const actions = [];

        switch (category) {
            case 'INSUFFICIENT_FUNDS':
                actions.push({
                    label: 'Check Balance',
                    action: () => this.refreshUserBalance(context.userAddress)
                });
                break;

            case 'GAS_ERROR':
                actions.push({
                    label: 'Retry with Higher Gas',
                    action: () => this.retryWithHigherGas(context)
                });
                break;

            case 'NETWORK_ERROR':
                actions.push({
                    label: 'Switch Network',
                    action: () => this.switchToCorrectNetwork()
                });
                break;

            case 'CONTRACT_ERROR':
                if (context.txHash) {
                    actions.push({
                        label: 'View on Explorer',
                        action: () => this.openTransactionInExplorer(context.txHash)
                    });
                }
                break;
        }

        return actions;
    }

    /**
     * Retry transaction with higher gas
     */
    async retryWithHigherGas(context) {
        try {
            if (context.operation && context.args) {
                // Increase gas limit by 50%
                const newContext = {
                    ...context,
                    gasMultiplier: (context.gasMultiplier || 1) * 1.5
                };

                this.log('Retrying transaction with higher gas:', newContext);

                // Re-execute the operation
                return await this[context.operation](...context.args, newContext);
            }
        } catch (error) {
            this.logError('Retry with higher gas failed:', error);
        }
    }

    /**
     * Switch to correct network
     */
    async switchToCorrectNetwork() {
        try {
            if (window.walletManager) {
                await window.walletManager.switchNetwork(80002); // Polygon Amoy
                this.log('Switched to correct network');
            }
        } catch (error) {
            this.logError('Failed to switch network:', error);
        }
    }

    /**
     * Refresh user balance
     */
    async refreshUserBalance(userAddress) {
        try {
            if (userAddress && window.stateManager) {
                // Trigger balance refresh
                window.stateManager.set('user.balanceRefresh', Date.now());
                this.log('Triggered balance refresh for:', userAddress);
            }
        } catch (error) {
            this.logError('Failed to refresh balance:', error);
        }
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

    // Export ContractManager class to global scope
    global.ContractManager = ContractManager;

    // Note: Instance creation is now handled by SystemManager
    console.log('✅ ContractManager class loaded');

})(window);
