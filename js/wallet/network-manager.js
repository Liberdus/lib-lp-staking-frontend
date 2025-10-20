/**
 * NetworkManager - Handles network switching and validation
 * Manages different blockchain networks and switching between them
 */
class NetworkManager {
    constructor() {
        this.currentNetwork = null;
        this.supportedNetworks = window.CONFIG.NETWORKS;
        this.defaultNetwork = window.CONFIG.DEFAULT_NETWORK;
        this.listeners = new Set();
        
        this.init();
    }

    /**
     * Initialize network manager
     */
    init() {
        this.log('NetworkManager initialized');
        
        // Subscribe to wallet manager events
        if (window.walletManager) {
            window.walletManager.subscribe((event, data) => {
                if (event === 'connected' || event === 'chainChanged') {
                    this.handleNetworkChange(data.chainId);
                }
            });
        }
    }

    /**
     * Check if current network is supported
     */
    isNetworkSupported(chainId = null) {
        const targetChainId = chainId || this.getCurrentChainId();
        return Object.values(this.supportedNetworks).some(network => network.chainId === targetChainId);
    }

    /**
     * Check if wallet is on the required network (synchronous chainId comparison)
     * ⚠️ NETWORK CHECK ONLY - Does NOT verify MetaMask permissions
     * Only compares chainId values, not wallet_getPermissions
     * For permission checks, use hasRequiredNetworkPermission()
     * @param {number} chainId - Chain ID to check (defaults to current)
     * @returns {boolean} True if on required network (chainId match)
     */
    isOnRequiredNetwork(chainId = null) {
        const targetChainId = chainId || this.getCurrentChainId();
        const requiredChainId = window.CONFIG?.NETWORK?.CHAIN_ID || this.defaultNetwork;
        return targetChainId === requiredChainId;
    }

    /**
     * Check if we have required network permission (async with RPC calls)
     * @returns {Promise<boolean>} True if has permission for required network
     */
    async hasRequiredNetworkPermission() {
        try {
            if (!window.ethereum) return false;

            // Check if wallet is connected to dApp
            const permissions = await window.ethereum.request({
                method: 'wallet_getPermissions'
            });

            if (!permissions.some(p => p.parentCapability === 'eth_accounts')) {
                return false; // Not connected to dApp
            }

            // Check if currently on configured network
            const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
            const expectedChainIdHex = this.getChainIdHex();
            
            return currentChainId === expectedChainIdHex;

        } catch (error) {
            const networkName = window.CONFIG?.NETWORK?.NAME || 'configured network';
            console.error(`Error checking ${networkName} permission:`, error);
            return false;
        }
    }

    /**
     * Get current chain ID from wallet
     */
    getCurrentChainId() {
        return window.walletManager?.getChainId() || null;
    }

    /**
     * Get network information by chain ID
     */
    getNetworkInfo(chainId) {
        return Object.values(this.supportedNetworks).find(network => network.chainId === chainId);
    }

    /**
     * Get current network information
     */
    getCurrentNetworkInfo() {
        const chainId = this.getCurrentChainId();
        return chainId ? this.getNetworkInfo(chainId) : null;
    }

    /**
     * Switch to a specific network
     */
    async switchNetwork(chainId) {
        if (!window.walletManager?.isConnected()) {
            throw new Error('Wallet not connected');
        }

        const networkInfo = this.getNetworkInfo(chainId);
        if (!networkInfo) {
            throw new Error(`Unsupported network: ${chainId}`);
        }

        try {
            this.log('Switching to network:', networkInfo.name);

            // Try to switch to the network
            await this.requestNetworkSwitch(chainId);
            
            this.log('Network switch successful');
            return true;

        } catch (error) {
            // If the network doesn't exist in wallet, try to add it
            if (error.code === 4902 || error.message.includes('Unrecognized chain ID')) {
                this.log('Network not found in wallet, attempting to add...');
                await this.addNetwork(chainId);
                return true;
            }
            
            this.logError('Network switch failed:', error);
            throw error;
        }
    }

    /**
     * Switch to default network
     */
    async switchToDefaultNetwork() {
        return await this.switchNetwork(this.defaultNetwork);
    }

