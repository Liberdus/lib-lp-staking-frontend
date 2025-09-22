/**
 * NotificationManager - Simple notification system
 * Shows toast notifications for user feedback
 */

class NotificationManagerNew {
    constructor() {
        this.notifications = [];
        this.container = null;
        this.init();
    }

    init() {
        this.createContainer();
        this.addStyles();
    }

    createContainer() {
        this.container = document.getElementById('notification-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        }
    }

    addStyles() {
        if (document.getElementById('notification-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 2000;
                display: flex;
                flex-direction: column;
                gap: 12px;
                max-width: 400px;
            }

            .notification {
                background: white;
                border-radius: 8px;
                padding: 16px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                display: flex;
                align-items: center;
                gap: 12px;
                transform: translateX(100%);
                transition: transform 0.3s ease;
                border-left: 4px solid;
            }

            .notification.show {
                transform: translateX(0);
            }

            .notification.success {
                border-left-color: #4caf50;
                background: #f1f8e9;
            }

            .notification.error {
                border-left-color: #f44336;
                background: #ffebee;
            }

            .notification.warning {
                border-left-color: #ff9800;
                background: #fff3e0;
            }

            .notification.info {
                border-left-color: #2196f3;
                background: #e3f2fd;
            }

            .notification-icon {
                font-size: 20px;
            }

            .notification.success .notification-icon {
                color: #4caf50;
            }

            .notification.error .notification-icon {
                color: #f44336;
            }

            .notification.warning .notification-icon {
                color: #ff9800;
            }

            .notification.info .notification-icon {
                color: #2196f3;
            }

            .notification-content {
                flex: 1;
                font-size: 14px;
                color: #333;
            }

            .notification-close {
                background: none;
                border: none;
                color: #666;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: background 0.2s;
            }

            .notification-close:hover {
                background: rgba(0, 0, 0, 0.1);
            }

            [data-theme="dark"] .notification {
                background: #2a2a2a;
                color: #fff;
            }

            [data-theme="dark"] .notification.success {
                background: #1b5e20;
            }

            [data-theme="dark"] .notification.error {
                background: #b71c1c;
            }

            [data-theme="dark"] .notification.warning {
                background: #e65100;
            }

            [data-theme="dark"] .notification.info {
                background: #0d47a1;
            }

            [data-theme="dark"] .notification-content {
                color: #fff;
            }

            @media (max-width: 768px) {
                .notification-container {
                    left: 20px;
                    right: 20px;
                    max-width: none;
                }
            }
        `;

        document.head.appendChild(styles);
    }

    show(message, type = 'info', duration = 5000) {
        const notification = this.createNotification(message, type);
        this.container.appendChild(notification);

        // Trigger animation
        setTimeout(() => notification.classList.add('show'), 10);

        // Auto remove
        setTimeout(() => this.remove(notification), duration);

        return notification;
    }

    createNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        const icons = {
            success: 'check_circle',
            error: 'error',
            warning: 'warning',
            info: 'info'
        };

        notification.innerHTML = `
            <span class="material-icons notification-icon">${icons[type] || 'info'}</span>
            <div class="notification-content">${message}</div>
            <button class="notification-close">
                <span class="material-icons" style="font-size: 16px;">close</span>
            </button>
        `;

        // Add close functionality
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => this.remove(notification));

        return notification;
    }

    remove(notification) {
        if (!notification || !notification.parentNode) return;

        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    clear() {
        const notifications = this.container.querySelectorAll('.notification');
        notifications.forEach(notification => this.remove(notification));
    }

    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }
}

// Initialize notification manager
let notificationManagerNew;
document.addEventListener('DOMContentLoaded', () => {
    notificationManagerNew = new NotificationManagerNew();
    window.notificationManager = notificationManagerNew;
});

// Export for global access
window.NotificationManagerNew = NotificationManagerNew;
