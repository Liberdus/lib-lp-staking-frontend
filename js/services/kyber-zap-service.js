/**
 * KyberZapService - Kyber Zap API integration and quote request protection.
 */
(function(global) {
    'use strict';

    if (global.KyberZapService) {
        console.warn('KyberZapService already exists, skipping redeclaration');
        return;
    }

    class KyberZapRateLimitError extends Error {
        constructor(message, waitMs) {
            super(message);
            this.name = 'KyberZapRateLimitError';
            this.zapRateLimited = true;
            this.waitMs = waitMs;
        }
    }

    class KyberZapService {
        constructor(options = {}) {
            this.global = options.global || global;
            this.fetchImpl = options.fetchImpl || ((...args) => this.global.fetch(...args));
            this.now = options.now || (() => Date.now());
            this.poolDexCache = new Map();
            this.tokenMeta = {};
            this.quoteRequestTimestamps = [];
        }

        getConfig() {
            return this.global.CONFIG?.KYBER_ZAP || {};
        }

        getCurrentNetworkKey() {
            const networkSelector = this.global.networkSelector;
            return networkSelector?.getCurrentNetwork?.()
                || networkSelector?.getSelectedNetworkKey?.()
                || networkSelector?.currentNetwork
                || 'BSC_MAINNET';
        }

        getNetworkConfig(networkKey = this.getCurrentNetworkKey()) {
            return this.getConfig()?.NETWORKS?.[networkKey] || null;
        }

        getProvider() {
            return this.global.contractManager?.provider || this.global.walletManager?.provider || null;
        }

        isNativeToken(address) {
            return !address || address === 'native' || address === this.getConfig()?.NATIVE_TOKEN_ADDRESS;
        }

        normalizeAddress(address) {
            return typeof address === 'string' ? address.toLowerCase() : '';
        }

        getRouteData(quote) {
            return quote?.data || quote || null;
        }

        getRouteEncoded(quote) {
            const data = this.getRouteData(quote);
            return data?.route || data?.routeData || data?.encodedRoute || null;
        }

        getRouterAddress(source) {
            const data = source || null;
            return data?.routerAddress || data?.router || data?.to || data?.tx?.to || data?.transaction?.to || null;
        }

        getExpectedRouterAddress(networkConfig = this.getNetworkConfig()) {
            return networkConfig?.ROUTER_ADDRESS || null;
        }

        validateRouterAddress(routerAddress, networkConfig = this.getNetworkConfig()) {
            const expectedRouter = this.getExpectedRouterAddress(networkConfig);
            if (!expectedRouter || !routerAddress) {
                return;
            }

            if (this.normalizeAddress(routerAddress) !== this.normalizeAddress(expectedRouter)) {
                throw new Error('Kyber returned an unexpected zap router. Refresh the quote and try again.');
            }
        }

        getQuoteRequestKey({ networkKey, walletAddress, lpTokenAddress, tokenAddress, amountRaw, slippageBps }) {
            return [
                networkKey || this.getCurrentNetworkKey(),
                walletAddress || '',
                String(lpTokenAddress || '').toLowerCase(),
                String(tokenAddress || '').toLowerCase(),
                amountRaw?.toString?.() || String(amountRaw || ''),
                slippageBps
            ].join('|');
        }

        getQuoteRateLimitMaxRequests() {
            return Number(this.getConfig()?.QUOTE_RATE_LIMIT_MAX_REQUESTS) || 8;
        }

        getQuoteRateLimitWindowMs() {
            return Number(this.getConfig()?.RATE_LIMIT_WINDOW_MS) || 10000;
        }

        pruneQuoteRequestTimestamps(now = this.now()) {
            const windowMs = this.getQuoteRateLimitWindowMs();
            this.quoteRequestTimestamps = this.quoteRequestTimestamps.filter(timestamp => now - timestamp < windowMs);
        }

        getQuoteRateLimitWaitMs(now = this.now()) {
            this.pruneQuoteRequestTimestamps(now);

            if (this.quoteRequestTimestamps.length < this.getQuoteRateLimitMaxRequests()) {
                return 0;
            }

            const oldestRequest = this.quoteRequestTimestamps[0];
            return Math.max(0, this.getQuoteRateLimitWindowMs() - (now - oldestRequest));
        }

        reserveQuoteRequestSlot(now = this.now()) {
            const waitMs = this.getQuoteRateLimitWaitMs(now);
            if (waitMs > 0) {
                return { allowed: false, waitMs };
            }

            this.quoteRequestTimestamps.push(now);
            return { allowed: true, waitMs: 0 };
        }

        getQuoteRateLimitMessage(waitMs = this.getQuoteRateLimitWaitMs()) {
            const seconds = Math.max(1, Math.ceil(waitMs / 1000));
            return `Quote refresh paused to avoid Kyber rate limits. Try again in ${seconds}s.`;
        }

        createRateLimitError(waitMs) {
            return new KyberZapRateLimitError(this.getQuoteRateLimitMessage(waitMs), waitMs);
        }

        async getPoolFactoryAddress(poolAddress, provider = this.getProvider()) {
            if (!poolAddress || !this.global.ethers) return null;

            const normalizedPool = poolAddress.toLowerCase();
            if (this.poolDexCache.has(normalizedPool)) {
                return this.poolDexCache.get(normalizedPool);
            }

            if (!provider) return null;

            try {
                const pairAbi = ['function factory() view returns (address)'];
                const pairContract = new this.global.ethers.Contract(poolAddress, pairAbi, provider);
                const factoryAddress = await pairContract.factory();
                const normalizedFactory = factoryAddress?.toLowerCase?.() || null;
                this.poolDexCache.set(normalizedPool, normalizedFactory);
                return normalizedFactory;
            } catch (error) {
                console.warn('Unable to detect zap pool factory:', error.message);
                this.poolDexCache.set(normalizedPool, null);
                return null;
            }
        }

        async getDexCandidates({ networkConfig, poolAddress, platform }) {
            const candidates = [];
            const addCandidate = (dexId) => {
                if (dexId && !candidates.includes(dexId)) {
                    candidates.push(dexId);
                }
            };

            if (platform && networkConfig.PLATFORM_DEX_IDS?.[platform]) {
                addCandidate(networkConfig.PLATFORM_DEX_IDS[platform]);
            }

            const factoryAddress = await this.getPoolFactoryAddress(poolAddress);
            if (factoryAddress && networkConfig.FACTORY_DEX_IDS?.[factoryAddress]) {
                addCandidate(networkConfig.FACTORY_DEX_IDS[factoryAddress]);
            }

            addCandidate(networkConfig.DEX);
            (networkConfig.DEX_CANDIDATES || []).forEach(addCandidate);
            return candidates;
        }

        async getTokenMetadata(address, provider = this.getProvider()) {
            if (!address || !this.global.ethers) return null;

            const normalized = address.toLowerCase();
            if (this.tokenMeta?.[normalized]) {
                return this.tokenMeta[normalized];
            }

            if (!provider) return null;

            const abi = [
                'function symbol() view returns (string)',
                'function name() view returns (string)',
                'function decimals() view returns (uint8)'
            ];

            try {
                const contract = new this.global.ethers.Contract(address, abi, provider);
                const [symbol, name, decimals] = await Promise.all([
                    contract.symbol().catch(() => 'TOKEN'),
                    contract.name().catch(() => 'Token'),
                    contract.decimals().catch(() => 18)
                ]);
                const meta = { address, symbol, name, decimals: Number(decimals) || 18 };
                this.tokenMeta[normalized] = meta;
                return meta;
            } catch (error) {
                console.warn('Unable to load token metadata:', address, error.message);
                return { address, symbol: 'TOKEN', name: 'Token', decimals: 18 };
            }
        }

        async getPairTokenMetadata(lpTokenAddress, provider = this.getProvider()) {
            if (!lpTokenAddress || !provider || !this.global.ethers) {
                return [];
            }

            try {
                const pairAbi = [
                    'function token0() view returns (address)',
                    'function token1() view returns (address)'
                ];
                const pairContract = new this.global.ethers.Contract(lpTokenAddress, pairAbi, provider);
                const [token0, token1] = await Promise.all([
                    pairContract.token0(),
                    pairContract.token1()
                ]);
                return (await Promise.all([
                    this.getTokenMetadata(token0, provider),
                    this.getTokenMetadata(token1, provider)
                ])).filter(Boolean);
            } catch (error) {
                console.warn('Unable to load LP pair tokens for zap:', error.message);
                return [];
            }
        }

        async fetchQuote({ networkConfig, lpTokenAddress, walletAddress, tokenAddress, amountRaw, slippageBps, platform }) {
            const initialRateLimitWaitMs = this.getQuoteRateLimitWaitMs();
            if (initialRateLimitWaitMs > 0) {
                throw this.createRateLimitError(initialRateLimitWaitMs);
            }

            const baseUrl = this.getConfig()?.BASE_URL || 'https://zap-api.kyberswap.com';
            const dexCandidates = await this.getDexCandidates({ networkConfig, poolAddress: lpTokenAddress, platform });
            let payload = null;
            let lastError = null;

            for (const dexId of dexCandidates) {
                const rateLimit = this.reserveQuoteRequestSlot();
                if (!rateLimit.allowed) {
                    throw this.createRateLimitError(rateLimit.waitMs);
                }

                const params = new URLSearchParams({
                    dex: dexId,
                    'pool.id': lpTokenAddress,
                    'position.id': walletAddress,
                    tokensIn: tokenAddress,
                    amountsIn: amountRaw.toString(),
                    slippage: slippageBps.toString()
                });

                const url = `${baseUrl}/${networkConfig.CHAIN}/api/v1/in/route?${params.toString()}`;
                const response = await this.fetchImpl(url, {
                    headers: {
                        accept: 'application/json',
                        'x-client-id': this.getConfig()?.CLIENT_ID || 'liberdus-lp-staking'
                    }
                });
                const candidatePayload = await response.json().catch(() => ({}));
                const failed = !response.ok || (candidatePayload.code && candidatePayload.code !== 0 && candidatePayload.code !== 200);

                if (!failed) {
                    payload = candidatePayload;
                    break;
                }

                lastError = new Error(candidatePayload.message || `Kyber quote failed with status ${response.status}`);
                const canTryNextDex = /invalid pool|does not belong to given dex id/i.test(lastError.message);
                if (!canTryNextDex) {
                    break;
                }
            }

            if (!payload) {
                throw lastError || new Error('Unable to fetch a Kyber zap quote.');
            }

            return payload;
        }

        async buildRoute({ networkConfig, route, sender, recipient = sender, deadline }) {
            if (!networkConfig) {
                throw new Error('Zap is not available on this network.');
            }

            if (!route) {
                throw new Error('Kyber route is missing. Refresh the quote and try again.');
            }

            const baseUrl = this.getConfig()?.BASE_URL || 'https://zap-api.kyberswap.com';
            const response = await this.fetchImpl(`${baseUrl}/${networkConfig.CHAIN}/api/v1/in/route/build`, {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    'content-type': 'application/json',
                    'x-client-id': this.getConfig()?.CLIENT_ID || 'liberdus-lp-staking'
                },
                body: JSON.stringify({
                    sender,
                    recipient,
                    route,
                    deadline,
                    source: this.getConfig()?.SOURCE || 'liberdus-lp-staking'
                })
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok || (payload.code && payload.code !== 0 && payload.code !== 200)) {
                throw new Error(payload.message || `Kyber build failed with status ${response.status}`);
            }

            return payload?.data || payload;
        }
    }

    global.KyberZapRateLimitError = KyberZapRateLimitError;
    global.KyberZapService = KyberZapService;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { KyberZapService, KyberZapRateLimitError };
    }
})(typeof window !== 'undefined' ? window : globalThis);
