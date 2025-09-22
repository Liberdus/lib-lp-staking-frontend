/**
 * ThemeManager - Simple theme management system matching React version
 * Provides light/dark mode switching with persistence
 */

class ThemeManagerNew {
    constructor() {
        this.currentTheme = 'light';
        this.storageKey = 'lp-staking-theme';
        this.init();
    }

    init() {
        this.loadSavedTheme();
        this.setupThemeToggle();
        this.applyTheme(this.currentTheme);
    }

    loadSavedTheme() {
        const saved = localStorage.getItem(this.storageKey);
        if (saved && (saved === 'light' || saved === 'dark')) {
            this.currentTheme = saved;
        } else {
            // Check system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.currentTheme = prefersDark ? 'dark' : 'light';
        }
    }

    setupThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.currentTheme);
        this.saveTheme();
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update theme toggle icon
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('.material-icons-outlined');
            if (icon) {
                icon.textContent = theme === 'light' ? 'light_mode' : 'bedtime';
            }
        }
    }

    saveTheme() {
        localStorage.setItem(this.storageKey, this.currentTheme);
    }

    getCurrentTheme() {
        return this.currentTheme;
    }
}

/**
 * WalletManager - Simple wallet connection management
 * Handles wallet connection state and UI updates
 */

class WalletManagerNew {
    constructor() {
        this.isConnected = false;
        this.account = null;
        this.provider = null;
        this.init();
    }

    init() {
        this.setupConnectButton();
        this.checkConnection();
    }

    setupConnectButton() {
        const connectBtn = document.getElementById('connect-wallet-btn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.toggleConnection());
        }
    }

    async checkConnection() {
        if (typeof window.ethereum !== 'undefined') {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    this.account = accounts[0];
                    this.isConnected = true;
                    this.updateUI();
                }
            } catch (error) {
                console.error('Failed to check wallet connection:', error);
            }
        }
    }

    async toggleConnection() {
        if (this.isConnected) {
            this.disconnect();
        } else {
            await this.connect();
        }
    }

    async connect() {
        console.log('🔗 Attempting wallet connection...');

        if (typeof window.ethereum === 'undefined') {
            console.log('❌ MetaMask not detected');
            if (window.notificationManager) {
                window.notificationManager.show('Please install MetaMask or another Web3 wallet', 'error');
            } else {
                alert('Please install MetaMask or another Web3 wallet');
            }
            return false;
        }

        try {
            console.log('📡 Requesting account access...');
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

            if (accounts.length > 0) {
                this.account = accounts[0];
                this.isConnected = true;

                // Initialize provider if ethers is available
                if (window.ethers) {
                    this.provider = new window.ethers.providers.Web3Provider(window.ethereum);
                }

                this.updateUI();

                console.log('✅ Wallet connected:', this.account);

                if (window.notificationManager) {
                    window.notificationManager.show(`Wallet connected: ${this.account.slice(0, 6)}...${this.account.slice(-4)}`, 'success');
                } else {
                    alert('Wallet connected successfully!');
                }

                // Refresh home page data
                if (window.homePage) {
                    window.homePage.loadData();
                }

                return true;
            }
        } catch (error) {
            console.error('❌ Failed to connect wallet:', error);

            let errorMessage = 'Failed to connect wallet';
            if (error.code === 4001) {
                errorMessage = 'Wallet connection rejected by user';
            } else if (error.code === -32002) {
                errorMessage = 'Wallet connection request already pending';
            }

            if (window.notificationManager) {
                window.notificationManager.show(errorMessage, 'error');
            } else {
                alert(errorMessage);
            }

            return false;
        }
    }

    disconnect() {
        this.account = null;
        this.isConnected = false;
        this.updateUI();
        
        if (window.notificationManager) {
            window.notificationManager.show('Wallet disconnected', 'info');
        }

        // Refresh home page data
        if (window.homePage) {
            window.homePage.loadData();
        }
    }

    updateUI() {
        const connectBtn = document.getElementById('connect-wallet-btn');
        if (!connectBtn) return;

        if (this.isConnected && this.account) {
            const shortAccount = `${this.account.slice(0, 6)}...${this.account.slice(-4)}`;
            connectBtn.innerHTML = `
                <span class="material-icons">account_balance_wallet</span>
                <span>${shortAccount}</span>
            `;
            connectBtn.style.background = 'var(--success-main)';
        } else {
            connectBtn.innerHTML = `
                <span class="material-icons">account_balance_wallet</span>
                <span>Connect Wallet</span>
            `;
            connectBtn.style.background = 'var(--primary-main)';
        }
    }

    getAccount() {
        return this.account;
    }

    isWalletConnected() {
        return this.isConnected;
    }

    isMetaMaskAvailable() {
        return typeof window.ethereum !== 'undefined';
    }
}

// Initialize managers
let themeManagerNew, walletManagerNew;
document.addEventListener('DOMContentLoaded', () => {
    themeManagerNew = new ThemeManagerNew();
    walletManagerNew = new WalletManagerNew();
    
    // Set global references for compatibility
    window.themeManager = themeManagerNew;
    window.walletManager = walletManagerNew;
});

// Export for global access
window.ThemeManagerNew = ThemeManagerNew;
window.WalletManagerNew = WalletManagerNew;
