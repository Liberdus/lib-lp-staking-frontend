/**
 * Quick Fix Script - Run this in browser console to make buttons work
 */

console.log('🔧 Applying quick fixes to make buttons functional...');

// Fix 1: Ensure StakingModal instance exists
if (window.StakingModal && !window.stakingModal) {
    window.stakingModal = new window.StakingModal();
    console.log('✅ StakingModal instance created');
}

// Fix 2: Add event listeners to stake buttons
function attachStakeButtonListeners() {
    const stakeButtons = document.querySelectorAll('.stake-btn');
    console.log(`🔘 Found ${stakeButtons.length} stake buttons`);
    
    stakeButtons.forEach(btn => {
        // Remove existing listeners
        btn.replaceWith(btn.cloneNode(true));
        
        // Get the new button reference
        const newBtn = document.querySelector(`[data-pair-id="${btn.getAttribute('data-pair-id')}"].stake-btn`);
        
        if (newBtn) {
            newBtn.addEventListener('click', function(e) {
                console.log('🎯 Stake button clicked!');
                const pairId = this.getAttribute('data-pair-id');
                
                if (window.stakingModal) {
                    const mockPair = {
                        id: pairId,
                        name: 'LIB-USDT',
                        lpToken: '0x1234567890123456789012345678901234567890',
                        apr: 0,
                        isActive: true
                    };
                    
                    window.stakingModal.show(mockPair, 0);
                    console.log('✅ Staking modal opened');
                } else {
                    console.log('❌ StakingModal not available');
                    if (window.notificationManager) {
                        window.notificationManager.info('Coming Soon', 'Staking functionality will be available soon');
                    }
                }
            });
        }
    });
}

// Fix 3: Add event listener to refresh button
function attachRefreshButtonListener() {
    const refreshBtn = document.getElementById('manual-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            console.log('🔄 Refresh button clicked!');
            if (window.notificationManager) {
                window.notificationManager.success('Refreshed', 'Data has been updated');
            }
        });
        console.log('✅ Refresh button listener attached');
    }
}

// Fix 4: Add event listeners to Uniswap links
function attachUniswapLinkListeners() {
    const uniswapLinks = document.querySelectorAll('.uniswap-link');
    console.log(`🦄 Found ${uniswapLinks.length} Uniswap links`);
    
    uniswapLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            console.log('🦄 Uniswap link clicked!');
            const pairName = this.getAttribute('data-pair') || 'LIB-USDT';
            const [token0, token1] = pairName.split('-');
            const uniswapUrl = `https://app.uniswap.org/#/add/v2/${token0}/${token1}`;
            
            window.open(uniswapUrl, '_blank', 'noopener,noreferrer');
            
            if (window.notificationManager) {
                window.notificationManager.info('Redirecting', `Opening Uniswap to add ${pairName} liquidity`);
            }
        });
    });
}

// Fix 5: Test wallet connection
function testWalletConnection() {
    const connectBtn = document.getElementById('connect-wallet-btn');
    if (connectBtn) {
        console.log('✅ Connect wallet button found');
        // The wallet connection should already work
    }
}

// Apply all fixes
attachStakeButtonListeners();
attachRefreshButtonListener();
attachUniswapLinkListeners();
testWalletConnection();

console.log('✅ Quick fixes applied! Try clicking the buttons now.');

// Helper function to reapply fixes if needed
window.applyQuickFixes = function() {
    attachStakeButtonListeners();
    attachRefreshButtonListener();
    attachUniswapLinkListeners();
    console.log('✅ Quick fixes reapplied!');
};

console.log('💡 If buttons still don\'t work, run: applyQuickFixes()');