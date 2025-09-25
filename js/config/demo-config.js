/**
 * Demo Configuration for Client Presentation
 * Toggle between DEMO_MODE and PRODUCTION_MODE easily
 * 
 * USAGE:
 * - Set DEMO_MODE = true for client demo
 * - Set DEMO_MODE = false for real blockchain integration
 */

// 🎭 DEMO MODE TOGGLE - Change this to switch modes
window.DEMO_MODE = true; // Set to false for production

// Demo Configuration
window.DEMO_CONFIG = {
    // Demo Settings
    ENABLED: window.DEMO_MODE,
    AUTO_CONNECT_WALLET: true,
    SIMULATE_TRANSACTIONS: true,
    REALISTIC_DELAYS: true,
    
    // Mock Wallet Data
    MOCK_WALLET: {
        address: '0x742d35Cc6634C0532925a3b8D4C9db96590c4C5d',
        balance: '15.7834', // ETH balance
        connected: false
    },
    
    // Mock Contract Data
    MOCK_CONTRACT_DATA: {
        // Global Stats
        totalTVL: 2847392.45,
        totalStakers: 1247,
        totalRewardsDistributed: 156789.23,
        averageAPR: 24.7,
        
        // Staking Pairs with realistic data
        pairs: [
            {
                id: 1,
                name: 'ETH/USDC',
                platform: 'Uniswap V3',
                address: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
                weight: 1000,
                isActive: true,
                tvl: 1245678.90,
                apr: 28.5,
                userStaked: 5.2341,
                userPendingRewards: 0.1847,
                lpTokenBalance: 12.5678,
                allowance: 0,
                rewardRate: 0.000032, // per second
                lastRewardTime: Date.now() - 3600000 // 1 hour ago
            },
            {
                id: 2,
                name: 'WBTC/ETH',
                platform: 'Uniswap V3',
                address: '0x4585FE77225b41b697C938B018E2Ac67Ac5a20c0',
                weight: 800,
                isActive: true,
                tvl: 892345.67,
                apr: 22.3,
                userStaked: 2.1567,
                userPendingRewards: 0.0923,
                lpTokenBalance: 8.9012,
                allowance: 1000000,
                rewardRate: 0.000025,
                lastRewardTime: Date.now() - 7200000 // 2 hours ago
            },
            {
                id: 3,
                name: 'USDC/USDT',
                platform: 'Uniswap V3',
                address: '0x3416cF6C708Da44DB2624D63ea0AAef7113527C6',
                weight: 600,
                isActive: true,
                tvl: 567890.12,
                apr: 18.9,
                userStaked: 0,
                userPendingRewards: 0,
                lpTokenBalance: 25.3456,
                allowance: 0,
                rewardRate: 0.000018,
                lastRewardTime: 0
            },
            {
                id: 4,
                name: 'LIB/ETH',
                platform: 'Uniswap V3',
                address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
                weight: 1200,
                isActive: true,
                tvl: 234567.89,
                apr: 35.7,
                userStaked: 1.0234,
                userPendingRewards: 0.2156,
                lpTokenBalance: 6.7890,
                allowance: 500000,
                rewardRate: 0.000041,
                lastRewardTime: Date.now() - 1800000 // 30 minutes ago
            },
            {
                id: 5,
                name: 'DAI/USDC',
                platform: 'Uniswap V3',
                address: '0x6c6Bc977E13Df9b0de53b251522280BB72383700',
                weight: 400,
                isActive: false, // Inactive pair for testing
                tvl: 123456.78,
                apr: 0,
                userStaked: 0,
                userPendingRewards: 0,
                lpTokenBalance: 15.6789,
                allowance: 0,
                rewardRate: 0,
                lastRewardTime: 0
            }
        ],
        
        // User Portfolio Summary
        userPortfolio: {
            totalStaked: 8.4142, // Sum of all staked amounts
            totalPendingRewards: 0.4926, // Sum of all pending rewards
            totalValue: 24567.89, // USD value
            totalEarned: 2.3456 // Total rewards earned historically
        },
        
        // Admin Data (for admin panel demo)
        adminData: {
            isAdmin: true,
            pendingActions: [
                {
                    id: 1,
                    type: 'SET_HOURLY_REWARD_RATE',
                    proposer: '0x742d35Cc6634C0532925a3b8D4C9db96590c4C5d',
                    newRate: '1000000000000000000', // 1 token per hour
                    approvals: 2,
                    requiredApprovals: 3,
                    status: 'pending',
                    createdAt: Date.now() - 86400000, // 1 day ago
                    expiresAt: Date.now() + 518400000 // 6 days from now
                },
                {
                    id: 2,
                    type: 'ADD_PAIR',
                    proposer: '0x1234567890123456789012345678901234567890',
                    pairAddress: '0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852',
                    pairName: 'WETH/USDT',
                    platform: 'Uniswap V2',
                    weight: 500,
                    approvals: 1,
                    requiredApprovals: 3,
                    status: 'pending',
                    createdAt: Date.now() - 43200000, // 12 hours ago
                    expiresAt: Date.now() + 561600000 // 6.5 days from now
                }
            ],
            contractBalance: 50000.0, // LIB tokens in contract
            signers: [
                '0x742d35Cc6634C0532925a3b8D4C9db96590c4C5d',
                '0x1234567890123456789012345678901234567890',
                '0x9876543210987654321098765432109876543210',
                '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
            ]
        }
    },
    
    // Transaction Simulation Settings
    TRANSACTION_SIMULATION: {
        // Realistic delays for different operations
        delays: {
            walletConnect: 2000,
            approve: 3000,
            stake: 4000,
            unstake: 3500,
            claim: 2500,
            adminAction: 5000
        },
        
        // Success rates (for realistic demo)
        successRates: {
            walletConnect: 0.95,
            approve: 0.98,
            stake: 0.97,
            unstake: 0.98,
            claim: 0.99,
            adminAction: 0.95
        }
    },
    
    // Price Data (for APR calculations)
    MOCK_PRICES: {
        ETH: 2340.56,
        WBTC: 43210.78,
        USDC: 1.00,
        USDT: 0.999,
        DAI: 1.001,
        LIB: 0.0234 // Mock LIB token price
    },
    
    // Real-time Updates Simulation
    LIVE_UPDATES: {
        enabled: true,
        interval: 10000, // Update every 10 seconds
        priceVolatility: 0.02, // 2% max price change
        rewardAccumulation: true,
        tvlFluctuation: 0.01 // 1% max TVL change
    }
};

