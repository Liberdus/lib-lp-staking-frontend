/**
 * SystemInitializer - Centralized system initialization manager
 * Prevents redeclaration errors and ensures proper initialization order
 * Handles all core system dependencies and error recovery
 */
(function(global) {
    'use strict';
    
    // Prevent multiple initialization
    if (global.SystemInitializer) {
        console.warn('SystemInitializer already exists, skipping redeclaration');
        return;
    }
    
    class SystemInitializer {
        constructor() {
            this.initialized = false;
            this.systems = new Map();
            this.initializationOrder = [
                'ErrorHandler',
                'StateManager', 
                'EventManager',
                'Router'
            ];
            this.errors = [];
            this.startTime = Date.now();
            
            console.log('🚀 SystemInitializer created');
        }
        
        /**
         * Initialize all core systems in proper order
         */
        async initialize() {
            if (this.initialized) {
                console.warn('Systems already initialized');
                return true;
            }
            
            console.log('🔧 Starting system initialization...');
            
            try {
                // Step 1: Validate environment
                this.validateEnvironment();
                
                // Step 2: Initialize core systems in order
                await this.initializeCoreSystemsSequentially();
                
                // Step 3: Validate all systems are working
                this.validateSystems();
                
                // Step 4: Set up global error handling
                this.setupGlobalErrorHandling();
                
                this.initialized = true;
                const duration = Date.now() - this.startTime;
                console.log(`✅ All systems initialized successfully in ${duration}ms`);
                
                return true;
                
            } catch (error) {
                console.error('❌ System initialization failed:', error);
                this.handleInitializationFailure(error);
                return false;
            }
        }
        
        /**
         * Validate environment before initialization
         */
        validateEnvironment() {
            console.log('🔍 Validating environment...');
            
            // Check required DOM elements
            const requiredElements = [
                '#app-content',
                '#notification-container', 
                '#modal-container'
            ];
            
            for (const selector of requiredElements) {
                const element = document.querySelector(selector);
                if (!element) {
                    throw new Error(`Required DOM element ${selector} not found`);
                }
            }
            
            // Check for conflicting global variables
            const conflictingGlobals = ['StateManager', 'ErrorHandler', 'EventManager', 'Router'];
            for (const globalName of conflictingGlobals) {
                if (global[globalName] && typeof global[globalName] === 'function') {
                    console.warn(`⚠️ Global class ${globalName} already exists - potential redeclaration`);
                }
            }
            
            console.log('✅ Environment validation passed');
        }
        
        /**
         * Initialize core systems in proper sequential order
         */
        async initializeCoreSystemsSequentially() {
            console.log('⚙️ Initializing core systems...');
            
            // Initialize ErrorHandler first
            await this.initializeErrorHandler();
            
            // Initialize StateManager second
            await this.initializeStateManager();
            
            // Initialize EventManager third
            await this.initializeEventManager();
            
            // Initialize Router last
            await this.initializeRouter();
            
            console.log('✅ Core systems initialization completed');
        }
        
        /**
         * Initialize ErrorHandler with safety checks
         */
        async initializeErrorHandler() {
            console.log('🚨 Initializing ErrorHandler...');
            
            if (global.errorHandler) {
                console.warn('ErrorHandler instance already exists, using existing');
                this.systems.set('ErrorHandler', global.errorHandler);
                return;
            }
            
            try {
                // Create ErrorHandler if class exists
                if (typeof global.ErrorHandler === 'function') {
                    global.errorHandler = new global.ErrorHandler();
                    this.systems.set('ErrorHandler', global.errorHandler);
                    console.log('✅ ErrorHandler initialized successfully');
                } else {
                    throw new Error('ErrorHandler class not found');
                }
            } catch (error) {
                console.error('❌ ErrorHandler initialization failed:', error);
                // Create minimal fallback
                global.errorHandler = this.createFallbackErrorHandler();
                this.systems.set('ErrorHandler', global.errorHandler);
                console.log('⚠️ Using fallback ErrorHandler');
            }
        }
        
        /**
         * Initialize StateManager with safety checks
         */
        async initializeStateManager() {
            console.log('🔄 Initializing StateManager...');
            
            if (global.stateManager) {
                console.warn('StateManager instance already exists, using existing');
                this.systems.set('StateManager', global.stateManager);
                return;
            }
            
            try {
                // Create StateManager if class exists
                if (typeof global.StateManager === 'function') {
                    global.stateManager = new global.StateManager();
                    this.systems.set('StateManager', global.stateManager);
                    console.log('✅ StateManager initialized successfully');
                } else {
                    throw new Error('StateManager class not found');
                }
            } catch (error) {
                console.error('❌ StateManager initialization failed:', error);
                // Create minimal fallback
                global.stateManager = this.createFallbackStateManager();
                this.systems.set('StateManager', global.stateManager);
                console.log('⚠️ Using fallback StateManager');
            }
        }
        
        /**
         * Initialize EventManager with safety checks
         */
        async initializeEventManager() {
            console.log('📡 Initializing EventManager...');
            
            if (global.eventManager) {
                console.warn('EventManager instance already exists, using existing');
                this.systems.set('EventManager', global.eventManager);
                return;
            }
            
            try {
                // Create EventManager if class exists
                if (typeof global.EventManager === 'function') {
                    global.eventManager = new global.EventManager();
                    this.systems.set('EventManager', global.eventManager);
                    console.log('✅ EventManager initialized successfully');
                } else {
                    throw new Error('EventManager class not found');
                }
            } catch (error) {
                console.error('❌ EventManager initialization failed:', error);
                // Create minimal fallback
                global.eventManager = this.createFallbackEventManager();
                this.systems.set('EventManager', global.eventManager);
                console.log('⚠️ Using fallback EventManager');
            }
        }
        
        /**
         * Initialize Router with safety checks
         */
        async initializeRouter() {
            console.log('🧭 Initializing Router...');
            
            if (global.router) {
                console.warn('Router instance already exists, using existing');
                this.systems.set('Router', global.router);
                return;
            }
            
            try {
                // Create Router if class exists
                if (typeof global.Router === 'function') {
                    global.router = new global.Router();
                    this.systems.set('Router', global.router);
                    console.log('✅ Router initialized successfully');
                } else {
                    throw new Error('Router class not found');
                }
            } catch (error) {
                console.error('❌ Router initialization failed:', error);
                // Create minimal fallback
                global.router = this.createFallbackRouter();
                this.systems.set('Router', global.router);
                console.log('⚠️ Using fallback Router');
            }
        }
        
        /**
         * Validate all systems are working correctly
         */
        validateSystems() {
            console.log('🔍 Validating system functionality...');
            
            // Test StateManager
            if (global.stateManager && typeof global.stateManager.set === 'function') {
                try {
                    global.stateManager.set('system.test', 'validation');
                    const value = global.stateManager.get('system.test');
                    if (value !== 'validation') {
                        throw new Error('StateManager validation failed');
                    }
                    console.log('✅ StateManager validation passed');
                } catch (error) {
                    console.error('❌ StateManager validation failed:', error);
                }
            }
            
            // Test ErrorHandler
            if (global.errorHandler && typeof global.errorHandler.processError === 'function') {
                try {
                    const testError = new Error('Validation test');
                    const processed = global.errorHandler.processError(testError);
                    if (!processed || !processed.category) {
                        throw new Error('ErrorHandler validation failed');
                    }
                    console.log('✅ ErrorHandler validation passed');
                } catch (error) {
                    console.error('❌ ErrorHandler validation failed:', error);
                }
            }
            
            console.log('✅ System validation completed');
        }
        
        /**
         * Set up global error handling
         */
        setupGlobalErrorHandling() {
            // Capture unhandled errors
            global.addEventListener('error', (event) => {
                console.error('🚨 Unhandled error:', event.error);
                if (global.errorHandler && global.errorHandler.processError) {
                    global.errorHandler.processError(event.error, { global: true });
                }
            });
            
            // Capture unhandled promise rejections
            global.addEventListener('unhandledrejection', (event) => {
                console.error('🚨 Unhandled promise rejection:', event.reason);
                if (global.errorHandler && global.errorHandler.processError) {
                    global.errorHandler.processError(event.reason, { promise: true });
                }
            });
            
            console.log('✅ Global error handling set up');
        }
        
        /**
         * Handle initialization failure
         */
        handleInitializationFailure(error) {
            console.error('💥 Critical initialization failure:', error);
            
            // Show user-friendly error message
            const appContent = document.getElementById('app-content');
            if (appContent) {
                appContent.innerHTML = `
                    <div style="max-width: 600px; margin: 2rem auto; padding: 2rem; background: #fee; border: 1px solid #fcc; border-radius: 0.5rem; color: #c33; font-family: system-ui, -apple-system, sans-serif;">
                        <h2 style="margin-top: 0; color: #c33;">⚠️ System Initialization Failed</h2>
                        <p><strong>Error:</strong> ${error.message}</p>
                        <p>The application failed to start properly. This may be due to:</p>
                        <ul>
                            <li>Script loading conflicts</li>
                            <li>Browser extension interference</li>
                            <li>Network connectivity issues</li>
                        </ul>
                        <div style="margin-top: 1.5rem;">
                            <button onclick="window.location.reload()" style="background: #c33; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; cursor: pointer; margin-right: 0.5rem; font-size: 1rem;">
                                🔄 Refresh Page
                            </button>
                            <button onclick="console.log('System errors:', window.systemInitializer?.errors || [])" style="background: #666; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; cursor: pointer; font-size: 1rem;">
                                🔍 Show Debug Info
                            </button>
                        </div>
                    </div>
                `;
            }
        }
        
        // Fallback system creators
        createFallbackErrorHandler() {
            return {
                processError: (error) => ({ message: error.message || 'Unknown error', category: 'unknown' }),
                displayError: () => {},
                executeWithRetry: async (fn) => await fn(),
                initialized: false,
                fallback: true
            };
        }
        
        createFallbackStateManager() {
            const state = {};
            return {
                get: (path) => path ? state[path] : state,
                set: (path, value) => { state[path] = value; return true; },
                subscribe: () => () => {},
                initialized: false,
                fallback: true
            };
        }
        
        createFallbackEventManager() {
            return {
                addEventListener: () => () => {},
                removeEventListener: () => {},
                queueEvent: () => {},
                getQueueStatus: () => ({ queueLength: 0 }),
                initialized: false,
                fallback: true
            };
        }
        
        createFallbackRouter() {
            return {
                navigate: () => {},
                register: () => {},
                getCurrentRoute: () => null,
                initialized: false,
                fallback: true
            };
        }
        
        /**
         * Get system status
         */
        getSystemStatus() {
            return {
                initialized: this.initialized,
                systems: Array.from(this.systems.keys()),
                errors: this.errors,
                duration: Date.now() - this.startTime
            };
        }
    }
    
    // Export SystemInitializer
    global.SystemInitializer = SystemInitializer;
    
    // Create global instance
    global.systemInitializer = new SystemInitializer();
    
    console.log('✅ SystemInitializer ready');
    
})(window);
