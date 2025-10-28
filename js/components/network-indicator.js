/**
 * Network Indicator Component
 * Shared component for displaying network status and permissions
 * Used by both home page and admin page to reduce duplication
 */

class NetworkIndicator {
    /**
     * Update network indicator for a given context
     * @param {string} indicatorId - ID of the indicator element
     * @param {string} selectorId - ID of the network selector container
     * @param {string} context - 'home' or 'admin'
     */
    static async update(indicatorId, selectorId, context = 'home') {
        const indicator = document.getElementById(indicatorId);
        if (!indicator) return;

        // Always show the network indicator
        indicator.style.display = 'flex';

        // Show loading state initially
        indicator.innerHTML = `
            <span class="network-status-dot gray"></span>
            <div id="${selectorId}"></div>
        `;
        indicator.className = `network-indicator-${context} loading`;

        const isWalletConnected = window.walletManager && window.walletManager.isConnected();
        const expectedNetworkName = window.CONFIG?.NETWORK?.NAME || 'Unknown';

        // Check permission asynchronously if wallet is connected
        if (isWalletConnected && window.networkManager) {
            try {
                const hasPermission = await window.networkManager.hasRequiredNetworkPermission();

                if (hasPermission) {
                    // Green indicator - has permission
                    indicator.innerHTML = `
                        <span class="network-status-dot green"></span>
                        <div id="${selectorId}"></div>
                    `;
                    indicator.className = `network-indicator-${context} has-permission`;
                } else {
                    // Red indicator - missing permission
                    const buttonText = window.PermissionUtils?.getPermissionButtonText(expectedNetworkName) || `Grant ${expectedNetworkName} Permission`;
                    const buttonAction = window.PermissionUtils?.getPermissionButtonAction(expectedNetworkName, context) || `window.networkManager.requestPermissionWithUIUpdate('${context}')`;
                    
                    indicator.innerHTML = `
                        <span class="network-status-dot red"></span>
                        <div id="${selectorId}"></div>
                        <button class="btn-grant-permission" onclick="${buttonAction}">
                            ${buttonText}
                        </button>
                    `;
                    indicator.className = `network-indicator-${context} missing-permission`;
                }
            } catch (error) {
                console.error('Error checking network permission:', error);
                // Fallback to no permission state
                const buttonText = window.PermissionUtils?.getPermissionButtonText(expectedNetworkName) || `Grant ${expectedNetworkName} Permission`;
                const buttonAction = window.PermissionUtils?.getPermissionButtonAction(expectedNetworkName, context) || `window.networkManager.requestPermissionWithUIUpdate('${context}')`;
                
                indicator.innerHTML = `
                    <span class="network-status-dot red"></span>
                    <div id="${selectorId}"></div>
                    <button class="btn-grant-permission" onclick="${buttonAction}">
                        ${buttonText}
                    </button>
                `;
                indicator.className = `network-indicator-${context} missing-permission`;
            }
        } else {
            // No wallet connected - show network selector only
            indicator.innerHTML = `
                <span class="network-status-dot gray"></span>
                <div id="${selectorId}"></div>
            `;
            indicator.className = `network-indicator-${context} no-wallet`;
        }

        // Add network selector after DOM update
        setTimeout(() => {
            const container = document.getElementById(selectorId);
            if (container && window.networkSelector) {
                container.innerHTML = '';
                window.networkSelector.createSelector(selectorId, context);
            }
        }, 100);
    }
}

// Make available globally
window.NetworkIndicator = NetworkIndicator;