// Demo Utilities
window.DEMO_UTILS = {
    // Toggle demo mode
    toggleDemoMode() {
        window.DEMO_MODE = !window.DEMO_MODE;
        window.DEMO_CONFIG.ENABLED = window.DEMO_MODE;
        console.log(`🎭 Demo mode: ${window.DEMO_MODE ? 'ENABLED' : 'DISABLED'}`);
        location.reload();
    },
    
    // Enable production mode
    enableProductionMode() {
        window.DEMO_MODE = false;
        window.DEMO_CONFIG.ENABLED = false;
        console.log('🚀 Production mode enabled - Real blockchain integration active');
        location.reload();
    },
    
    // Enable demo mode
    enableDemoMode() {
        window.DEMO_MODE = true;
        window.DEMO_CONFIG.ENABLED = true;
        console.log('🎭 Demo mode enabled - Mock data active');
        location.reload();
    },
    
    // Get current mode
    getCurrentMode() {
        return window.DEMO_MODE ? 'DEMO' : 'PRODUCTION';
    },
    
    // Simulate transaction
    simulateTransaction(type, duration = null) {
        const delay = duration || window.DEMO_CONFIG.TRANSACTION_SIMULATION.delays[type] || 3000;
        const successRate = window.DEMO_CONFIG.TRANSACTION_SIMULATION.successRates[type] || 0.95;
        
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (Math.random() < successRate) {
                    resolve({
                        hash: '0x' + Math.random().toString(16).substr(2, 64),
                        status: 'success',
                        type: type,
                        timestamp: Date.now()
                    });
                } else {
                    reject(new Error(`Transaction ${type} failed (simulated failure)`));
                }
            }, delay);
        });
    }
};

// Console helpers
if (window.DEMO_CONFIG.ENABLED) {
    console.log('🎭 DEMO MODE ACTIVE');
    console.log('📋 Available commands:');
    console.log('  - DEMO_UTILS.toggleDemoMode() - Toggle between demo/production');
    console.log('  - DEMO_UTILS.enableProductionMode() - Switch to real blockchain');
    console.log('  - DEMO_UTILS.enableDemoMode() - Switch to demo mode');
    console.log('  - DEMO_UTILS.getCurrentMode() - Check current mode');
} else {
    console.log('🚀 PRODUCTION MODE ACTIVE - Real blockchain integration');
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DEMO_CONFIG: window.DEMO_CONFIG, DEMO_UTILS: window.DEMO_UTILS };
}
