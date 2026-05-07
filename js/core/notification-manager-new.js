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

    show(message, type = 'info', options = {}) {
        const normalizedOptions = typeof options === 'number' ? { duration: options } : (options || {});
        const {
            duration = 5000,
            title = null,
            persistent = false,
            showProgress = true,
            onClick = null,
            supportAction = type === 'error'
        } = normalizedOptions;

        const notification = this.createNotification(message, type, { title, persistent, showProgress, onClick, supportAction });
        this.container.appendChild(notification);

        // Trigger animation
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        // Add progress bar animation if enabled
        if (showProgress && duration > 0 && !persistent) {
            const progressBar = notification.querySelector('.notification-progress');
            if (progressBar) {
                progressBar.style.animationDuration = `${duration}ms`;
                progressBar.classList.add('animating');
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
        const { title, persistent, showProgress, onClick, supportAction } = options;
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

        const iconContainer = document.createElement('div');
        iconContainer.className = 'notification-icon';

        const icon = document.createElement('span');
        icon.className = 'material-icons';
        icon.textContent = icons[type] || 'info';
        iconContainer.appendChild(icon);

        const content = document.createElement('div');
        content.className = 'notification-content';

        if (title) {
            const titleElement = document.createElement('div');
            titleElement.className = 'notification-title';
            titleElement.textContent = String(title);
            content.appendChild(titleElement);
        }

        const messageElement = document.createElement('div');
        messageElement.className = 'notification-message';
        messageElement.textContent = String(message ?? '');
        content.appendChild(messageElement);

        const supportActions = this.getSupportActions(type, supportAction);
        if (supportActions.length > 0) {
            const actions = document.createElement('div');
            actions.className = 'notification-actions';

            supportActions.forEach(action => {
                actions.appendChild(this.createActionLink(action));
            });

            content.appendChild(actions);
        }

        notification.appendChild(iconContainer);
        notification.appendChild(content);

        if (!persistent) {
            const closeButton = document.createElement('button');
            closeButton.className = 'notification-close';
            closeButton.type = 'button';
            closeButton.setAttribute('aria-label', 'Close notification');

            const closeIcon = document.createElement('span');
            closeIcon.className = 'material-icons';
            closeIcon.textContent = 'close';
            closeButton.appendChild(closeIcon);

            notification.appendChild(closeButton);
        }

        if (showProgress && !persistent) {
            const progress = document.createElement('div');
            progress.className = 'notification-progress';
            notification.appendChild(progress);
        }

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

    getSupportActions(type, supportAction) {
        if (type !== 'error' || supportAction === false) {
            return [];
        }

        const discordUrl = window.CONFIG?.SUPPORT?.DISCORD_URL;
        if (!discordUrl) {
            return [];
        }

        return [
            {
                label: 'Get support',
                url: discordUrl,
                ariaLabel: 'Get support on Discord'
            }
        ];
    }

    createActionLink(action) {
        const link = document.createElement('a');
        link.className = 'notification-action-link';
        link.href = action.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = action.label;
        link.setAttribute('aria-label', action.ariaLabel);

        link.addEventListener('click', event => {
            event.stopPropagation();
        });

        return link;
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

    success(message, options) {
        return this.show(message, 'success', options);
    }

    error(message, options) {
        return this.show(message, 'error', options);
    }

    warning(message, options) {
        return this.show(message, 'warning', options);
    }

    info(message, options) {
        return this.show(message, 'info', options);
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
