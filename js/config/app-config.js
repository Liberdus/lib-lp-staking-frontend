/**
 * Application Configuration
 * Global configuration object for the LP Staking application
 */

window.CONFIG = {
    // Network Configuration
    DEFAULT_NETWORK: 80002, // Polygon Amoy Testnet
    SUPPORTED_NETWORKS: [1, 137, 80002], // Ethereum, Polygon, Polygon Amoy
    
    // RPC Configuration
    RPC: {
        ETHEREUM: [
            'https://eth-mainnet.g.alchemy.com/v2/demo',
            'https://mainnet.infura.io/v3/demo'
        ],
        POLYGON: [
            'https://polygon-rpc.com',
            'https://rpc-mainnet.matic.network'
        ],
        POLYGON_AMOY: [
            'https://rpc-amoy.polygon.technology',
            'https://polygon-amoy.drpc.org'
        ]
    },
    
    // Contract Addresses - Real deployed contracts on Polygon Amoy
    CONTRACTS: {
        STAKING_CONTRACT: '0xc24e28db325D2EEe5e4bc21C53b91A26eC9471f2',
        REWARD_TOKEN: '0x568939fD09f57408dfeEccc3f7F2f7EA95D22249',
        // LP tokens will be fetched dynamically from the staking contract
        LP_TOKENS: {}
    },
    
    // UI Configuration
    UI: {
        WALLET_STORAGE_KEY: 'lp_staking_wallet_connection',
        THEME_STORAGE_KEY: 'lp_staking_theme',
        NOTIFICATION_DURATION: 5000,
        AUTO_REFRESH_INTERVAL: 30000,
        MODAL_ANIMATION_DURATION: 300
    },
    
    // Development Configuration
    DEV: {
        DEBUG_MODE: true,
        MOCK_DATA: false, // Disabled - use real blockchain data
        CONSOLE_LOGGING: true,
        ERROR_REPORTING: true
    },
    
    // API Configuration
    API: {
        BASE_URL: 'https://api.example.com',
        TIMEOUT: 10000,
        RETRY_ATTEMPTS: 3
    },
    
    // Staking Configuration
    STAKING: {
        MIN_STAKE_AMOUNT: '0.01',
        MAX_STAKE_AMOUNT: '1000000',
        UNSTAKE_COOLDOWN: 86400, // 24 hours in seconds
        REWARD_PRECISION: 18
    },
    
    // Token Configuration
    TOKENS: {
        LIB: {
            symbol: 'LIB',
            name: 'Liberdus Token',
            decimals: 18,
            address: '0x1111111111111111111111111111111111111111'
        },
        USDC: {
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            address: '0x2222222222222222222222222222222222222222'
        },
        ETH: {
            symbol: 'ETH',
            name: 'Ethereum',
            decimals: 18,
            address: '0x0000000000000000000000000000000000000000'
        },
        BTC: {
            symbol: 'BTC',
            name: 'Bitcoin',
            decimals: 8,
            address: '0x3333333333333333333333333333333333333333'
        },
        DAI: {
            symbol: 'DAI',
            name: 'Dai Stablecoin',
            decimals: 18,
            address: '0x4444444444444444444444444444444444444444'
        },
        MATIC: {
            symbol: 'MATIC',
            name: 'Polygon',
            decimals: 18,
            address: '0x5555555555555555555555555555555555555555'
        }
    },
    
    // Feature Flags
    FEATURES: {
        WALLET_CONNECT: true,
        METAMASK_SUPPORT: true,
        THEME_SWITCHING: true,
        NOTIFICATIONS: true,
        AUTO_REFRESH: true,
        STAKING_REWARDS: true,
        TRANSACTION_HISTORY: true
    },
    
    // Error Messages
    ERRORS: {
        WALLET_NOT_FOUND: 'No Web3 wallet detected. Please install MetaMask or another Web3 wallet.',
        NETWORK_UNSUPPORTED: 'Unsupported network. Please switch to a supported network.',
        INSUFFICIENT_BALANCE: 'Insufficient balance for this transaction.',
        TRANSACTION_FAILED: 'Transaction failed. Please try again.',
        CONNECTION_FAILED: 'Failed to connect to wallet. Please try again.',
        STAKING_FAILED: 'Staking operation failed. Please try again.',
        UNSTAKING_FAILED: 'Unstaking operation failed. Please try again.',
        CLAIM_FAILED: 'Claim operation failed. Please try again.'
    },
    
    // Success Messages
    SUCCESS: {
        WALLET_CONNECTED: 'Wallet connected successfully!',
        TRANSACTION_SENT: 'Transaction sent successfully!',
        STAKING_SUCCESS: 'Staking completed successfully!',
        UNSTAKING_SUCCESS: 'Unstaking completed successfully!',
        CLAIM_SUCCESS: 'Rewards claimed successfully!',
        THEME_CHANGED: 'Theme changed successfully!'
    }
};

// Freeze the configuration to prevent accidental modifications
Object.freeze(window.CONFIG);
Object.freeze(window.CONFIG.RPC);
Object.freeze(window.CONFIG.CONTRACTS);
Object.freeze(window.CONFIG.UI);
Object.freeze(window.CONFIG.DEV);
Object.freeze(window.CONFIG.API);
Object.freeze(window.CONFIG.STAKING);
Object.freeze(window.CONFIG.TOKENS);
Object.freeze(window.CONFIG.FEATURES);
Object.freeze(window.CONFIG.ERRORS);
Object.freeze(window.CONFIG.SUCCESS);

console.log('✅ Application configuration loaded successfully');

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.CONFIG;
}
