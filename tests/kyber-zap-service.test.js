import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadKyberZapService() {
    vi.resetModules();

    globalThis.window = globalThis;
    globalThis.CONFIG = {
        KYBER_ZAP: {
            BASE_URL: 'https://zap-api.kyberswap.com',
            CLIENT_ID: 'liberdus-lp-staking',
            SOURCE: 'liberdus-lp-staking',
            NATIVE_TOKEN_ADDRESS: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            QUOTE_RATE_LIMIT_MAX_REQUESTS: 8,
            RATE_LIMIT_WINDOW_MS: 10000,
            NETWORKS: {
                BSC_MAINNET: {
                    CHAIN: 'bsc',
                    DEX: 'DEX_UNISWAPV2',
                    ROUTER_ADDRESS: '0x0e97C887b61cCd952a53578B04763E7134429e05'
                }
            }
        }
    };
    globalThis.console = console;

    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await import('../js/services/kyber-zap-rate-limiter.js');
    await import('../js/services/kyber-zap-service.js');
    return globalThis.KyberZapService;
}

function createJsonResponse({ ok = true, status = 200, payload = {} } = {}) {
    return {
        ok,
        status,
        json: vi.fn().mockResolvedValue(payload)
    };
}

describe('KyberZapService', () => {
    beforeEach(() => {
        vi.useRealTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        delete globalThis.window;
        delete globalThis.CONFIG;
        delete globalThis.fetch;
        delete globalThis.KyberZapRateLimitError;
        delete globalThis.KyberZapQuoteRateLimiter;
        delete globalThis.KyberZapService;
    });

    it('tries fallback DEX candidates and counts each quote HTTP request', async () => {
        const KyberZapService = await loadKyberZapService();
        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce(createJsonResponse({
                ok: false,
                status: 400,
                payload: { message: 'Pool does not belong to given dex id' }
            }))
            .mockResolvedValueOnce(createJsonResponse({
                payload: { data: { route: '0xroute' } }
            }));
        const service = new KyberZapService();

        const quote = await service.fetchQuote({
            networkConfig: {
                CHAIN: 'bsc',
                DEX: 'DEX_UNISWAPV2',
                DEX_CANDIDATES: ['DEX_PANCAKESWAPV2']
            },
            lpTokenAddress: '0xlp',
            walletAddress: '0xwallet',
            tokenAddress: '0xtoken',
            amountRaw: { toString: () => '100' },
            slippageBps: 50,
            platform: null
        });

        expect(quote.data.route).toBe('0xroute');
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        expect(service.quoteRateLimiter.timestamps).toHaveLength(2);
    });

    it('blocks quote HTTP requests when the Kyber quote window is exhausted', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-27T12:00:00Z'));
        const KyberZapService = await loadKyberZapService();
        globalThis.CONFIG.KYBER_ZAP.QUOTE_RATE_LIMIT_MAX_REQUESTS = 1;
        globalThis.fetch = vi.fn();
        const service = new KyberZapService();
        service.quoteRateLimiter.timestamps = [Date.now()];

        await expect(service.fetchQuote({
            networkConfig: { CHAIN: 'bsc', DEX: 'DEX_UNISWAPV2' },
            lpTokenAddress: '0xlp',
            walletAddress: '0xwallet',
            tokenAddress: '0xtoken',
            amountRaw: { toString: () => '100' },
            slippageBps: 50,
            platform: null
        })).rejects.toMatchObject({
            zapRateLimited: true,
            waitMs: 10000
        });

        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('builds Kyber zap routes through the build endpoint', async () => {
        const KyberZapService = await loadKyberZapService();
        globalThis.fetch = vi.fn().mockResolvedValue(createJsonResponse({
            payload: { data: { txData: '0xabcdef' } }
        }));
        const service = new KyberZapService();

        const build = await service.buildRoute({
            networkConfig: { CHAIN: 'bsc' },
            route: '0xroute',
            sender: '0xsender',
            recipient: '0xrecipient',
            deadline: 1777306663
        });

        expect(build.txData).toBe('0xabcdef');
        expect(globalThis.fetch).toHaveBeenCalledWith(
            'https://zap-api.kyberswap.com/bsc/api/v1/in/route/build',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    sender: '0xsender',
                    recipient: '0xrecipient',
                    route: '0xroute',
                    deadline: 1777306663,
                    source: 'liberdus-lp-staking'
                })
            })
        );
    });

    it('builds Kyber zap-out quote URLs with pool, position, liquidity, token out, and slippage', async () => {
        const KyberZapService = await loadKyberZapService();
        globalThis.fetch = vi.fn().mockResolvedValue(createJsonResponse({
            payload: { data: { route: '0xout' } }
        }));
        const service = new KyberZapService();

        const quote = await service.fetchOutQuote({
            networkConfig: { CHAIN: 'bsc', DEX: 'DEX_UNISWAPV2' },
            lpTokenAddress: '0xlp',
            walletAddress: '0xwallet',
            tokenOutAddress: '0xouttoken',
            liquidityRaw: { toString: () => '500' },
            slippageBps: 75,
            platform: null
        });

        expect(quote.data.route).toBe('0xout');
        expect(globalThis.fetch).toHaveBeenCalledWith(
            'https://zap-api.kyberswap.com/bsc/api/v1/out/route?dexFrom=DEX_UNISWAPV2&poolFrom.id=0xlp&positionFrom.id=0xwallet&liquidityOut=500&tokenOut=0xouttoken&slippage=75',
            expect.objectContaining({
                headers: expect.objectContaining({
                    accept: 'application/json',
                    'x-client-id': 'liberdus-lp-staking'
                })
            })
        );
    });

    it('tries fallback DEX candidates for Kyber zap-out quotes', async () => {
        const KyberZapService = await loadKyberZapService();
        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce(createJsonResponse({
                ok: false,
                status: 400,
                payload: { message: 'Pool does not belong to given dex id' }
            }))
            .mockResolvedValueOnce(createJsonResponse({
                payload: { data: { route: '0xout' } }
            }));
        const service = new KyberZapService();

        const quote = await service.fetchOutQuote({
            networkConfig: {
                CHAIN: 'bsc',
                DEX: 'DEX_UNISWAPV2',
                DEX_CANDIDATES: ['DEX_PANCAKESWAPV2']
            },
            lpTokenAddress: '0xlp',
            walletAddress: '0xwallet',
            tokenOutAddress: '0xouttoken',
            liquidityRaw: { toString: () => '500' },
            slippageBps: 75,
            platform: null
        });

        expect(quote.data.route).toBe('0xout');
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        expect(globalThis.fetch.mock.calls[0][0]).toContain('dexFrom=DEX_UNISWAPV2');
        expect(globalThis.fetch.mock.calls[1][0]).toContain('dexFrom=DEX_PANCAKESWAPV2');
    });

    it('builds Kyber zap-out routes through the out build endpoint', async () => {
        const KyberZapService = await loadKyberZapService();
        globalThis.fetch = vi.fn().mockResolvedValue(createJsonResponse({
            payload: { data: { txData: '0xabcdef' } }
        }));
        const service = new KyberZapService();

        const build = await service.buildOutRoute({
            networkConfig: { CHAIN: 'bsc' },
            route: '0xout',
            sender: '0xsender',
            recipient: '0xrecipient',
            deadline: 1777306663
        });

        expect(build.txData).toBe('0xabcdef');
        expect(globalThis.fetch).toHaveBeenCalledWith(
            'https://zap-api.kyberswap.com/bsc/api/v1/out/route/build',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    sender: '0xsender',
                    recipient: '0xrecipient',
                    route: '0xout',
                    deadline: 1777306663,
                    source: 'liberdus-lp-staking'
                })
            })
        );
    });

    it('fetches and caches GeckoTerminal token market metadata', async () => {
        const KyberZapService = await loadKyberZapService();
        globalThis.fetch = vi.fn().mockResolvedValue(createJsonResponse({
            payload: {
                data: {
                    attributes: {
                        address: '0xabc',
                        symbol: 'ABC',
                        name: 'ABC Token',
                        image_url: 'https://assets.geckoterminal.com/abc',
                        coingecko_coin_id: 'abc-token'
                    }
                }
            }
        }));
        const service = new KyberZapService();

        const firstResult = await service.getTokenMarketMetadata('0xAbC', { CHAIN: 'bsc' });
        const secondResult = await service.getTokenMarketMetadata('0xAbC', { CHAIN: 'bsc' });

        expect(firstResult).toEqual({
            address: '0xabc',
            symbol: 'ABC',
            name: 'ABC Token',
            imageUrl: 'https://assets.geckoterminal.com/abc',
            coingeckoCoinId: 'abc-token'
        });
        expect(secondResult).toBe(firstResult);
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(globalThis.fetch).toHaveBeenCalledWith(
            'https://api.geckoterminal.com/api/v2/networks/bsc/tokens/0xabc',
            { headers: { accept: 'application/json' } }
        );
    });

    it('rejects unexpected Kyber router addresses', async () => {
        const KyberZapService = await loadKyberZapService();
        const service = new KyberZapService();

        expect(() => service.validateRouterAddress(
            '0x1111111111111111111111111111111111111111',
            { ROUTER_ADDRESS: '0x0e97C887b61cCd952a53578B04763E7134429e05' }
        )).toThrow('Kyber returned an unexpected zap router');
    });
});
