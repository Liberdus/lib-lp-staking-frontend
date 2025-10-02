// Comprehensive diagnostic script for Action #66
// Run this in the browser console when connected to the admin page

(async () => {
    try {
        console.log('='.repeat(80));
        console.log('COMPREHENSIVE ACTION #66 DIAGNOSTIC');
        console.log('='.repeat(80));
        
        const actionId = 66;
        
        // 1. Check contract connection
        console.log('\n1️⃣ CONTRACT CONNECTION CHECK');
        console.log('-'.repeat(80));
        if (!window.contractManager) {
            console.error('❌ contractManager not found');
            return;
        }
        if (!window.contractManager.stakingContract) {
            console.error('❌ stakingContract not initialized');
            return;
        }
        console.log('✅ Contract connected:', window.contractManager.stakingContract.address);
        
        // 2. Get action details
        console.log('\n2️⃣ ACTION DETAILS');
        console.log('-'.repeat(80));
        const action = await window.contractManager.stakingContract.actions(actionId);
        console.log('Raw action object:', action);
        console.log('Action Type:', action.actionType.toString());
        console.log('Approvals:', action.approvals.toString());
        console.log('Executed:', action.executed);
        console.log('Rejected:', action.rejected);
        console.log('Expired (flag):', action.expired);
        console.log('Proposed Time:', action.proposedTime ? action.proposedTime.toString() : 'N/A');
        
        // 3. Check REQUIRED_APPROVALS constant
        console.log('\n3️⃣ APPROVAL REQUIREMENTS');
        console.log('-'.repeat(80));
        const requiredApprovals = await window.contractManager.stakingContract.REQUIRED_APPROVALS();
        console.log('Required Approvals:', requiredApprovals.toString());
        console.log('Current Approvals:', action.approvals.toString());
        console.log('Has enough approvals:', action.approvals >= requiredApprovals ? '✅ YES' : '❌ NO');
        
        // 4. Check time-based expiry
        console.log('\n4️⃣ TIME-BASED EXPIRY CHECK');
        console.log('-'.repeat(80));
        const currentBlockTime = (await window.contractManager.provider.getBlock('latest')).timestamp;
        const proposedTime = parseInt(action.proposedTime.toString());
        const expiryTime = proposedTime + (7 * 24 * 60 * 60); // 7 days
        const timeRemaining = expiryTime - currentBlockTime;
        
        console.log('Current Block Time:', currentBlockTime, '(' + new Date(currentBlockTime * 1000).toISOString() + ')');
        console.log('Proposed Time:', proposedTime, '(' + new Date(proposedTime * 1000).toISOString() + ')');
        console.log('Expiry Time:', expiryTime, '(' + new Date(expiryTime * 1000).toISOString() + ')');
        console.log('Time Remaining:', timeRemaining, 'seconds (' + (timeRemaining / 3600).toFixed(2) + ' hours)');
        console.log('Is Expired (time-based):', currentBlockTime > expiryTime ? '❌ YES' : '✅ NO');
        
        // 5. Check ADMIN_ROLE
        console.log('\n5️⃣ ADMIN ROLE CHECK');
        console.log('-'.repeat(80));
        const signer = window.contractManager.signer;
        const signerAddress = await signer.getAddress();
        const adminRole = await window.contractManager.stakingContract.ADMIN_ROLE();
        const hasAdminRole = await window.contractManager.stakingContract.hasRole(adminRole, signerAddress);
        
        console.log('Signer Address:', signerAddress);
        console.log('ADMIN_ROLE:', adminRole);
        console.log('Has ADMIN_ROLE:', hasAdminRole ? '✅ YES' : '❌ NO');
        
        // 6. Check action-specific data
        console.log('\n6️⃣ ACTION-SPECIFIC DATA');
        console.log('-'.repeat(80));
        const actionTypeNames = [
            'SET_HOURLY_REWARD_RATE',
            'UPDATE_PAIR_WEIGHTS',
            'ADD_PAIR',
            'REMOVE_PAIR',
            'CHANGE_SIGNER',
            'WITHDRAW_REWARDS'
        ];
        const actionTypeName = actionTypeNames[action.actionType.toString()] || 'UNKNOWN';
        console.log('Action Type Name:', actionTypeName);
        
        if (action.actionType.toString() === '0') { // SET_HOURLY_REWARD_RATE
            console.log('New Hourly Reward Rate:', action.newHourlyRewardRate.toString());
            
            // Check current rate
            const currentRate = await window.contractManager.stakingContract.hourlyRewardRate();
            console.log('Current Hourly Reward Rate:', currentRate.toString());
            
            // Check active pairs (updateAllRewards will iterate through these)
            console.log('\nActive Pairs (will be updated):');
            const activePairsCount = await window.contractManager.stakingContract.activePairs.length;
            console.log('Active Pairs Count:', activePairsCount);
            
            for (let i = 0; i < activePairsCount; i++) {
                const pairAddress = await window.contractManager.stakingContract.activePairs(i);
                const pair = await window.contractManager.stakingContract.pairs(pairAddress);
                console.log(`  Pair ${i}:`, pairAddress);
                console.log(`    Name: ${pair.pairName}`);
                console.log(`    Platform: ${pair.platform}`);
                console.log(`    Weight: ${pair.weight.toString()}`);
                console.log(`    Active: ${pair.isActive}`);
            }
        }
        
        // 7. Try to estimate gas
        console.log('\n7️⃣ GAS ESTIMATION');
        console.log('-'.repeat(80));
        try {
            const gasEstimate = await window.contractManager.stakingContract.estimateGas.executeAction(actionId);
            console.log('✅ Gas Estimate:', gasEstimate.toString());
        } catch (gasError) {
            console.error('❌ Gas Estimation Failed:', gasError.message);
            
            // Try to decode the error
            if (gasError.error && gasError.error.message) {
                console.error('Error details:', gasError.error.message);
            }
            if (gasError.reason) {
                console.error('Revert reason:', gasError.reason);
            }
            
            // Try to call the function statically to get the revert reason
            console.log('\nTrying static call to get revert reason...');
            try {
                await window.contractManager.stakingContract.callStatic.executeAction(actionId);
                console.log('✅ Static call succeeded (should not happen if gas estimation failed)');
            } catch (staticError) {
                console.error('❌ Static call failed:', staticError.message);
                if (staticError.reason) {
                    console.error('🔍 REVERT REASON:', staticError.reason);
                }
                if (staticError.error && staticError.error.data) {
                    console.error('Error data:', staticError.error.data);
                }
            }
        }
        
        // 8. Summary
        console.log('\n8️⃣ EXECUTION READINESS SUMMARY');
        console.log('='.repeat(80));
        
        const checks = {
            'Action exists': action.proposer !== '0x0000000000000000000000000000000000000000',
            'Not executed': !action.executed,
            'Not rejected': !action.rejected,
            'Not expired (flag)': !action.expired,
            'Not expired (time)': currentBlockTime <= expiryTime,
            'Has enough approvals': action.approvals >= requiredApprovals,
            'User has ADMIN_ROLE': hasAdminRole
        };
        
        let allPassed = true;
        for (const [check, passed] of Object.entries(checks)) {
            console.log(`${passed ? '✅' : '❌'} ${check}`);
            if (!passed) allPassed = false;
        }
        
        console.log('\n' + '='.repeat(80));
        if (allPassed) {
            console.log('✅ ALL CHECKS PASSED - Action should be executable');
            console.log('If execution still fails, check the gas estimation error above for the revert reason.');
        } else {
            console.log('❌ SOME CHECKS FAILED - Action cannot be executed');
        }
        console.log('='.repeat(80));
        
    } catch (error) {
        console.error('Diagnostic script error:', error);
    }
})();

