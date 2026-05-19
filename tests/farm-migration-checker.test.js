import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadFarmMigrationChecker() {
    vi.resetModules();
    globalThis.window = globalThis;
    delete globalThis.FarmMigrationChecker;

    await import('../js/services/farm-migration-checker.js');
    return globalThis.FarmMigrationChecker;
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

describe('FarmMigrationChecker', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.CONFIG;
        delete globalThis.ethers;
        delete globalThis.contractManager;
        delete globalThis.networkSelector;
        delete globalThis.walletManager;
        delete globalThis.FarmMigrationChecker;
        delete globalThis.window;
    });

    it('uses ContractManager signer permissions before wallet-manager fallbacks', async () => {
        const FarmMigrationChecker = await loadFarmMigrationChecker();
        globalThis.contractManager = {
            getCurrentSignerForPermissions: vi.fn().mockResolvedValue('0xpermission')
        };
        globalThis.walletManager = {
            currentAccount: '0xwallet'
        };

        const checker = new FarmMigrationChecker();

        await expect(checker.getConnectedWalletAddress()).resolves.toBe('0xpermission');
    });

    it('marks a connected wallet as having migration work when old stake or rewards exist', async () => {
        const FarmMigrationChecker = await loadFarmMigrationChecker();
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
        const provider = { provider: true };
        const executeWithProviderFallback = vi.fn(async (operation) => operation(provider, null));

        globalThis.CONFIG = {
            FARM_MIGRATION: {
                OLD_FARM_CONTRACTS: {
                    BSC_MAINNET: '0xoldfarm'
                },
                LEGACY_LP_TOKENS: {}
            },
            ABIS: {
                STAKING_CONTRACT: ['staking abi']
            }
        };
        globalThis.ethers = {
            BigNumber: { from: createMockBigNumber },
            Contract
        };
        globalThis.contractManager = {
            provider,
            executeWithProviderFallback,
            contractABIs: new Map([['STAKING', ['manager staking abi']]])
        };
        const checker = new FarmMigrationChecker();

        const result = await checker.fetchPosition(
            {
                oldFarmContracts: { BSC_MAINNET: '0xoldfarm' },
                legacyLpTokens: {}
            },
            '0xwallet',
            'BSC_MAINNET'
        );

        expect(executeWithProviderFallback).toHaveBeenCalledWith(
            expect.any(Function),
            'FarmMigrationChecker.checkPosition',
            2
        );
        expect(Contract).toHaveBeenCalledWith('0xoldfarm', ['manager staking abi'], provider);
        expect(getPairs).toHaveBeenCalled();
        expect(getUserStakeInfo).toHaveBeenCalledWith('0xwallet', '0xlp1');
        expect(result).toEqual({
            hasPosition: true,
            stakeAmountRaw: '0',
            pendingRewardsRaw: '5'
        });
    });

    it('reuses ContractManager cached RPC providers when no active provider exists', async () => {
        const FarmMigrationChecker = await loadFarmMigrationChecker();
        const cachedProvider = { cached: true };
        globalThis.CONFIG = {
            NETWORKS: {
                BSC_MAINNET: {
                    RPC_URL: 'https://rpc.example'
                }
            }
        };
        globalThis.contractManager = {
            getRpcProvider: vi.fn().mockReturnValue(cachedProvider)
        };

        const checker = new FarmMigrationChecker();

        expect(checker.getProvider('BSC_MAINNET')).toBe(cachedProvider);
        expect(globalThis.contractManager.getRpcProvider).toHaveBeenCalledWith('https://rpc.example');
    });
});
