(function () {
    if (typeof window === 'undefined') {
        return;
    }

    class WalletProviderSelector {
        constructor() {
            this.overlay = null;
            this.resolveSelection = null;
            this.handleKeydown = this.handleKeydown.bind(this);
            this.ensureStyles();
        }

        ensureStyles() {
            if (document.getElementById('wallet-provider-selector-styles')) {
                return;
            }

            const style = document.createElement('style');
            style.id = 'wallet-provider-selector-styles';
            style.textContent = `
                .wallet-provider-selector-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(17, 24, 39, 0.55);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 2000;
                    backdrop-filter: blur(2px);
                    padding: 24px;
                }
                .wallet-provider-selector-modal {
                    background: #0f172a;
                    color: #f1f5f9;
                    border-radius: 16px;
                    width: min(360px, 100%);
                    max-width: 100%;
                    box-shadow: 0 20px 45px rgba(15, 23, 42, 0.35);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    animation: wallet-provider-fade-in 140ms ease-out;
                }
                @keyframes wallet-provider-fade-in {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .wallet-provider-selector-header {
                    padding: 20px 22px 12px 22px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .wallet-provider-selector-title {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                    letter-spacing: 0.01em;
                }
                .wallet-provider-selector-close {
                    border: 0;
                    background: transparent;
                    color: #cbd5f5;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 4px;
                }
                .wallet-provider-selector-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 12px 22px 6px 22px;
                }
                .wallet-provider-selector-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 14px;
                    border-radius: 12px;
                    border: 1px solid rgba(148, 163, 184, 0.25);
                    background: rgba(15, 23, 42, 0.35);
                    cursor: pointer;
                    transition: border-color 120ms ease, background 120ms ease;
                }
                .wallet-provider-selector-item:hover,
                .wallet-provider-selector-item:focus-visible {
                    border-color: rgba(129, 140, 248, 0.6);
                    background: rgba(79, 70, 229, 0.15);
                    outline: none;
                }
                .wallet-provider-selector-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    background: rgba(129, 140, 248, 0.15);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #a5b4fc;
                    font-weight: 600;
                    font-size: 16px;
                    overflow: hidden;
                }
                .wallet-provider-selector-icon img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .wallet-provider-selector-name {
                    font-size: 16px;
                    font-weight: 500;
                }
                .wallet-provider-selector-secondary {
                    font-size: 13px;
                    color: #94a3b8;
                    margin-top: 2px;
                }
                .wallet-provider-selector-footer {
                    padding: 14px 22px 20px 22px;
                    display: flex;
                    justify-content: flex-end;
                }
                .wallet-provider-selector-cancel {
                    border: 0;
                    border-radius: 10px;
                    padding: 10px 16px;
                    background: rgba(226, 232, 240, 0.12);
                    color: #e2e8f0;
                    cursor: pointer;
                    font-weight: 500;
                    transition: background 120ms ease;
                }
                .wallet-provider-selector-cancel:hover,
                .wallet-provider-selector-cancel:focus-visible {
                    background: rgba(226, 232, 240, 0.22);
                    outline: none;
                }
            `;
            document.head.appendChild(style);
        }

        open({ providers, contextTitle } = {}) {
            if (!Array.isArray(providers) || providers.length === 0) {
                return Promise.resolve(null);
            }

            this.close();

            return new Promise((resolve) => {
                this.resolveSelection = resolve;

                const overlay = document.createElement('div');
                overlay.className = 'wallet-provider-selector-overlay';
                overlay.addEventListener('click', (event) => {
                    if (event.target === overlay) {
                        this.close(null);
                    }
                });

                const modal = document.createElement('div');
                modal.className = 'wallet-provider-selector-modal';

                const header = document.createElement('div');
                header.className = 'wallet-provider-selector-header';

                const title = document.createElement('h2');
                title.className = 'wallet-provider-selector-title';
                title.textContent = contextTitle || 'Select a wallet';

                const closeBtn = document.createElement('button');
                closeBtn.className = 'wallet-provider-selector-close';
                closeBtn.type = 'button';
                closeBtn.setAttribute('aria-label', 'Close');
                closeBtn.innerHTML = '&times;';
                closeBtn.addEventListener('click', () => this.close(null));

                header.appendChild(title);
                header.appendChild(closeBtn);

                const list = document.createElement('div');
                list.className = 'wallet-provider-selector-list';

                providers.forEach((detail) => {
                    const info = detail?.info || {};
                    const item = document.createElement('button');
                    item.type = 'button';
                    item.className = 'wallet-provider-selector-item';
                    item.setAttribute('data-provider-uuid', info.uuid || '');

                    const iconContainer = document.createElement('span');
                    iconContainer.className = 'wallet-provider-selector-icon';

                    if (info.icon) {
                        const img = document.createElement('img');
                        img.src = info.icon;
                        img.alt = `${info.name || 'Wallet'} icon`;
                        iconContainer.appendChild(img);
                    } else {
                        const fallbackLetter = (info.name || info.rdns || 'W').charAt(0).toUpperCase();
                        iconContainer.textContent = fallbackLetter;
                    }

                    const textWrapper = document.createElement('span');
                    textWrapper.style.display = 'flex';
                    textWrapper.style.flexDirection = 'column';
                    textWrapper.style.alignItems = 'flex-start';

                    const name = document.createElement('span');
                    name.className = 'wallet-provider-selector-name';
                    name.textContent = info.name || 'Browser Wallet';

                    const secondary = document.createElement('span');
                    secondary.className = 'wallet-provider-selector-secondary';
                    secondary.textContent = info.rdns || 'injected';

                    textWrapper.appendChild(name);
                    textWrapper.appendChild(secondary);

                    item.appendChild(iconContainer);
                    item.appendChild(textWrapper);

                    item.addEventListener('click', () => {
                        this.close(detail);
                    });

                    list.appendChild(item);
                });

                const footer = document.createElement('div');
                footer.className = 'wallet-provider-selector-footer';

                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'wallet-provider-selector-cancel';
                cancelBtn.type = 'button';
                cancelBtn.textContent = 'Cancel';
                cancelBtn.addEventListener('click', () => this.close(null));

                footer.appendChild(cancelBtn);

                modal.appendChild(header);
                modal.appendChild(list);
                modal.appendChild(footer);

                overlay.appendChild(modal);
                document.body.appendChild(overlay);

                this.overlay = overlay;

                requestAnimationFrame(() => {
                    const firstButton = list.querySelector('button');
                    firstButton?.focus();
                });

                document.addEventListener('keydown', this.handleKeydown);
            });
        }

        handleKeydown(event) {
            if (event.key === 'Escape') {
                this.close(null);
            }
        }

        close(selection) {
            if (this.overlay) {
                this.overlay.remove();
                this.overlay = null;
            }

            document.removeEventListener('keydown', this.handleKeydown);

            if (this.resolveSelection) {
                this.resolveSelection(selection || null);
                this.resolveSelection = null;
            }
        }
    }

    window.WalletProviderSelector = WalletProviderSelector;
    if (!window.walletProviderSelector) {
        window.walletProviderSelector = new WalletProviderSelector();
    }
})();
