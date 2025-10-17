/**
 * Network Permission Manager
 * Modern MetaMask chain permissions handler using centralized config
 * 
 * This utility handles network permissions instead of forcing network switches,
 * allowing users to stay on any network while the dApp uses the required network.
 */

class NetworkPermission {
    /**
     * Get the expected chain ID from centralized config
     * @returns {number} Chain ID (e.g., 80002 for Polygon Amoy)
     */
    static get AMOY_CHAIN_ID() {
        return window.CONFIG?.NETWORK?.CHAIN_ID || 80002;
    }

    /**
     * Get the expected chain ID in hex format
     * @returns {string} Chain ID in hex (e.g., '0x13882')
     */
    static get AMOY_CHAIN_ID_HEX() {
        return '0x' + NetworkPermission.AMOY_CHAIN_ID.toString(16);
    }

    /**
     * Get network configuration from centralized config
     * @returns {object} Network configuration
     */
    static getNetworkConfig() {
        return {
            chainId: NetworkPermission.AMOY_CHAIN_ID_HEX,
            chainName: window.CONFIG?.NETWORK?.NAME || 'Polygon Amoy Testnet',
            rpcUrls: [
                window.CONFIG?.NETWORK?.RPC_URL || 'https://rpc-amoy.polygon.technology',
                ...(window.CONFIG?.NETWORK?.FALLBACK_RPCS || [])
            ],
            nativeCurrency: window.CONFIG?.NETWORK?.NATIVE_CURRENCY || {
                name: 'MATIC',
                symbol: 'MATIC',
                decimals: 18
            },
            blockExplorerUrls: [
                window.CONFIG?.NETWORK?.BLOCK_EXPLORER || 'https://amoy.polygonscan.com'
            ]
        };
    }

    /**
     * Check if we have permission to use the Amoy network
     * @returns {Promise<boolean>} True if wallet is connected and on Amoy network
     */
    static async hasAmoyPermission() {
        try {
            if (!window.ethereum) return false;

            // Check if wallet is connected to dApp
            const permissions = await window.ethereum.request({
                method: 'wallet_getPermissions'
            });

            if (!permissions.some(p => p.parentCapability === 'eth_accounts')) {
                return false; // Not connected to dApp
            }

            // Check if currently on Amoy network
            const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
            const amoyChainIdHex = '0x' + NetworkPermission.AMOY_CHAIN_ID.toString(16);
            
            return currentChainId === amoyChainIdHex;

        } catch (error) {
            console.error('Error checking Amoy permission:', error);
            return false;
        }
    }

    /**
     * Request permission to use the Amoy network
     * This adds the network to MetaMask and ensures we can interact with it
     * @param {string} walletType - Type of wallet ('metamask', 'walletconnect')
     * @returns {Promise<boolean>} True if permission granted
     */
    static async requestAmoyPermission(walletType = 'metamask') {
        try {
            if (walletType === 'metamask') {
                return await NetworkPermission._requestMetaMaskPermission();
            } else if (walletType === 'walletconnect') {
                // WalletConnect handles network permissions during connection
                console.log('WalletConnect permissions managed during connection');
                return true;
            } else {
                throw new Error(`Unsupported wallet type: ${walletType}`);
            }
        } catch (error) {
            console.error('Failed to request Amoy permission:', error);
            throw error;
        }
    }

    /**
     * Request MetaMask-specific permission
     * @private
     * @returns {Promise<boolean>}
     */
    static async _requestMetaMaskPermission() {
        if (!window.ethereum) {
            throw new Error('MetaMask not installed');
        }

        try {
            console.log('🔐 Requesting Amoy network permission...');

            // First, ensure we have account permissions
            try {
                await window.ethereum.request({
                    method: 'wallet_requestPermissions',
                    params: [{ eth_accounts: {} }]
                });
            } catch (error) {
                // User might have rejected or already has permissions
                if (error.code === 4001) {
                    throw new Error('User rejected permission request');
                }
                // If error is "already processing", continue anyway
            }

            // Add Amoy network to MetaMask
            await NetworkPermission.addAmoyNetworkIfNeeded();
            return true;

        } catch (error) {
            console.error('❌ Failed to request MetaMask permission:', error);
            throw error;
        }
    }

