/**
 * Application Configuration
 * Contains all configuration settings for the LP Staking application
 * Updated for Local Hardhat Network Deployment
 */

// Application Configuration
window.CONFIG = {
    // Network Configuration
    NETWORK: {
        CHAIN_ID: 80002, // Polygon Amoy Testnet
        NAME: 'Polygon Amoy Testnet',
        RPC_URL: 'https://rpc-amoy.polygon.technology',
        FALLBACK_RPCS: [
            'https://rpc-amoy.polygon.technology',
            'https://polygon-amoy-bor-rpc.publicnode.com'
        ],
        BLOCK_EXPLORER: 'https://amoy.polygonscan.com',
        NATIVE_CURRENCY: {
            name: 'MATIC',
            symbol: 'MATIC',
            decimals: 18
        }
    },

    // Contract Addresses (Polygon Amoy Testnet Deployment)
    CONTRACTS: {
        STAKING_CONTRACT: '0x1cAcD190b8a9223f24F6aBFb7Ba6D598B3E513f0',
        REWARD_TOKEN: '0x05A4cfAF5a8f939d61E4Ec6D6287c9a065d6574c', // Mock LibToken
        LP_TOKENS: {
            LPLIBETH: '0x34370487063aE6e02400Db1336f1724f28EF4cDC',
            LPLIBUSDC: '0x020393f1E32DFeeE19D3889aa55205E6e4733623',
            LPLIBUSDT: '0xE797b9130527BF6972Ee0a1e84D31e076f76f278'
        }
    },

    // Governance Configuration
    GOVERNANCE: {
        SIGNERS: [
            '0x9249cFE964C49Cf2d2D0DBBbB33E99235707aa61',
            '0xea7bb30fbcCBB2646B0eFeB31382D3A4da07a3cC',
            '0x2fBe1cd4BC1718B7625932f35e3cb03E6847289F',
            '0xd3ac493dc0dA16077CC589A838ac473bC010324F'
        ],
        REQUIRED_APPROVALS: 3
    },

    // Application Settings
    APP: {
        NAME: 'Liberdus LP Staking',
        VERSION: '1.0.0',
        DESCRIPTION: 'Stake LP tokens and earn LIB rewards',
        REFRESH_INTERVAL: 30000, // 30 seconds
        NOTIFICATION_DURATION: 5000, // 5 seconds
        ANIMATION_DURATION: 300, // 300ms
        DEBOUNCE_DELAY: 500 // 500ms
    },

    // UI Configuration
    UI: {
        THEME: {
            DEFAULT: 'dark',
            STORAGE_KEY: 'liberdus-theme'
        },
        PAGINATION: {
            DEFAULT_PAGE_SIZE: 10,
            MAX_PAGE_SIZE: 100
        },
        DECIMAL_PLACES: {
            TOKEN_AMOUNTS: 6,
            PERCENTAGES: 2,
            PRICES: 8
        }
    },

    // API Configuration
    API: {
        TIMEOUT: 10000, // 10 seconds
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000, // 1 second
        RPC_RETRY_LOGIC: true,
        FALLBACK_ON_ERROR: true,
        RPC_TIMEOUT: 8000, // 8 seconds for RPC calls
        MAX_CONCURRENT_REQUESTS: 5
    },

    // Wallet Configuration
    WALLET: {
        SUPPORTED_WALLETS: ['MetaMask', 'WalletConnect', 'Coinbase Wallet'],
        AUTO_CONNECT: true,
        CONNECTION_TIMEOUT: 30000 // 30 seconds
    },

    // Staking Configuration
    STAKING: {
        MIN_STAKE_AMOUNT: '0.001', // Minimum stake amount in LP tokens
        MAX_STAKE_AMOUNT: '1000000', // Maximum stake amount in LP tokens
        UNSTAKE_DELAY: 0, // No delay for unstaking (in seconds)
        REWARD_PRECISION: 18 // Token precision for rewards
    },

    // Development Configuration
    DEV: {
        DEBUG: true,
        CONSOLE_LOGS: true,
        PERFORMANCE_MONITORING: true
    },

    // Feature Flags
    FEATURES: {
        DARK_MODE: true,
        NOTIFICATIONS: true,
        ANIMATIONS: true,
        ACCESSIBILITY: true,
        MOBILE_RESPONSIVE: true,
        ADMIN_PANEL: true,
        MULTI_SIG: false // Not implemented yet
    },

    // Error Messages
    ERRORS: {
        WALLET_NOT_CONNECTED: 'Please connect your wallet to continue',
        INSUFFICIENT_BALANCE: 'Insufficient balance for this transaction',
        TRANSACTION_FAILED: 'Transaction failed. Please try again.',
        NETWORK_ERROR: 'Network error. Please check your connection.',
        CONTRACT_ERROR: 'Smart contract error. Please try again later.',
        INVALID_AMOUNT: 'Please enter a valid amount',
        AMOUNT_TOO_LOW: 'Amount is below minimum stake requirement',
        AMOUNT_TOO_HIGH: 'Amount exceeds maximum stake limit'
    },

    // Success Messages
    SUCCESS: {
        WALLET_CONNECTED: 'Wallet connected successfully',
        STAKE_SUCCESS: 'Tokens staked successfully',
        UNSTAKE_SUCCESS: 'Tokens unstaked successfully',
        CLAIM_SUCCESS: 'Rewards claimed successfully',
        TRANSACTION_CONFIRMED: 'Transaction confirmed'
    }
};

// Contract ABIs (Essential functions for local deployment)
window.CONFIG.ABIS = {
    STAKING_CONTRACT: [
        // Core staking functions
        'function stake(address lpToken, uint256 amount) external',
        'function unstake(address lpToken, uint256 amount) external',
        'function claimRewards(address lpToken) external',

        // View functions - User info
        'function getUserStakeInfo(address user, address lpToken) external view returns (uint256 amount, uint256 pendingRewards, uint256 lastRewardTime)',
        'function earned(address user, address lpToken) external view returns (uint256)',

        // View functions - Pair info
        'function getPairs() external view returns (tuple(address lpToken, string pairName, string platform, uint256 weight, bool isActive)[])',
        'function getActivePairs() external view returns (address[])',

        // View functions - Contract state
        'function rewardToken() external view returns (address)',
        'function hourlyRewardRate() external view returns (uint256)',
        'function totalWeight() external view returns (uint256)',
        'function getSigners() external view returns (address[])',

        // Access control
        'function hasRole(bytes32 role, address account) external view returns (bool)',
        'function ADMIN_ROLE() external view returns (bytes32)'
    ],

    ERC20: [
        'function balanceOf(address owner) external view returns (uint256)',
        'function allowance(address owner, address spender) external view returns (uint256)',
        'function approve(address spender, uint256 amount) external returns (bool)',
        'function transfer(address to, uint256 amount) external returns (bool)',
        'function decimals() external view returns (uint8)',
        'function symbol() external view returns (string)',
        'function name() external view returns (string)'
    ]
};

// Freeze the configuration to prevent accidental modifications
Object.freeze(window.CONFIG);

console.log('✅ Application configuration loaded successfully');
console.log('🌐 Network:', window.CONFIG.NETWORK.NAME);
console.log('📄 Staking Contract:', window.CONFIG.CONTRACTS.STAKING_CONTRACT);
console.log('🎨 Default Theme:', window.CONFIG.UI.THEME.DEFAULT);