import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const LP_TOKEN_ADDRESS = '0x1111111111111111111111111111111111111111';
const RECIPIENT_ADDRESS = '0x2222222222222222222222222222222222222222';

function tx(hash) {
    return Promise.resolve({ hash });
}

function createContractMethods() {
    return {
        claimRewards: vi.fn(() => tx('0xclaim')),
        claimRewardsTo: vi.fn(() => tx('0xclaim-to')),
        unstake: vi.fn(() => tx('0xunstake')),
        unstakeTo: vi.fn(() => tx('0xunstake-to'))
    };
}

async function createManager(contractMethods) {
    vi.resetModules();

    globalThis.window = globalThis;
    globalThis.notificationManager = { error: vi.fn() };
    globalThis.ethers = {
        utils: {
            parseEther: vi.fn(value => ({ value, toString: () => String(value) })),
            isAddress: vi.fn(value => /^0x[a-fA-F0-9]{40}$/.test(String(value))),
            getAddress: vi.fn(value => String(value))
        }
    };

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await import('../js/contracts/contract-manager.js');
    const manager = new globalThis.ContractManager();

    manager.signer = {};
    manager.ensureSigner = vi.fn().mockResolvedValue(undefined);
    manager.stakingContract = {
        connect: vi.fn(() => contractMethods)
    };
    manager.executeTransactionOnce = vi.fn(async (operation, operationName) => {
        const result = await operation();
        return { success: true, hash: result.hash, operationName };
    });

    return manager;
}

beforeEach(() => {
    delete globalThis.ContractManager;
    delete globalThis.contractManager;
});

afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.window;
    delete globalThis.notificationManager;
    delete globalThis.ethers;
    delete globalThis.ContractManager;
    delete globalThis.contractManager;
});

describe('ContractManager recipient-aware staking calls', () => {
    it('routes claim rewards to the default or recipient-aware contract method', async () => {
        const contractMethods = createContractMethods();
        const manager = await createManager(contractMethods);

        await manager.claimRewards(LP_TOKEN_ADDRESS);
        await manager.claimRewards(LP_TOKEN_ADDRESS, RECIPIENT_ADDRESS);

        expect(contractMethods.claimRewards).toHaveBeenCalledWith(LP_TOKEN_ADDRESS);
        expect(contractMethods.claimRewardsTo).toHaveBeenCalledWith(LP_TOKEN_ADDRESS, RECIPIENT_ADDRESS);
    });

    it('routes unstake to the default or recipient-aware contract method', async () => {
        const contractMethods = createContractMethods();
        const manager = await createManager(contractMethods);

        await manager.unstake(LP_TOKEN_ADDRESS, '1.5', true);
        await manager.unstake(LP_TOKEN_ADDRESS, '2', false, RECIPIENT_ADDRESS);

        expect(globalThis.ethers.utils.parseEther).toHaveBeenCalledWith('1.5');
        expect(globalThis.ethers.utils.parseEther).toHaveBeenCalledWith('2');
        expect(contractMethods.unstake).toHaveBeenCalledWith(
            LP_TOKEN_ADDRESS,
            expect.objectContaining({ value: '1.5' }),
            true
        );
        expect(contractMethods.unstakeTo).toHaveBeenCalledWith(
            LP_TOKEN_ADDRESS,
            expect.objectContaining({ value: '2' }),
            false,
            RECIPIENT_ADDRESS
        );
    });
});
