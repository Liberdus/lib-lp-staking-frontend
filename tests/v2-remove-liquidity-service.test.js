import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function toBigIntValue(value) {
    if (value instanceof MockBigNumber) {
        return value.value;
    }
    if (typeof value === 'bigint') {
        return value;
    }
    return BigInt(String(value));
}

class MockBigNumber {
    constructor(value) {
        this.value = BigInt(value);
    }

    mul(other) {
        return new MockBigNumber(this.value * toBigIntValue(other));
    }

    div(other) {
        return new MockBigNumber(this.value / toBigIntValue(other));
    }

    add(other) {
        return new MockBigNumber(this.value + toBigIntValue(other));
    }

    sub(other) {
        return new MockBigNumber(this.value - toBigIntValue(other));
    }

    gte(other) {
        return this.value >= toBigIntValue(other);
    }

    lt(other) {
        return this.value < toBigIntValue(other);
    }

    lte(other) {
        return this.value <= toBigIntValue(other);
    }

    eq(other) {
        return this.value === toBigIntValue(other);
    }

    isZero() {
        return this.value === 0n;
    }

    toString() {
        return this.value.toString();
    }
}

function bn(value) {
    return new MockBigNumber(value);
}

function unit(value, decimals = 18) {
    return BigInt(value) * (10n ** BigInt(decimals));
}