    /**
     * Request network switch via wallet
     */
    async requestNetworkSwitch(chainId) {
        const hexChainId = `0x${chainId.toString(16)}`;
        
        if (window.ethereum) {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: hexChainId }]
            });
        } else {
            throw new Error('No wallet provider available');
        }
    }

    /**
     * Add network to wallet with robust error handling
     * @param {number} chainId - Chain ID to add
     */
    async addNetwork(chainId) {
        if (!window.ethereum) {
            throw new Error('MetaMask not installed');
        }

        // Build network configuration using centralized helper
        const networkConfig = this.buildNetworkConfig(chainId);
        const networkInfo = this.getNetworkInfo(chainId);
        const networkName = networkInfo?.name || `Chain ${chainId}`;
        
        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [networkConfig]
            });
            
            this.log('Network added successfully:', networkName);
        } catch (error) {
            // Error code 4902 means the chain has not been added
            if (error.code === 4902) {
                throw new Error(`Failed to add ${networkName} network to MetaMask`);
            }
            
            // Error code -32602 means chain already added (can be ignored)
            if (error.code === -32602) {
                this.log(`${networkName} network already added`);
                return; // Success - network already exists
            }

            // User rejected
            if (error.code === 4001) {
                throw new Error(`User rejected adding ${networkName} network`);
            }

            // Other errors
            console.warn('Error adding network:', error);
            throw error;
        }
    }

    /**
     * Handle network change events
     */
    handleNetworkChange(chainId) {
        this.log('Network changed to:', chainId);
        
        const previousNetwork = this.currentNetwork;
        this.currentNetwork = chainId;
        
        // Notify listeners
        this.notifyListeners('networkChanged', {
            chainId,
            networkInfo: this.getNetworkInfo(chainId),
            isSupported: this.isNetworkSupported(chainId),
            isCorrect: this.isOnRequiredNetwork(chainId),
            previousNetwork
        });

        // Show network warning if needed
        this.updateNetworkWarning();
    }

    /**
     * Update network warning display
     */
    updateNetworkWarning() {
        const warningElement = document.getElementById('network-warning');
        if (!warningElement) return;

        const chainId = this.getCurrentChainId();
        const isCorrect = this.isOnRequiredNetwork(chainId);
        const isSupported = this.isNetworkSupported(chainId);

        if (!chainId || !isCorrect) {
            // Show warning
            warningElement.style.display = 'block';
            
            const messageElement = warningElement.querySelector('.warning-message');
            if (messageElement) {
                if (!chainId) {
                    messageElement.textContent = 'Please connect your wallet';
                } else if (!isSupported) {
                    messageElement.textContent = 'Unsupported network detected';
                } else {
                    const networkInfo = this.getNetworkInfo(this.defaultNetwork);
                    messageElement.textContent = `Please switch to ${networkInfo.name}`;
                }
            }
        } else {
            // Hide warning
            warningElement.style.display = 'none';
        }
    }

    /**
     * Get network status
     */
    getNetworkStatus() {
        const chainId = this.getCurrentChainId();
        const networkInfo = this.getNetworkInfo(chainId);
        
        return {
            chainId,
            networkInfo,
            isConnected: !!chainId,
            isSupported: this.isNetworkSupported(chainId),
            isCorrect: this.isOnRequiredNetwork(chainId),
            defaultNetwork: this.getNetworkInfo(this.defaultNetwork)
        };
    }

    /**
     * Subscribe to network events
     */
    subscribe(callback) {
        this.listeners.add(callback);
        
        // Return unsubscribe function
        return () => {
            this.listeners.delete(callback);
        };
    }

    /**
     * Notify all listeners of events
     */
    notifyListeners(event, data) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                this.logError('Listener callback error:', error);
            }
        });
    }

    /**
     * Get RPC URL for network
     */
    getRpcUrl(chainId = null) {
        const targetChainId = chainId || this.getCurrentChainId();
        const networkInfo = this.getNetworkInfo(targetChainId);
        return networkInfo?.rpcUrl || null;
    }

    /**
     * Get block explorer URL for network
     */
    getBlockExplorerUrl(chainId = null) {
        const targetChainId = chainId || this.getCurrentChainId();
        const networkInfo = this.getNetworkInfo(targetChainId);
        return networkInfo?.blockExplorer || null;
    }

    /**
     * Get transaction URL for block explorer
     */
    getTransactionUrl(txHash, chainId = null) {
        const explorerUrl = this.getBlockExplorerUrl(chainId);
        return explorerUrl ? `${explorerUrl}/tx/${txHash}` : null;
    }

    /**
     * Get address URL for block explorer
     */
    getAddressUrl(address, chainId = null) {
        const explorerUrl = this.getBlockExplorerUrl(chainId);
        return explorerUrl ? `${explorerUrl}/address/${address}` : null;
    }

    /**
     * Validate network configuration
     */
    validateNetworkConfig() {
        const errors = [];
        
        Object.entries(this.supportedNetworks).forEach(([key, network]) => {
            if (!network.chainId) {
                errors.push(`Missing chainId for network: ${key}`);
            }
            if (!network.name) {
                errors.push(`Missing name for network: ${key}`);
            }
            if (!network.rpcUrl) {
                errors.push(`Missing rpcUrl for network: ${key}`);
            }
            if (!network.blockExplorer) {
                errors.push(`Missing blockExplorer for network: ${key}`);
            }
            if (!network.nativeCurrency) {
                errors.push(`Missing nativeCurrency for network: ${key}`);
            }
        });

        if (errors.length > 0) {
            this.logError('Network configuration errors:', errors);
            return false;
        }

        return true;
    }

    /**
     * Get the configured chain ID in hex format
     * @returns {string} Chain ID in hex (e.g., '0x13882')
     */
    getChainIdHex() {
        const chainId = window.CONFIG?.NETWORK?.CHAIN_ID || this.defaultNetwork;
        return '0x' + chainId.toString(16);
    }

    /**
     * Build wallet-ready network configuration for any chain ID
     * @param {number} chainId - Chain ID (defaults to configured network)
     * @returns {object} Network configuration for wallet_addEthereumChain
     */
    buildNetworkConfig(chainId = null) {
        const targetChainId = chainId || (window.CONFIG?.NETWORK?.CHAIN_ID || this.defaultNetwork);
        const hexChainId = '0x' + targetChainId.toString(16);
        
        // If requesting the configured network, use detailed config with fallbacks
        if (targetChainId === (window.CONFIG?.NETWORK?.CHAIN_ID || this.defaultNetwork)) {
            return {
                chainId: hexChainId,
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
        
        // For other networks, use the NETWORKS config
        const networkInfo = this.getNetworkInfo(targetChainId);
        if (!networkInfo) {
            throw new Error(`Network configuration not found for chain ID: ${targetChainId}`);
        }
        
        return {
            chainId: hexChainId,
            chainName: networkInfo.name,
            rpcUrls: [networkInfo.rpcUrl],
            nativeCurrency: networkInfo.nativeCurrency,
            blockExplorerUrls: [networkInfo.blockExplorer]
        };
    }

    /**
     * Get network name for a given chain ID
     * @param {number} chainId - Chain ID
     * @returns {string} Network name
     */
    getNetworkName(chainId) {
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
     * Request permission to use the configured network
     * This adds the network to MetaMask and ensures we can interact with it
     * @param {string} walletType - Type of wallet ('metamask', 'walletconnect')
     * @returns {Promise<boolean>} True if permission granted
     */
    async requestNetworkPermission(walletType = 'metamask') {
        try {
            if (walletType === 'metamask') {
                return await this._requestMetaMaskPermission();
            } else if (walletType === 'walletconnect') {
                // WalletConnect handles network permissions during connection
                console.log('WalletConnect permissions managed during connection');
                return true;
            } else {
                throw new Error(`Unsupported wallet type: ${walletType}`);
            }
        } catch (error) {
            const networkName = window.CONFIG?.NETWORK?.NAME || 'configured network';
            console.error(`Failed to request ${networkName} permission:`, error);
            throw error;
        }
    }

    /**
     * Request MetaMask-specific permission
     * @private
     * @returns {Promise<boolean>}
     */
    async _requestMetaMaskPermission() {
        if (!window.ethereum) {
            throw new Error('MetaMask not installed');
        }

        try {
            const networkName = window.CONFIG?.NETWORK?.NAME || 'configured network';
            console.log(`🔐 Requesting ${networkName} network permission...`);

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

            // Add configured network to MetaMask
            const configuredChainId = window.CONFIG?.NETWORK?.CHAIN_ID || this.defaultNetwork;
            await this.addNetwork(configuredChainId);
            return true;

        } catch (error) {
            console.error('❌ Failed to request MetaMask permission:', error);
            throw error;
        }
    }

    /**
     * Centralized permission request with UI updates
     * Replaces duplicate logic in admin.html and index.html
     * @param {string} context - 'admin' or 'home'
     * @returns {Promise<boolean>} Success status
     */
    async requestPermissionWithUIUpdate(context = 'admin') {
        try {
            const expectedChainId = window.CONFIG?.NETWORK?.CHAIN_ID || this.defaultNetwork;
            const networkName = this.getNetworkName(expectedChainId);

            // Request permission using modern approach
            await this.requestNetworkPermission('metamask');

            // Update UI based on context
            if (context === 'admin' && window.adminPage) {
                const chainId = window.walletManager?.getChainId();
                const currentNetworkName = this.getNetworkName(chainId);
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
            const networkName = window.CONFIG?.NETWORK?.NAME || 'the configured network';
            const errorMessage = `Failed to get network permission. Please grant permission for ${networkName} network in MetaMask.`;
            
            if (context === 'admin') {
                alert(errorMessage);
            } else if (window.homepageNotificationManager) {
                window.homepageNotificationManager.show('error', 'Permission Error', errorMessage);
            }
            
            throw error;
        }
    }

    /**
     * Logging utility
     */
    log(...args) {
        if (window.CONFIG.DEV.DEBUG_MODE) {
            console.log('[NetworkManager]', ...args);
        }
    }

    /**
     * Error logging utility
     */
    logError(...args) {
        console.error('[NetworkManager]', ...args);
    }
}

// Create global instance
window.networkManager = new NetworkManager();
