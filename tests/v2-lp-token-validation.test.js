import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const scriptSrc = 'https://example.test/repo/js/contracts/contract-manager.js';
const LP = '0x1111111111111111111111111111111111111111';
const TOKEN0 = '0x2222222222222222222222222222222222222222';
const TOKEN1 = '0x3333333333333333333333333333333333333333';

async function loadContractManager(provider, pairContract) {
    vi.resetModules();
    globalThis.window = globalThis;
    globalThis.location = { pathname: '/' };
    globalThis.document = { currentScript: { src: scriptSrc } };
    delete globalThis.ContractManager;
    globalThis.ethers = {
        constants: { AddressZero: '0x0000000000000000000000000000000000000000' },
        utils: {
            isAddress(value) {
                return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
            },
            getAddress(value) {
                if (!globalThis.ethers.utils.isAddress(value)) {
                    throw new Error('invalid address');
                }
                return value;
            },
            formatEther(value) {
                return String(value);
            }
        },
        BigNumber: {
            from(value) {
                return { toString: () => String(value) };
            }
        },
        Contract: vi.fn(function Contract() {
            return pairContract;
        })
    };

    await import('../js/contracts/contract-manager.js');
    const manager = new globalThis.ContractManager();
    manager.provider = provider;
    return manager;
}

function validPairContract(token0 = TOKEN0, token1 = TOKEN1, reserve0 = '0', reserve1 = '0') {
    return {
        token0: vi.fn().mockResolvedValue(token0),
        token1: vi.fn().mockResolvedValue(token1),
        getReserves: vi.fn().mockResolvedValue([reserve0, reserve1, 0])
    };
}

describe('ContractManager.validateV2CompatibleLpToken', () => {
    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.ContractManager;
        delete globalThis.document;
        delete globalThis.ethers;
        delete globalThis.location;
        delete globalThis.window;
    });

    it('rejects bad addresses before RPC calls', async () => {
        const getCode = vi.fn();
        const manager = await loadContractManager({ getCode }, validPairContract());

        await expect(manager.validateV2CompatibleLpToken('')).resolves.toEqual({
            valid: false,
            error: 'LP token address is required'
        });
        await expect(manager.validateV2CompatibleLpToken('bad')).resolves.toEqual({
            valid: false,
            error: 'Invalid Ethereum address format'
        });
        expect(getCode).not.toHaveBeenCalled();
    });

    it('rejects EOAs and non-pair contracts', async () => {
        const manager = await loadContractManager(
            { getCode: vi.fn().mockResolvedValue('0x') },
            validPairContract()
        );
        await expect(manager.validateV2CompatibleLpToken(LP)).resolves.toEqual({
            valid: false,
            error: 'No contract code found at this address'
        });

        const brokenPair = {
            token0: vi.fn().mockRejectedValue(new Error('missing')),
            token1: vi.fn(),
            getReserves: vi.fn()
        };
        const brokenManager = await loadContractManager(
            { getCode: vi.fn().mockResolvedValue('0x6000') },
            brokenPair
        );
        await expect(brokenManager.validateV2CompatibleLpToken(LP)).resolves.toEqual({
            valid: false,
            error: 'This address does not appear to be a V2-compatible LP token contract'
        });
    });

    it('accepts V2-compatible pair contracts', async () => {
        const pairContract = validPairContract();
        const manager = await loadContractManager(
            { getCode: vi.fn().mockResolvedValue('0x6000') },
            pairContract
        );

        const result = await manager.validateV2CompatibleLpToken(LP);

        expect(result.valid).toBe(true);
        expect(result.address).toBe(LP);
        expect(result.token0).toBe(TOKEN0);
        expect(result.token1).toBe(TOKEN1);
        expect(result.reserve0.toString()).toBe('0');
        expect(result.reserve1.toString()).toBe('0');
    });

    it('rejects invalid underlying tokens and RPC failures', async () => {
        const invalidTokens = await loadContractManager(
            { getCode: vi.fn().mockResolvedValue('0x6000') },
            validPairContract(TOKEN0, TOKEN0)
        );
        await expect(invalidTokens.validateV2CompatibleLpToken(LP)).resolves.toEqual({
            valid: false,
            error: 'This address does not appear to be a V2-compatible LP token contract'
        });

        const rpcFailure = await loadContractManager(
            { getCode: vi.fn().mockRejectedValue(new Error('timeout')) },
            validPairContract()
        );
        await expect(rpcFailure.validateV2CompatibleLpToken(LP)).resolves.toEqual({
            valid: false,
            error: 'Unable to verify contract code. Check your network connection and try again.'
        });

        const pairReadFailure = await loadContractManager(
            { getCode: vi.fn().mockResolvedValue('0x6000') },
            {
                token0: vi.fn().mockRejectedValue(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })),
                token1: vi.fn(),
                getReserves: vi.fn()
            }
        );
        await expect(pairReadFailure.validateV2CompatibleLpToken(LP)).resolves.toEqual({
            valid: false,
            error: 'Unable to verify LP token contract. Check your network connection and try again.'
        });
    });
});

describe('ContractManager.getAllPairsInfo', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.ContractManager;
        delete globalThis.document;
        delete globalThis.ethers;
        delete globalThis.location;
        delete globalThis.window;
    });

    it('uses cached pairs unless a force refresh is requested', async () => {
        const manager = await loadContractManager(
            { getCode: vi.fn().mockResolvedValue('0x6000') },
            validPairContract()
        );
        const refreshedLp = '0x4444444444444444444444444444444444444444';
        const getPairs = vi.fn()
            .mockResolvedValueOnce([{ lpToken: LP, pairName: 'LIB/USDC', platform: 'Uniswap V2', isActive: true }])
            .mockResolvedValueOnce([{ lpToken: refreshedLp, pairName: 'LIB/USDT', platform: 'SushiSwap', isActive: true }]);

        manager.stakingContract = { getPairs };

        const initialPairs = await manager.getAllPairsInfo();
        const cachedPairs = await manager.getAllPairsInfo();
        const refreshedPairs = await manager.getAllPairsInfo({ forceRefresh: true });

        expect(getPairs).toHaveBeenCalledTimes(2);
        expect(initialPairs[0].address).toBe(LP);
        expect(cachedPairs[0].address).toBe(LP);
        expect(refreshedPairs[0].address).toBe(refreshedLp);
    });
});
