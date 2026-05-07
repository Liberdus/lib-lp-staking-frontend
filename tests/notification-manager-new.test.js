import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

function matchesSelector(element, selector) {
    if (selector.startsWith('.')) {
        return element.className.split(/\s+/).includes(selector.slice(1));
    }

    return element.tagName.toLowerCase() === selector.toLowerCase();
}

function createClassList(element) {
    return {
        add: (...names) => {
            const classes = new Set(element.className.split(/\s+/).filter(Boolean));
            names.forEach(name => classes.add(name));
            element.className = Array.from(classes).join(' ');
        },
        remove: (...names) => {
            const classes = new Set(element.className.split(/\s+/).filter(Boolean));
            names.forEach(name => classes.delete(name));
            element.className = Array.from(classes).join(' ');
        },
        contains: name => element.className.split(/\s+/).includes(name)
    };
}

function createElement(tagName) {
    const element = {
        tagName: tagName.toUpperCase(),
        children: [],
        attributes: {},
        className: '',
        parentNode: null,
        style: {},
        _textContent: '',
        appendChild(child) {
            child.parentNode = this;
            this.children.push(child);
            return child;
        },
        removeChild(child) {
            this.children = this.children.filter(item => item !== child);
            child.parentNode = null;
            return child;
        },
        setAttribute(name, value) {
            this.attributes[name] = String(value);
        },
        getAttribute(name) {
            return this.attributes[name];
        },
        addEventListener: vi.fn(),
        querySelector(selector) {
            return this.querySelectorAll(selector)[0] || null;
        },
        querySelectorAll(selector) {
            const matches = [];
            const visit = node => {
                node.children.forEach(child => {
                    if (matchesSelector(child, selector)) {
                        matches.push(child);
                    }
                    visit(child);
                });
            };

            visit(this);
            return matches;
        }
    };

    Object.defineProperty(element, 'textContent', {
        get() {
            return `${this._textContent}${this.children.map(child => child.textContent).join('')}`;
        },
        set(value) {
            this._textContent = String(value);
            this.children = [];
        }
    });

    element.classList = createClassList(element);
    return element;
}

function createDocumentMock() {
    const body = createElement('body');

    return {
        body,
        addEventListener: vi.fn(),
        createElement,
        getElementById: vi.fn(() => null)
    };
}

async function loadNotificationManager() {
    vi.resetModules();

    globalThis.window = globalThis;
    globalThis.document = createDocumentMock();
    globalThis.requestAnimationFrame = callback => callback();
    globalThis.CONFIG = {
        SUPPORT: {
            DISCORD_URL: 'https://discord.gg/2Cs9YWtFVN'
        }
    };

    await import('../js/core/notification-manager-new.js');
    return globalThis.NotificationManagerNew;
}

describe('NotificationManagerNew support actions', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.CONFIG;
        delete globalThis.NotificationManagerNew;
        delete globalThis.document;
        delete globalThis.requestAnimationFrame;
        delete globalThis.window;
    });

    it('adds a Discord support action to error toasts', async () => {
        const NotificationManagerNew = await loadNotificationManager();
        const manager = new NotificationManagerNew();

        const notification = manager.error('Something failed', { persistent: true });
        const action = notification.querySelector('.notification-action-link');

        expect(action).not.toBeNull();
        expect(action.textContent).toBe('Get support');
        expect(action.href).toBe('https://discord.gg/2Cs9YWtFVN');
        expect(action.target).toBe('_blank');
        expect(action.rel).toBe('noopener noreferrer');
    });

    it('does not add support actions to non-error toasts', async () => {
        const NotificationManagerNew = await loadNotificationManager();
        const manager = new NotificationManagerNew();

        const notification = manager.warning('Check this', { persistent: true });

        expect(notification.querySelector('.notification-action-link')).toBeNull();
    });

    it('allows callers to disable the error support action', async () => {
        const NotificationManagerNew = await loadNotificationManager();
        const manager = new NotificationManagerNew();

        const notification = manager.error('Something failed', {
            persistent: true,
            supportAction: false
        });

        expect(notification.querySelector('.notification-action-link')).toBeNull();
    });

    it('renders message text without treating it as HTML', async () => {
        const NotificationManagerNew = await loadNotificationManager();
        const manager = new NotificationManagerNew();
        const unsafeMessage = '<img src=x onerror=alert(1)>';

        const notification = manager.error(unsafeMessage, { persistent: true });
        const message = notification.querySelector('.notification-message');

        expect(message.textContent).toBe(unsafeMessage);
        expect(message.children).toHaveLength(0);
        expect(notification.querySelector('img')).toBeNull();
    });
});

describe('footer support link', () => {
    it('uses the configured Discord support URL', () => {
        const config = readFileSync(new URL('../js/config/app-config.js', import.meta.url), 'utf8');
        const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
        const discordUrl = config.match(/DISCORD_URL:\s*'([^']+)'/)?.[1];

        expect(discordUrl).toBe('https://discord.gg/2Cs9YWtFVN');
        expect(index).toContain(`id="discord-support-link" href="${discordUrl}"`);
        expect(index).toContain('class="social-link-icon"');
        expect(index.match(/class="social-link-icon"/g)).toHaveLength(4);
        expect(index).not.toContain('<span class="material-icons">code</span>');
        expect(index).not.toContain('<span class="material-icons">forum</span>');
        expect(index).not.toContain('<span class="material-icons">alternate_email</span>');
        expect(index).not.toContain('<span class="material-icons">send</span>');
    });
});
