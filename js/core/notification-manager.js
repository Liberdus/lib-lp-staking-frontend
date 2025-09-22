/**
 * NotificationManager - Advanced notification system with animations and queue management
 * Provides comprehensive user feedback for all system operations
 * Supports multiple notification types, animations, and persistent storage
 *
 * ENHANCED SINGLETON PATTERN - Completely prevents redeclaration errors
 */
(function(global) {
    'use strict';

    // CRITICAL FIX: Enhanced redeclaration prevention with instance management
    if (global.NotificationManager) {
        console.warn('NotificationManager class already exists, skipping redeclaration');
        return;
    }

    // Check for existing instance and preserve it
    if (global.notificationManager) {
        console.warn('NotificationManager instance already exists, preserving existing instance');
        return;
    }

class NotificationManager {
    constructor() {
        this.notifications = [];
        this.container = null;
        this.maxNotifications = 5;
        this.defaultDuration = 5000;
        this.animationDuration = 300;
        this.isInitialized = false;
        
        // Notification types with styling
        this.types = {
            success: {
                icon: '✅',
                className: 'notification-success',
                color: '#4caf50',
                sound: 'success'
            },
            error: {
                icon: '❌',
                className: 'notification-error',
                color: '#f44336',
                sound: 'error'
            },
            warning: {
                icon: '⚠️',
                className: 'notification-warning',
                color: '#ff9800',
                sound: 'warning'
            },
            info: {
                icon: 'ℹ️',
                className: 'notification-info',
                color: '#2196f3',
                sound: 'info'
            },
            loading: {
                icon: '⏳',
                className: 'notification-loading',
                color: '#9c27b0',
                sound: null
            }
        };
        
        this.log('NotificationManager initialized');
    }

    /**
     * Initialize notification system
     */
    initialize() {
        if (this.isInitialized) {
            this.log('NotificationManager already initialized');
            return;
        }

        this.createContainer();
        this.injectStyles();
        this.setupEventListeners();
        
        this.isInitialized = true;
        this.log('NotificationManager initialization complete');
    }

    /**
     * Create notification container
     */
    createContainer() {
        // Remove existing container if present
        const existing = document.getElementById('notification-container');
        if (existing) {
            existing.remove();
        }

        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.className = 'notification-container';
        document.body.appendChild(this.container);
        
        this.log('Notification container created');
    }

    /**
     * Inject notification styles
     */
    injectStyles() {
        const styleId = 'notification-styles';
        if (document.getElementById(styleId)) {
            return; // Styles already injected
        }

        const styles = `
            .notification-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
                max-width: 400px;
            }

            .notification {
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                margin-bottom: 10px;
                padding: 16px 20px;
                display: flex;
                align-items: flex-start;
                gap: 12px;
                pointer-events: auto;
                transform: translateX(100%);
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                border-left: 4px solid #ddd;
                position: relative;
                overflow: hidden;
            }

            .notification.show {
                transform: translateX(0);
                opacity: 1;
            }

            .notification.hide {
                transform: translateX(100%);
                opacity: 0;
                margin-bottom: 0;
                padding-top: 0;
                padding-bottom: 0;
                max-height: 0;
            }

            .notification-icon {
                font-size: 20px;
                flex-shrink: 0;
                margin-top: 2px;
            }

            .notification-content {
                flex: 1;
                min-width: 0;
            }

            .notification-title {
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 4px;
                color: #333;
                line-height: 1.4;
            }

            .notification-message {
                font-size: 13px;
                color: #666;
                line-height: 1.4;
                margin-bottom: 8px;
            }

            .notification-actions {
                display: flex;
                gap: 8px;
                margin-top: 8px;
            }

            .notification-action {
                background: transparent;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 4px 12px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
                color: #666;
            }

            .notification-action:hover {
                background: #f5f5f5;
                border-color: #bbb;
            }

            .notification-action.primary {
                background: #1976d2;
                border-color: #1976d2;
                color: white;
            }

            .notification-action.primary:hover {
                background: #1565c0;
                border-color: #1565c0;
            }

            .notification-close {
                position: absolute;
                top: 8px;
                right: 8px;
                background: none;
                border: none;
                font-size: 16px;
                cursor: pointer;
                color: #999;
                padding: 4px;
                line-height: 1;
                border-radius: 4px;
                transition: all 0.2s;
            }

            .notification-close:hover {
                background: #f5f5f5;
                color: #666;
            }

            .notification-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: rgba(0,0,0,0.1);
                transition: width linear;
            }

            /* Type-specific styles */
            .notification-success {
                border-left-color: #4caf50;
            }
            .notification-success .notification-progress {
                background: #4caf50;
            }

            .notification-error {
                border-left-color: #f44336;
            }
            .notification-error .notification-progress {
                background: #f44336;
            }

            .notification-warning {
                border-left-color: #ff9800;
            }
            .notification-warning .notification-progress {
                background: #ff9800;
            }

            .notification-info {
                border-left-color: #2196f3;
            }
            .notification-info .notification-progress {
                background: #2196f3;
            }

            .notification-loading {
                border-left-color: #9c27b0;
            }
            .notification-loading .notification-progress {
                background: #9c27b0;
            }

            /* Loading animation */
            .notification-loading .notification-icon {
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            /* Mobile responsive */
            @media (max-width: 768px) {
                .notification-container {
                    left: 10px;
                    right: 10px;
                    top: 10px;
                    max-width: none;
                }
                
                .notification {
                    margin-bottom: 8px;
                    padding: 12px 16px;
                }
            }
        `;

        const styleSheet = document.createElement('style');
        styleSheet.id = styleId;
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
        
        this.log('Notification styles injected');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for state changes if StateManager is available
        if (global.stateManager) {
            global.stateManager.subscribe('ui.notifications', (notifications) => {
                this.processNotificationQueue(notifications);
            });
        }
        
        this.log('Event listeners setup complete');
    }

    /**
     * Show success notification
     */
    success(message, options = {}) {
        return this.show('success', message, options);
    }

    /**
     * Show error notification
     */
    error(message, options = {}) {
        return this.show('error', message, { duration: 8000, ...options });
    }

    /**
     * Show warning notification
     */
    warning(message, options = {}) {
        return this.show('warning', message, { duration: 6000, ...options });
    }

    /**
     * Show info notification
     */
    info(message, options = {}) {
        return this.show('info', message, options);
    }

    /**
     * Show loading notification
     */
    loading(message, options = {}) {
        return this.show('loading', message, { duration: 0, ...options });
    }

    /**
     * Show notification with custom type
     */
    show(type, message, options = {}) {
        if (!this.isInitialized) {
            this.initialize();
        }

        const notification = this.createNotification(type, message, options);
        this.addNotification(notification);
        return notification.id;
    }

    /**
     * Create notification object
     */
    createNotification(type, message, options = {}) {
        const typeConfig = this.types[type] || this.types.info;
        
        const notification = {
            id: this.generateId(),
            type,
            message,
            title: options.title || '',
            icon: options.icon || typeConfig.icon,
            className: typeConfig.className,
            duration: options.duration !== undefined ? options.duration : this.defaultDuration,
            actions: options.actions || [],
            persistent: options.persistent || false,
            timestamp: Date.now(),
            element: null,
            progressElement: null,
            timeoutId: null
        };

        return notification;
    }

    /**
     * Add notification to display
     */
    addNotification(notification) {
        // Remove oldest notification if at max capacity
        if (this.notifications.length >= this.maxNotifications) {
            const oldest = this.notifications[0];
            this.removeNotification(oldest.id);
        }

        this.notifications.push(notification);
        this.renderNotification(notification);
        
        // Auto-hide if duration is set
        if (notification.duration > 0) {
            notification.timeoutId = setTimeout(() => {
                this.removeNotification(notification.id);
            }, notification.duration);
        }

        this.log(`Notification added: ${notification.type} - ${notification.message}`);
    }

    /**
     * Render notification element
     */
    renderNotification(notification) {
        const element = document.createElement('div');
        element.className = `notification ${notification.className}`;
        element.dataset.id = notification.id;

        // Build notification HTML
        let html = `
            <div class="notification-icon">${notification.icon}</div>
            <div class="notification-content">
        `;

        if (notification.title) {
            html += `<div class="notification-title">${this.escapeHtml(notification.title)}</div>`;
        }

        html += `<div class="notification-message">${this.escapeHtml(notification.message)}</div>`;

        // Add actions if present
        if (notification.actions.length > 0) {
            html += '<div class="notification-actions">';
            for (const action of notification.actions) {
                const actionClass = action.primary ? 'notification-action primary' : 'notification-action';
                html += `<button class="${actionClass}" data-action="${action.id}">${this.escapeHtml(action.label)}</button>`;
            }
            html += '</div>';
        }

        html += '</div>';

        // Add close button if not persistent
        if (!notification.persistent) {
            html += '<button class="notification-close" data-action="close">×</button>';
        }

        // Add progress bar if duration is set
        if (notification.duration > 0) {
            html += '<div class="notification-progress"></div>';
        }

        element.innerHTML = html;
        notification.element = element;

        // Add event listeners
        this.addNotificationEventListeners(notification);

        // Add to container
        this.container.appendChild(element);

        // Trigger show animation
        requestAnimationFrame(() => {
            element.classList.add('show');
        });

        // Start progress animation if duration is set
        if (notification.duration > 0) {
            const progressElement = element.querySelector('.notification-progress');
            if (progressElement) {
                notification.progressElement = progressElement;
                requestAnimationFrame(() => {
                    progressElement.style.width = '100%';
                    progressElement.style.transitionDuration = `${notification.duration}ms`;
                    
                    setTimeout(() => {
                        progressElement.style.width = '0%';
                    }, 50);
                });
            }
        }
    }

    /**
     * Add event listeners to notification
     */
    addNotificationEventListeners(notification) {
        const element = notification.element;

        // Close button
        const closeBtn = element.querySelector('[data-action="close"]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.removeNotification(notification.id);
            });
        }

        // Action buttons
        const actionBtns = element.querySelectorAll('[data-action]:not([data-action="close"])');
        actionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const actionId = e.target.dataset.action;
                const action = notification.actions.find(a => a.id === actionId);
                if (action && action.handler) {
                    action.handler(notification);
                }
                
                // Remove notification after action unless persistent
                if (!notification.persistent) {
                    this.removeNotification(notification.id);
                }
            });
        });

        // Hover to pause auto-hide
        if (notification.duration > 0) {
            element.addEventListener('mouseenter', () => {
                if (notification.timeoutId) {
                    clearTimeout(notification.timeoutId);
                    notification.timeoutId = null;
                }
                if (notification.progressElement) {
                    notification.progressElement.style.animationPlayState = 'paused';
                }
            });

            element.addEventListener('mouseleave', () => {
                if (!notification.timeoutId) {
                    const remainingTime = notification.duration * 0.3; // Resume with 30% of original time
                    notification.timeoutId = setTimeout(() => {
                        this.removeNotification(notification.id);
                    }, remainingTime);
                }
                if (notification.progressElement) {
                    notification.progressElement.style.animationPlayState = 'running';
                }
            });
        }
    }

    /**
     * Remove notification
     */
    removeNotification(id) {
        const index = this.notifications.findIndex(n => n.id === id);
        if (index === -1) return;

        const notification = this.notifications[index];
        
        // Clear timeout
        if (notification.timeoutId) {
            clearTimeout(notification.timeoutId);
        }

        // Animate out
        if (notification.element) {
            notification.element.classList.add('hide');
            
            setTimeout(() => {
                if (notification.element && notification.element.parentNode) {
                    notification.element.parentNode.removeChild(notification.element);
                }
            }, this.animationDuration);
        }

        // Remove from array
        this.notifications.splice(index, 1);
        
        this.log(`Notification removed: ${id}`);
    }

    /**
     * Clear all notifications
     */
    clearAll() {
        const notificationIds = this.notifications.map(n => n.id);
        notificationIds.forEach(id => this.removeNotification(id));
        
        this.log('All notifications cleared');
    }

    /**
     * Update existing notification
     */
    update(id, updates) {
        const notification = this.notifications.find(n => n.id === id);
        if (!notification) return false;

        // Update properties
        Object.assign(notification, updates);

        // Re-render if element exists
        if (notification.element) {
            const parent = notification.element.parentNode;
            const nextSibling = notification.element.nextSibling;
            
            notification.element.remove();
            this.renderNotification(notification);
            
            if (nextSibling) {
                parent.insertBefore(notification.element, nextSibling);
            } else {
                parent.appendChild(notification.element);
            }
        }

        return true;
    }

    /**
     * Process notification queue from state manager
     */
    processNotificationQueue(notifications) {
        if (!Array.isArray(notifications)) return;

        for (const notificationData of notifications) {
            if (!this.notifications.find(n => n.id === notificationData.id)) {
                const notification = this.createNotification(
                    notificationData.type,
                    notificationData.message,
                    notificationData
                );
                notification.id = notificationData.id; // Use existing ID
                this.addNotification(notification);
            }
        }
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Get notification statistics
     */
    getStats() {
        return {
            total: this.notifications.length,
            byType: this.notifications.reduce((acc, n) => {
                acc[n.type] = (acc[n.type] || 0) + 1;
                return acc;
            }, {}),
            oldest: this.notifications.length > 0 ? this.notifications[0].timestamp : null,
            newest: this.notifications.length > 0 ? this.notifications[this.notifications.length - 1].timestamp : null
        };
    }

    /**
     * Cleanup notification manager
     */
    cleanup() {
        this.clearAll();
        
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        const styles = document.getElementById('notification-styles');
        if (styles) {
            styles.remove();
        }
        
        this.isInitialized = false;
        this.log('NotificationManager cleaned up');
    }

    /**
     * Logging utility
     */
    log(...args) {
        if (window.CONFIG?.DEV?.DEBUG_MODE) {
            console.log('[NotificationManager]', ...args);
        }
    }
}

    // Export NotificationManager class to global scope
    global.NotificationManager = NotificationManager;

    // Note: Instance creation is now handled by SystemInitializer
    console.log('✅ NotificationManager class loaded');

})(window);
