/**
 * Formatting Utilities
 * 
 * Provides formatting functions for displaying numbers, addresses, currencies, and timestamps.
 * All functions are attached to window.Formatter for global access.
 */
window.Formatter = {
    /**
     * Format very small numbers with subscript notation (e.g., 5e-17 → 0.0₁₆5)
     * @param {number|string} value - The number to format
     * @returns {string} Formatted string with subscript notation for values < 0.01
     */
    formatSmallNumberWithSubscript(value) {
        if (!value || value === '0' || value === 0 || value === '0.0') return '0';
        
        const num = typeof value === 'number' ? value : parseFloat(value);
        if (isNaN(num) || num === 0) return '0';
        
        if (num >= 0.01) {
            return num < 1 ? num.toFixed(6).replace(/\.?0+$/, '') : num.toString();
        }
        
        // Use subscript notation for very small numbers
        const str = Math.abs(num).toFixed(20);
        const match = str.match(/^0\.0+(?=([1-9]))/);
        
        if (match) {
            const zeros = match[0].substring(3).length;
            const significant = str.substring(match[0].length).replace(/0+$/, '');
            return `0.0<sub>${zeros}</sub>${significant}`;
        }
        
        return num.toString();
    },

    /**
     * Format token amount for display (converts from wei/smallest unit to readable format)
     * Automatically uses subscript notation for very small values (< 0.01)
     * 
     * @param {string|BigNumber} amount - Token amount in smallest unit (wei)
     * @param {number} decimals - Token decimals (default: 18)
     * @param {number} displayDecimals - Maximum decimal places to display (default: 4)
     * @returns {string} Formatted token amount
     */
    formatTokenAmount(amount, decimals = 18, displayDecimals = 4) {
        if (!amount) return '0';
        
        try {
            const formatted = ethers.utils.formatUnits(amount, decimals);
            const num = parseFloat(formatted);
            
            if (num === 0) return '0';
            
            // Use subscript notation for very small numbers (< 0.01)
            if (num < 0.01) {
                return this.formatSmallNumberWithSubscript(num);
            }
            
            return num.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: displayDecimals
            });
        } catch (error) {
            console.error('Error formatting token amount:', error);
            return '0';
        }
    },

    /**
     * Format percentage
     * @param {number|string} value - The value to format as percentage
     * @param {number} decimals - Number of decimal places (default: 2)
     * @returns {string} Formatted percentage string
     */
    formatPercentage(value, decimals = 2) {
        if (!value || isNaN(value)) return '0%';
        
        const num = parseFloat(value);
        return `${num.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimals
        })}%`;
    },

    /**
     * Format USD amount
     * @param {number|string} amount - The amount to format
     * @param {number} decimals - Number of decimal places (default: 2)
     * @returns {string} Formatted USD string
     */
    formatUSD(amount, decimals = 2) {
        if (!amount || isNaN(amount)) return '$0.00';
        
        const num = parseFloat(amount);
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num);
    },

    /**
     * Format address for display
     * @param {string} address - Ethereum address
     * @param {number} startChars - Number of characters to show at start (default: 6)
     * @param {number} endChars - Number of characters to show at end (default: 4)
     * @returns {string} Formatted address (e.g., "0x1234...5678")
     */
    formatAddress(address, startChars = 6, endChars = 4) {
        if (!address) return '';
        
        if (address.length <= startChars + endChars) {
            return address;
        }
        
        return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
    },

    /**
     * Format transaction hash
     * @param {string} hash - Transaction hash
     * @param {number} chars - Number of characters to show (default: 8)
     * @returns {string} Formatted hash (e.g., "0x1234...")
     */
    formatTxHash(hash, chars = 8) {
        if (!hash) return '';
        return `${hash.slice(0, chars)}...`;
    },

    /**
     * Format time ago
     * @param {number} timestamp - Unix timestamp in milliseconds
     * @returns {string} Human-readable time ago string
     */
    formatTimeAgo(timestamp) {
        if (!timestamp) return '';
        
        const now = Date.now();
        const diff = now - timestamp;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    }
};

