/**
 * BaseComponent - Base class for all components
 * Provides lifecycle methods and common functionality
 */
class BaseComponent {
    constructor(selector = null) {
        this.selector = selector;
        this.element = null;
        this.isDestroyed = false;
        this.eventListeners = [];
        this.stateSubscriptions = [];
        this.childComponents = [];
        
        // Bind methods to preserve context
        this.mount = this.mount.bind(this);
        this.unmount = this.unmount.bind(this);
        this.destroy = this.destroy.bind(this);
        this.render = this.render.bind(this);
        this.update = this.update.bind(this);
    }

    /**
     * Mount component to DOM
     */
    async mount(container = null) {
        if (this.isDestroyed) {
            throw new Error('Cannot mount destroyed component');
        }

        try {
            // Find container element
            if (container) {
                this.element = typeof container === 'string' 
                    ? document.querySelector(container)
                    : container;
            } else if (this.selector) {
                this.element = document.querySelector(this.selector);
            }

            if (!this.element) {
                throw new Error(`Container not found: ${container || this.selector}`);
            }

            // Call lifecycle hooks
            await this.beforeMount();
            
            // Render component
            const content = await this.render();
            if (content) {
                this.element.innerHTML = content;
            }
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Set up state subscriptions
            this.setupStateSubscriptions();
            
            // Call lifecycle hooks
            await this.afterMount();
            
            this.log('Component mounted successfully');
            
        } catch (error) {
            this.logError('Failed to mount component:', error);
            throw error;
        }
    }

    /**
     * Unmount component from DOM
     */
    unmount() {
        if (this.isDestroyed) return;

        try {
            // Call lifecycle hook
            this.beforeUnmount();
            
            // Clean up child components
            this.childComponents.forEach(child => {
                if (child && typeof child.destroy === 'function') {
                    child.destroy();
                }
            });
            this.childComponents = [];
            
            // Clean up event listeners
            this.cleanupEventListeners();
            
            // Clean up state subscriptions
            this.cleanupStateSubscriptions();
            
            // Clear DOM content
            if (this.element) {
                this.element.innerHTML = '';
            }
            
            // Call lifecycle hook
            this.afterUnmount();
            
            this.log('Component unmounted successfully');
            
        } catch (error) {
            this.logError('Error during unmount:', error);
        }
    }

    /**
     * Destroy component completely
     */
    destroy() {
        if (this.isDestroyed) return;

        this.unmount();
        this.isDestroyed = true;
        this.element = null;
        
        this.log('Component destroyed');
    }

    /**
     * Render component content (override in subclasses)
     */
    async render() {
        return '';
    }

    /**
     * Update component (re-render)
     */
    async update() {
        if (this.isDestroyed || !this.element) return;

        try {
            const content = await this.render();
            if (content) {
                this.element.innerHTML = content;
                this.setupEventListeners();
            }
        } catch (error) {
            this.logError('Error during update:', error);
        }
    }

    /**
     * Set up event listeners (override in subclasses)
     */
    setupEventListeners() {
        // Override in subclasses
    }

    /**
     * Set up state subscriptions (override in subclasses)
     */
    setupStateSubscriptions() {
        // Override in subclasses
    }

    /**
     * Add event listener with automatic cleanup
     */
    addEventListener(element, event, handler, options = {}) {
        if (!element) return;

        const cleanup = () => {
            element.removeEventListener(event, handler, options);
        };

        element.addEventListener(event, handler, options);
        this.eventListeners.push(cleanup);

        return cleanup;
    }

    /**
     * Subscribe to state changes with automatic cleanup
     */
    subscribeToState(path, callback) {
        if (!window.appState) return;

        const unsubscribe = window.appState.subscribe(path, callback);
        this.stateSubscriptions.push(unsubscribe);

        return unsubscribe;
    }

    /**
     * Get state value
     */
    getState(path) {
        return window.appState?.getState(path);
    }

    /**
     * Set state value
     */
    setState(path, value, options = {}) {
        return window.appState?.setState(path, value, options);
    }

    /**
     * Find element within component
     */
    $(selector) {
        return this.element ? this.element.querySelector(selector) : null;
    }

    /**
     * Find all elements within component
     */
    $$(selector) {
        return this.element ? this.element.querySelectorAll(selector) : [];
    }

    /**
     * Show element
     */
    show(element = null) {
        const target = element || this.element;
        if (target) {
            target.style.display = '';
            target.removeAttribute('hidden');
        }
    }

    /**
     * Hide element
     */
    hide(element = null) {
        const target = element || this.element;
        if (target) {
            target.style.display = 'none';
        }
    }

    /**
     * Toggle element visibility
     */
    toggle(element = null) {
        const target = element || this.element;
        if (target) {
            if (target.style.display === 'none') {
                this.show(target);
            } else {
                this.hide(target);
            }
        }
    }

    /**
     * Add CSS class
     */
    addClass(className, element = null) {
        const target = element || this.element;
        if (target) {
            target.classList.add(className);
        }
    }

    /**
     * Remove CSS class
     */
    removeClass(className, element = null) {
        const target = element || this.element;
        if (target) {
            target.classList.remove(className);
        }
    }

    /**
     * Toggle CSS class
     */
    toggleClass(className, element = null) {
        const target = element || this.element;
        if (target) {
            target.classList.toggle(className);
        }
    }

    /**
     * Clean up event listeners
     */
    cleanupEventListeners() {
        this.eventListeners.forEach(cleanup => {
            try {
                cleanup();
            } catch (error) {
                this.logError('Error cleaning up event listener:', error);
            }
        });
        this.eventListeners = [];
    }

    /**
     * Clean up state subscriptions
     */
    cleanupStateSubscriptions() {
        this.stateSubscriptions.forEach(unsubscribe => {
            try {
                unsubscribe();
            } catch (error) {
                this.logError('Error cleaning up state subscription:', error);
            }
        });
        this.stateSubscriptions = [];
    }

    /**
     * Add child component
     */
    addChild(component) {
        this.childComponents.push(component);
    }

    /**
     * Remove child component
     */
    removeChild(component) {
        const index = this.childComponents.indexOf(component);
        if (index > -1) {
            this.childComponents.splice(index, 1);
            if (component && typeof component.destroy === 'function') {
                component.destroy();
            }
        }
    }

    // Lifecycle hooks (override in subclasses)
    async beforeMount() {}
    async afterMount() {}
    beforeUnmount() {}
    afterUnmount() {}

    /**
     * Logging utility
     */
    log(...args) {
        if (window.CONFIG.DEV.DEBUG_MODE) {
            console.log(`[${this.constructor.name}]`, ...args);
        }
    }

    /**
     * Error logging utility
     */
    logError(...args) {
        console.error(`[${this.constructor.name}]`, ...args);
    }
}

// Export for use in other components
window.BaseComponent = BaseComponent;
