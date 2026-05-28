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

    function renderPairRowOutput(homePagePrototype, pair, overrides = {}) {
        const context = Object.create(homePagePrototype);
        context.isWalletConnected = overrides.isWalletConnected || (() => true);
        context.formatTvlDisplay = overrides.formatTvlDisplay || (() => '$1.2K');
        return homePagePrototype.renderPairRow.call(context, pair);
    }

    it('renders inline row metrics and action buttons', async () => {
        const homePagePrototype = await loadHomePage();
        const output = renderPairRowOutput(homePagePrototype, {
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

        expect(output).toContain('class="staking-cell staking-cell--actions"');
        expect(output).toContain('staking-metric-value">3.50%</span>');
        expect(output).toContain('staking-metric-value">1.2345 LIB</span>');
        expect(output).toContain('btn-danger btn-unstake');
        expect(output).toContain('btn-success btn-claim');
        expect(output).toContain('>Stake</button>');
        expect(output).toContain('>Unstake</button>');
        expect(output).toContain('>Claim</button>');
        expect(output).not.toContain('btn-share');
        expect(output).not.toContain('btn-earnings');
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

    function createActionButtonTarget(action) {
        const button = {
            dataset: { pairId: '1', action },
            closest(selector) {
                if (selector === '.btn-stake, .btn-unstake, .btn-claim') return button;
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

    it.each(['stake', 'unstake', 'claim'])(
        'shows the wallet-required warning toast for disconnected %s clicks',
        async (action) => {
            const homePagePrototype = await loadHomePage();
            const openStakingModal = vi.fn();
            const event = {
                target: createActionButtonTarget(action),
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

    it.each(['stake', 'unstake', 'claim'])('opens the modal on the %s tab', async (action) => {
        const homePagePrototype = await loadHomePage();
        const openStakingModal = vi.fn();

        homePagePrototype.attachEventListeners.call({
            isWalletConnected: () => true,
            showWalletRequiredToast: homePagePrototype.showWalletRequiredToast,
            openStakingModal
        });
        clickHandler({
            target: createActionButtonTarget(action),
            stopPropagation: vi.fn()
        });

        expect(openStakingModal).toHaveBeenCalledWith('1', action);
    });

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
