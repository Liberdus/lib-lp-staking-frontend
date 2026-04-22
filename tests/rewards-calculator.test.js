import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadRewardsCalculator() {
    vi.resetModules();
    globalThis.window = globalThis;
    globalThis.global = globalThis;
    delete globalThis.RewardsCalculator;
    delete globalThis.rewardsCalculator;

    await import('../js/utils/rewards-calculator.js');
    return new globalThis.RewardsCalculator();
}

describe('RewardsCalculator', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn();
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.fetch;
        delete globalThis.RewardsCalculator;
        delete globalThis.rewardsCalculator;
        delete globalThis.window;
    });

    it.each([
        {
            hourlyRate: 0.01,
            tvlLpTokens: 10,
            libPerLp: 10,
            poolWeight: 70,
            totalWeight: 100,
            expected: 61.32
        },
        {
            hourlyRate: 0.01,
            tvlLpTokens: 10,
            libPerLp: 10,
            poolWeight: 30,
            totalWeight: 100,
            expected: 26.28
        },
        {
            hourlyRate: 0.01,
            tvlLpTokens: 10,
            libPerLp: 10,
            poolWeight: 0,
            totalWeight: 100,
            expected: 0
        }
    ])('calcAPR($poolWeight / $totalWeight) -> $expected', async ({
        hourlyRate,
        tvlLpTokens,
        libPerLp,
        poolWeight,
        totalWeight,
        expected
    }) => {
        const calculator = await loadRewardsCalculator();

        if (expected === 0) {
            expect(calculator.calcAPR(hourlyRate, tvlLpTokens, libPerLp, poolWeight, totalWeight)).toBe(0);
            return;
        }

        expect(calculator.calcAPR(hourlyRate, tvlLpTokens, libPerLp, poolWeight, totalWeight)).toBeCloseTo(expected);
    });

    it.each([
        {
            input: {
                token0Staked: 0,
                token1Staked: 0,
                token0PriceUsd: 0,
                token1PriceUsd: 0
            },
            expected: 0
        },
        {
            input: {
                token0Staked: 10,
                token1Staked: 2,
                token0PriceUsd: 5,
                token1PriceUsd: 0
            },
            expected: null
        },
        {
            input: {
                token0Staked: 10,
                token1Staked: 0,
                token0PriceUsd: 5,
                token1PriceUsd: 0
            },
            expected: 50
        }
    ])('calculateTvlUsd($input.token0Staked, $input.token1Staked) -> $expected', async ({ input, expected }) => {
        const calculator = await loadRewardsCalculator();

        if (expected === null) {
            expect(calculator.calculateTvlUsd(input)).toBeNull();
            return;
        }

        expect(calculator.calculateTvlUsd(input)).toBe(expected);
    });

    it('caches repeated token price lookups by normalized address', async () => {
        const calculator = await loadRewardsCalculator();
        globalThis.fetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                pairs: [{ priceUsd: '1.23' }]
            })
        });

        const first = await calculator.fetchTokenPriceByAddress('0xABC');
        const second = await calculator.fetchTokenPriceByAddress('0xabc');

        expect(first).toBe(1.23);
        expect(second).toBe(1.23);
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(globalThis.fetch).toHaveBeenCalledWith('https://api.dexscreener.com/latest/dex/tokens/0xabc');
    });

    it('returns zero and does not cache failed or zero-priced lookups', async () => {
        const calculator = await loadRewardsCalculator();

        globalThis.fetch
            .mockResolvedValueOnce({
                ok: false,
                status: 500
            })
            .mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    pairs: [{ priceUsd: '0' }]
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    pairs: [{ priceUsd: '0' }]
                })
            });

        expect(await calculator.fetchTokenPriceByAddress('0xdef')).toBe(0);
        expect(await calculator.fetchTokenPriceByAddress('0xzero')).toBe(0);
        expect(await calculator.fetchTokenPriceByAddress('0xzero')).toBe(0);
        expect(await calculator.fetchTokenPriceByAddress('')).toBe(0);

        expect(globalThis.fetch).toHaveBeenCalledTimes(3);
        expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it('builds pool metrics for a reward token on token0', async () => {
        const calculator = await loadRewardsCalculator();
        const metrics = calculator.buildPoolMetrics({
            rewardTokenAddress: '0xlib',
            hourlyRate: 0.01,
            poolWeight: 70,
            totalWeight: 100,
            token0PriceUsd: 0.5,
            token1PriceUsd: 2000,
            breakdown: {
                lpToken: {
                    stakedBalance: { formatted: '10' }
                },
                token0: {
                    address: '0xlib',
                    staked: { formatted: '50' },
                    reserve: { formatted: '500' }
                },
                token1: {
                    address: '0xweth',
                    staked: { formatted: '0.2' },
                    reserve: { formatted: '2' }
                }
            }
        });

        expect(metrics.isSupportedPair).toBe(true);
        expect(metrics.rewardTokenPerLp).toBeCloseTo(10);
        expect(metrics.tvlUsd).toBeCloseTo(425);
        expect(metrics.apr).toBeCloseTo(61.32);
    });

    it('builds pool metrics for a reward token on token1 and preserves a zero-weight pool', async () => {
        const calculator = await loadRewardsCalculator();
        const metrics = calculator.buildPoolMetrics({
            rewardTokenAddress: '0xlib',
            hourlyRate: 1,
            poolWeight: 0,
            totalWeight: 100,
            token0PriceUsd: 2500,
            token1PriceUsd: 0.4,
            breakdown: {
                lpToken: {
                    stakedBalance: { formatted: '20' }
                },
                token0: {
                    address: '0xweth',
                    staked: { formatted: '1' },
                    reserve: { formatted: '10' }
                },
                token1: {
                    address: '0xlib',
                    staked: { formatted: '250' },
                    reserve: { formatted: '2500' }
                }
            }
        });

        expect(metrics.isSupportedPair).toBe(true);
        expect(metrics.rewardTokenStaked).toBe(250);
        expect(metrics.counterTokenRewardEquivalent).toBe(250);
        expect(metrics.rewardTokenPerLp).toBe(25);
        expect(metrics.tvlUsd).toBeCloseTo(2600);
        expect(metrics.apr).toBe(0);
    });

    it('returns safe defaults for unsupported pairs and unresolved USD pricing', async () => {
        const calculator = await loadRewardsCalculator();

        const unsupportedMetrics = calculator.buildPoolMetrics({
            rewardTokenAddress: '0xlib',
            token0PriceUsd: 2,
            token1PriceUsd: 5,
            breakdown: {
                lpToken: {
                    stakedBalance: { formatted: '3' }
                },
                token0: {
                    address: '0xaaa',
                    staked: { formatted: '4' },
                    reserve: { formatted: '40' }
                },
                token1: {
                    address: '0xbbb',
                    staked: { formatted: '6' },
                    reserve: { formatted: '60' }
                }
            }
        });

        const unresolvedPricingMetrics = calculator.buildPoolMetrics({
            rewardTokenAddress: '0xlib',
            token0PriceUsd: 1,
            token1PriceUsd: 0,
            breakdown: {
                lpToken: {
                    stakedBalance: { formatted: '5' }
                },
                token0: {
                    address: '0xlib',
                    staked: { formatted: '10' },
                    reserve: { formatted: '100' }
                },
                token1: {
                    address: '0xusdc',
                    staked: { formatted: '10' },
                    reserve: { formatted: '100' }
                }
            }
        });

        expect(unsupportedMetrics.isSupportedPair).toBe(false);
        expect(unsupportedMetrics.apr).toBe(0);
        expect(unsupportedMetrics.tvlUsd).toBe(38);

        expect(unresolvedPricingMetrics.isSupportedPair).toBe(true);
        expect(unresolvedPricingMetrics.tvlUsd).toBeNull();
        expect(unresolvedPricingMetrics.rewardTokenPerLp).toBeCloseTo(4);
    });
});
