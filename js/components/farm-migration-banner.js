/**
 * Farm 1.0 migration banner and read-only position check.
 * This keeps temporary migration UI isolated from the main staking page.
 */
class FarmMigrationBanner {
    constructor({ isWalletConnected, requestRender } = {}) {
        this.isWalletConnected = typeof isWalletConnected === 'function'
            ? isWalletConnected
            : () => false;
        this.requestRender = typeof requestRender === 'function'
            ? requestRender
            : () => {};
        this.checkNonce = 0;
        this.status = this.createStatus();
    }

    getConfig() {
        const config = window.CONFIG?.FARM_MIGRATION || {};

        return {
            enabled: config.ENABLED !== false,
            positionCheckEnabled: config.POSITION_CHECK_ENABLED !== false,
            hideWhenConnectedWalletHasNoPosition: config.HIDE_WHEN_CONNECTED_WALLET_HAS_NO_POSITION === true,
            oldFarmLabel: config.OLD_FARM_LABEL || 'Farm 1.0',
            oldFarmUrl: config.OLD_FARM_URL || '',
            oldFarmContracts: config.OLD_FARM_CONTRACTS || {},
            legacyLpTokens: config.LEGACY_LP_TOKENS || {}
        };
    }

    createStatus(overrides = {}) {
        return {
            state: 'idle',
            checked: false,
            checking: false,
            hasPosition: false,
            walletAddress: null,
            networkKey: null,
            stakeAmountRaw: '0',
            pendingRewardsRaw: '0',
            error: null,
            ...overrides
        };
    }

    reset() {
        this.checkNonce++;
        this.status = this.createStatus();
        this.requestRender();
    }

    render() {
        const {
            enabled,
            hideWhenConnectedWalletHasNoPosition,
            oldFarmLabel,
            oldFarmUrl
        } = this.getConfig();

        if (!enabled || !oldFarmUrl) {
            return '';
        }

        const status = this.status || this.createStatus();
        const walletConnected = this.isWalletConnected();

        if (
            walletConnected &&
            status.checked &&
            !status.hasPosition &&
            hideWhenConnectedWalletHasNoPosition
        ) {
            return '';
        }

        const hasMigrationPosition = walletConnected && status.checked && status.hasPosition;
        const bannerClass = hasMigrationPosition
            ? 'farm-migration-banner farm-migration-banner--position-found'
            : 'farm-migration-banner';
        const title = hasMigrationPosition
            ? `${oldFarmLabel} position found`
            : `${oldFarmLabel} migration is available`;
        const message = hasMigrationPosition
            ? `This wallet still has ${oldFarmLabel} LP or rewards to migrate.`
            : 'Open the old farm to unstake LP and claim any remaining rewards.';
        const statusBadge = hasMigrationPosition
            ? '<span class="farm-migration-banner-badge">Position detected</span>'
            : '';

        return `
            <section class="${bannerClass}" aria-labelledby="farm-migration-title">
                <div class="farm-migration-banner-content">
                    <span class="material-icons farm-migration-banner-icon" aria-hidden="true">moving</span>
                    <div class="farm-migration-banner-copy">
                        <div class="farm-migration-banner-heading">
                            <h2 id="farm-migration-title">${title}</h2>
                            ${statusBadge}
                        </div>
                        <p>${message}</p>
                    </div>
                </div>
                <a class="farm-migration-banner-link" href="${oldFarmUrl}" target="_blank" rel="noopener noreferrer">
                    <span>Open ${oldFarmLabel}</span>
                    <span class="material-icons" aria-hidden="true">open_in_new</span>
                </a>
            </section>
        `;
    }

    getCurrentNetworkKey() {
        return window.networkSelector?.getSelectedNetworkKey?.() || null;
    }

    getConnectedWalletAddress() {
        return window.walletManager?.currentAccount ||
            window.walletManager?.getAddress?.() ||
            window.walletManager?.address ||
            null;
    }

    getOldFarmContractAddress(config, networkKey) {
        if (!networkKey) {
            return null;
        }

        return config.oldFarmContracts?.[networkKey] || null;
    }

    getLegacyLpTokens(config, networkKey) {
        const configuredTokens = config.legacyLpTokens?.[networkKey];

        if (!Array.isArray(configuredTokens)) {
            return [];
        }

        return configuredTokens.filter(Boolean);
    }

    createProvider(networkKey) {
        const ethers = window.ethers;
        const networkConfig = window.CONFIG?.NETWORKS?.[networkKey];
        const rpcUrl = networkConfig?.RPC_URL || networkConfig?.FALLBACK_RPCS?.[0];

        if (!ethers?.providers?.JsonRpcProvider || !rpcUrl) {
            return window.contractManager?.provider || window.walletManager?.provider || null;
        }

        const staticNetwork = networkConfig?.CHAIN_ID
            ? { chainId: networkConfig.CHAIN_ID, name: networkKey.toLowerCase() }
            : undefined;

        return new ethers.providers.JsonRpcProvider({
            url: rpcUrl,
            timeout: window.CONFIG?.API?.RPC_TIMEOUT || 12000
        }, staticNetwork);
    }

