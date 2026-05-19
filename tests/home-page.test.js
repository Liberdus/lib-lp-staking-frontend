import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadHomePage() {
    vi.resetModules();
    globalThis.window = globalThis;
    delete globalThis.HomePage;

    await import('../js/components/home-page.js');
    return globalThis.HomePage.prototype;
}

describe('HomePage.formatTvlDisplay', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.Formatter;
        delete globalThis.HomePage;
        delete globalThis.window;
    });

    it.each([
        { pair: undefined, expected: '...' },
        { pair: { tvlCalculated: false }, expected: '...' },
        { pair: { tvlCalculated: true, tvlUsd: null }, expected: 'N/A' },
        { pair: { tvlCalculated: true, tvlUsd: undefined }, expected: 'N/A' }
    ])('formatTvlDisplay(%j) -> %s', async ({ pair, expected }) => {
        const homePagePrototype = await loadHomePage();

        expect(homePagePrototype.formatTvlDisplay.call({}, pair)).toBe(expected);
    });

    it('uses the shared formatter when available', async () => {
        const homePagePrototype = await loadHomePage();
        globalThis.Formatter = {
            formatCompactCurrency: vi.fn().mockReturnValue('$1.23M')
        };

        const output = homePagePrototype.formatTvlDisplay.call(
            {
                formatNumber: vi.fn()
            },
            { tvlCalculated: true, tvlUsd: 1230000 }
        );

        expect(output).toBe('$1.23M');
        expect(globalThis.Formatter.formatCompactCurrency).toHaveBeenCalledWith(1230000);
    });

    it('falls back to formatNumber when the formatter is unavailable', async () => {
        const homePagePrototype = await loadHomePage();
        const formatNumber = vi.fn().mockReturnValue('123.46');

        const output = homePagePrototype.formatTvlDisplay.call(
            { formatNumber },
            { tvlCalculated: true, tvlUsd: 123.456 }
        );

        expect(output).toBe('$123.46');
        expect(formatNumber).toHaveBeenCalledWith(123.456);
    });
});

describe('HomePage.loadDataWhenReady', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.contractManager;
        delete globalThis.HomePage;
        delete globalThis.window;
    });

    it('checks Farm 1.0 migration status when the contract manager is already ready on page load', async () => {
        const homePagePrototype = await loadHomePage();
        globalThis.contractManager = {
            isReady: vi.fn().mockReturnValue(true)
        };
        const context = {
            updateFooter: vi.fn(),
            loadData: vi.fn().mockResolvedValue(undefined),
            checkFarmMigrationPosition: vi.fn().mockResolvedValue(undefined),
            checkAdminAccess: vi.fn()
        };

        await homePagePrototype.loadDataWhenReady.call(context);

        expect(context.loadData).toHaveBeenCalled();
        expect(context.checkFarmMigrationPosition).toHaveBeenCalled();
        expect(context.checkAdminAccess).toHaveBeenCalled();
    });
});

describe('HomePage.renderPairRow', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        globalThis.window = globalThis;
        globalThis.Formatter = {
            formatPairName: vi.fn().mockReturnValue('<span class="pair-name-link">LIB/BNB</span>'),
            getPlatformUrl: vi.fn().mockReturnValue('https://example.com/pool')
        };
        globalThis.networkManager = {
            isOnRequiredNetwork: vi.fn().mockReturnValue(true)
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.Formatter;
        delete globalThis.networkManager;
        delete globalThis.HomePage;
        delete globalThis.window;
    });

    it('adds mobile card labels and cell classes to each staking row cell', async () => {
        const homePagePrototype = await loadHomePage();
        const output = homePagePrototype.renderPairRow.call(
            {
                isWalletConnected: () => true,
                formatTvlDisplay: () => '$1.2K'
            },
            {
                id: '1',
                address: '0x123',
                name: 'LIB/BNB',
                platform: 'PancakeSwap',
                apr: '12.3',
                weightPercentage: '25.00',
                userShares: '3.50',
                userEarnings: '1.2345'
            }
        );

        [
            ['pair', 'Pair'],
            ['apr', 'APR'],
            ['weight', 'Weight'],
            ['tvl', 'TVL'],
            ['share', 'My Share'],
            ['reward', 'My Reward']
        ].forEach(([cell, label]) => {
            expect(output).toContain(`class="staking-cell staking-cell--${cell}" data-label="${label}"`);
        });
    });

    it('keeps table action buttons clickable when the wallet is disconnected', async () => {
        const homePagePrototype = await loadHomePage();
        const output = homePagePrototype.renderPairRow.call(
            {
                isWalletConnected: () => false,
                formatTvlDisplay: () => '$1.2K'
            },
            {
                id: '1',
                address: '0x123',
                name: 'LIB/BNB',
                platform: 'PancakeSwap'
            }
        );

        expect(output).toContain('btn-share');
        expect(output).toContain('btn-earnings');
        expect(output).not.toContain('disabled');
    });

    it('keeps table action buttons clickable when connected on the wrong network', async () => {
        const homePagePrototype = await loadHomePage();
        globalThis.networkManager.isOnRequiredNetwork.mockReturnValue(false);

        const output = homePagePrototype.renderPairRow.call(
            {
                isWalletConnected: () => true,
                formatTvlDisplay: () => '$1.2K'
            },
            {
                id: '1',
                address: '0x123',
                name: 'LIB/BNB',
                platform: 'PancakeSwap'
            }
        );

        expect(output).toContain('btn-share');
        expect(output).toContain('btn-earnings');
        expect(output).not.toContain('disabled');
    });
});

