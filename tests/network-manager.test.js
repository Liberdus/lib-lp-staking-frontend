import { afterEach, describe, expect, it, vi } from 'vitest';

const BSC_NETWORK = {
    CHAIN_ID: 56,
    NAME: 'BNB Smart Chain',
    RPC_URL: 'https://bsc-dataseed.bnbchain.org',
    FALLBACK_RPCS: ['https://bsc-dataseed.nariox.org'],
    BLOCK_EXPLORER: 'https://bscscan.com',
    NATIVE_CURRENCY: { name: 'BNB', symbol: 'BNB', decimals: 18 }
};

async function loadNetworkManager(ethereum) {
    vi.resetModules();

    globalThis.window = globalThis;
    globalThis.ethereum = ethereum;
    globalThis.CONFIG = {
        DEV: { DEBUG_MODE: false }
    };
    globalThis.networkSelector = {
        getCurrentChainId: vi.fn(() => BSC_NETWORK.CHAIN_ID),
        getCurrentNetworkName: vi.fn(() => BSC_NETWORK.NAME),
        getCurrentNetworkConfig: vi.fn(() => BSC_NETWORK)
    };

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await import('../js/wallet/network-manager.js');
    return globalThis.networkManager;
}

describe('NetworkManager injected wallet permissions', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.window;
        delete globalThis.ethereum;
        delete globalThis.CONFIG;
        delete globalThis.networkSelector;
        delete globalThis.networkManager;
    });

    it('checks account and chain state without wallet_getPermissions', async () => {
        const request = vi.fn(({ method }) => {
            if (method === 'eth_accounts') return ['0xabc'];
            if (method === 'eth_chainId') return '0x38';
            throw new Error(`Unexpected method: ${method}`);
        });
        const manager = await loadNetworkManager({ request });

        const hasPermission = await manager.hasRequiredNetworkPermission();

        expect(hasPermission).toBe(true);
        expect(request.mock.calls.map(([payload]) => payload.method)).toEqual([
            'eth_accounts',
            'eth_chainId'
        ]);
    });

    it('reports missing permission when the wallet is on the wrong chain', async () => {
        const request = vi.fn(({ method }) => {
            if (method === 'eth_accounts') return ['0xabc'];
            if (method === 'eth_chainId') return '0x1';
            throw new Error(`Unexpected method: ${method}`);
        });
        const manager = await loadNetworkManager({ request });

        await expect(manager.hasRequiredNetworkPermission()).resolves.toBe(false);
    });

    it('requests account access and network switch without wallet_requestPermissions', async () => {
        const request = vi.fn(({ method }) => {
            if (method === 'eth_requestAccounts') return ['0xabc'];
            if (method === 'eth_chainId') return '0x1';
            if (method === 'wallet_switchEthereumChain') return true;
            throw new Error(`Unexpected method: ${method}`);
        });
        const manager = await loadNetworkManager({ request });

        await expect(manager.requestNetworkPermission()).resolves.toBe(true);

        expect(request.mock.calls.map(([payload]) => payload.method)).toEqual([
            'eth_requestAccounts',
            'eth_chainId',
            'wallet_switchEthereumChain'
        ]);
        expect(request).toHaveBeenCalledWith({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x38' }]
        });
    });

    it('adds the configured network when the wallet does not know the chain', async () => {
        const request = vi.fn(({ method }) => {
            if (method === 'eth_requestAccounts') return ['0xabc'];
            if (method === 'eth_chainId') return '0x1';
            if (method === 'wallet_switchEthereumChain') {
                const error = new Error('Unrecognized chain ID');
                error.code = 4902;
                throw error;
            }
            if (method === 'wallet_addEthereumChain') return true;
            throw new Error(`Unexpected method: ${method}`);
        });
        const manager = await loadNetworkManager({ request });

        await expect(manager.requestNetworkPermission()).resolves.toBe(true);

        expect(request).toHaveBeenCalledWith({
            method: 'wallet_addEthereumChain',
            params: [{
                chainId: '0x38',
                chainName: BSC_NETWORK.NAME,
                rpcUrls: [BSC_NETWORK.RPC_URL, ...BSC_NETWORK.FALLBACK_RPCS],
                nativeCurrency: BSC_NETWORK.NATIVE_CURRENCY,
                blockExplorerUrls: [BSC_NETWORK.BLOCK_EXPLORER]
            }]
        });
    });
});