    /**
     * Add Amoy network to MetaMask if not already added
     * @returns {Promise<void>}
     */
    static async addAmoyNetworkIfNeeded() {
        if (!window.ethereum) {
            throw new Error('MetaMask not installed');
        }

        try {
            const networkConfig = NetworkPermission.getNetworkConfig();

            // Try to add the network
            // If already added, this will just succeed silently or return an error we can ignore
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [networkConfig]
            });


        } catch (error) {
            // Error code 4902 means the chain has not been added
            if (error.code === 4902) {
                throw new Error('Failed to add Amoy network to MetaMask');
            }
            
            // Error code -32602 means chain already added (can be ignored)
            if (error.code === -32602) {
                console.log('Amoy network already added');
                return;
            }

            // User rejected
            if (error.code === 4001) {
                throw new Error('User rejected adding Amoy network');
            }

            // Other errors
            console.warn('Error adding network:', error);
            // Don't throw - network might already be added
        }
    }

    /**
     * Get current permissions for debugging
     * @returns {Promise<Array>} Array of permissions
     */
    static async getCurrentPermissions() {
        try {
            if (!window.ethereum) {
                return [];
            }

            const permissions = await window.ethereum.request({
                method: 'wallet_getPermissions'
            });

            console.log('Current MetaMask permissions:', permissions);
            return permissions;

        } catch (error) {
            console.error('Error getting permissions:', error);
            return [];
        }
    }

    /**
     * Get network name for a given chain ID
     * @param {number} chainId - Chain ID
     * @returns {string} Network name
     */
    static getNetworkName(chainId) {
        if (!chainId) return 'Not Connected';
        
        const networks = {
            1: 'Ethereum Mainnet',
            5: 'Goerli',
            11155111: 'Sepolia',
            137: 'Polygon Mainnet',
            80001: 'Mumbai Testnet',
            80002: 'Polygon Amoy',
            31337: 'Localhost',
            59144: 'Linea'
        };
        return networks[chainId] || `Chain ${chainId}`;
    }

    /**
     * Centralized permission request with UI updates
     * Replaces duplicate logic in admin.html and index.html
     * @param {string} context - 'admin' or 'home'
     * @returns {Promise<boolean>} Success status
     */
    static async requestPermissionWithUIUpdate(context = 'admin') {
        try {
            const expectedChainId = window.CONFIG?.NETWORK?.CHAIN_ID || NetworkPermission.AMOY_CHAIN_ID;
            const networkName = NetworkPermission.getNetworkName(expectedChainId);

            // Request permission using modern approach
            await NetworkPermission.requestAmoyPermission('metamask');

            // Update UI based on context
            if (context === 'admin' && window.adminPage) {
                const chainId = window.walletManager?.getChainId();
                const currentNetworkName = NetworkPermission.getNetworkName(chainId);
                if (typeof window.adminPage.updateNetworkIndicatorWithPermission === 'function') {
                    window.adminPage.updateNetworkIndicatorWithPermission(true, chainId, currentNetworkName);
                }
            } else if (context === 'home' && window.homePage) {
                if (typeof window.homePage.updateNetworkIndicator === 'function') {
                    await window.homePage.updateNetworkIndicator();
                }
            }

            // Show success notification
            const message = `${networkName} network permission granted`;
            if (context === 'admin') {
                alert(`✅ ${message}! You can now use the admin panel.`);
            } else if (window.homepageNotificationManager) {
                window.homepageNotificationManager.show('success', 'Permission Granted', message);
            } else if (window.notificationManager) {
                window.notificationManager.success('Permission Granted', message);
            }

            return true;
        } catch (error) {
            console.error('❌ Failed to get network permission:', error);
            const errorMessage = 'Failed to get network permission. Please grant permission for Amoy network in MetaMask.';
            
            if (context === 'admin') {
                alert(errorMessage);
            } else if (window.homepageNotificationManager) {
                window.homepageNotificationManager.show('error', 'Permission Error', errorMessage);
            }
            
            throw error;
        }
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.NetworkPermission = NetworkPermission;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetworkPermission;
}


