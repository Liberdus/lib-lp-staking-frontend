import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const NETWORK = {
    CHAIN_ID: 56,
    NAME: 'BNB Smart Chain',
    RPC_URL: 'https://bsc.example',
    FALLBACK_RPCS: ['https://bsc-fallback.example'],
    BLOCK_EXPLORER: 'https://bscscan.com',
    NATIVE_CURRENCY: { name: 'BNB', symbol: 'BNB', decimals: 18 }
};

function createProvider(handler) {
    const calls = [];
    return {
        calls,
        async request(payload) {
            calls.push(payload);
            return handler?.(payload);
        }
    };
}

async function loadNetworkManager(provider) {
    vi.resetModules();
    delete globalThis.NetworkManager;

    globalThis.window = globalThis;
    globalThis.document = { addEventListener: vi.fn() };
    globalThis.CONFIG = { DEV: { DEBUG_MODE: false } };
    globalThis.walletManager = {
        isConnected: vi.fn(() => true),
        getChainId: vi.fn(() => NETWORK.CHAIN_ID),
        getEip1193Provider: vi.fn(() => provider),
        sync: vi.fn()
    };
    globalThis.networkSelector = {
        getCurrentChainId: vi.fn(() => NETWORK.CHAIN_ID),
        getCurrentNetworkConfig: vi.fn(() => NETWORK),
        getCurrentNetworkName: vi.fn(() => NETWORK.NAME)
    };

    await import('../js/wallet/network-manager.js');
    return globalThis.networkManager;
}

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.NetworkManager;
    delete globalThis.networkManager;
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.CONFIG;
    delete globalThis.walletManager;
    delete globalThis.networkSelector;
    delete globalThis.ethereum;
});

describe('NetworkManager wallet module adapter integration', () => {
    it('checks permission against the selected wallet provider', async () => {
        const provider = createProvider(({ method }) => {
            if (method === 'eth_chainId') return '0x38';
        });
        const otherProvider = createProvider();
        globalThis.ethereum = otherProvider;

        const manager = await loadNetworkManager(provider);

        await expect(manager.hasRequiredNetworkPermission()).resolves.toBe(true);
        expect(provider.calls).toEqual([{ method: 'eth_chainId' }]);
        expect(otherProvider.calls).toEqual([]);
    });

    it('switches known networks through the selected provider', async () => {
        const provider = createProvider();
        const manager = await loadNetworkManager(provider);

        await manager.switchNetwork();

        expect(provider.calls).toEqual([
            {
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x38' }]
            }
        ]);
        expect(globalThis.walletManager.sync).toHaveBeenCalled();
    });

    it('adds unknown networks then retries the switch', async () => {
        let switches = 0;
        const provider = createProvider(({ method }) => {
            if (method === 'wallet_switchEthereumChain') {
                switches += 1;
                if (switches === 1) {
                    const error = new Error('Unknown chain');
                    error.code = 4902;
                    throw error;
                }
            }
        });
        const manager = await loadNetworkManager(provider);

        await manager.switchNetwork();

        expect(provider.calls.map((call) => call.method)).toEqual([
            'wallet_switchEthereumChain',
            'wallet_addEthereumChain',
            'wallet_switchEthereumChain'
        ]);
    });
});
