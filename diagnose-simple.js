// SIMPLE DIAGNOSTIC SCRIPT FOR ACTION EXECUTION
// Copy and paste this into the browser console on the admin.html page
// Make sure you're connected to your wallet first!

(async function diagnoseAction() {
    const actionId = 66; // Change this to the action ID you want to diagnose
    
    console.log('═'.repeat(80));
    console.log('🔍 ACTION EXECUTION DIAGNOSTIC');
    console.log('═'.repeat(80));
    console.log(`Action ID: ${actionId}`);
    console.log('');
    
    try {
        // Check if contract manager exists
        if (!window.contractManager) {
            console.error('❌ ERROR: contractManager not found');
            console.log('Make sure you are on the admin.html page and connected to your wallet');
            return;
        }
        
        if (!window.contractManager.stakingContract) {
            console.error('❌ ERROR: Contract not initialized');
            console.log('Please connect your wallet first');
            return;
        }
        
        const contract = window.contractManager.stakingContract;
        const provider = window.contractManager.provider;
        const signer = window.contractManager.signer;
        
        console.log('✅ Contract Manager Found');
        console.log(`   Contract: ${contract.address}`);
        console.log('');
        
        // 1. Get action details
        console.log('1️⃣ FETCHING ACTION DETAILS...');
        console.log('─'.repeat(80));
        
        const action = await contract.actions(actionId);
        
        console.log('Action Details:');
        console.log(`   Action Type: ${action.actionType.toString()}`);
        console.log(`   Approvals: ${action.approvals.toString()}`);
        console.log(`   Executed: ${action.executed}`);
        console.log(`   Rejected: ${action.rejected}`);
        console.log(`   Expired Flag: ${action.expired}`);
        console.log(`   Proposed Time: ${action.proposedTime.toString()}`);
        console.log('');
        
        // 2. Check requirements
        console.log('2️⃣ CHECKING REQUIREMENTS...');
        console.log('─'.repeat(80));
        
        const requiredApprovals = await contract.REQUIRED_APPROVALS();
        console.log(`Required Approvals: ${requiredApprovals.toString()}`);
        console.log(`Current Approvals: ${action.approvals.toString()}`);
        
        const hasEnoughApprovals = action.approvals >= requiredApprovals;
        console.log(`${hasEnoughApprovals ? '✅' : '❌'} Has Enough Approvals: ${hasEnoughApprovals}`);
        console.log('');
        
        // 3. Check time-based expiry
        console.log('3️⃣ CHECKING TIME-BASED EXPIRY...');
        console.log('─'.repeat(80));
        
        const currentBlock = await provider.getBlock('latest');
        const currentTime = currentBlock.timestamp;
        const proposedTime = parseInt(action.proposedTime.toString());
        const expiryTime = proposedTime + (7 * 24 * 60 * 60); // 7 days
        const timeRemaining = expiryTime - currentTime;
        
        console.log(`Current Time: ${currentTime} (${new Date(currentTime * 1000).toLocaleString()})`);
        console.log(`Proposed Time: ${proposedTime} (${new Date(proposedTime * 1000).toLocaleString()})`);
        console.log(`Expiry Time: ${expiryTime} (${new Date(expiryTime * 1000).toLocaleString()})`);
        console.log(`Time Remaining: ${timeRemaining} seconds (${(timeRemaining / 3600).toFixed(2)} hours)`);
        
        const isTimeExpired = currentTime > expiryTime;
        console.log(`${isTimeExpired ? '❌' : '✅'} Is Expired (time-based): ${isTimeExpired}`);
        console.log('');
        
        // 4. Check admin role
        console.log('4️⃣ CHECKING ADMIN ROLE...');
        console.log('─'.repeat(80));
        
        const signerAddress = await signer.getAddress();
        const adminRole = await contract.ADMIN_ROLE();
        const hasAdminRole = await contract.hasRole(adminRole, signerAddress);
        
        console.log(`Signer Address: ${signerAddress}`);
        console.log(`${hasAdminRole ? '✅' : '❌'} Has ADMIN_ROLE: ${hasAdminRole}`);
        console.log('');
        
        // 5. Check action type specific data
        console.log('5️⃣ ACTION TYPE SPECIFIC DATA...');
        console.log('─'.repeat(80));
        
        const actionTypes = [
            'SET_HOURLY_REWARD_RATE',
            'UPDATE_PAIR_WEIGHTS',
            'ADD_PAIR',
            'REMOVE_PAIR',
            'CHANGE_SIGNER',
            'WITHDRAW_REWARDS'
        ];
        
        const actionTypeName = actionTypes[action.actionType.toString()] || 'UNKNOWN';
        console.log(`Action Type: ${actionTypeName}`);
        
        if (action.actionType.toString() === '0') { // SET_HOURLY_REWARD_RATE
            console.log(`New Hourly Reward Rate: ${action.newHourlyRewardRate.toString()}`);

            const currentRate = await contract.hourlyRewardRate();
            console.log(`Current Hourly Reward Rate: ${currentRate.toString()}`);

            // Check active pairs - try to get count
            try {
                // activePairs is a mapping, not an array with .length
                // We'll try to get a few pairs to see if any exist
                let pairCount = 0;
                for (let i = 0; i < 10; i++) {
                    try {
                        const pairAddress = await contract.activePairs(i);
                        if (pairAddress && pairAddress !== '0x0000000000000000000000000000000000000000') {
                            pairCount++;
                        } else {
                            break;
                        }
                    } catch (e) {
                        break;
                    }
                }
                console.log(`Active Pairs Count: ${pairCount} (checked first 10 slots)`);
            } catch (e) {
                console.log(`Active Pairs Count: Unable to determine (${e.message})`);
            }
        }
        console.log('');
        
        // 6. Try gas estimation
        console.log('6️⃣ GAS ESTIMATION TEST...');
        console.log('─'.repeat(80));
        
        try {
            const gasEstimate = await contract.estimateGas.executeAction(actionId);
            console.log(`✅ Gas Estimate: ${gasEstimate.toString()}`);
            console.log('   This means the transaction SHOULD succeed!');
        } catch (gasError) {
            console.error('❌ Gas Estimation FAILED');
            console.error(`   Error: ${gasError.message}`);
            
            // Try static call for more details
            console.log('');
            console.log('   Trying static call for detailed error...');
            try {
                await contract.callStatic.executeAction(actionId);
                console.log('   ✅ Static call succeeded (unexpected)');
            } catch (staticError) {
                console.error('   ❌ Static call also failed');
                console.error(`   Error: ${staticError.message}`);
                
                if (staticError.reason) {
                    console.error(`   🔍 REVERT REASON: "${staticError.reason}"`);
                }
                
                // Try to decode error data
                if (staticError.error && staticError.error.data) {
                    console.error(`   Error Data: ${staticError.error.data}`);
                }
            }
        }
        console.log('');
        
        // 7. Summary
        console.log('7️⃣ EXECUTION READINESS SUMMARY');
        console.log('═'.repeat(80));
        
        const checks = [
            { name: 'Not Executed', passed: !action.executed },
            { name: 'Not Rejected', passed: !action.rejected },
            { name: 'Not Expired (flag)', passed: !action.expired },
            { name: 'Not Expired (time)', passed: !isTimeExpired },
            { name: 'Has Enough Approvals', passed: hasEnoughApprovals },
            { name: 'User Has ADMIN_ROLE', passed: hasAdminRole }
        ];
        
        let allPassed = true;
        checks.forEach(check => {
            const icon = check.passed ? '✅' : '❌';
            console.log(`${icon} ${check.name}`);
            if (!check.passed) allPassed = false;
        });
        
        console.log('');
        console.log('═'.repeat(80));
        
        if (allPassed) {
            console.log('✅ ALL CHECKS PASSED!');
            console.log('');
            console.log('The action should be executable.');
            console.log('If execution still fails, check the gas estimation error above.');
        } else {
            console.log('❌ SOME CHECKS FAILED!');
            console.log('');
            console.log('The action cannot be executed until the failed checks are resolved.');
            console.log('See the failed items above for details.');
        }
        
        console.log('═'.repeat(80));
        
        // Return summary object
        return {
            actionId,
            allChecksPassed: allPassed,
            checks: checks.reduce((obj, check) => {
                obj[check.name] = check.passed;
                return obj;
            }, {}),
            action: {
                type: actionTypeName,
                approvals: action.approvals.toString(),
                executed: action.executed,
                rejected: action.rejected,
                expired: action.expired,
                proposedTime: new Date(proposedTime * 1000).toLocaleString()
            }
        };
        
    } catch (error) {
        console.error('');
        console.error('═'.repeat(80));
        console.error('❌ DIAGNOSTIC ERROR');
        console.error('═'.repeat(80));
        console.error(error);
        console.error('');
        console.error('Stack trace:');
        console.error(error.stack);
        return { error: error.message };
    }
})();

