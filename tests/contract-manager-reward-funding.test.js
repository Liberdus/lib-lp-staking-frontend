import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const STAKING_ADDRESS = '0x3333333333333333333333333333333333333333';
const REWARD_TOKEN_ADDRESS = '0x4444444444444444444444444444444444444444';

function tx(hash) {
    return Promise.resolve({ hash });
}

async function createManager(rewardTokenMethods, includeRewardToken = true) {
    vi.resetModules();

    globalThis.window = globalThis;
    globalThis.ethers = {
        utils: {
            parseEther: vi.fn(value => ({ value, toString: () => String(value) })),
            isAddress: vi.fn(value => /^0x[a-fA-F0-9]{40}$/.test(String(value))),
            getAddress: vi.fn(value => String(value))
        }
    };

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await import('../js/contracts/contract-manager.js');
    const manager = new globalThis.ContractManager();

    manager.signer = {};
    manager.ensureSigner = vi.fn().mockResolvedValue(undefined);
    manager.stakingContract = { address: STAKING_ADDRESS };
    manager.contractAddresses = new Map([['STAKING', STAKING_ADDRESS]]);
    manager.rewardTokenContract = includeRewardToken ? {
        address: REWARD_TOKEN_ADDRESS,
        interface: {},
        connect: vi.fn(() => rewardTokenMethods)
    } : null;
    manager.isValidContractAddress = vi.fn(() => true);
    manager.validateAndChecksumAddress = vi.fn(address => address);
    manager.executeTransactionOnce = vi.fn(async (operation) => {
        const result = await operation();
        return {
            transactionHash: result.hash,
            blockNumber: 1,
            gasUsed: '21000'
        };
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
    delete globalThis.ethers;
    delete globalThis.ContractManager;
    delete globalThis.contractManager;
});

describe('ContractManager reward token funding', () => {
    it('transfers configured reward tokens to the staking contract address', async () => {
        const transfer = vi.fn(() => tx('0xfund-rewards'));
        const manager = await createManager({ transfer });

        const result = await manager.transferRewardTokensToStaking('10');

        expect(result.success).toBe(true);
        expect(transfer).toHaveBeenCalledWith(
            STAKING_ADDRESS,
            expect.objectContaining({ value: '10' })
        );
        expect(manager.executeTransactionOnce).toHaveBeenCalledWith(
            expect.any(Function),
            'transferRewardTokensToStaking'
        );
    });

    it('rejects invalid amounts without submitting a transaction', async () => {
        const transfer = vi.fn(() => tx('0xfund-rewards'));
        const manager = await createManager({ transfer });

        for (const amount of ['0', 'abc']) {
            const result = await manager.transferRewardTokensToStaking(amount);
            expect(result.success).toBe(false);
            expect(result.error.message).toBe('Amount must be a positive number.');
        }

        expect(manager.executeTransactionOnce).not.toHaveBeenCalled();
        expect(transfer).not.toHaveBeenCalled();
    });

    it('returns an error when the reward token contract is unavailable', async () => {
        const transfer = vi.fn(() => tx('0xfund-rewards'));
        const manager = await createManager({ transfer }, false);

        const result = await manager.transferRewardTokensToStaking('5');

        expect(result.success).toBe(false);
        expect(result.error.message).toBe('Reward token contract is not available.');
        expect(manager.executeTransactionOnce).not.toHaveBeenCalled();
        expect(transfer).not.toHaveBeenCalled();
    });
});
