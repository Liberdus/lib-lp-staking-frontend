/**
 * Debug Test Script for LP Staking Platform
 * Run this in the browser console to test functionality
 */

console.log('🧪 Starting LP Staking Platform Debug Test...');

// Test 1: Check if core systems are loaded
console.log('\n📋 Test 1: Core Systems Check');
const coreSystemsCheck = {
    'Ethers.js': typeof window.ethers !== 'undefined',
    'SystemManager': typeof window.systemManager !== 'undefined',
    'Router': typeof window.router !== 'undefined',
    'NotificationManager': typeof window.notificationManager !== 'undefined',
    'WalletManager': typeof window.walletManager !== 'undefined',
    'HomePage Class': typeof window.HomePage !== 'undefined',
    'StakingModal Class': typeof window.StakingModal !== 'undefined',
    'StakingModal Instance': typeof window.stakingModal !== 'undefined'
};

Object.entries(coreSystemsCheck).forEach(([name, status]) => {
    console.log(`${status ? '✅' : '❌'} ${name}: ${status ? 'Available' : 'Missing'}`);
});

// Test 2: Check DOM elements
console.log('\n📋 Test 2: DOM Elements Check');
const domElementsCheck = {
    'App Content Container': !!document.getElementById('app-content'),
    'Connect Wallet Button': !!document.getElementById('connect-wallet-btn'),
    'Theme Toggle Button': !!document.getElementById('theme-toggle'),
    'Manual Refresh Button': !!document.getElementById('manual-refresh'),
    'Stake Buttons': document.querySelectorAll('.stake-btn').length,
    'Uniswap Links': document.querySelectorAll('.uniswap-link').length
};

Object.entries(domElementsCheck).forEach(([name, status]) => {
    const isAvailable = typeof status === 'boolean' ? status : status > 0;
    const displayValue = typeof status === 'number' ? `${status} found` : (status ? 'Found' : 'Missing');
    console.log(`${isAvailable ? '✅' : '❌'} ${name}: ${displayValue}`);
});

// Test 3: Check current route and component
console.log('\n📋 Test 3: Routing Check');
if (window.router) {
    const currentRoute = window.router.getCurrentRoute();
    const currentPath = window.router.getCurrentPath();
    console.log(`✅ Current Route: ${currentRoute}`);
    console.log(`✅ Current Path: ${currentPath}`);
    console.log(`✅ Current Component: ${window.router.currentComponent ? window.router.currentComponent.constructor.name : 'None'}`);
} else {
    console.log('❌ Router not available');
}

// Test 4: Test wallet connection
console.log('\n📋 Test 4: Wallet Connection Test');
if (window.walletManager) {
    const isConnected = window.walletManager.isConnected();
    const address = window.walletManager.getAddress();
    console.log(`${isConnected ? '✅' : '❌'} Wallet Connected: ${isConnected}`);
    if (isConnected) {
        console.log(`✅ Wallet Address: ${address}`);
    }
} else {
    console.log('❌ WalletManager not available');
}

// Test 5: Test notification system
console.log('\n📋 Test 5: Notification System Test');
if (window.notificationManager) {
    console.log('✅ Testing notification system...');
    window.notificationManager.info('Debug Test', 'Notification system is working!');
} else {
    console.log('❌ NotificationManager not available');
}

// Test 6: Test staking modal
console.log('\n📋 Test 6: Staking Modal Test');
if (window.stakingModal) {
    console.log('✅ StakingModal instance available');
    console.log('✅ Testing staking modal...');
    
    // Test with mock data
    const mockPair = {
        id: 'pair-1',
        name: 'LIB-USDT',
        lpToken: '0x1234567890123456789012345678901234567890',
        apr: 0,
        isActive: true
    };
    
    try {
        window.stakingModal.show(mockPair, 0); // Show stake tab
        console.log('✅ Staking modal opened successfully');
    } catch (error) {
        console.log('❌ Error opening staking modal:', error);
    }
} else {
    console.log('❌ StakingModal instance not available');
}

// Test 7: Test button functionality
console.log('\n📋 Test 7: Button Functionality Test');

// Test connect wallet button
const connectBtn = document.getElementById('connect-wallet-btn');
if (connectBtn) {
    console.log('✅ Connect wallet button found');
    console.log('🔄 Testing connect wallet button click...');
    connectBtn.click();
} else {
    console.log('❌ Connect wallet button not found');
}

// Test manual refresh button
setTimeout(() => {
    const refreshBtn = document.getElementById('manual-refresh');
    if (refreshBtn) {
        console.log('✅ Manual refresh button found');
        console.log('🔄 Testing manual refresh button click...');
        refreshBtn.click();
    } else {
        console.log('❌ Manual refresh button not found');
    }
}, 1000);

// Test stake buttons
setTimeout(() => {
    const stakeButtons = document.querySelectorAll('.stake-btn');
    if (stakeButtons.length > 0) {
        console.log(`✅ Found ${stakeButtons.length} stake buttons`);
        console.log('🔄 Testing first stake button click...');
        stakeButtons[0].click();
    } else {
        console.log('❌ No stake buttons found');
    }
}, 2000);

console.log('\n🧪 Debug test completed! Check the results above and any additional console messages.');
console.log('💡 If you see errors, they will help identify what needs to be fixed.');

// Helper function to manually test staking modal
window.testStakingModal = function() {
    if (window.stakingModal) {
        const mockPair = {
            id: 'pair-1',
            name: 'LIB-USDT',
            lpToken: '0x1234567890123456789012345678901234567890',
            apr: 0,
            isActive: true
        };
        window.stakingModal.show(mockPair, 0);
        console.log('✅ Staking modal test executed');
    } else {
        console.log('❌ StakingModal not available');
    }
};

// Helper function to manually test wallet connection
window.testWalletConnection = function() {
    if (window.walletManager) {
        window.walletManager.connectMetaMask()
            .then(() => console.log('✅ Wallet connection test successful'))
            .catch(error => console.log('❌ Wallet connection test failed:', error));
    } else {
        console.log('❌ WalletManager not available');
    }
};

console.log('\n🛠️ Helper functions available:');
console.log('- testStakingModal() - Test the staking modal');
console.log('- testWalletConnection() - Test wallet connection');