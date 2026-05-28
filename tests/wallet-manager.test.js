import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SESSION_KEY = 'lib_lp_staking:wallet-session';
const ACCOUNT = '0x24f55B1e86D67ca62146618Ee486AA4DF611CDD4';
const NEXT_ACCOUNT = '0x1111111111111111111111111111111111111111';

class MemoryStorage {
    constructor() {
        this.items = new Map();
    }

    getItem(key) {
        return this.items.get(key) || null;
    }

    setItem(key, value) {
        this.items.set(key, String(value));
    }

    removeItem(key) {
        this.items.delete(key);
    }
}

function createMockProvider({
    account = ACCOUNT,
    chainId = '0x38',
    flags = { isMetaMask: true },
    revokePermissions = async () => null
} = {}) {
    const listeners = new Map();
    const requests = [];

    function handlers(event) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        return listeners.get(event);
    }

    return {
        ...flags,
        requests,
        async request(payload) {
            requests.push(payload);
            if (payload.method === 'eth_requestAccounts') return [account];
            if (payload.method === 'eth_accounts') return [account];
            if (payload.method === 'eth_chainId') return chainId;
            if (payload.method === 'wallet_revokePermissions') return revokePermissions();
            throw new Error(`Unsupported request: ${payload.method}`);
        },
        on(event, handler) {
            handlers(event).add(handler);
        },
        removeListener(event, handler) {
            handlers(event).delete(handler);
        },
        emit(event, value) {
            handlers(event).forEach((handler) => handler(value));
        }
    };
}

function installBrowser(provider, storage = new MemoryStorage()) {
    const windowListeners = new Map();
    const documentEvents = [];

    globalThis.CustomEvent = class CustomEvent extends Event {
        constructor(type, init = {}) {
            super(type);
            this.detail = init.detail;
        }
    };
    globalThis.window = globalThis;
    globalThis.ethereum = provider;
    globalThis.localStorage = storage;
    globalThis.document = {
        currentScript: null,
        dispatchEvent(event) {
            documentEvents.push(event);
            return true;
        }
    };
    globalThis.addEventListener = (event, handler) => {
        windowListeners.set(event, handler);
    };
    globalThis.removeEventListener = (event, handler) => {
        if (windowListeners.get(event) === handler) windowListeners.delete(event);
    };
    globalThis.dispatchEvent = (event) => {
        windowListeners.get(event.type)?.(event);
        return true;
    };
    globalThis.ethers = {
        providers: {
            Web3Provider: class Web3Provider {
                constructor(injectedProvider) {
                    this.injectedProvider = injectedProvider;
                }

                getSigner() {
                    return { provider: this.injectedProvider };
                }
            }
        }
    };

    return { documentEvents, storage };
}

async function loadWalletManager() {
    vi.resetModules();
    delete globalThis.WalletManager;
    await import('../js/wallet/wallet-manager.js');
    return globalThis.WalletManager;
}

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.CustomEvent;
    delete globalThis.WalletManager;
    delete globalThis.window;
    delete globalThis.ethereum;
    delete globalThis.localStorage;
    delete globalThis.document;
    delete globalThis.addEventListener;
    delete globalThis.removeEventListener;
    delete globalThis.dispatchEvent;
    delete globalThis.ethers;
});

describe('WalletManager wallet module integration', () => {
    it('restores a saved wallet session without requesting accounts', async () => {
        const provider = createMockProvider();
        const { storage } = installBrowser(provider);

        const WalletManager = await loadWalletManager();
        const manager = new WalletManager();
        await manager.init();
        const wallet = (await manager.discoverWallets())[0];
        storage.setItem(SESSION_KEY, JSON.stringify({ walletId: wallet.id }));
        await manager.checkPreviousConnection();

        expect(manager.getAddress()).toBe(ACCOUNT.toLowerCase());
        expect(provider.requests.map((request) => request.method)).not.toContain('eth_requestAccounts');
        expect(provider.requests.map((request) => request.method)).toContain('eth_accounts');
    });

    it('requires wallet selection when multiple wallets are available', async () => {
        const metaMask = createMockProvider();
        const rabby = createMockProvider({ flags: { isRabby: true } });
        installBrowser({ providers: [metaMask, rabby] });

        const WalletManager = await loadWalletManager();
        const manager = new WalletManager();
        await manager.init();

        await expect(manager.connectWallet()).rejects.toMatchObject({
            code: 'WALLET_SELECTION_REQUIRED'
        });
    });

    it('connects by wallet id and updates account, chain, and disconnect events', async () => {
        const provider = createMockProvider();
        const { documentEvents } = installBrowser(provider);

        const WalletManager = await loadWalletManager();
        const manager = new WalletManager();
        await manager.init();

        const wallet = (await manager.discoverWallets())[0];
        await manager.connectWallet({ walletId: wallet.id });
        expect(manager.getAddress()).toBe(ACCOUNT.toLowerCase());

        provider.emit('accountsChanged', [NEXT_ACCOUNT]);
        expect(manager.getAddress()).toBe(NEXT_ACCOUNT.toLowerCase());

        provider.emit('chainChanged', '0x61');
        expect(manager.getChainId()).toBe(97);

        provider.emit('accountsChanged', []);
        expect(manager.isConnected()).toBe(false);
        expect(documentEvents.map((event) => event.type)).toContain('walletDisconnected');
    });

    it('emits one disconnect event when the app disconnects', async () => {
        const provider = createMockProvider();
        const { documentEvents } = installBrowser(provider);

        const WalletManager = await loadWalletManager();
        const manager = new WalletManager();
        await manager.init();

        const wallet = (await manager.discoverWallets())[0];
        await manager.connectWallet({ walletId: wallet.id });
        await manager.disconnect();

        expect(manager.isConnected()).toBe(false);
        expect(provider.requests.map((request) => request.method)).toContain('wallet_revokePermissions');
        expect(documentEvents.filter((event) => event.type === 'walletDisconnected')).toHaveLength(1);
    });

    it('still disconnects when permission revocation is unsupported', async () => {
        const provider = createMockProvider({
            revokePermissions: async () => {
                throw new Error('Unsupported method');
            }
        });
        const { storage } = installBrowser(provider);

        const WalletManager = await loadWalletManager();
        const manager = new WalletManager();
        await manager.init();

        const wallet = (await manager.discoverWallets())[0];
        await manager.connectWallet({ walletId: wallet.id });
        await manager.disconnect();

        expect(manager.isConnected()).toBe(false);
        expect(storage.getItem(SESSION_KEY)).toBeNull();
    });

    it('emits one disconnect event when revocation clears accounts first', async () => {
        let provider;
        provider = createMockProvider({
            revokePermissions: async () => {
                provider.emit('accountsChanged', []);
                return null;
            }
        });
        const { documentEvents } = installBrowser(provider);

        const WalletManager = await loadWalletManager();
        const manager = new WalletManager();
        await manager.init();

        const wallet = (await manager.discoverWallets())[0];
        await manager.connectWallet({ walletId: wallet.id });
        await manager.disconnect();

        expect(manager.isConnected()).toBe(false);
        expect(documentEvents.filter((event) => event.type === 'walletDisconnected')).toHaveLength(1);
    });
});
