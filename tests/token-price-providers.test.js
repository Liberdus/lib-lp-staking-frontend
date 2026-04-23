import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadPriceProviders() {
    vi.resetModules();
    globalThis.window = globalThis;
    globalThis.global = globalThis;
    delete globalThis.GeckoTerminalPriceProvider;
    delete globalThis.DexScreenerPriceProvider;

    await import('../js/utils/pricing/gecko-terminal-price-provider.js');
    await import('../js/utils/pricing/dex-screener-price-provider.js');

    return {
        GeckoTerminalPriceProvider: globalThis.GeckoTerminalPriceProvider,
        DexScreenerPriceProvider: globalThis.DexScreenerPriceProvider
    };
}

describe('Token price providers', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn();
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.fetch;
        delete globalThis.GeckoTerminalPriceProvider;
        delete globalThis.DexScreenerPriceProvider;
        delete globalThis.window;
    });

    it('GeckoTerminalPriceProvider fetches a chain-specific token price by address', async () => {
        const { GeckoTerminalPriceProvider } = await loadPriceProviders();
        const provider = new GeckoTerminalPriceProvider();

        globalThis.fetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                data: {
                    attributes: {
                        token_prices: {
                            '0xAbC': '0.9876'
                        }
                    }
                }
            })
        });

        expect(await provider.fetchTokenPrice('0xabc', { chainId: 56 })).toBe(0.9876);
        expect(globalThis.fetch).toHaveBeenCalledWith('https://api.geckoterminal.com/api/v2/simple/networks/bsc/token_price/0xabc');
    });

    it('GeckoTerminalPriceProvider returns zero for unsupported pricing networks', async () => {
        const { GeckoTerminalPriceProvider } = await loadPriceProviders();
        const provider = new GeckoTerminalPriceProvider();

        expect(await provider.fetchTokenPrice('0xabc', { chainId: 80002 })).toBe(0);
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('DexScreenerPriceProvider selects the deepest-liquidity same-chain base-token pair', async () => {
        const { DexScreenerPriceProvider } = await loadPriceProviders();
        const provider = new DexScreenerPriceProvider();

        globalThis.fetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                pairs: [
                    {
                        chainId: 'bsc',
                        baseToken: { address: '0xother' },
                        quoteToken: { address: '0xabc' },
                        priceUsd: '13.45',
                        liquidity: { usd: 76300725.73 }
                    },
                    {
                        chainId: 'ethereum',
                        baseToken: { address: '0xabc' },
                        quoteToken: { address: '0xusd' },
                        priceUsd: '9.99',
                        liquidity: { usd: 99999999 }
                    },
                    {
                        chainId: 'bsc',
                        baseToken: { address: '0xabc' },
                        quoteToken: { address: '0xusd' },
                        priceUsd: '3.11',
                        liquidity: { usd: 1205785.98 }
                    },
                    {
                        chainId: 'bsc',
                        baseToken: { address: '0xABC' },
                        quoteToken: { address: '0xusd' },
                        priceUsd: '1.00042',
                        liquidity: { usd: 44962438.69 }
                    }
                ]
            })
        });

        expect(await provider.fetchTokenPrice('0xabc', { chainId: 56 })).toBe(1.00042);
        expect(globalThis.fetch).toHaveBeenCalledWith('https://api.dexscreener.com/latest/dex/tokens/0xabc');
    });

    it('DexScreenerPriceProvider returns zero when only cross-chain or quote-side matches exist', async () => {
        const { DexScreenerPriceProvider } = await loadPriceProviders();
        const provider = new DexScreenerPriceProvider();

        globalThis.fetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                pairs: [
                    {
                        chainId: 'polygon',
                        baseToken: { address: '0xabc' },
                        quoteToken: { address: '0xusd' },
                        priceUsd: '2.22',
                        liquidity: { usd: 99999 }
                    },
                    {
                        chainId: 'bsc',
                        baseToken: { address: '0xother' },
                        quoteToken: { address: '0xabc' },
                        priceUsd: '7.77',
                        liquidity: { usd: 99999 }
                    }
                ]
            })
        });

        expect(await provider.fetchTokenPrice('0xabc', { chainId: 56 })).toBe(0);
    });
});
