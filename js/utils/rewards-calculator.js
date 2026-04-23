/**
 * RewardsCalculator - Minimal APR helper used by the active homepage flow.
 */
(function(global) {
    'use strict';

    if (global.RewardsCalculator) {
        console.warn('RewardsCalculator already registered, skipping redeclaration');
        return;
    }

    if (global.rewardsCalculator) {
        console.warn('RewardsCalculator instance already exists, preserving existing instance');
        return;
    }

    class RewardsCalculator {
        constructor() {
            this.contractManager = null;
            this.isInitialized = false;
            this.priceCache = new Map();
            this.priceCacheTtlMs = 5 * 60 * 1000;
            this.dexScreenerBaseUrl = 'https://api.dexscreener.com/latest/dex/tokens';
        }

        async initialize(contractManagerOrOptions) {
            const { contractManager } = this.normalizeInitArgs(contractManagerOrOptions);

            this.contractManager = contractManager || null;
            this.isInitialized = true;

            return {
                hasContractManager: !!this.contractManager
            };
        }

        normalizeInitArgs(contractManagerOrOptions) {
            if (contractManagerOrOptions && typeof contractManagerOrOptions === 'object' && !Array.isArray(contractManagerOrOptions)) {
                const hasOptionsShape = Object.prototype.hasOwnProperty.call(contractManagerOrOptions, 'contractManager');

                if (hasOptionsShape) {
                    return {
                        contractManager: contractManagerOrOptions.contractManager
                    };
                }
            }

            return {
                contractManager: contractManagerOrOptions
            };
        }

        /**
         * Calculate APR from the on-chain LIB-per-LP ratio.
         *
         * @param {number} hourlyRate - Total LIB distributed per hour across all pools.
         * @param {number} tvlLpTokens - Total LP tokens staked in this pool (formatted, not wei).
         * @param {number} libPerLp - LIB-equivalent value backing one LP token.
         * @param {number} [poolWeight=1] - Pool-specific weight used for reward distribution.
         * @param {number} [totalWeight=1] - Sum of all pool weights.
         * @returns {number} APR percentage (e.g., 150 equals 150%).
         */
        calcAPR(hourlyRate, tvlLpTokens, libPerLp, poolWeight = 1, totalWeight = 1) {
            if (!hourlyRate || !tvlLpTokens || !libPerLp || !poolWeight || !totalWeight) {
                return 0;
            }

            const pairPct = poolWeight / totalWeight;
            if (pairPct <= 0) {
                return 0;
            }

            const annualRewards = hourlyRate * 8760 * pairPct;
            return (annualRewards / (tvlLpTokens * libPerLp)) * 100;
        }

        normalizeAddress(address) {
            return typeof address === 'string' ? address.toLowerCase() : null;
        }

        parseAmount(value) {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : 0;
        }

        getCurrentDexScreenerChainContext() {
            const chainId = Number(globalThis?.window?.networkSelector?.getCurrentChainId?.());

            if (!Number.isFinite(chainId) || chainId <= 0) {
                return {
                    dexScreenerChainId: null,
                    isSupported: null
                };
            }

            switch (chainId) {
                case 56:
                    return { dexScreenerChainId: 'bsc', isSupported: true };
                case 137:
                    return { dexScreenerChainId: 'polygon', isSupported: true };
                case 97:
                case 80002:
                    return { dexScreenerChainId: null, isSupported: false };
                default:
                    return {
                        dexScreenerChainId: null,
                        isSupported: null
                    };
            }
        }

        getPriceCacheKey(address, dexScreenerChainId = null) {
            return `${dexScreenerChainId || 'any'}:${address}`;
        }

        getCachedTokenPrice(address, dexScreenerChainId = null) {
            const cacheKey = this.getPriceCacheKey(address, dexScreenerChainId);
            const cachedEntry = this.priceCache.get(cacheKey);
            if (!cachedEntry) {
                return null;
            }

            const cacheAgeMs = Date.now() - cachedEntry.timestamp;
            return cacheAgeMs < this.priceCacheTtlMs ? cachedEntry.price : null;
        }

        setCachedTokenPrice(address, dexScreenerChainId, price) {
            if (price <= 0) {
                return;
            }

            const cacheKey = this.getPriceCacheKey(address, dexScreenerChainId);
            this.priceCache.set(cacheKey, {
                price,
                timestamp: Date.now()
            });
        }

        getDexScreenerPairLiquidityUsd(pair) {
            return this.parseAmount(pair?.liquidity?.usd);
        }

        getBestDexScreenerPair(address, data, dexScreenerChainId = null) {
            const normalizedAddress = this.normalizeAddress(address);
            const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
            const pricedPairs = pairs.filter((pair) => {
                const priceUsd = Number.parseFloat(pair?.priceUsd || '0') || 0;
                if (priceUsd <= 0) {
                    return false;
                }

                const baseTokenAddress = this.normalizeAddress(pair?.baseToken?.address);
                return !normalizedAddress || baseTokenAddress === normalizedAddress;
            });

            if (pricedPairs.length === 0) {
                return null;
            }

            const sameChainPairs = dexScreenerChainId
                ? pricedPairs.filter((pair) => pair?.chainId === dexScreenerChainId)
                : pricedPairs;
            const candidatePairs = sameChainPairs.length > 0 ? sameChainPairs : pricedPairs;

            return candidatePairs.reduce((bestPair, pair) => {
                if (!bestPair) {
                    return pair;
                }

                const bestLiquidityUsd = this.getDexScreenerPairLiquidityUsd(bestPair);
                const pairLiquidityUsd = this.getDexScreenerPairLiquidityUsd(pair);

                if (pairLiquidityUsd > bestLiquidityUsd) {
                    return pair;
                }

                return bestPair;
            }, null);
        }

        parseDexScreenerPriceUsd(address, data, dexScreenerChainId = null) {
            const bestPair = this.getBestDexScreenerPair(address, data, dexScreenerChainId);
            return Number.parseFloat(bestPair?.priceUsd || '0') || 0;
        }

        async requestTokenPriceByAddress(address, dexScreenerChainId = null) {
            const response = await fetch(`${this.dexScreenerBaseUrl}/${address}`);
            if (!response.ok) {
                throw new Error(`DexScreener price request failed: ${response.status}`);
            }

            const data = await response.json();
            return this.parseDexScreenerPriceUsd(address, data, dexScreenerChainId);
        }

        async fetchTokenPriceByAddress(address) {
            const normalizedAddress = this.normalizeAddress(address);
            const chainContext = this.getCurrentDexScreenerChainContext();

            if (!normalizedAddress || typeof fetch !== 'function' || chainContext.isSupported === false) {
                return 0;
            }

            const cachedPrice = this.getCachedTokenPrice(normalizedAddress, chainContext.dexScreenerChainId);
            if (cachedPrice !== null) {
                return cachedPrice;
            }

            try {
                const price = await this.requestTokenPriceByAddress(normalizedAddress, chainContext.dexScreenerChainId);
                this.setCachedTokenPrice(normalizedAddress, chainContext.dexScreenerChainId, price);
                return price;
            } catch (error) {
                console.warn(`Failed to fetch token price for ${normalizedAddress}:`, error?.message || error);
                return 0;
            }
        }

        buildPoolMetrics({
            breakdown,
            rewardTokenAddress,
            hourlyRate = 0,
            poolWeight = 1,
            totalWeight = 1,
            token0PriceUsd = 0,
            token1PriceUsd = 0
        }) {
            if (!breakdown) {
                return {
                    isValid: false,
                    isSupportedPair: false,
                    tvlLpTokens: 0,
                    token0Staked: 0,
                    token1Staked: 0,
                    rewardTokenPerLp: 0,
                    rewardTokenStaked: 0,
                    counterTokenStaked: 0,
                    counterTokenRewardEquivalent: 0,
                    totalStakeValueInRewardToken: 0,
                    token0PriceUsd: 0,
                    token1PriceUsd: 0,
                    tvlUsd: null,
                    apr: 0
                };
            }

            const tvlLpTokens = this.parseAmount(breakdown?.lpToken?.stakedBalance?.formatted);
            const rewardTokenAddressLower = this.normalizeAddress(rewardTokenAddress);
            const token0 = breakdown?.token0 || null;
            const token1 = breakdown?.token1 || null;
            const token0Address = this.normalizeAddress(token0?.address);
            const token1Address = this.normalizeAddress(token1?.address);

            let rewardToken = null;
            if (rewardTokenAddressLower && token0Address === rewardTokenAddressLower) {
                rewardToken = token0;
            } else if (rewardTokenAddressLower && token1Address === rewardTokenAddressLower) {
                rewardToken = token1;
            }

            if (!rewardToken) {
                const token0Staked = this.parseAmount(token0?.staked?.formatted);
                const token1Staked = this.parseAmount(token1?.staked?.formatted);
                const tvlUsd = this.calculateTvlUsd({
                    token0Staked,
                    token1Staked,
                    token0PriceUsd,
                    token1PriceUsd
                });

                return {
                    isValid: false,
                    isSupportedPair: false,
                    tvlLpTokens,
                    token0Staked,
                    token1Staked,
                    rewardTokenPerLp: 0,
                    rewardTokenStaked: 0,
                    counterTokenStaked: 0,
                    counterTokenRewardEquivalent: 0,
                    totalStakeValueInRewardToken: 0,
                    token0PriceUsd,
                    token1PriceUsd,
                    tvlUsd,
                    apr: 0
                };
            }

            const token0Staked = this.parseAmount(token0?.staked?.formatted);
            const token1Staked = this.parseAmount(token1?.staked?.formatted);
            const rewardTokenStaked = this.parseAmount(rewardToken?.staked?.formatted);
            const rewardTokenReserve = this.parseAmount(rewardToken?.reserve?.formatted);
            const counterToken = rewardToken === token0 ? token1 : token0;
            const counterTokenStaked = this.parseAmount(counterToken?.staked?.formatted);
            const counterTokenReserve = this.parseAmount(counterToken?.reserve?.formatted);

            let counterTokenRewardEquivalent = 0;
            if (counterTokenStaked > 0 && counterTokenReserve > 0 && rewardTokenReserve > 0) {
                const counterToRewardRate = rewardTokenReserve / counterTokenReserve;
                counterTokenRewardEquivalent = counterTokenStaked * counterToRewardRate;
            }

            const totalStakeValueInRewardToken = rewardTokenStaked + counterTokenRewardEquivalent;
            const rewardTokenPerLp = tvlLpTokens > 0 ? totalStakeValueInRewardToken / tvlLpTokens : 0;
            const tvlUsd = this.calculateTvlUsd({
                token0Staked,
                token1Staked,
                token0PriceUsd,
                token1PriceUsd
            });
            const apr = this.calcAPR(
                hourlyRate,
                tvlLpTokens,
                rewardTokenPerLp,
                poolWeight,
                totalWeight
            );

            return {
                isValid: rewardTokenPerLp > 0,
                isSupportedPair: true,
                tvlLpTokens,
                token0Staked,
                token1Staked,
                rewardTokenPerLp,
                rewardTokenStaked,
                counterTokenStaked,
                counterTokenRewardEquivalent,
                totalStakeValueInRewardToken,
                token0PriceUsd,
                token1PriceUsd,
                tvlUsd,
                apr
            };
        }

        calculateTvlUsd({
            token0Staked = 0,
            token1Staked = 0,
            token0PriceUsd = 0,
            token1PriceUsd = 0
        }) {
            const hasToken0Stake = token0Staked > 0;
            const hasToken1Stake = token1Staked > 0;

            if (!hasToken0Stake && !hasToken1Stake) {
                return 0;
            }

            const hasToken0Price = !hasToken0Stake || token0PriceUsd > 0;
            const hasToken1Price = !hasToken1Stake || token1PriceUsd > 0;

            if (!hasToken0Price || !hasToken1Price) {
                return null;
            }

            return (token0Staked * token0PriceUsd) + (token1Staked * token1PriceUsd);
        }
    }

    global.RewardsCalculator = RewardsCalculator;
    console.log('✅ RewardsCalculator class registered globally');
})(typeof window !== 'undefined' ? window : global);
