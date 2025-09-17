/**
 * State Management System - Observer pattern for vanilla JS
 * Replaces React state management with a centralized store
 */
class StateManager {
    constructor() {
        this.state = {};
        this.listeners = new Map();
        this.middleware = [];
        this.history = [];
        this.maxHistorySize = 50;
        
        this.init();
    }

    /**
     * Initialize state manager
     */
    init() {
        // Set initial state
        this.state = {
            // Wallet state
            wallet: {
                isConnected: false,
                address: null,
                chainId: null,
                walletType: null,
                balance: '0'
            },
            
            // Network state
            network: {
                chainId: null,
                isSupported: false,
                isCorrect: false,
                networkInfo: null
            },
            
            // Contract state
            contracts: {
                stakingContract: null,
                rewardToken: null,
                isLoaded: false
            },
            
            // Staking data
            staking: {
                pairs: [],
                userStakes: [],
                totalStaked: '0',
                totalRewards: '0',
                isLoading: false
            },
            
            // UI state
            ui: {
                theme: 'light',
                isLoading: false,
                activeModal: null,
                notifications: [],
                sidebarOpen: false
            },
            
            // Admin state
            admin: {
                isAdmin: false,
                pendingActions: [],
                actionHistory: []
            },
            
            // Transaction state
            transactions: {
                pending: [],
                history: [],
                gasPrice: null
            }
        };
        
        this.log('StateManager initialized with initial state');
    }

