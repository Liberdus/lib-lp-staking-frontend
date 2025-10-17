/**
 * Reusable Network Indicator Component
 * Provides consistent network status display across admin and home pages
 */
class NetworkIndicator {
    constructor(options = {}) {
        this.containerId = options.containerId || 'network-indicator';
        this.context = options.context || 'admin'; // 'admin' or 'home'
        this.showPermissionButton = options.showPermissionButton !== false;
        this.onPermissionRequest = options.onPermissionRequest || this.defaultPermissionRequest;
    }

    /**
     * Create network indicator HTML
     * @param {boolean} hasPermission - Whether user has network permission
     * @param {number} chainId - Current chain ID
     * @param {string} networkName - Current network name
     * @returns {string} HTML string
     */
    createHTML(hasPermission, chainId, networkName) {
        const expectedChainId = window.CONFIG?.NETWORK?.CHAIN_ID || 80002;
        const expectedNetworkName = NetworkPermission?.getNetworkName(expectedChainId) || 'Polygon Amoy';
        const onExpectedNetwork = chainId === expectedChainId;
        
        // Determine CSS classes
        let statusClass = 'network-wrong';
        let icon = '⚠️';
        let statusText = networkName || 'Not Connected';
        
        if (hasPermission) {
            statusClass = 'network-correct';
            icon = '🟢';
            statusText = expectedNetworkName;
        }

        // Build HTML
        let html = `
            <div class="network-indicator ${statusClass}" id="${this.containerId}">
                <span class="network-icon">${icon}</span>
                <div class="network-info">
                    <span class="network-name">${statusText}</span>
                    <span class="network-id">Chain ID: ${chainId || 'Not Connected'}</span>
                </div>
        `;

        // Add permission button if needed
        if (!hasPermission && this.showPermissionButton) {
            html += `
                <button class="btn btn-sm btn-warning" onclick="${this.getPermissionButtonAction()}" title="Grant permission for ${expectedNetworkName}">
                    Grant ${expectedNetworkName} Permission
                </button>
            `;
        }

        html += '</div>';
        return html;
    }

    /**
     * Get permission button action based on context
     */
    getPermissionButtonAction() {
        if (this.context === 'home') {
            return 'window.requestHomeNetworkPermission()';
        } else {
            return 'window.requestNetworkPermission()';
        }
    }

    /**
     * Update network indicator with current status
     * @param {Element} container - Container element to update
     */
    async updateIndicator(container) {
        if (!container) return;

        try {
            // Get current state
            const chainId = window.walletManager?.getChainId();
            const networkName = NetworkPermission?.getNetworkName(chainId) || 'Unknown';
            
            // Check permission
            let hasPermission = false;
            if (typeof NetworkPermission !== 'undefined') {
                hasPermission = await NetworkPermission.hasNetworkPermission();
            }

            // Update HTML
            container.innerHTML = this.createHTML(hasPermission, chainId, networkName);
            
        } catch (error) {
            console.error('Error updating network indicator:', error);
            // Show error state
            container.innerHTML = `
                <div class="network-indicator network-wrong">
                    <span class="network-icon">❌</span>
                    <div class="network-info">
                        <span class="network-name">Error</span>
                        <span class="network-id">Unable to check status</span>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Set up network indicator with event listeners
     * @param {Element} container - Container element
     */
    async setupIndicator(container) {
        if (!container) return;

        // Initial update
        await this.updateIndicator(container);

        // Set up event listeners for updates
        this.setupEventListeners(container);
    }

    /**
     * Set up event listeners for automatic updates
     */
    setupEventListeners(container) {
        // Listen for wallet connection changes
        if (window.walletManager) {
            // Note: These events should be dispatched by wallet manager
            document.addEventListener('walletConnected', () => {
                this.updateIndicator(container);
            });
            
            document.addEventListener('walletDisconnected', () => {
                this.updateIndicator(container);
            });
            
            document.addEventListener('walletChainChanged', () => {
                this.updateIndicator(container);
            });
        }
    }

    /**
     * Default permission request handler
     */
    defaultPermissionRequest() {
        if (typeof NetworkPermission !== 'undefined') {
            return NetworkPermission.requestPermissionWithUIUpdate(this.context);
        }
        throw new Error('NetworkPermission utility not available');
    }

    /**
     * Static method to create and setup network indicator
     * @param {Object} options - Configuration options
     * @returns {NetworkIndicator} Instance
     */
    static async create(options = {}) {
        const indicator = new NetworkIndicator(options);
        const container = document.getElementById(options.containerId || 'network-indicator');
        
        if (container) {
            await indicator.setupIndicator(container);
        }
        
        return indicator;
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.NetworkIndicator = NetworkIndicator;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetworkIndicator;
}
