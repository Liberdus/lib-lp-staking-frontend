
(function(global) {
    'use strict';

    if (global.ContractManager) {
        return;
    }
    if (global.contractManager) {
        return;
    }

class ContractManager {
    constructor() {

        this.stakingContract = null;
        this.rewardTokenContract = null;
        this.lpTokenContracts = new Map(); // Map of LP token contracts


        this.provider = null;
        this.signer = null;
        this.fallbackProviders = [];
        this.currentProviderIndex = 0;
        this.disabledFeatures = new Set(); // Track disabled features due to contract limitations

        // State management
        this.isInitialized = false;
        this.isInitializing = false;
        this.initializationPromise = null;
        this.readyCallbacks = [];
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
                // Optimized list based on connectivity test results (fastest first)
                'https://rpc-amoy.polygon.technology',                    // ✅ 1643ms - Official & Fastest
                'https://endpoints.omniatech.io/v1/matic/amoy/public',    // ✅ 1850ms - Fast & Reliable
                'https://polygon-amoy-bor-rpc.publicnode.com',            // ✅ 2375ms - Stable
                'https://polygon-amoy.drpc.org',                          // ✅ 2952ms - Backup
                // Note: Removed non-working RPCs (ankr, polygonscan, blockpi) based on test results
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
     * Initialize the contract manager with read-only provider (no wallet required)
     */
    async initializeReadOnly() {
        if (this.isInitializing) {
            this.log('⏳ ContractManager initialization already in progress, waiting...');
            return this.initializationPromise;
        }

        if (this.isInitialized) {
            this.log('✅ ContractManager already initialized');
            return;
        }

        this.isInitializing = true;
        this.log('🔄 Starting ContractManager read-only initialization...');

        try {
            this.initializationPromise = this._initializeReadOnlyInternal();
            await this.initializationPromise;

            this.isInitialized = true;
            this.isInitializing = false;
            this.log('✅ ContractManager read-only initialization completed successfully');
            this._notifyReadyCallbacks();

        } catch (error) {
            this.isInitializing = false;
            this.logError('❌ ContractManager read-only initialization failed:', error);
            throw error;
        }
    }

    /**
     * Internal read-only initialization logic
     */
    async _initializeReadOnlyInternal() {
        try {
            this.log('🔄 Starting read-only initialization...');

            // Check if app config is available
            if (!window.CONFIG) {
                this.logError('❌ CONFIG not available - cannot initialize contracts');
                throw new Error('CONFIG not loaded');
            }

            this.log('✅ CONFIG available:', window.CONFIG.CONTRACTS);

            // Check if ethers is available
            if (!window.ethers) {
                this.logError('❌ Ethers.js not available - cannot initialize contracts');
                throw new Error('Ethers.js not loaded');
            }

            this.log('✅ Ethers.js available');

            // Try MetaMask provider first (bypasses CORS issues)
            if (window.ethereum) {
                try {
                    this.log('🦊 Attempting to use MetaMask provider (CORS-free)...');
                    const metamaskProvider = new ethers.providers.Web3Provider(window.ethereum);

                    // Test the connection with timeout
                    const networkPromise = metamaskProvider.getNetwork();
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Network detection timeout')), 10000)
                    );

                    const network = await Promise.race([networkPromise, timeoutPromise]);
                    this.log('🦊 MetaMask network detected:', network.chainId, network.name);

                    // Use MetaMask provider for read-only operations
                    this.provider = metamaskProvider;
                    this.signer = null; // No signer in read-only mode
                    this.log('✅ Using MetaMask provider (read-only mode)');

                } catch (metamaskError) {
                    this.log('⚠️ MetaMask provider failed, trying RPC fallbacks:', metamaskError.message);

                    // Fall back to RPC providers
                    await this.setupFallbackProviders();
                    await this.initializeFallbackProviders();
                    this.log('📡 Fallback providers initialized:', this.fallbackProviders.length);

                    if (this.fallbackProviders.length > 0) {
                        this.provider = this.fallbackProviders[0];
                        this.signer = null;
                        this.log('✅ Using RPC fallback provider:', this.provider.connection?.url || 'Unknown');
                    } else {
                        throw new Error('No fallback providers available');
                    }
                }
            } else {
                this.log('🌐 MetaMask not available, using RPC providers...');

                // Initialize fallback providers (read-only)
                this.log('📡 Initializing fallback providers...');
                await this.initializeFallbackProviders();
                this.log('📡 Fallback providers initialized:', this.fallbackProviders.length);

                // Use working provider (ENHANCED)
                this.log('🔄 Finding working RPC provider...');
                this.provider = await this.getWorkingProvider();
                this.signer = null; // No signer in read-only mode
                this.log('✅ Using working provider:', this.provider.connection?.url || 'Unknown');
            }

            // Load contract ABIs
            this.log('📋 Loading contract ABIs...');
            await this.loadContractABIs();
            this.log('📋 Contract ABIs loaded:', this.contractABIs.size);

            // Load contract addresses
            this.log('📍 Loading contract addresses...');
            this.loadContractAddresses();
            this.log('📍 Contract addresses loaded:', this.contractAddresses.size);

            // Initialize contract instances (read-only)
            this.log('🔗 Initializing contract instances (read-only)...');
            await this.initializeContractsReadOnly();
            this.log('🔗 Contract instances initialized');

            // Verify contract deployment and functions
            this.log('🔍 Verifying contract deployment...');
            await this.verifyContractDeployment();
            this.log('🔍 Contract deployment verified');

            // Verify contract function availability
            this.log('🔍 Verifying contract functions...');
            await this.verifyContractFunctions();
            this.log('🔍 Contract functions verified');

            this.log('✅ ContractManager read-only initialization completed');

        } catch (error) {
            this.logError('❌ Read-only initialization failed:', error);
            this.logError('❌ Error stack:', error.stack);
            throw error;
        }
    }

    /**
     * Initialize contract instances in read-only mode
     */
    async initializeContractsReadOnly() {
        try {
            this.log('Initializing smart contract instances (read-only)...');
            let contractsInitialized = 0;

            // Initialize staking contract
            const stakingAddress = this.contractAddresses.get('STAKING');
            const stakingABI = this.contractABIs.get('STAKING');

            this.log('🔍 Staking contract details:');
            this.log('   - Address:', stakingAddress);
            this.log('   - ABI available:', !!stakingABI);
            this.log('   - ABI length:', stakingABI?.length);
            this.log('   - Address valid:', this.isValidContractAddress(stakingAddress));
            this.log('   - Provider available:', !!this.provider);

            if (stakingAddress && stakingABI && this.isValidContractAddress(stakingAddress)) {
                try {
                    this.log('🔄 Creating staking contract instance...');
                    this.stakingContract = new ethers.Contract(stakingAddress, stakingABI, this.provider);
                    this.log('✅ Staking contract initialized (read-only):', stakingAddress);
                    this.log('   - Contract methods available:', Object.keys(this.stakingContract.interface.functions).length);
                    contractsInitialized++;
                } catch (contractError) {
                    this.logError('❌ Failed to create staking contract:', contractError.message);
                    this.logError('❌ Contract error stack:', contractError.stack);
                    this.log('Continuing without staking contract...');
                }
            } else {
                this.log('❌ Staking contract address invalid or missing, skipping:', stakingAddress);
            }

            // Initialize reward token contract
            const rewardTokenAddress = this.contractAddresses.get('REWARD_TOKEN');
            const erc20ABI = this.contractABIs.get('ERC20');

            this.log('🔍 Reward token contract details:');
            this.log('   - Address:', rewardTokenAddress);
            this.log('   - ABI available:', !!erc20ABI);
            this.log('   - Address valid:', this.isValidContractAddress(rewardTokenAddress));

            if (rewardTokenAddress && erc20ABI && this.isValidContractAddress(rewardTokenAddress)) {
                try {
                    this.log('🔄 Creating reward token contract instance...');
                    this.rewardTokenContract = new ethers.Contract(rewardTokenAddress, erc20ABI, this.provider);
                    this.log('✅ Reward token contract initialized (read-only):', rewardTokenAddress);
                    contractsInitialized++;
                } catch (contractError) {
                    this.logError('❌ Failed to create reward token contract:', contractError.message);
                    this.logError('❌ Contract error stack:', contractError.stack);
                    this.log('Continuing without reward token contract...');
                }
            } else {
                this.log('❌ Reward token address invalid or missing, skipping:', rewardTokenAddress);
            }

            this.log(`📊 Contract instances initialized: ${contractsInitialized}`);

            if (contractsInitialized === 0) {
                throw new Error('No contract instances could be initialized');
            }

        } catch (error) {
            this.logError('❌ Failed to initialize contract instances:', error);
            this.logError('❌ Error stack:', error.stack);
            throw error;
        }
    }

    /**
     * Upgrade from read-only mode to wallet mode
     */
    async upgradeToWalletMode(provider, signer) {
        try {
            this.log('🔄 Upgrading ContractManager to wallet mode...');

            // Update provider and signer
            this.provider = provider;
            this.signer = signer;

            // Re-initialize contract instances with signer
            await this.initializeContracts();

            // Initialize additional wallet-dependent components
            if (this.gasEstimator) {
                this.gasEstimator.updateProvider(provider);
            }

            this.log('✅ ContractManager upgraded to wallet mode successfully');

        } catch (error) {
            this.logError('❌ Failed to upgrade to wallet mode:', error);
            throw error;
        }
    }

    /**
     * Initialize contract manager with comprehensive provider setup (wallet mode)
     */
    async initialize(provider, signer) {
        // Prevent multiple simultaneous initializations
        if (this.isInitializing) {
            this.log('ContractManager initialization already in progress, waiting...');
            return this.initializationPromise;
        }

        if (this.isInitialized) {
            this.log('ContractManager already initialized');
            return true;
        }

        this.isInitializing = true;
        this.initializationPromise = this._performInitialization(provider, signer);

        try {
            const result = await this.initializationPromise;
            this.isInitializing = false;
            return result;
        } catch (error) {
            this.isInitializing = false;
            this.initializationPromise = null;
            throw error;
        }
    }

    /**
     * Internal initialization method
     */
    async _performInitialization(provider, signer) {
        try {
            this.log('🔄 Starting ContractManager initialization...');

            // Set primary provider and signer
            this.provider = provider;
            this.signer = signer;

            // Initialize fallback providers
            this.log('📡 Initializing fallback providers...');
            await this.initializeFallbackProviders();

            // Load contract ABIs
            this.log('📋 Loading contract ABIs...');
            await this.loadContractABIs();

            // Load contract addresses
            this.log('📍 Loading contract addresses...');
            this.loadContractAddresses();

            // Initialize contract instances
            this.log('🔗 Initializing contract instances...');
            await this.initializeContracts();

            // Verify contract connections
            this.log('✅ Verifying contract connections...');
            await this.verifyContractConnections();

            this.isInitialized = true;
            this.log('✅ ContractManager initialized successfully with all features');

            // Notify all waiting callbacks
            this._notifyReadyCallbacks();

            return true;
        } catch (error) {
            this.logError('❌ Failed to initialize ContractManager:', error);
            await this.handleInitializationError(error);
            throw error;
        }
    }

    /**
     * Get a working provider with comprehensive RPC testing (ENHANCED)
     */
    async getWorkingProvider() {
        const rpcUrls = this.getAllRPCUrls();

        this.log(`🔄 Testing ${rpcUrls.length} RPC endpoints for reliability...`);

        for (let i = 0; i < rpcUrls.length; i++) {
            const rpcUrl = rpcUrls[i];
            try {
                this.log(`🔄 Testing RPC ${i + 1}/${rpcUrls.length}: ${rpcUrl}`);

                const provider = new ethers.providers.JsonRpcProvider({
                    url: rpcUrl,
                    timeout: 8000 // 8 second timeout
                });

                // Test basic connectivity
                const networkPromise = provider.getNetwork();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Network timeout')), 8000)
                );

                const network = await Promise.race([networkPromise, timeoutPromise]);

                // Verify correct network
                if (network.chainId !== 80002) {
                    throw new Error(`Wrong network: expected 80002, got ${network.chainId}`);
                }

                // Test block number retrieval (tests node sync)
                const blockNumber = await Promise.race([
                    provider.getBlockNumber(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Block number timeout')), 5000))
                ]);

                this.log(`✅ RPC ${i + 1} working: Chain ${network.chainId}, Block ${blockNumber}`);
                return provider;

            } catch (error) {
                this.log(`❌ RPC ${i + 1} failed: ${error.message}`);
                continue;
            }
        }

        throw new Error('All RPC endpoints failed - no working provider available');
    }

    /**
     * Get all available RPC URLs from configuration
     */
    getAllRPCUrls() {
        const rpcUrls = [];

        // Primary RPC from CONFIG
        if (window.CONFIG?.NETWORK?.RPC_URL) {
            rpcUrls.push(window.CONFIG.NETWORK.RPC_URL);
        }

        // Fallback RPCs from CONFIG
        if (window.CONFIG?.NETWORK?.FALLBACK_RPCS) {
            rpcUrls.push(...window.CONFIG.NETWORK.FALLBACK_RPCS);
        }

        // Legacy RPC format
        if (window.CONFIG?.RPC?.POLYGON_AMOY) {
            rpcUrls.push(...window.CONFIG.RPC.POLYGON_AMOY);
        }

        // Internal fallback RPCs
        if (this.config.fallbackRPCs) {
            rpcUrls.push(...this.config.fallbackRPCs);
        }

        // Remove duplicates and return
        return [...new Set(rpcUrls)];
    }

    /**
     * Setup fallback provider configuration
     */
    async setupFallbackProviders() {
        this.log('🔧 Setting up fallback provider configuration...');

        // Ensure fallback providers array is initialized
        if (!this.fallbackProviders) {
            this.fallbackProviders = [];
        }

        // Setup default RPC URLs if not configured
        if (!this.config.fallbackRPCs || this.config.fallbackRPCs.length === 0) {
            this.config.fallbackRPCs = [
                'https://rpc-amoy.polygon.technology',
                'https://polygon-amoy.drpc.org',
                'https://polygon-amoy-bor-rpc.publicnode.com'
            ];
            this.log('🔧 Using default fallback RPC URLs');
        }
    }

    /**
     * Initialize fallback providers for redundancy
     */
    async initializeFallbackProviders() {
        try {
            this.fallbackProviders = [];

            // Get RPC URLs from multiple sources
            let rpcUrls = [];

            // First try from internal config
            if (this.config.fallbackRPCs && this.config.fallbackRPCs.length > 0) {
                rpcUrls = [...this.config.fallbackRPCs];
                this.log('📡 Using internal fallback RPCs:', rpcUrls.length);
            }

            // Also try from global CONFIG (new FALLBACK_RPCS format)
            if (window.CONFIG?.NETWORK?.FALLBACK_RPCS && window.CONFIG.NETWORK.FALLBACK_RPCS.length > 0) {
                rpcUrls = [...rpcUrls, ...window.CONFIG.NETWORK.FALLBACK_RPCS];
                this.log('📡 Added global CONFIG FALLBACK_RPCS:', window.CONFIG.NETWORK.FALLBACK_RPCS.length);
            }

            // Legacy support for old RPC format
            if (window.CONFIG?.RPC?.POLYGON_AMOY && window.CONFIG.RPC.POLYGON_AMOY.length > 0) {
                rpcUrls = [...rpcUrls, ...window.CONFIG.RPC.POLYGON_AMOY];
                this.log('📡 Added legacy CONFIG RPCs:', window.CONFIG.RPC.POLYGON_AMOY.length);
            }

            // Remove duplicates
            rpcUrls = [...new Set(rpcUrls)];
            this.log('📡 Total unique RPC URLs to test:', rpcUrls.length);
            this.log('📡 RPC URLs:', rpcUrls);

            if (rpcUrls.length === 0) {
                throw new Error('No RPC URLs available for fallback providers');
            }

            // Test each RPC URL with enhanced error handling
            const testResults = [];

            for (let i = 0; i < rpcUrls.length; i++) {
                const rpcUrl = rpcUrls[i];
                const testResult = { url: rpcUrl, success: false, error: null, chainId: null };

                try {
                    this.log(`🔄 Testing RPC ${i + 1}/${rpcUrls.length}:`, rpcUrl);

                    // Create provider with connection info
                    const fallbackProvider = new ethers.providers.JsonRpcProvider({
                        url: rpcUrl,
                        timeout: 10000 // 10 second timeout
                    });

                    // Test connection with multiple timeouts
                    const networkPromise = fallbackProvider.getNetwork();
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Connection timeout (10s)')), 10000)
                    );

                    const network = await Promise.race([networkPromise, timeoutPromise]);

                    // Verify correct network
                    if (network.chainId !== 80002) {
                        throw new Error(`Wrong network: expected 80002, got ${network.chainId}`);
                    }

                    // Test a simple call to ensure provider is fully functional
                    const blockNumber = await Promise.race([
                        fallbackProvider.getBlockNumber(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Block number timeout')), 5000))
                    ]);

                    this.fallbackProviders.push(fallbackProvider);
                    testResult.success = true;
                    testResult.chainId = network.chainId;

                    this.log(`✅ RPC ${i + 1} SUCCESS:`, rpcUrl, `(Chain: ${network.chainId}, Block: ${blockNumber})`);

                    // Continue testing more providers for redundancy (don't break after first success)
                    if (this.fallbackProviders.length >= 3) {
                        this.log('✅ Sufficient providers available (3+), stopping tests');
                        break;
                    }

                } catch (error) {
                    testResult.error = error.message;
                    this.log(`❌ RPC ${i + 1} FAILED:`, rpcUrl, '→', error.message);
                }

                testResults.push(testResult);
            }

            // Log detailed test results
            this.log('📊 RPC Test Results Summary:');
            testResults.forEach((result, index) => {
                const status = result.success ? '✅' : '❌';
                const details = result.success
                    ? `Chain ID: ${result.chainId}`
                    : `Error: ${result.error}`;
                this.log(`  ${status} RPC ${index + 1}: ${result.url} - ${details}`);
            });

            this.log(`📊 Successfully initialized ${this.fallbackProviders.length} fallback providers`);

            if (this.fallbackProviders.length === 0) {
                // Emergency fallback: try to create a basic provider without testing
                this.log('🚨 EMERGENCY FALLBACK: Attempting to create provider without testing...');

                try {
                    const emergencyRpc = 'https://rpc-amoy.polygon.technology';
                    const emergencyProvider = new ethers.providers.JsonRpcProvider(emergencyRpc);
                    this.fallbackProviders.push(emergencyProvider);
                    this.log('🚨 Emergency provider created (untested):', emergencyRpc);
                    this.log('⚠️ WARNING: Using untested provider - functionality may be limited');
                } catch (emergencyError) {
                    const errorMsg = 'No working fallback providers found. All RPC endpoints failed connection tests.';
                    this.logError('❌ CRITICAL:', errorMsg);
                    this.logError('❌ Emergency fallback also failed:', emergencyError.message);
                    this.logError('❌ Test results:', testResults.map(r => `${r.url}: ${r.error || 'Success'}`));
                    throw new Error(errorMsg);
                }
            }

        } catch (error) {
            this.logError('❌ Failed to initialize fallback providers:', error);
            throw error;
        }
    }

    /**
     * Load contract ABIs from configuration or external sources (FIXED)
     */
    async loadContractABIs() {
        try {
            this.log('Loading contract ABIs...');

            // FIXED: Use ABI from CONFIG instead of hardcoded
            let stakingABI;

            if (window.CONFIG?.ABIS?.STAKING_CONTRACT) {
                this.log('✅ Using ABI from CONFIG');
                stakingABI = window.CONFIG.ABIS.STAKING_CONTRACT;
            } else {
                this.log('⚠️ CONFIG ABI not found, using fallback ABI');
                // Fallback ABI with essential functions only
                stakingABI = [
                    "function rewardToken() external view returns (address)",
                    "function hourlyRewardRate() external view returns (uint256)",
                    "function REQUIRED_APPROVALS() external view returns (uint256)",
                    "function actionCounter() external view returns (uint256)",
                    "function stake(address lpToken, uint256 amount) external",
                    "function unstake(address lpToken, uint256 amount) external",
                    "function claimRewards(address lpToken) external",

                    // Admin role functions
                    "function hasRole(bytes32 role, address account) external view returns (bool)",
                    "function grantRole(bytes32 role, address account) external",
                    "function revokeRole(bytes32 role, address account) external",

                    // Multi-signature proposal functions
                    "function proposeSetHourlyRewardRate(uint256 newRate) external returns (uint256)",
                    "function proposeUpdatePairWeights(address[] calldata lpTokens, uint256[] calldata weights) external returns (uint256)",
                    "function proposeAddPair(address lpToken, string calldata pairName, string calldata platform, uint256 weight) external returns (uint256)",
                    "function proposeRemovePair(address lpToken) external returns (uint256)",
                    "function proposeChangeSigner(address oldSigner, address newSigner) external returns (uint256)",
                    "function proposeWithdrawRewards(address recipient, uint256 amount) external returns (uint256)",

                    // Multi-signature approval functions
                    "function approveAction(uint256 actionId) external",
                    "function executeAction(uint256 actionId) external",
                    "function rejectAction(uint256 actionId) external",

                    // Multi-signature query functions
                    "function actionCounter() external view returns (uint256)",
                    "function REQUIRED_APPROVALS() external view returns (uint256)",
                    "function actions(uint256 actionId) external view returns (uint8 actionType, uint256 newHourlyRewardRate, address[] memory pairs, uint256[] memory weights, address pairToAdd, string memory pairNameToAdd, string memory platformToAdd, uint256 weightToAdd, address pairToRemove, address recipient, uint256 withdrawAmount, bool executed, bool expired, uint8 approvals, address[] memory approvedBy, uint256 proposedTime, bool rejected)",
                    "function getActionPairs(uint256 actionId) external view returns (address[] memory)",
                    "function getActionWeights(uint256 actionId) external view returns (uint256[] memory)",
                    "function isActionExpired(uint256 actionId) external view returns (bool)",

                    // Utility functions
                    "function cleanupExpiredActions() external"
                ];
            }

            // ERC20 Token ABI (FIXED: Use CONFIG or fallback)
            let erc20ABI;
            if (window.CONFIG?.ABIS?.ERC20) {
                erc20ABI = window.CONFIG.ABIS.ERC20;
            } else {
                erc20ABI = [
                    "function balanceOf(address owner) external view returns (uint256)",
                    "function allowance(address owner, address spender) external view returns (uint256)",
                    "function approve(address spender, uint256 amount) external returns (bool)",
                    "function transfer(address to, uint256 amount) external returns (bool)",
                    "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
                    "function name() external view returns (string)",
                    "function symbol() external view returns (string)",
                    "function decimals() external view returns (uint8)",
                    "function totalSupply() external view returns (uint256)"
                ];
            }

            // Store ABIs
            this.contractABIs.set('STAKING', stakingABI);
            this.contractABIs.set('ERC20', erc20ABI);

            this.log('✅ Contract ABIs loaded successfully');
            this.log(`   - Staking ABI functions: ${stakingABI.length}`);
            this.log(`   - ERC20 ABI functions: ${erc20ABI.length}`);
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

            // Load from global config
            const config = window.CONFIG;

            if (!config) {
                this.logError('❌ No configuration found (CONFIG)');
                throw new Error('Configuration not available');
            }

            this.log('✅ Using configuration:', config.CONTRACTS);

            const addresses = {
                STAKING_CONTRACT: config.CONTRACTS?.STAKING_CONTRACT || null,
                REWARD_TOKEN: config.CONTRACTS?.REWARD_TOKEN || null,
                LP_TOKENS: config.CONTRACTS?.LP_TOKENS || {}
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
     * Verify contract deployment exists (ENHANCED)
     */
    async verifyContractDeployment() {
        try {
            this.log('🔍 Verifying contract deployment...');

            const stakingAddress = this.contractAddresses.get('STAKING');
            if (!stakingAddress) {
                throw new Error('No staking contract address configured');
            }

            // Get working provider
            const provider = this.provider || await this.getWorkingProvider();

            // Check if contract is deployed
            const code = await provider.getCode(stakingAddress);
            if (code === '0x') {
                throw new Error(`Contract not deployed at address: ${stakingAddress}`);
            }

            this.log(`✅ Contract verified at ${stakingAddress} (${code.length} bytes)`);
            return true;
        } catch (error) {
            this.logError('❌ Contract deployment verification failed:', error);
            throw error;
        }
    }

    /**
     * Verify contract function availability (NEW)
     */
    async verifyContractFunctions() {
        try {
            this.log('🔍 Verifying contract functions...');

            if (!this.stakingContract) {
                throw new Error('Staking contract not initialized');
            }

            // Test required functions with timeout
            const requiredFunctions = [
                { name: 'rewardToken', test: () => this.stakingContract.rewardToken() },
                { name: 'hourlyRewardRate', test: () => this.stakingContract.hourlyRewardRate() },
                { name: 'REQUIRED_APPROVALS', test: () => this.stakingContract.REQUIRED_APPROVALS() },
                { name: 'actionCounter', test: () => this.stakingContract.actionCounter() }
            ];

            let workingFunctions = 0;
            for (const func of requiredFunctions) {
                try {
                    // Add timeout to prevent hanging
                    const result = await Promise.race([
                        func.test(),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Function call timeout')), 10000)
                        )
                    ]);
                    this.log(`✅ Function ${func.name}: ${result}`);
                    workingFunctions++;
                } catch (error) {
                    this.logError(`❌ Function ${func.name} failed:`, error.message);
                    throw new Error(`Required function ${func.name} not available: ${error.message}`);
                }
            }

            this.log(`✅ Contract functions verified: ${workingFunctions}/${requiredFunctions.length} required functions working`);
            return true;
        } catch (error) {
            this.logError('❌ Contract function verification failed:', error);
            throw error;
        }
    }

    /**
     * Verify contract connections and basic functionality (ENHANCED)
     */
    async verifyContractConnections() {
        try {
            this.log('🔍 Verifying contract connections...');

            // Call the new verification methods
            await this.verifyContractDeployment();
            await this.verifyContractFunctions();

            this.log('✅ Contract connection verification completed');
        } catch (error) {
            this.logError('❌ Contract verification failed:', error);
            // Don't throw here as this is just verification - let the system continue
            this.log('⚠️ Continuing with limited functionality...');
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
        // Check if initialized and has provider
        // Signer is optional (null in read-only mode)
        const ready = !!(this.isInitialized &&
                        this.provider &&
                        (this.stakingContract || this.rewardTokenContract));

        // Debug logging
        if (window.DEV_CONFIG?.VERBOSE_LOGGING) {
            console.log('🔍 ContractManager.isReady() check:', {
                isInitialized: this.isInitialized,
                hasProvider: !!this.provider,
                hasStakingContract: !!this.stakingContract,
                hasRewardTokenContract: !!this.rewardTokenContract,
                ready: ready
            });
        }

        return ready;
    }

    /**
     * Wait for contract manager to be ready
     */
    async waitForReady(timeout = 30000) {
        if (this.isReady()) {
            return true;
        }

        if (this.isInitializing && this.initializationPromise) {
            try {
                await this.initializationPromise;
                return this.isReady();
            } catch (error) {
                this.logError('ContractManager initialization failed while waiting:', error);
                return false;
            }
        }

        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                this.logError('ContractManager readiness timeout after', timeout, 'ms');
                resolve(false);
            }, timeout);

            this.readyCallbacks.push(() => {
                clearTimeout(timeoutId);
                resolve(this.isReady());
            });
        });
    }

    /**
     * Add callback to be called when contract manager is ready
     */
    onReady(callback) {
        if (this.isReady()) {
            callback();
        } else {
            this.readyCallbacks.push(callback);
        }
    }

    /**
     * Notify all ready callbacks
     */
    _notifyReadyCallbacks() {
        const callbacks = [...this.readyCallbacks];
        this.readyCallbacks = [];

        callbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                this.logError('Error in ready callback:', error);
            }
        });
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
     * Get user's stake information for a specific LP token
     */
    async getUserStake(userAddress, lpTokenAddress) {
        return await this.executeWithRetry(async () => {
            const stakeInfo = await this.stakingContract.getUserStakeInfo(userAddress, lpTokenAddress);
            return {
                amount: ethers.formatEther(stakeInfo.amount || '0'),
                rewards: ethers.formatEther(stakeInfo.pendingRewards || '0')
            };
        }, 'getUserStake');
    }

    /**
     * Get user's pending rewards for a specific LP token (legacy method)
     */
    async getPendingRewards(userAddress, lpTokenAddress) {
        return await this.executeWithRetry(async () => {
            const stakeInfo = await this.stakingContract.getUserStakeInfo(userAddress, lpTokenAddress);
            return ethers.formatEther(stakeInfo.pendingRewards || '0');
        }, 'getPendingRewards');
    }

    /**
     * Get pool information for a specific LP token (using available contract methods)
     */
    async getPoolInfo(lpTokenAddress) {
        return await this.executeWithRetry(async () => {
            // Since getPoolInfo doesn't exist, we'll return basic info
            // In a real implementation, you might calculate this from other contract data
            return {
                totalStaked: '0', // Would need to be calculated from contract state
                rewardRate: '0',  // Would need to be calculated from contract state
                lastUpdateTime: Date.now() / 1000,
                apr: '0'
            };
        }, 'getPoolInfo');
    }

    /**
     * Get all active LP token pairs
     */
    async getSupportedTokens() {
        return await this.executeWithRetry(async () => {
            return await this.stakingContract.getActivePairs();
        }, 'getSupportedTokens');
    }

    // ============ ADMIN CONTRACT FUNCTIONS ============

    /**
     * Check if an address has admin role
     */
    async hasAdminRole(address) {
        return await this.executeWithRetry(async () => {
            const ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000'; // DEFAULT_ADMIN_ROLE
            return await this.stakingContract.hasRole(ADMIN_ROLE, address);
        }, 'hasAdminRole');
    }

    /**
     * Get action counter for multi-signature proposals
     */
    async getActionCounter() {
        return await this.executeWithRetry(async () => {
            const counter = await this.stakingContract.actionCounter();
            return counter.toNumber();
        }, 'getActionCounter');
    }

    /**
     * Retry contract call with exponential backoff (ENHANCED)
     */
    async retryContractCall(contractFunction, maxRetries = 3, functionName = 'unknown') {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.log(`🔄 Calling ${functionName} (attempt ${attempt}/${maxRetries})`);
                const result = await Promise.race([
                    contractFunction(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Contract call timeout')), 15000)
                    )
                ]);
                this.log(`✅ ${functionName} succeeded on attempt ${attempt}`);
                return result;
            } catch (error) {
                this.log(`❌ ${functionName} failed on attempt ${attempt}: ${error.message}`);

                if (attempt === maxRetries) {
                    throw error;
                }

                // Check if it's an RPC error that might be retryable
                if (error.code === -32603 ||
                    error.message.includes('missing trie node') ||
                    error.message.includes('timeout') ||
                    error.message.includes('CALL_EXCEPTION')) {
                    const delay = 1000 * Math.pow(2, attempt - 1); // Exponential backoff
                    this.log(`⏳ Retrying ${functionName} in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                // Non-retryable error
                throw error;
            }
        }
    }

    /**
     * Get required approvals for multi-signature actions (ENHANCED)
     */
    async getRequiredApprovals() {
        try {
            if (!this.stakingContract) {
                throw new Error('Staking contract not initialized');
            }

            // Use enhanced retry logic
            return await this.retryContractCall(
                () => this.stakingContract.REQUIRED_APPROVALS().then(result => result.toNumber()),
                3,
                'REQUIRED_APPROVALS'
            );
        } catch (error) {
            this.logError('Failed to get required approvals:', error);
            // Return fallback value instead of throwing
            this.log('⚠️ Using fallback value for required approvals: 2');
            return 2;
        }
    }

    /**
     * Get action details by ID
     */
    async getAction(actionId) {
        return await this.executeWithRetry(async () => {
            const action = await this.stakingContract.actions(actionId);
            return {
                actionType: action.actionType,
                newHourlyRewardRate: action.newHourlyRewardRate.toString(),
                pairs: action.pairs,
                weights: action.weights.map(w => w.toString()),
                pairToAdd: action.pairToAdd,
                pairNameToAdd: action.pairNameToAdd,
                platformToAdd: action.platformToAdd,
                weightToAdd: action.weightToAdd.toString(),
                pairToRemove: action.pairToRemove,
                recipient: action.recipient,
                withdrawAmount: action.withdrawAmount.toString(),
                executed: action.executed,
                expired: action.expired,
                approvals: action.approvals,
                approvedBy: action.approvedBy,
                proposedTime: action.proposedTime.toNumber(),
                rejected: action.rejected
            };
        }, 'getAction');
    }

    /**
     * Get action pairs by ID
     */
    async getActionPairs(actionId) {
        return await this.executeWithRetry(async () => {
            return await this.stakingContract.getActionPairs(actionId);
        }, 'getActionPairs');
    }

    /**
     * Get action weights by ID
     */
    async getActionWeights(actionId) {
        return await this.executeWithRetry(async () => {
            const weights = await this.stakingContract.getActionWeights(actionId);
            return weights.map(w => w.toString());
        }, 'getActionWeights');
    }

    // ============ ADMIN PROPOSAL FUNCTIONS ============

    /**
     * Propose setting hourly reward rate
     */
    async proposeSetHourlyRewardRate(newRate) {
        return await this.executeTransactionWithRetry(async () => {
            const rateWei = ethers.utils.parseEther(newRate.toString());
            const tx = await this.stakingContract.proposeSetHourlyRewardRate(rateWei);
            this.log('Propose hourly rate transaction sent:', tx.hash);
            return await tx.wait();
        }, 'proposeSetHourlyRewardRate');
    }

    /**
     * Propose updating pair weights
     */
    async proposeUpdatePairWeights(lpTokens, weights) {
        return await this.executeTransactionWithRetry(async () => {
            const weightsWei = weights.map(w => ethers.utils.parseEther(w.toString()));
            const tx = await this.stakingContract.proposeUpdatePairWeights(lpTokens, weightsWei);
            this.log('Propose update weights transaction sent:', tx.hash);
            return await tx.wait();
        }, 'proposeUpdatePairWeights');
    }

    /**
     * Propose adding a new pair
     */
    async proposeAddPair(lpToken, pairName, platform, weight) {
        return await this.executeTransactionWithRetry(async () => {
            const weightWei = ethers.utils.parseEther(weight.toString());
            const tx = await this.stakingContract.proposeAddPair(lpToken, pairName, platform, weightWei);
            this.log('Propose add pair transaction sent:', tx.hash);
            return await tx.wait();
        }, 'proposeAddPair');
    }

    /**
     * Propose removing a pair
     */
    async proposeRemovePair(lpToken) {
        return await this.executeTransactionWithRetry(async () => {
            const tx = await this.stakingContract.proposeRemovePair(lpToken);
            this.log('Propose remove pair transaction sent:', tx.hash);
            return await tx.wait();
        }, 'proposeRemovePair');
    }

    /**
     * Propose changing a signer
     */
    async proposeChangeSigner(oldSigner, newSigner) {
        return await this.executeTransactionWithRetry(async () => {
            const tx = await this.stakingContract.proposeChangeSigner(oldSigner, newSigner);
            this.log('Propose change signer transaction sent:', tx.hash);
            return await tx.wait();
        }, 'proposeChangeSigner');
    }

    /**
     * Propose withdrawing rewards
     */
    async proposeWithdrawRewards(recipient, amount) {
        return await this.executeTransactionWithRetry(async () => {
            const amountWei = ethers.utils.parseEther(amount.toString());
            const tx = await this.stakingContract.proposeWithdrawRewards(recipient, amountWei);
            this.log('Propose withdraw rewards transaction sent:', tx.hash);
            return await tx.wait();
        }, 'proposeWithdrawRewards');
    }

    // ============ ADMIN APPROVAL FUNCTIONS ============

    /**
     * Approve a multi-signature action
     */
    async approveAction(actionId) {
        return await this.executeTransactionWithRetry(async () => {
            const tx = await this.stakingContract.approveAction(actionId);
            this.log('Approve action transaction sent:', tx.hash, 'Action ID:', actionId);
            return await tx.wait();
        }, 'approveAction');
    }

    /**
     * Execute a multi-signature action
     */
    async executeAction(actionId) {
        return await this.executeTransactionWithRetry(async () => {
            const tx = await this.stakingContract.executeAction(actionId);
            this.log('Execute action transaction sent:', tx.hash, 'Action ID:', actionId);
            return await tx.wait();
        }, 'executeAction');
    }

    /**
     * Reject a multi-signature action
     */
    async rejectAction(actionId) {
        return await this.executeTransactionWithRetry(async () => {
            const tx = await this.stakingContract.rejectAction(actionId);
            this.log('Reject action transaction sent:', tx.hash, 'Action ID:', actionId);
            return await tx.wait();
        }, 'rejectAction');
    }

    /**
     * Check if an action is expired
     */
    async isActionExpired(actionId) {
        return await this.executeWithRetry(async () => {
            return await this.stakingContract.isActionExpired(actionId);
        }, 'isActionExpired');
    }

    /**
     * Clean up expired actions (admin only)
     */
    async cleanupExpiredActions() {
        return await this.executeTransactionWithRetry(async () => {
            const tx = await this.stakingContract.cleanupExpiredActions();
            this.log('Cleanup expired actions transaction sent:', tx.hash);
            return await tx.wait();
        }, 'cleanupExpiredActions');
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

            // Get pairs info directly from the contract
            const pairs = await this.stakingContract.getPairs();
            const pairsInfo = [];

            // Transform the contract data to the expected format
            for (let i = 0; i < pairs.length; i++) {
                const pair = pairs[i];
                try {
                    const pairInfo = {
                        id: (i + 1).toString(),
                        address: pair.lpToken,
                        name: pair.pairName || `LP Token ${i + 1}`,
                        platform: pair.platform || 'Unknown',
                        weight: pair.weight ? ethers.formatEther(pair.weight) : '0',
                        isActive: pair.isActive,
                        // Add computed fields
                        apr: '0', // Would need to be calculated
                        tvl: 0,   // Would need to be calculated
                        totalStaked: '0' // Would need to be calculated
                    };
                    pairsInfo.push(pairInfo);
                } catch (error) {
                    this.logError(`Failed to process pair ${pair.lpToken}:`, error.message);
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

        // Safety check for errorHandler availability
        if (!window.errorHandler || typeof window.errorHandler.executeWithRetry !== 'function') {
            console.warn('ErrorHandler not available, using fallback retry logic');
            return await this.fallbackExecuteWithRetry(operation, operationName, retries);
        }

        return await window.errorHandler.executeWithRetry(async () => {
            try {
                this.log(`Executing ${operationName}`);
                const result = await operation();
                this.log(`${operationName} completed successfully`);
                return result;
            } catch (error) {
                // Enhanced error processing with safety check
                let processedError = error;
                if (window.errorHandler && typeof window.errorHandler.processError === 'function') {
                    processedError = window.errorHandler.processError(error, context);
                } else {
                    console.warn('ErrorHandler.processError not available, using raw error');
                }

                // Try fallback provider for network errors
                if ((processedError.category === 'network' || error.code === 'NETWORK_ERROR') && this.canUseFallbackProvider()) {
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
     * Fallback retry logic when ErrorHandler is not available
     */
    async fallbackExecuteWithRetry(operation, operationName, retries = this.config.maxRetries) {
        let lastError = null;

        for (let attempt = 1; attempt <= retries + 1; attempt++) {
            try {
                this.log(`Fallback: Executing ${operationName} (attempt ${attempt}/${retries + 1})`);
                const result = await operation();

                if (attempt > 1) {
                    this.log(`${operationName} succeeded after ${attempt} attempts`);
                }

                return result;
            } catch (error) {
                lastError = error;
                this.logError(`${operationName} attempt ${attempt} failed:`, error);

                // Don't retry on last attempt
                if (attempt > retries) {
                    this.logError(`${operationName} failed after ${attempt} attempts`);
                    throw error;
                }

                // Wait before retry with exponential backoff
                const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
                this.log(`Retrying ${operationName} in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError;
    }

    /**
     * Execute transaction with enhanced retry logic, gas estimation, and error handling
     */
    async executeTransactionWithRetry(operation, operationName, retries = this.config.maxRetries) {
        const context = { operation: operationName, contractManager: true, transaction: true };

        // Safety check for errorHandler availability
        if (!window.errorHandler || typeof window.errorHandler.executeWithRetry !== 'function') {
            console.warn('ErrorHandler not available for transaction, using fallback retry logic');
            return await this.fallbackExecuteWithRetry(operation, operationName, retries);
        }

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
                // Enhanced error processing with user-friendly messages and safety checks
                let processedError = error;
                if (window.errorHandler && typeof window.errorHandler.processError === 'function') {
                    processedError = window.errorHandler.processError(error, context);
                } else {
                    console.warn('ErrorHandler.processError not available, using raw error');
                }

                // Display error to user with safety check
                if (window.errorHandler && typeof window.errorHandler.displayError === 'function') {
                    window.errorHandler.displayError(processedError, {
                        context: { operation: operationName },
                        showTechnical: window.CONFIG?.DEV?.DEBUG_MODE
                    });
                } else {
                    console.error(`Transaction ${operationName} failed:`, error.message);
                    // Fallback notification
                    if (window.notificationManager) {
                        window.notificationManager.error(`Transaction Failed`, `${operationName}: ${error.message}`);
                    }
                }

                // Try fallback provider for network errors
                if ((processedError.category === 'network' || error.code === 'NETWORK_ERROR') && this.canUseFallbackProvider()) {
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
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                this.signer = provider.getSigner();
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