describe('HomePage table action clicks', () => {
    let clickHandler;

    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        globalThis.document = {
            getElementById: vi.fn(() => null),
            addEventListener: vi.fn((eventName, handler) => {
                if (eventName === 'click') {
                    clickHandler = handler;
                }
            })
        };
        globalThis.notificationManager = {
            warning: vi.fn()
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.document;
        delete globalThis.HomePage;
        delete globalThis.notificationManager;
        delete globalThis.window;
        clickHandler = undefined;
    });

    function createActionButtonTarget(actionClass) {
        const button = {
            dataset: {
                pairId: '1',
                tab: actionClass === 'btn-share' ? '0' : '2'
            },
            closest(selector) {
                if (selector === '.pair-row') return { dataset: { pairId: '1' } };
                if (selector === 'button') return button;
                if (selector === '.btn-share') return actionClass === 'btn-share' ? button : null;
                if (selector === '.btn-earnings') return actionClass === 'btn-earnings' ? button : null;
                return null;
            }
        };

        return button;
    }

    function createRowTarget() {
        return {
            closest(selector) {
                if (selector === '.pair-row') return { dataset: { pairId: '1' } };
                return null;
            }
        };
    }

    it('shows the same wallet-required warning toast for disconnected row clicks', async () => {
        const homePagePrototype = await loadHomePage();
        const openStakingModal = vi.fn();
        const event = {
            target: createRowTarget()
        };

        homePagePrototype.attachEventListeners.call({
            isWalletConnected: () => false,
            showWalletRequiredToast: homePagePrototype.showWalletRequiredToast,
            openStakingModal
        });
        clickHandler(event);

        expect(globalThis.notificationManager.warning).toHaveBeenCalledWith('Please connect your wallet to stake token.');
        expect(openStakingModal).not.toHaveBeenCalled();
    });

    it.each(['btn-share', 'btn-earnings'])(
        'shows the wallet-required warning toast for disconnected %s clicks',
        async (actionClass) => {
            const homePagePrototype = await loadHomePage();
            const openStakingModal = vi.fn();
            const event = {
                target: createActionButtonTarget(actionClass),
                stopPropagation: vi.fn()
            };

            homePagePrototype.attachEventListeners.call({
                isWalletConnected: () => false,
                showWalletRequiredToast: homePagePrototype.showWalletRequiredToast,
                openStakingModal
            });
            clickHandler(event);

            expect(event.stopPropagation).toHaveBeenCalled();
            expect(globalThis.notificationManager.warning).toHaveBeenCalledWith('Please connect your wallet to stake token.');
            expect(openStakingModal).not.toHaveBeenCalled();
        }
    );

    it('opens the modal for connected row clicks even when the wallet is on another network', async () => {
        const homePagePrototype = await loadHomePage();
        const openStakingModal = vi.fn();
        const event = {
            target: createRowTarget()
        };

        homePagePrototype.attachEventListeners.call({
            isWalletConnected: () => true,
            showWalletRequiredToast: homePagePrototype.showWalletRequiredToast,
            openStakingModal
        });
        clickHandler(event);

        expect(globalThis.notificationManager.warning).not.toHaveBeenCalled();
        expect(openStakingModal).toHaveBeenCalledWith('1');
    });
});
