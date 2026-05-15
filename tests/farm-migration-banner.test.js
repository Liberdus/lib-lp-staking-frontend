import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadFarmMigrationBanner() {
    vi.resetModules();
    globalThis.window = globalThis;
    delete globalThis.FarmMigrationBanner;

    await import('../js/components/farm-migration-banner.js');
    return globalThis.FarmMigrationBanner;
}

function createMockBigNumber(value) {
    const normalizedValue = BigInt(value?.toString?.() || value || 0);

    return {
        add(other) {
            return createMockBigNumber(normalizedValue + BigInt(other.toString()));
        },
        gt(other) {
            return normalizedValue > BigInt(other.toString());
        },
        toString() {
            return normalizedValue.toString();
        }
    };
}

describe('FarmMigrationBanner.render', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.CONFIG;
        delete globalThis.FarmMigrationBanner;
        delete globalThis.window;
    });

    it('links users to the configured Farm 1.0 migration page', async () => {
        const FarmMigrationBanner = await loadFarmMigrationBanner();
        globalThis.CONFIG = {
            FARM_MIGRATION: {
                ENABLED: true,
                OLD_FARM_LABEL: 'Farm 1.0',
                OLD_FARM_URL: 'https://liberdus.com/farm/'
            }
        };
        const banner = new FarmMigrationBanner();

        const output = banner.render();

        expect(output).toContain('Farm 1.0 migration is available');
        expect(output).toContain('Open the old farm to unstake LP and claim any remaining rewards.');
        expect(output).toContain('href="https://liberdus.com/farm/"');
        expect(output).toContain('Open Farm 1.0');
    });

    it('highlights the banner when the connected wallet has an old farm position', async () => {
        const FarmMigrationBanner = await loadFarmMigrationBanner();
        globalThis.CONFIG = {
            FARM_MIGRATION: {
                ENABLED: true,
                OLD_FARM_LABEL: 'Farm 1.0',
                OLD_FARM_URL: 'https://liberdus.com/farm/'
            }
        };
        const banner = new FarmMigrationBanner({
            isWalletConnected: vi.fn().mockReturnValue(true)
        });
        banner.status = banner.createStatus({
            checked: true,
            hasPosition: true
        });

        const output = banner.render();

        expect(output).toContain('Farm 1.0 position found');
        expect(output).toContain('This wallet still has Farm 1.0 LP or rewards to migrate.');
        expect(output).toContain('farm-migration-banner--position-found');
        expect(output).toContain('Position detected');
    });

    it('keeps the general banner visible for connected wallets without an old farm position by default', async () => {
        const FarmMigrationBanner = await loadFarmMigrationBanner();
        globalThis.CONFIG = {
            FARM_MIGRATION: {
                ENABLED: true,
                OLD_FARM_LABEL: 'Farm 1.0',
                OLD_FARM_URL: 'https://liberdus.com/farm/'
            }
        };
        const banner = new FarmMigrationBanner({
            isWalletConnected: vi.fn().mockReturnValue(true)
        });
        banner.status = banner.createStatus({
            checked: true,
            hasPosition: false
        });

        const output = banner.render();

        expect(output).toContain('Farm 1.0 migration is available');
        expect(output).not.toContain('farm-migration-banner--position-found');
    });

    it('can hide the banner when the connected wallet has no old farm position', async () => {
        const FarmMigrationBanner = await loadFarmMigrationBanner();
        globalThis.CONFIG = {
            FARM_MIGRATION: {
                ENABLED: true,
                HIDE_WHEN_CONNECTED_WALLET_HAS_NO_POSITION: true,
                OLD_FARM_LABEL: 'Farm 1.0',
                OLD_FARM_URL: 'https://liberdus.com/farm/'
            }
        };
        const banner = new FarmMigrationBanner({
            isWalletConnected: vi.fn().mockReturnValue(true)
        });
        banner.status = banner.createStatus({
            checked: true,
            hasPosition: false
        });

        expect(banner.render()).toBe('');
    });

    it('does not render when the migration banner is disabled', async () => {
        const FarmMigrationBanner = await loadFarmMigrationBanner();
        globalThis.CONFIG = {
            FARM_MIGRATION: {
                ENABLED: false,
                OLD_FARM_LABEL: 'Farm 1.0',
                OLD_FARM_URL: 'https://liberdus.com/farm/'
            }
        };
        const banner = new FarmMigrationBanner();

        expect(banner.render()).toBe('');
    });
});

describe('FarmMigrationBanner.checkPosition', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.CONFIG;
        delete globalThis.ethers;
        delete globalThis.networkSelector;
        delete globalThis.walletManager;
        delete globalThis.FarmMigrationBanner;
        delete globalThis.window;
    });

    it('marks a connected wallet as having migration work when old stake or rewards exist', async () => {
        const FarmMigrationBanner = await loadFarmMigrationBanner();
        const getUserStakeInfo = vi.fn()
            .mockResolvedValueOnce({
                amount: createMockBigNumber('0'),
                pendingRewards: createMockBigNumber('5')
            });
        const getPairs = vi.fn().mockResolvedValue([
            { lpToken: '0xlp1' }
        ]);
        const Contract = vi.fn(function MockContract() {
            return { getPairs, getUserStakeInfo };
        });
        const requestRender = vi.fn();

        globalThis.CONFIG = {
            FARM_MIGRATION: {
                ENABLED: true,
                POSITION_CHECK_ENABLED: true,
                OLD_FARM_CONTRACTS: {
                    BSC_MAINNET: '0xoldfarm'
                },
                LEGACY_LP_TOKENS: {}
            },
            NETWORKS: {
                BSC_MAINNET: {
                    RPC_URL: 'https://rpc.example',
                    CHAIN_ID: 56
                }
            },
            API: { RPC_TIMEOUT: 12000 }
        };
        globalThis.ethers = {
            BigNumber: { from: createMockBigNumber },
            Contract,
            providers: {
                JsonRpcProvider: vi.fn(function MockJsonRpcProvider() {
                    return { provider: true };
                })
            }
        };
        globalThis.networkSelector = {
            getSelectedNetworkKey: vi.fn().mockReturnValue('BSC_MAINNET')
        };
        globalThis.walletManager = {
            currentAccount: '0xwallet'
        };
        const banner = new FarmMigrationBanner({
            isWalletConnected: vi.fn().mockReturnValue(true),
            requestRender
        });

        await banner.checkPosition({ force: true });

        expect(Contract).toHaveBeenCalledWith('0xoldfarm', expect.any(Array), expect.any(Object));
        expect(getUserStakeInfo).toHaveBeenCalledWith('0xwallet', '0xlp1');
        expect(banner.status.checked).toBe(true);
        expect(banner.status.hasPosition).toBe(true);
        expect(banner.status.pendingRewardsRaw).toBe('5');
        expect(requestRender).toHaveBeenCalled();
    });

    it('does not check old farm positions when no wallet is connected', async () => {
        const FarmMigrationBanner = await loadFarmMigrationBanner();
        globalThis.CONFIG = {
            FARM_MIGRATION: {
                ENABLED: true,
                POSITION_CHECK_ENABLED: true
            }
        };
        globalThis.walletManager = {};
        const banner = new FarmMigrationBanner();

        await banner.checkPosition({ force: true });

        expect(banner.status.checked).toBe(false);
        expect(banner.status.hasPosition).toBe(false);
    });
});
