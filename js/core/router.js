/**
 * Router - Hash-based routing system for single page application
 * Handles navigation between different pages without full page reloads
 */
class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.currentComponent = null;
        this.listeners = new Set();
        this.isNavigating = false;
        
        this.init();
    }

    /**
     * Initialize router
     */
    init() {
        // Listen for hash changes
        window.addEventListener('hashchange', () => this.handleHashChange());
        window.addEventListener('load', () => this.handleHashChange());
        
        // Set up navigation link handlers
        this.setupNavigationLinks();
        
        this.log('Router initialized');
    }

    /**
     * Register a route
     */
    register(path, component, options = {}) {
        const route = {
            path,
            component,
            title: options.title || 'LP Staking Platform',
            requiresAuth: options.requiresAuth || false,
            requiresAdmin: options.requiresAdmin || false,
            beforeEnter: options.beforeEnter || null,
            afterEnter: options.afterEnter || null
        };
        
        this.routes.set(path, route);
        this.log('Route registered:', path);
        
        return this;
    }

    /**
     * Navigate to a route
     */
    navigate(path, replace = false) {
        if (this.isNavigating) {
            this.log('Navigation already in progress, ignoring:', path);
            return;
        }

        try {
            this.log('Navigating to:', path);
            
            if (replace) {
                window.location.replace(`#${path}`);
            } else {
                window.location.hash = path;
            }
        } catch (error) {
            this.logError('Navigation failed:', error);
        }
    }

    /**
     * Go back in history
     */
    back() {
        window.history.back();
    }

    /**
     * Go forward in history
     */
    forward() {
        window.history.forward();
    }

    /**
     * Replace current route
     */
    replace(path) {
        this.navigate(path, true);
    }

    /**
     * Get current route path
     */
    getCurrentPath() {
        return window.location.hash.slice(1) || '/';
    }

    /**
     * Get current route object
     */
    getCurrentRoute() {
        return this.currentRoute;
    }

    /**
     * Handle hash change events
     */
    async handleHashChange() {
        if (this.isNavigating) return;
        
        this.isNavigating = true;
        
        try {
            const path = this.getCurrentPath();
            const route = this.findRoute(path);
            
            if (!route) {
                this.log('Route not found:', path);
                this.navigate('/', true);
                return;
            }

            // Check authentication requirements
            if (route.requiresAuth && !this.isAuthenticated()) {
                this.log('Route requires authentication:', path);
                this.showAuthenticationRequired();
                return;
            }

            // Check admin requirements
            if (route.requiresAdmin && !this.isAdmin()) {
                this.log('Route requires admin access:', path);
                this.showAccessDenied();
                return;
            }

            // Execute beforeEnter hook
            if (route.beforeEnter) {
                const canEnter = await route.beforeEnter(route, this.currentRoute);
                if (canEnter === false) {
                    this.log('Route entry blocked by beforeEnter hook:', path);
                    return;
                }
            }

            // Clean up current component
            if (this.currentComponent && typeof this.currentComponent.destroy === 'function') {
                this.currentComponent.destroy();
            }

            // Update current route
            const previousRoute = this.currentRoute;
            this.currentRoute = route;

            // Update page title
            document.title = route.title;

            // Update active navigation links
            this.updateActiveNavigation(path);

            // Create and mount new component
            if (typeof route.component === 'function') {
                this.currentComponent = new route.component();
                if (typeof this.currentComponent.mount === 'function') {
                    await this.currentComponent.mount();
                }
            } else if (typeof route.component === 'string') {
                // Handle string-based components (HTML content)
                this.renderContent(route.component);
            }

            // Execute afterEnter hook
            if (route.afterEnter) {
                await route.afterEnter(route, previousRoute);
            }

            // Notify listeners
            this.notifyListeners('routeChanged', {
                route,
                previousRoute,
                path
            });

            this.log('Route changed successfully:', path);

        } catch (error) {
            this.logError('Route change failed:', error);
            this.showError('Navigation failed. Please try again.');
        } finally {
            this.isNavigating = false;
        }
    }

    /**
     * Find route by path
     */
    findRoute(path) {
        // Exact match first
        if (this.routes.has(path)) {
            return this.routes.get(path);
        }

        // Try to find parameterized routes
        for (const [routePath, route] of this.routes) {
            if (this.matchRoute(routePath, path)) {
                return { ...route, params: this.extractParams(routePath, path) };
            }
        }

        return null;
    }

    /**
     * Match route with parameters
     */
    matchRoute(routePath, actualPath) {
        const routeParts = routePath.split('/');
        const actualParts = actualPath.split('/');

        if (routeParts.length !== actualParts.length) {
            return false;
        }

        return routeParts.every((part, index) => {
            return part.startsWith(':') || part === actualParts[index];
        });
    }

    /**
     * Extract parameters from route
     */
    extractParams(routePath, actualPath) {
        const routeParts = routePath.split('/');
        const actualParts = actualPath.split('/');
        const params = {};

        routeParts.forEach((part, index) => {
            if (part.startsWith(':')) {
                const paramName = part.slice(1);
                params[paramName] = actualParts[index];
            }
        });

        return params;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return window.walletManager?.isConnected() || false;
    }

    /**
     * Check if user is admin
     */
    isAdmin() {
        // This will be implemented when contract integration is ready
        // For now, just check if wallet is connected
        return this.isAuthenticated();
    }

    /**
     * Set up navigation link handlers
     */
    setupNavigationLinks() {
        document.addEventListener('click', (event) => {
            const link = event.target.closest('[data-route]');
            if (link) {
                event.preventDefault();
                const route = link.getAttribute('data-route');
                this.navigate(route);
            }
        });
    }

    /**
     * Update active navigation links
     */
    updateActiveNavigation(currentPath) {
        const navLinks = document.querySelectorAll('[data-route]');
        navLinks.forEach(link => {
            const route = link.getAttribute('data-route');
            if (route === currentPath) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    /**
     * Render string content
     */
    renderContent(content) {
        const appContent = document.getElementById('app-content');
        if (appContent) {
            appContent.innerHTML = content;
        }
    }

    /**
     * Show authentication required message
     */
    showAuthenticationRequired() {
        const content = `
            <div class="container">
                <div class="card" style="max-width: 500px; margin: 2rem auto;">
                    <div class="card-body text-center">
                        <h2>Authentication Required</h2>
                        <p>Please connect your wallet to access this page.</p>
                        <button id="connect-wallet-auth" class="btn btn-primary">
                            Connect Wallet
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.renderContent(content);
        
        // Add event listener for connect button
        const connectBtn = document.getElementById('connect-wallet-auth');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                window.walletManager?.connectMetaMask();
            });
        }
    }

    /**
     * Show access denied message
     */
    showAccessDenied() {
        const content = `
            <div class="container">
                <div class="card" style="max-width: 500px; margin: 2rem auto;">
                    <div class="card-body text-center">
                        <h2>Access Denied</h2>
                        <p>You don't have permission to access this page.</p>
                        <button onclick="window.router.navigate('/')" class="btn btn-secondary">
                            Go Home
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.renderContent(content);
    }

    /**
     * Show error message
     */
    showError(message) {
        if (window.notificationManager) {
            window.notificationManager.show('error', 'Navigation Error', message);
        } else {
            alert(message);
        }
    }

    /**
     * Subscribe to router events
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
                this.logError('Router listener callback error:', error);
            }
        });
    }

    /**
     * Get route parameters
     */
    getParams() {
        return this.currentRoute?.params || {};
    }

    /**
     * Get query parameters
     */
    getQuery() {
        const params = new URLSearchParams(window.location.search);
        const query = {};
        for (const [key, value] of params) {
            query[key] = value;
        }
        return query;
    }

    /**
     * Cleanup router
     */
    destroy() {
        window.removeEventListener('hashchange', this.handleHashChange);
        window.removeEventListener('load', this.handleHashChange);
        
        if (this.currentComponent && typeof this.currentComponent.destroy === 'function') {
            this.currentComponent.destroy();
        }
        
        this.listeners.clear();
        this.routes.clear();
    }

    /**
     * Logging utility
     */
    log(...args) {
        if (window.CONFIG.DEV.DEBUG_MODE) {
            console.log('[Router]', ...args);
        }
    }

    /**
     * Error logging utility
     */
    logError(...args) {
        console.error('[Router]', ...args);
    }
}

// Create global instance
window.router = new Router();
