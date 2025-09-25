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
                pointer-events: none;
            }

            .notification {
                background: var(--background-paper);
                border-radius: 8px;
                padding: 16px;
                box-shadow: var(--shadow-4);
                display: flex;
                align-items: flex-start;
                gap: 12px;
                border-left: 4px solid var(--primary-main);
                transform: translateX(100%);
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: auto;
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
            }

            .notification.success {
                border-left-color: var(--success-main);
            }

            .notification.error {
                border-left-color: var(--error-main);
            }

            .notification.warning {
                border-left-color: var(--warning-main);
            }

            .notification.info {
                border-left-color: var(--info-main);
            }

            .notification-icon {
                flex-shrink: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                font-size: 16px;
            }

            .notification.success .notification-icon {
                background: var(--success-main);
                color: white;
            }

            .notification.error .notification-icon {
                background: var(--error-main);
                color: white;
            }

            .notification.warning .notification-icon {
                background: var(--warning-main);
                color: white;
            }

            .notification.info .notification-icon {
                background: var(--info-main);
                color: white;
            }

            .notification-content {
                flex: 1;
                min-width: 0;
            }

            .notification-title {
                font-weight: 600;
                font-size: 14px;
                color: var(--text-primary);
                margin: 0 0 4px 0;
                line-height: 1.4;
            }

            .notification-message {
                font-size: 13px;
                color: var(--text-secondary);
                margin: 0;
                line-height: 1.4;
                word-wrap: break-word;
            }

            .notification-close {
                flex-shrink: 0;
                width: 20px;
                height: 20px;
                border: none;
                background: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                color: var(--text-secondary);
                transition: all 0.2s ease;
                font-size: 16px;
            }

            .notification-close:hover {
                background: var(--action-hover);
                color: var(--text-primary);
            }

            .notification-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 2px;
                background: var(--primary-main);
                transition: width linear;
                border-radius: 0 0 8px 8px;
            }

            .notification.success .notification-progress {
                background: var(--success-main);
            }

            .notification.error .notification-progress {
                background: var(--error-main);
            }

            .notification.warning .notification-progress {
                background: var(--warning-main);
            }

            .notification.info .notification-progress {
                background: var(--info-main);
            }

            @media (max-width: 480px) {
                .notification-container {
                    top: 10px;
                    right: 10px;
                    left: 10px;
                    max-width: none;
                }

                .notification {
                    transform: translateY(-100%);
                }

                .notification.show {
                    transform: translateY(0);
                }

                .notification.hide {
                    transform: translateY(-100%);
                }
            }

            /* Respect reduced motion preference */
            @media (prefers-reduced-motion: reduce) {
                .notification {
                    transition: opacity 0.2s ease;
                    transform: none !important;
                }

                .notification.show {
                    opacity: 1;
                }

                .notification.hide {
                    opacity: 0;
                }
            }
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

    show(message, type = 'info', options = {}) {
        const {
            duration = 5000,
            title = null,
            persistent = false,
            showProgress = true,
            onClick = null
        } = typeof options === 'number' ? { duration: options } : options;

        const notification = this.createNotification(message, type, { title, persistent, showProgress, onClick });
        this.container.appendChild(notification);

        // Trigger animation
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        // Add progress bar animation if enabled
        if (showProgress && duration > 0 && !persistent) {
            const progressBar = notification.querySelector('.notification-progress');
            if (progressBar) {
                progressBar.style.width = '100%';
                progressBar.style.transitionDuration = `${duration}ms`;
                requestAnimationFrame(() => {
                    progressBar.style.width = '0%';
                });
            }
        }

        // Auto remove (unless persistent)
        if (duration > 0 && !persistent) {
            setTimeout(() => this.remove(notification), duration);
        }

        // Add to notifications array
        this.notifications.push({
            element: notification,
            type,
            message,
            timestamp: Date.now()
        });

        return notification;
    }

    createNotification(message, type, options = {}) {
        const { title, persistent, showProgress, onClick } = options;
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        if (onClick) {
            notification.style.cursor = 'pointer';
            notification.addEventListener('click', onClick);
        }

        const icons = {
            success: 'check_circle',
            error: 'error',
            warning: 'warning',
            info: 'info'
        };

        const titleHtml = title ? `<div class="notification-title">${title}</div>` : '';
        const progressHtml = showProgress && !persistent ? '<div class="notification-progress"></div>' : '';

        notification.innerHTML = `
            <div class="notification-icon">
                <span class="material-icons">${icons[type] || 'info'}</span>
            </div>
            <div class="notification-content">
                ${titleHtml}
                <div class="notification-message">${message}</div>
            </div>
            ${!persistent ? `
                <button class="notification-close" aria-label="Close notification">
                    <span class="material-icons">close</span>
                </button>
            ` : ''}
            ${progressHtml}
        `;

        // Add close functionality
        if (!persistent) {
            const closeBtn = notification.querySelector('.notification-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.remove(notification);
                });
            }
        }

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
