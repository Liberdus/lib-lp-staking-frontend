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
};