    getStakingAbi() {
        return window.CONFIG?.ABIS?.STAKING_CONTRACT || [
            'function getPairs() external view returns (tuple(address lpToken, string pairName, string platform, uint256 weight, bool isActive)[])',
            'function getUserStakeInfo(address user, address lpToken) external view returns (uint256 amount, uint256 pendingRewards, uint256 lastRewardTime)'
        ];
    }

    getPairAddress(pair) {
        return pair?.lpToken || pair?.[0] || null;
    }

    getUniqueLpTokens(pairs, legacyTokens) {
        const tokens = new Set();

        if (Array.isArray(pairs)) {
            pairs.forEach((pair) => {
                const pairAddress = this.getPairAddress(pair);

                if (pairAddress) {
                    tokens.add(pairAddress);
                }
            });
        }

        legacyTokens.forEach((token) => tokens.add(token));

        return [...tokens];
    }

    normalizeBigNumber(value) {
        const ethers = window.ethers;

        if (ethers?.BigNumber?.from) {
            return ethers.BigNumber.from(value || 0);
        }

        const numericValue = BigInt(value?.toString?.() || value || 0);

        return {
            add: (other) => this.normalizeBigNumber(numericValue + BigInt(other?.toString?.() || other || 0)),
            gt: (other) => numericValue > BigInt(other?.toString?.() || other || 0),
            toString: () => numericValue.toString()
        };
    }

    async fetchPosition(config, walletAddress, networkKey) {
        const ethers = window.ethers;
        const oldFarmAddress = this.getOldFarmContractAddress(config, networkKey);

        if (!ethers?.Contract || !oldFarmAddress) {
            return { hasPosition: false, stakeAmountRaw: '0', pendingRewardsRaw: '0' };
        }

        const provider = this.createProvider(networkKey);
        if (!provider) {
            return { hasPosition: false, stakeAmountRaw: '0', pendingRewardsRaw: '0' };
        }

        const oldFarmContract = new ethers.Contract(oldFarmAddress, this.getStakingAbi(), provider);
        const pairs = await oldFarmContract.getPairs();
        const lpTokens = this.getUniqueLpTokens(pairs, this.getLegacyLpTokens(config, networkKey));
        let totalStake = this.normalizeBigNumber(0);
        let totalRewards = this.normalizeBigNumber(0);

        await Promise.all(lpTokens.map(async (lpToken) => {
            try {
                const stakeInfo = await oldFarmContract.getUserStakeInfo(walletAddress, lpToken);
                const amount = this.normalizeBigNumber(stakeInfo?.amount || stakeInfo?.[0] || 0);
                const pendingRewards = this.normalizeBigNumber(stakeInfo?.pendingRewards || stakeInfo?.[1] || 0);
                totalStake = totalStake.add(amount);
                totalRewards = totalRewards.add(pendingRewards);
            } catch (error) {
                console.warn('Failed to check Farm 1.0 position for LP token:', lpToken, error);
            }
        }));

        return {
            hasPosition: totalStake.gt(0) || totalRewards.gt(0),
            stakeAmountRaw: totalStake.toString(),
            pendingRewardsRaw: totalRewards.toString()
        };
    }

    async checkPosition({ force = false } = {}) {
        const config = this.getConfig();
        const walletAddress = this.getConnectedWalletAddress();
        const networkKey = this.getCurrentNetworkKey();

        if (!config.enabled || !config.positionCheckEnabled || !walletAddress) {
            this.status = this.createStatus();
            this.requestRender();
            return;
        }

        if (
            !force &&
            this.status?.checked &&
            this.status.walletAddress?.toLowerCase?.() === walletAddress.toLowerCase() &&
            this.status.networkKey === networkKey
        ) {
            return;
        }

        const nonce = ++this.checkNonce;
        this.status = this.createStatus({
            state: 'checking',
            checking: true,
            walletAddress,
            networkKey
        });
        this.requestRender();

        try {
            const result = await this.fetchPosition(config, walletAddress, networkKey);
            if (nonce !== this.checkNonce) {
                return;
            }

            this.status = this.createStatus({
                state: 'checked',
                checked: true,
                checking: false,
                hasPosition: result.hasPosition,
                walletAddress,
                networkKey,
                stakeAmountRaw: result.stakeAmountRaw,
                pendingRewardsRaw: result.pendingRewardsRaw
            });
        } catch (error) {
            if (nonce !== this.checkNonce) {
                return;
            }

            console.warn('Failed to check Farm 1.0 migration position:', error);
            this.status = this.createStatus({
                state: 'error',
                checked: false,
                checking: false,
                hasPosition: false,
                walletAddress,
                networkKey,
                error
            });
        }

        this.requestRender();
    }
}

window.FarmMigrationBanner = FarmMigrationBanner;