    /**
     * Get state value by path
     */
    getState(path = null) {
        if (!path) {
            return { ...this.state };
        }
        
        const keys = path.split('.');
        let value = this.state;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return undefined;
            }
        }
        
        return value;
    }

    /**
     * Set state value by path
     */
    setState(path, value, options = {}) {
        const { silent = false, merge = true } = options;
        
        // Store previous state for history
        const previousState = JSON.parse(JSON.stringify(this.state));
        
        // Apply middleware
        const action = { type: 'SET_STATE', path, value, timestamp: Date.now() };
        const processedAction = this.applyMiddleware(action, previousState);
        
        if (processedAction === null) {
            this.log('State update blocked by middleware:', path);
            return false;
        }
        
        // Update state
        const keys = path.split('.');
        let current = this.state;
        
        // Navigate to parent object
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        // Set the final value
        const finalKey = keys[keys.length - 1];
        if (merge && typeof current[finalKey] === 'object' && typeof value === 'object') {
            current[finalKey] = { ...current[finalKey], ...value };
        } else {
            current[finalKey] = value;
        }
        
        // Add to history
        this.addToHistory(previousState, this.state, action);
        
        // Notify listeners
        if (!silent) {
            this.notifyListeners(path, value, previousState);
        }
        
        this.log('State updated:', path, value);
        return true;
    }

    /**
     * Subscribe to state changes
     */
    subscribe(path, callback) {
        if (!this.listeners.has(path)) {
            this.listeners.set(path, new Set());
        }
        
        this.listeners.get(path).add(callback);
        
        // Return unsubscribe function
        return () => {
            const pathListeners = this.listeners.get(path);
            if (pathListeners) {
                pathListeners.delete(callback);
                if (pathListeners.size === 0) {
                    this.listeners.delete(path);
                }
            }
        };
    }

    /**
     * Subscribe to multiple state paths
     */
    subscribeMultiple(paths, callback) {
        const unsubscribers = paths.map(path => this.subscribe(path, callback));
        
        // Return function to unsubscribe from all
        return () => {
            unsubscribers.forEach(unsubscribe => unsubscribe());
        };
    }

    /**
     * Notify listeners of state changes
     */
    notifyListeners(path, newValue, previousState) {
        // Notify exact path listeners
        const exactListeners = this.listeners.get(path);
        if (exactListeners) {
            exactListeners.forEach(callback => {
                try {
                    callback(newValue, this.getState(path), previousState);
                } catch (error) {
                    this.logError('Listener callback error:', error);
                }
            });
        }
        
        // Notify parent path listeners
        const pathParts = path.split('.');
        for (let i = pathParts.length - 1; i > 0; i--) {
            const parentPath = pathParts.slice(0, i).join('.');
            const parentListeners = this.listeners.get(parentPath);
            
            if (parentListeners) {
                parentListeners.forEach(callback => {
                    try {
                        callback(this.getState(parentPath), this.getState(parentPath), previousState);
                    } catch (error) {
                        this.logError('Parent listener callback error:', error);
                    }
                });
            }
        }
        
        // Notify global listeners
        const globalListeners = this.listeners.get('*');
        if (globalListeners) {
            globalListeners.forEach(callback => {
                try {
                    callback(path, newValue, this.state, previousState);
                } catch (error) {
                    this.logError('Global listener callback error:', error);
                }
            });
        }
    }

    /**
     * Add middleware
     */
    addMiddleware(middleware) {
        this.middleware.push(middleware);
    }

    /**
     * Apply middleware to actions
     */
    applyMiddleware(action, previousState) {
        let processedAction = action;
        
        for (const middleware of this.middleware) {
            try {
                processedAction = middleware(processedAction, previousState, this.state);
                if (processedAction === null) {
                    break;
                }
            } catch (error) {
                this.logError('Middleware error:', error);
            }
        }
        
        return processedAction;
    }

    /**
     * Add to state history
     */
    addToHistory(previousState, newState, action) {
        this.history.push({
            previousState: JSON.parse(JSON.stringify(previousState)),
            newState: JSON.parse(JSON.stringify(newState)),
            action,
            timestamp: Date.now()
        });
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }

    /**
     * Get state history
     */
    getHistory() {
        return [...this.history];
    }

    /**
     * Clear state history
     */
    clearHistory() {
        this.history = [];
    }

    /**
     * Reset state to initial values
     */
    reset() {
        const previousState = JSON.parse(JSON.stringify(this.state));
        this.init();
        this.notifyListeners('*', this.state, previousState);
    }

    /**
     * Batch state updates
     */
    batch(updates) {
        const previousState = JSON.parse(JSON.stringify(this.state));
        
        // Apply all updates silently
        updates.forEach(({ path, value, options = {} }) => {
            this.setState(path, value, { ...options, silent: true });
        });
        
        // Notify listeners once for all changes
        updates.forEach(({ path, value }) => {
            this.notifyListeners(path, value, previousState);
        });
    }

    /**
     * Compute derived state
     */
    computed(path, computeFn, dependencies = []) {
        const compute = () => {
            try {
                const result = computeFn(this.state);
                this.setState(path, result, { silent: true });
            } catch (error) {
                this.logError('Computed state error:', error);
            }
        };
        
        // Initial computation
        compute();
        
        // Subscribe to dependencies
        const unsubscribers = dependencies.map(dep => 
            this.subscribe(dep, compute)
        );
        
        // Return cleanup function
        return () => {
            unsubscribers.forEach(unsubscribe => unsubscribe());
        };
    }

    /**
     * Persist state to localStorage
     */
    persist(key = 'lp-staking-state', paths = []) {
        try {
            const stateToPersist = paths.length > 0 
                ? paths.reduce((acc, path) => {
                    acc[path] = this.getState(path);
                    return acc;
                }, {})
                : this.state;
                
            localStorage.setItem(key, JSON.stringify(stateToPersist));
            return true;
        } catch (error) {
            this.logError('Failed to persist state:', error);
            return false;
        }
    }

    /**
     * Restore state from localStorage
     */
    restore(key = 'lp-staking-state', paths = []) {
        try {
            const persistedState = localStorage.getItem(key);
            if (!persistedState) return false;
            
            const parsed = JSON.parse(persistedState);
            
            if (paths.length > 0) {
                // Restore specific paths
                paths.forEach(path => {
                    if (parsed[path] !== undefined) {
                        this.setState(path, parsed[path]);
                    }
                });
            } else {
                // Restore entire state
                this.state = { ...this.state, ...parsed };
            }
            
            return true;
        } catch (error) {
            this.logError('Failed to restore state:', error);
            return false;
        }
    }

    /**
     * Debug state
     */
    debug() {
        console.group('State Manager Debug');
        console.log('Current State:', this.state);
        console.log('Listeners:', this.listeners);
        console.log('History:', this.history);
        console.log('Middleware:', this.middleware);
        console.groupEnd();
    }

    /**
     * Logging utility
     */
    log(...args) {
        if (window.CONFIG.DEV.DEBUG_MODE) {
            console.log('[StateManager]', ...args);
        }
    }

    /**
     * Error logging utility
     */
    logError(...args) {
        console.error('[StateManager]', ...args);
    }
}

// Create global instance
window.appState = new StateManager();

// Add some useful middleware
window.appState.addMiddleware((action, previousState, currentState) => {
    // Log all state changes in debug mode
    if (window.CONFIG.DEV.DEBUG_MODE) {
        console.log('State Action:', action);
    }
    return action;
});

// Persist certain state paths automatically
window.appState.subscribe('ui.theme', (theme) => {
    localStorage.setItem(window.CONFIG.UI.THEME_STORAGE_KEY, theme);
});

// Auto-save important state
setInterval(() => {
    window.appState.persist('lp-staking-state', ['ui.theme', 'wallet.address']);
}, 30000); // Every 30 seconds