function formatUnits(value, decimals = 18) {
    const raw = toBigIntValue(value);
    const divisor = 10n ** BigInt(decimals);
    const integer = raw / divisor;
    const fraction = raw % divisor;
    if (fraction === 0n) {
        return integer.toString();
    }

    const fractionText = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${integer}.${fractionText}`;
}

const addresses = {
    lp: '0x1111111111111111111111111111111111111111',
    token0: '0x2222222222222222222222222222222222222222',
    token1: '0x3333333333333333333333333333333333333333',
    factory: '0x8909dc15e40173ff4699343b6eb8132c65e18ec6',
    router: '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24',
    unknownFactory: '0x9999999999999999999999999999999999999999',
    user: '0x4444444444444444444444444444444444444444'
};

async function loadService(contracts = {}) {
    vi.resetModules();
    globalThis.window = globalThis;
    globalThis.CONFIG = {
        DEX_REMOVE_LIQUIDITY: {
            56: {
                wrappedNative: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
                factories: {
                    [addresses.factory]: {
                        name: 'Uniswap V2',
                        type: 'uniswapV2',
                        router: addresses.router
                    }
                }
            }
        }
    };
    const Contract = vi.fn(function(address) {
        const contract = contracts[String(address).toLowerCase()];
        if (!contract) {
            throw new Error(`Missing contract fixture for ${address}`);
        }
        return contract;
    });

    globalThis.ethers = {
        BigNumber: { from: value => bn(value) },
        utils: { formatUnits },
        Contract
    };
    globalThis.console = console;
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await import('../js/services/v2-remove-liquidity-service.js');
    return globalThis.V2RemoveLiquidityService;
}

function createFixtures({ factory = addresses.factory, routerFactory = addresses.factory, allowance = unit(0) } = {}) {
    const approve = vi.fn().mockResolvedValue({ hash: '0xapprove', wait: vi.fn() });
    const removeLiquidity = vi.fn().mockResolvedValue({ hash: '0xremove', wait: vi.fn() });

    return {
        [addresses.lp]: {
            factory: vi.fn().mockResolvedValue(factory),
            token0: vi.fn().mockResolvedValue(addresses.token0),
            token1: vi.fn().mockResolvedValue(addresses.token1),
            getReserves: vi.fn().mockResolvedValue([bn(unit(10000)), bn(unit(5000)), 0]),
            totalSupply: vi.fn().mockResolvedValue(bn(unit(1000))),
            decimals: vi.fn().mockResolvedValue(18),
            allowance: vi.fn().mockResolvedValue(bn(allowance)),
            balanceOf: vi.fn().mockResolvedValue(bn(unit(10))),
            approve
        },
        [addresses.token0]: {
            symbol: vi.fn().mockResolvedValue('LIB'),
            name: vi.fn().mockResolvedValue('Liberdus'),
            decimals: vi.fn().mockResolvedValue(18)
        },
        [addresses.token1]: {
            symbol: vi.fn().mockResolvedValue('USDT'),
            name: vi.fn().mockResolvedValue('Tether USD'),
            decimals: vi.fn().mockResolvedValue(18)
        },
        [addresses.router]: {
            factory: vi.fn().mockResolvedValue(routerFactory),
            removeLiquidity
        },
        approve,
        removeLiquidity
    };
}

describe('V2RemoveLiquidityService', () => {
    beforeEach(() => {
        vi.useRealTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        delete globalThis.window;
        delete globalThis.CONFIG;
        delete globalThis.ethers;
        delete globalThis.V2RemoveLiquidityService;
    });

    it('matches an allowlisted factory and calculates output previews', async () => {
        const fixtures = createFixtures();
        const V2RemoveLiquidityService = await loadService(fixtures);
        const service = new V2RemoveLiquidityService();

        const preview = await service.getPreview({
            chainId: 56,
            lpTokenAddress: addresses.lp,
            liquidityRaw: bn(unit(10)),
            slippageBps: 50,
            provider: {}
        });

        expect(preview.supported).toBe(true);
        expect(preview.adapter.routerAddress).toBe(addresses.router);
        expect(preview.token0.amount.formatted).toBe('100');
        expect(preview.token1.amount.formatted).toBe('50');
        expect(preview.token0.minAmount.formatted).toBe('99.5');
        expect(preview.token1.minAmount.formatted).toBe('49.75');
    });

    it('returns unsupported metadata for unknown factories', async () => {
        const fixtures = createFixtures({ factory: addresses.unknownFactory });
        const V2RemoveLiquidityService = await loadService(fixtures);
        const service = new V2RemoveLiquidityService();

        const adapter = await service.getMatchedAdapter({
            chainId: 56,
            lpTokenAddress: addresses.lp,
            provider: {}
        });

        expect(adapter.supported).toBe(false);
        expect(adapter.factoryAddress).toBe(addresses.unknownFactory);
        expect(adapter.reason).toContain('not supported');
    });

    it('rejects configured routers whose factory does not match the LP factory', async () => {
        const fixtures = createFixtures({ routerFactory: addresses.unknownFactory });
        const V2RemoveLiquidityService = await loadService(fixtures);
        const service = new V2RemoveLiquidityService();

        await expect(service.getMatchedAdapter({
            chainId: 56,
            lpTokenAddress: addresses.lp,
            provider: {}
        })).rejects.toThrow('router does not match');
    });

    it('approves the router only when allowance is insufficient', async () => {
        const fixtures = createFixtures({ allowance: unit(1) });
        const V2RemoveLiquidityService = await loadService(fixtures);
        const service = new V2RemoveLiquidityService();
        const signer = { provider: {}, getAddress: vi.fn().mockResolvedValue(addresses.user) };

        const tx = await service.approveIfNeeded({
            lpTokenAddress: addresses.lp,
            spender: addresses.router,
            liquidityRaw: bn(unit(10)),
            signer
        });

        expect(tx.hash).toBe('0xapprove');
        expect(fixtures.approve).toHaveBeenCalledWith(addresses.router, expect.objectContaining({
            value: unit(10)
        }));
    });

    it('builds removeLiquidity transactions with token and min-output arguments', async () => {
        const fixtures = createFixtures();
        const V2RemoveLiquidityService = await loadService(fixtures);
        const service = new V2RemoveLiquidityService();

        const tx = await service.removeLiquidity({
            routerAddress: addresses.router,
            token0: addresses.token0,
            token1: addresses.token1,
            liquidityRaw: bn(unit(10)),
            amount0Min: bn(unit(99)),
            amount1Min: bn(unit(49)),
            recipient: addresses.user,
            deadline: 1777306663,
            signer: {}
        });

        expect(tx.hash).toBe('0xremove');
        expect(fixtures.removeLiquidity).toHaveBeenCalledWith(
            addresses.token0,
            addresses.token1,
            expect.objectContaining({ value: unit(10) }),
            expect.objectContaining({ value: unit(99) }),
            expect.objectContaining({ value: unit(49) }),
            addresses.user,
            1777306663
        );
    });

});
