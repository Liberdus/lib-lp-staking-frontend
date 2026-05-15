import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const LP_TOKEN_ADDRESS = '0x1111111111111111111111111111111111111111';
const RECIPIENT_ADDRESS = '0x2222222222222222222222222222222222222222';
const CHECKSUM_RECIPIENT_ADDRESS = '0x2222222222222222222222222222222222222222';

async function loadContractManagerClass() {
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
    return globalThis.ContractManager;
}

async function createManager(contractMethods) {
    const ContractManager = await loadContractManagerClass();
    const manager = new ContractManager();

    manager.signer = {};
    manager.ensureSigner = vi.fn().mockResolvedValue(undefined);
    manager.stakingContract = {
        connect: vi.fn(() => contractMethods)
    };
    manager.executeTransactionOnce = vi.fn(async (operation, operationName) => {
        const tx = await operation();
        return { success: true, hash: tx.hash, operationName };
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
    it('keeps default claim rewards calls on claimRewards', async () => {
        const contractMethods = {
            claimRewards: vi.fn().mockResolvedValue({ hash: '0xclaim' }),
            claimRewardsTo: vi.fn()
        };
        const manager = await createManager(contractMethods);

        const result = await manager.claimRewards(LP_TOKEN_ADDRESS);

        expect(result).toEqual({ success: true, hash: '0xclaim', operationName: 'claimRewards' });
        expect(contractMethods.claimRewards).toHaveBeenCalledWith(LP_TOKEN_ADDRESS);
        expect(contractMethods.claimRewardsTo).not.toHaveBeenCalled();
    });

    it('uses claimRewardsTo when a recipient is provided', async () => {
        const contractMethods = {
            claimRewards: vi.fn(),
            claimRewardsTo: vi.fn().mockResolvedValue({ hash: '0xclaim-to' })
        };
        const manager = await createManager(contractMethods);

        const result = await manager.claimRewards(LP_TOKEN_ADDRESS, RECIPIENT_ADDRESS);

        expect(result).toEqual({ success: true, hash: '0xclaim-to', operationName: 'claimRewards' });
        expect(globalThis.ethers.utils.getAddress).toHaveBeenCalledWith(RECIPIENT_ADDRESS);
        expect(contractMethods.claimRewardsTo).toHaveBeenCalledWith(LP_TOKEN_ADDRESS, CHECKSUM_RECIPIENT_ADDRESS);
        expect(contractMethods.claimRewards).not.toHaveBeenCalled();
    });

    it('keeps default unstake calls on unstake', async () => {
        const contractMethods = {
            unstake: vi.fn().mockResolvedValue({ hash: '0xunstake' }),
            unstakeTo: vi.fn()
        };
        const manager = await createManager(contractMethods);

        const result = await manager.unstake(LP_TOKEN_ADDRESS, '1.5', true);

        expect(result).toEqual({ success: true, hash: '0xunstake', operationName: 'unstake' });
        expect(globalThis.ethers.utils.parseEther).toHaveBeenCalledWith('1.5');
        expect(contractMethods.unstake).toHaveBeenCalledWith(
            LP_TOKEN_ADDRESS,
            expect.objectContaining({ value: '1.5' }),
            true
        );
        expect(contractMethods.unstakeTo).not.toHaveBeenCalled();
    });

    it('uses unstakeTo when a recipient is provided', async () => {
        const contractMethods = {
            unstake: vi.fn(),
            unstakeTo: vi.fn().mockResolvedValue({ hash: '0xunstake-to' })
        };
        const manager = await createManager(contractMethods);

        const result = await manager.unstake(LP_TOKEN_ADDRESS, '2', false, RECIPIENT_ADDRESS);

        expect(result).toEqual({ success: true, hash: '0xunstake-to', operationName: 'unstake' });
        expect(contractMethods.unstakeTo).toHaveBeenCalledWith(
            LP_TOKEN_ADDRESS,
            expect.objectContaining({ value: '2' }),
            false,
            CHECKSUM_RECIPIENT_ADDRESS
        );
        expect(contractMethods.unstake).not.toHaveBeenCalled();
    });
});
