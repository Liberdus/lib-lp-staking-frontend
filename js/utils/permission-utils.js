/**
 * Permission Utilities
 * Shared functions for permission button text and actions
 */

class PermissionUtils {
    /**
     * Get the appropriate button text for permission buttons
     * @param {string} networkName - The network name
     * @returns {string} - The button text
     */
    static getPermissionButtonText(networkName) {
        // For Polygon Mainnet, show "Add Polygon Mainnet" since it's likely not in MetaMask
        if (networkName === 'Polygon Mainnet') {
            return 'Add Polygon';
        }
        // For other networks, show "Grant [Network] Permission"
        return `Grant ${networkName} Permission`;
    }

    /**
     * Get the appropriate button action for permission buttons
     * @param {string} networkName - The network name
     * @param {string} context - Context ('home' or 'admin')
     * @returns {string} - The button action
     */
    static getPermissionButtonAction(networkName, context = 'home') {
        // For Polygon Mainnet, add network to MetaMask
        if (networkName === 'Polygon Mainnet') {
            return 'window.networkSelector.addNetworkToMetaMaskAndReload("POLYGON_MAINNET")';
        }
        // For other networks, use the standard permission request
        return `window.networkManager.requestPermissionWithUIUpdate('${context}')`;
    }

    /**
     * Get the appropriate button title for permission buttons
     * @param {string} networkName - The network name
     * @returns {string} - The button title
     */
    static getPermissionButtonTitle(networkName) {
        // For Polygon Mainnet, show "Add Polygon Mainnet to MetaMask"
        if (networkName === 'Polygon Mainnet') {
            return 'Add Polygon to MetaMask';
        }
        // For other networks, show "Grant permission for [Network]"
        return `Grant permission for ${networkName}`;
    }
}

// Make available globally
window.PermissionUtils = PermissionUtils;
