import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadContractManager(pathname = '/') {
    vi.resetModules();
    globalThis.window = globalThis;
    globalThis.location = { pathname };
    delete globalThis.ContractManager;

    await import('../js/contracts/contract-manager.js');
    return globalThis.ContractManager;
}

describe('ContractManager ABI loading', () => {
    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.CONFIG;
        delete globalThis.ContractManager;
        delete globalThis.fetch;
        delete globalThis.location;
        delete globalThis.window;
    });

    it('loads the staking ABI asset from the root page', async () => {
        const ContractManager = await loadContractManager('/');
        const manager = new ContractManager();
        const stakingABI = [{ type: 'function', name: 'stake' }];

        globalThis.CONFIG = { ABIS: { ERC20: ['function balanceOf(address owner) external view returns (uint256)'] } };
        globalThis.fetch = vi.fn(async () => ({
            ok: true,
            json: async () => stakingABI
        }));

        await manager.loadContractABIs();

        expect(globalThis.fetch).toHaveBeenCalledWith('assets/abi/LPStaking.json');
        expect(manager.contractABIs.get('STAKING')).toBe(stakingABI);
        expect(manager.contractABIs.get('ERC20')).toEqual(globalThis.CONFIG.ABIS.ERC20);
    });

    it('loads the staking ABI asset from the admin page', async () => {
        const ContractManager = await loadContractManager('/admin/');
        const manager = new ContractManager();

        globalThis.CONFIG = {};
        globalThis.fetch = vi.fn(async () => ({
            ok: true,
            json: async () => [{ type: 'function', name: 'stake' }]
        }));

        await manager.loadContractABIs();

        expect(globalThis.fetch).toHaveBeenCalledWith('../assets/abi/LPStaking.json');
        expect(manager.contractABIs.get('STAKING')).toEqual([{ type: 'function', name: 'stake' }]);
    });
});
