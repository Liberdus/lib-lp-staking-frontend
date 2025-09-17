/**
 * NotificationManager - Handles toast notifications
 * Provides success, error, warning, and info notifications
 */
class NotificationManager {
    constructor() {
        this.container = null;
        this.notifications = new Map();
        this.queue = [];
        this.maxNotifications = 5;
        this.defaultDuration = window.CONFIG.UI.NOTIFICATION_DURATION;
        
        this.init();
    }

    /**
     * Initialize notification manager
     */
    init() {
        this.container = document.getElementById('notification-container');
        if (!this.container) {
            this.createContainer();
        }
        
        this.log('NotificationManager initialized');
    }

    /**
     * Create notification container if it doesn't exist
     */
    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.className = 'notification-container';
        document.body.appendChild(this.container);
    }

    /**
     * Show notification
     */
    show(type, title, message, options = {}) {
        const {
            duration = this.defaultDuration,
            persistent = false,
            actions = [],
            id = null
        } = options;

        const notification = {
            id: id || this.generateId(),
            type,
            title,
            message,
            duration,
            persistent,
            actions,
            timestamp: Date.now()
        };

        // Add to queue if too many notifications
        if (this.notifications.size >= this.maxNotifications) {
            this.queue.push(notification);
            return notification.id;
        }

        this.renderNotification(notification);
        return notification.id;
    }

    /**
     * Show success notification
     */
    success(title, message, options = {}) {
        return this.show('success', title, message, options);
    }

    /**
     * Show error notification
     */
    error(title, message, options = {}) {
        return this.show('error', title, message, { ...options, persistent: true });
    }

    /**
     * Show warning notification
     */
    warning(title, message, options = {}) {
        return this.show('warning', title, message, options);
    }

    /**
     * Show info notification
     */
    info(title, message, options = {}) {
        return this.show('info', title, message, options);
    }

    /**
     * Render notification to DOM
     */
    renderNotification(notification) {
        const element = this.createNotificationElement(notification);
        
        // Add to container
        this.container.appendChild(element);
        
        // Store reference
        this.notifications.set(notification.id, {
            ...notification,
            element
        });

        // Set up auto-dismiss
        if (!notification.persistent && notification.duration > 0) {
            setTimeout(() => {
                this.dismiss(notification.id);
            }, notification.duration);
        }

        // Trigger entrance animation
        requestAnimationFrame(() => {
            element.classList.add('notification-enter');
        });

        this.log('Notification shown:', notification.type, notification.title);
    }

    /**
     * Create notification DOM element
     */
    createNotificationElement(notification) {
        const element = document.createElement('div');
        element.className = `notification notification-${notification.type}`;
        element.setAttribute('data-notification-id', notification.id);

        const icon = this.getIcon(notification.type);
        
        element.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">
                <div class="notification-title">${this.escapeHtml(notification.title)}</div>
                <div class="notification-message">${this.escapeHtml(notification.message)}</div>
                ${notification.actions.length > 0 ? this.renderActions(notification.actions) : ''}
            </div>
            <button class="notification-close" aria-label="Close notification">×</button>
        `;

        // Set up event listeners
        const closeBtn = element.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.dismiss(notification.id);
        });

        // Set up action buttons
        notification.actions.forEach((action, index) => {
            const actionBtn = element.querySelector(`[data-action-index="${index}"]`);
            if (actionBtn) {
                actionBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    action.handler();
                    if (action.dismissOnClick !== false) {
                        this.dismiss(notification.id);
                    }
                });
            }
        });

        return element;
    }

    /**
     * Render action buttons
     */
    renderActions(actions) {
        return `
            <div class="notification-actions">
                ${actions.map((action, index) => `
                    <button 
                        class="btn btn-small ${action.className || 'btn-primary'}"
                        data-action-index="${index}"
                    >
                        ${this.escapeHtml(action.label)}
                    </button>
                `).join('')}
            </div>
        `;
    }

    /**
     * Get icon for notification type
     */
    getIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    /**
     * Dismiss notification
     */
    dismiss(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        const element = notification.element;
        
        // Trigger exit animation
        element.classList.add('notification-exit');
        
        setTimeout(() => {
            // Remove from DOM
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            
            // Remove from tracking
            this.notifications.delete(id);
            
            // Process queue
            this.processQueue();
            
            this.log('Notification dismissed:', id);
        }, 300);
    }

    /**
     * Dismiss all notifications
     */
    dismissAll() {
        const ids = Array.from(this.notifications.keys());
        ids.forEach(id => this.dismiss(id));
    }

    /**
     * Process notification queue
     */
    processQueue() {
        if (this.queue.length > 0 && this.notifications.size < this.maxNotifications) {
            const next = this.queue.shift();
            this.renderNotification(next);
        }
    }

    /**
     * Update existing notification
     */
    update(id, updates) {
        const notification = this.notifications.get(id);
        if (!notification) return false;

        // Update notification data
        Object.assign(notification, updates);

        // Update DOM
        const element = notification.element;
        if (updates.title) {
            const titleEl = element.querySelector('.notification-title');
            if (titleEl) titleEl.textContent = updates.title;
        }
        
        if (updates.message) {
            const messageEl = element.querySelector('.notification-message');
            if (messageEl) messageEl.textContent = updates.message;
        }

        if (updates.type) {
            // Update classes
            element.className = `notification notification-${updates.type}`;
            
            // Update icon
            const iconEl = element.querySelector('.notification-icon');
            if (iconEl) iconEl.textContent = this.getIcon(updates.type);
        }

        return true;
    }

    /**
     * Get notification by ID
     */
    get(id) {
        return this.notifications.get(id);
    }

    /**
     * Get all notifications
     */
    getAll() {
        return Array.from(this.notifications.values());
    }

    /**
     * Clear all notifications
     */
    clear() {
        this.dismissAll();
        this.queue = [];
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
     * Set maximum number of notifications
     */
    setMaxNotifications(max) {
        this.maxNotifications = max;
    }

    /**
     * Set default duration
     */
    setDefaultDuration(duration) {
        this.defaultDuration = duration;
    }

    /**
     * Logging utility
     */
    log(...args) {
        if (window.CONFIG.DEV.DEBUG_MODE) {
            console.log('[NotificationManager]', ...args);
        }
    }

    /**
     * Error logging utility
     */
    logError(...args) {
        console.error('[NotificationManager]', ...args);
    }
}

// Add CSS for notification animations
const style = document.createElement('style');
style.textContent = `
    .notification-enter {
        animation: slideInRight 0.3s ease-out;
    }
    
    .notification-exit {
        animation: slideOutRight 0.3s ease-in;
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .notification-actions {
        margin-top: var(--space-3);
        display: flex;
        gap: var(--space-2);
    }
`;
document.head.appendChild(style);

// Create global instance
window.notificationManager = new NotificationManager();
