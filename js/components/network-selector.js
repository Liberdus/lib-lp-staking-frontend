/**
 * Network Selector Component
 * Provides a dropdown to switch between different networks
 */

class NetworkSelector {
    constructor() {
        this.onNetworkChange = null;
        this.isInitialized = false;
        this.eventListeners = new Map(); // Store event listeners for cleanup
    }

    /**
     * Initialize the network selector
     * @param {Function} onNetworkChange - Callback when network changes
     */
    init(onNetworkChange = null) {
        this.onNetworkChange = onNetworkChange;
        this.isInitialized = true;
        console.log('🌐 Network selector initialized');
        
        // Attach event handlers to any existing network selectors
        document.querySelectorAll('.network-selector').forEach(selector => {
            this.attachEventHandlers(selector, selector.classList.contains('admin') ? 'admin' : 'home');
        });
    }

    /**
     * Create network selector dropdown HTML
     * @param {string} containerId - ID of the container to add the selector to
     * @param {string} context - Context for styling ('home' or 'admin')
     */
    createSelector(containerId, context = 'home') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`❌ Container ${containerId} not found`);
            return;
        }

        const selector = document.createElement('div');
        selector.className = `network-selector ${context}`;
        selector.innerHTML = this.getSelectorHTML();
        container.appendChild(selector);
        
        this.attachEventHandlers(selector, context);
        console.log(`🌐 Network selector added to ${containerId}`);
    }

    /**
     * Get the HTML for the network selector dropdown
     */
    getSelectorHTML() {
        const networks = Object.entries(window.CONFIG.NETWORKS);
        
        return `
            <div class="network-select-wrapper">
                <select id="network-select" class="network-select">
                    ${networks.map(([key, network]) => `
                        <option value="${key}" ${key === window.CONFIG.SELECTED_NETWORK ? 'selected' : ''}>
                            ${network.NAME}
                        </option>
                    `).join('')}
                </select>
                <span class="network-select-chevron">▼</span>
            </div>
        `;
    }

    /**
     * Attach event handlers to the selector
     * @param {HTMLElement} selector - The selector element
     * @param {string} context - Context for the change handler
     */
    attachEventHandlers(selector, context) {
        const select = selector.querySelector('#network-select');
        if (!select) {
            console.error('❌ Network select element not found in selector');
            return;
        }

        // Remove any existing event listener
        const selectId = select.id || 'network-select';
        if (this.eventListeners.has(selectId)) {
            select.removeEventListener('change', this.eventListeners.get(selectId));
        }
        
        // Create and store new event listener
        const listener = (event) => {
            this.handleNetworkChange(event.target.value, context);
        };
        
        this.eventListeners.set(selectId, listener);
        select.addEventListener('change', listener);
    }

    /**
     * Handle network change
     * @param {string} networkKey - The selected network key
     * @param {string} context - Context ('home' or 'admin')
     */
    async handleNetworkChange(networkKey, context) {
        console.log(`🌐 Switching to ${networkKey} network...`);
        
        window.CONFIG._networkSwitching = true;
        
        // Hide admin button immediately when switching networks
        if (window.homePage?.hideAdminButton) {
            window.homePage.hideAdminButton();
        }

        try {
            // Switch network in config
            const success = window.CONFIG.switchNetwork(networkKey);
            if (!success) {
                console.error(`❌ Failed to switch to ${networkKey}`);
                return;
            }

            // Update the network name display immediately
            this.updateNetworkNameDisplay(networkKey, context);

            // Switch contract manager to new network
            if (window.contractManager?.switchNetwork) {
                try {
                    await window.contractManager.switchNetwork(networkKey);
                } catch (error) {
                    console.error('❌ Error switching contract manager:', error);
                }
            }
        } finally {
            // Clear network switching flag after contract initialization
            setTimeout(() => window.CONFIG._networkSwitching = false, 1000);
        }

        // If wallet is not connected, just update the UI
        const isWalletConnected = window.walletManager && window.walletManager.isConnected();
        if (!isWalletConnected) {
            // Update UI to show the selected network
            this.updateNetworkDisplay();
            
            // Still trigger network change callback to refresh data
            if (this.onNetworkChange) {
                try {
                    await this.onNetworkChange(networkKey, context);
                } catch (error) {
                    console.error('❌ Error in network change callback:', error);
                }
            }
            return;
        }

        // If wallet is connected, try to switch to the selected network
        await this.switchWalletToNetwork(networkKey);

        // Trigger network change callback if provided
        if (this.onNetworkChange) {
            try {
                await this.onNetworkChange(networkKey, context);
            } catch (error) {
                console.error('❌ Error in network change callback:', error);
            }
        }

        // Update UI elements that show network info
        this.updateNetworkDisplay();
    }

    /**
     * Update network display elements
     */
    updateNetworkDisplay() {
        // Update any elements that show the current network name
        const networkNameElements = document.querySelectorAll('.network-name');
        networkNameElements.forEach(element => {
            element.textContent = window.CONFIG.NETWORK.NAME;
        });

        // Update the selector value if it exists
        const selector = document.getElementById('network-select');
        if (selector) {
            selector.value = window.CONFIG.SELECTED_NETWORK;
        }
    }

    /**
     * Update the network name display immediately
     * @param {string} networkKey - The selected network key
     * @param {string} context - Context ('home' or 'admin')
     */
    updateNetworkNameDisplay(networkKey, context) {
        const networkName = window.CONFIG.NETWORKS[networkKey]?.NAME || networkKey;
        
        // Update network name in the indicator
        const networkNameElements = document.querySelectorAll('.network-name');
        networkNameElements.forEach(element => {
            element.textContent = networkName;
        });

        console.log(`📝 Updated network name display to: ${networkName}`);
    }


    /**
     * Get available networks for display
     */
    getAvailableNetworks() {
        return Object.entries(window.CONFIG.NETWORKS).map(([key, network]) => ({
            key,
            name: network.NAME,
            chainId: network.CHAIN_ID
        }));
    }

    /**
     * Check if a network is available
     * @param {string} networkKey - Network key to check
     */
    isNetworkAvailable(networkKey) {
        return !!window.CONFIG.NETWORKS[networkKey];
    }

    /**
     * Get current selected network info
     */
    getCurrentNetwork() {
        return {
            key: window.CONFIG.SELECTED_NETWORK,
            name: window.CONFIG.NETWORK.NAME,
            chainId: window.CONFIG.NETWORK.CHAIN_ID
        };
    }

    /**
     * Switch wallet to the selected network
     * @param {string} networkKey - The network key to switch to
     */
    async switchWalletToNetwork(networkKey) {
        const network = window.CONFIG.NETWORKS[networkKey];
        if (!network) {
            console.error(`❌ Network ${networkKey} not found`);
            return false;
        }

        try {
            console.log(`🔄 Requesting MetaMask to switch to ${network.NAME} (Chain ID: ${network.CHAIN_ID})`);

            // Check if we're already on the correct network
            const currentChainId = window.walletManager?.getChainId();
            if (currentChainId === network.CHAIN_ID) {
                console.log(`✅ Already on ${network.NAME} network`);
                return true;
            }

            // Request network switch
            if (window.ethereum && window.ethereum.request) {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: `0x${network.CHAIN_ID.toString(16)}` }],
                });
                console.log(`✅ Successfully switched to ${network.NAME}`);
                return true;
            } else {
                console.error('❌ MetaMask not available');
                return false;
            }
        } catch (error) {
            console.error(`❌ Failed to switch to ${network.NAME}:`, error);
            
            // If the network is not added to MetaMask, try to add it
            if (error.code === 4902) {
                console.log(`🔗 Network ${network.NAME} not found in MetaMask, attempting to add it...`);
                return await this.addNetworkToMetaMask(network);
            }
            
            return false;
        }
    }

    /**
     * Add network to MetaMask and switch to it
     * @param {string} networkKey - The network key to add
     */
    async addNetworkToMetaMaskAndSwitch(networkKey) {
        const network = window.CONFIG.NETWORKS[networkKey];
        if (!network) {
            console.error(`❌ Network ${networkKey} not found`);
            return false;
        }

        try {
            console.log(`➕ Adding ${network.NAME} to MetaMask and switching...`);
            
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: `0x${network.CHAIN_ID.toString(16)}`,
                    chainName: network.NAME,
                    nativeCurrency: network.NATIVE_CURRENCY,
                    rpcUrls: [network.RPC_URL, ...network.FALLBACK_RPCS],
                    blockExplorerUrls: [network.BLOCK_EXPLORER]
                }],
            });
            
            console.log(`✅ Successfully added and switched to ${network.NAME}`);
            return true;
        } catch (addError) {
            console.error(`❌ Failed to add ${network.NAME} to MetaMask:`, addError);
            return false;
        }
    }

    /**
     * Add network to MetaMask if it's not already added
     * @param {Object} network - The network configuration
     */
    async addNetworkToMetaMask(network) {
        try {
            console.log(`➕ Adding ${network.NAME} to MetaMask...`);
            
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: `0x${network.CHAIN_ID.toString(16)}`,
                    chainName: network.NAME,
                    nativeCurrency: network.NATIVE_CURRENCY,
                    rpcUrls: [network.RPC_URL, ...network.FALLBACK_RPCS],
                    blockExplorerUrls: [network.BLOCK_EXPLORER]
                }],
            });
            
            console.log(`✅ Successfully added ${network.NAME} to MetaMask`);
            return true;
        } catch (addError) {
            console.error(`❌ Failed to add ${network.NAME} to MetaMask:`, addError);
            return false;
        }
    }
}

// Create global instance
window.networkSelector = new NetworkSelector();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetworkSelector;
}
