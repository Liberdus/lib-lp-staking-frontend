import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createClassList(initialClasses = []) {
    const classes = new Set(initialClasses);

    return {
        add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)),
        contains: (name) => classes.has(name),
        toggle: (name, force) => {
            const shouldAdd = force === undefined ? !classes.has(name) : !!force;
            if (shouldAdd) {
                classes.add(name);
            } else {
                classes.delete(name);
            }
            return shouldAdd;
        }
    };
}

function createElement({ id = '', classes = [], value = '' } = {}) {
    return {
        id,
        value,
        style: {},
        dataset: {},
        classList: createClassList(classes),
        querySelector: vi.fn(() => null),
        childNodes: []
    };
}

function createDocumentMock() {
    const elements = new Map();
    const allElements = [];

    const documentMock = {
        readyState: 'loading',
        body: { style: {} },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getElementById: vi.fn(id => elements.get(id) || null),
        querySelector: vi.fn(() => null),
        querySelectorAll: vi.fn(selector => {
            if (selector === '.zap-percentage-btn') {
                return allElements.filter(element => element.classList.contains('zap-percentage-btn'));
            }

            return [];
        }),
        registerElement: (element) => {
            if (element.id) {
                elements.set(element.id, element);
            }
            allElements.push(element);
            return element;
        }
    };

    return documentMock;
}

async function loadStakingModalClass() {
    vi.resetModules();

    globalThis.window = globalThis;
    globalThis.addEventListener = vi.fn();
    globalThis.removeEventListener = vi.fn();
    globalThis.dispatchEvent = vi.fn();
    globalThis.document = createDocumentMock();
    globalThis.CONFIG = {
        KYBER_ZAP: {
            DEFAULT_SLIPPAGE_BPS: 50,
            DEFAULT_DEADLINE_MINUTES: 20,
            HIGH_SLIPPAGE_BPS: 300,
            HIGH_PRICE_IMPACT_PERCENT: 5,
            NETWORKS: {
                BSC_MAINNET: {
                    ROUTER_ADDRESS: '0x0e97C887b61cCd952a53578B04763E7134429e05'
                }
            }
        }
    };
    globalThis.ethers = {
        BigNumber: {
            from: vi.fn(value => ({ value, toString: () => String(value) }))
        }
    };
    globalThis.console = console;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await import('../js/components/staking-modal-new.js');
    return globalThis.StakingModalNew;
}

function createModal(StakingModalNew) {
    const modal = new StakingModalNew();
    modal.updateButtonStates = vi.fn();
    modal.updateZapButton = vi.fn();
    modal.updateZapQuotePanel = vi.fn();
    modal.renderTabContent = vi.fn();
    return modal;
}

function arrangeExecutableZap(modal, { executeResult, sendTransaction } = {}) {
    modal.zapQuote = { data: { route: '0xroute' } };
    modal.zapQuoteStatus = 'ready';
    modal.buildZapRoute = vi.fn().mockResolvedValue({ txData: '0xabcdef', to: '0xrouter', value: '0' });
    modal.getZapTransactionRequest = vi.fn(() => ({ to: '0xrouter', data: '0xabcdef', value: { toString: () => '0' } }));
    modal.approveZapTokenIfNeeded = vi.fn().mockResolvedValue(true);

    globalThis.contractManager = {
        isReady: vi.fn(() => true),
        ensureSigner: vi.fn().mockResolvedValue(undefined),
        signer: {
            sendTransaction: sendTransaction || vi.fn().mockResolvedValue({ hash: '0xtx' })
        },
        executeTransactionOnce: vi.fn(async operation => {
            if (executeResult) {
                return executeResult;
            }

            await operation();
            return { success: true, hash: '0xreceipt' };
        })
    };

    globalThis.notificationManager = {
        info: vi.fn(),
        success: vi.fn(),
        error: vi.fn()
    };
}

describe('StakingModalNew zap cleanup', () => {
    beforeEach(() => {
        vi.useRealTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        delete globalThis.window;
        delete globalThis.addEventListener;
        delete globalThis.removeEventListener;
        delete globalThis.dispatchEvent;
        delete globalThis.document;
        delete globalThis.CONFIG;
        delete globalThis.ethers;
        delete globalThis.contractManager;
        delete globalThis.notificationManager;
        delete globalThis.homePage;
        delete globalThis.StakingModalNew;
        delete globalThis.stakingModal;
        delete globalThis.stakingModalNew;
        delete globalThis.getStakingModal;
        delete globalThis.safeModalClose;
        delete globalThis.safeModalExecuteStake;
        delete globalThis.safeModalExecuteUnstake;
        delete globalThis.safeModalExecuteClaim;
        delete globalThis.safeModalFetchZapQuote;
        delete globalThis.safeModalExecuteZap;
        delete globalThis.safeModalAddZapCustomToken;
    });

    it('clearInputs removes active zap percentage button state', async () => {
        const StakingModalNew = await loadStakingModalClass();
        const activeButton = document.registerElement(createElement({ classes: ['zap-percentage-btn', 'active'] }));
        const inactiveButton = document.registerElement(createElement({ classes: ['zap-percentage-btn'] }));
        const modal = createModal(StakingModalNew);

        modal.clearInputs();

        expect(activeButton.classList.contains('active')).toBe(false);
        expect(inactiveButton.classList.contains('active')).toBe(false);
    });

    it('startZapQuoteAutoRefresh stops instead of refreshing while zap is executing', async () => {
        vi.useFakeTimers();
        const StakingModalNew = await loadStakingModalClass();
        const modal = createModal(StakingModalNew);
        modal.isOpen = true;
        modal.currentTab = 'zap';
        modal.zapSelectedToken = { address: 'native' };
        modal.zapInputAmount = '1';
        modal.isExecutingZap = true;
        modal.fetchZapQuote = vi.fn();

        modal.startZapQuoteAutoRefresh();
        await vi.advanceTimersByTimeAsync(1000);

        expect(modal.fetchZapQuote).not.toHaveBeenCalled();
        expect(modal.zapQuoteRefreshTimer).toBeNull();
    });

    it('executeZap stops quote auto-refresh before building the zap transaction', async () => {
        const StakingModalNew = await loadStakingModalClass();
        const modal = createModal(StakingModalNew);
        const calls = [];
        modal.stopZapQuoteAutoRefresh = vi.fn(() => calls.push('stop'));
        arrangeExecutableZap(modal);
        modal.buildZapRoute = vi.fn(async () => {
            calls.push('build');
            throw new Error('Build failed');
        });

        await modal.executeZap();

        expect(calls[0]).toBe('stop');
        expect(calls[1]).toBe('build');
    });

    it('executeZap syncs quote auto-refresh after a failed zap attempt', async () => {
        const StakingModalNew = await loadStakingModalClass();
        const modal = createModal(StakingModalNew);
        arrangeExecutableZap(modal, {
            sendTransaction: vi.fn().mockRejectedValue(new Error('User rejected transaction'))
        });
        modal.syncZapQuoteAutoRefresh = vi.fn();

        await modal.executeZap();

        expect(modal.syncZapQuoteAutoRefresh).toHaveBeenCalled();
    });

    it('executeZap clears inputs after a successful confirmed zap transaction', async () => {
        vi.useFakeTimers();
        const StakingModalNew = await loadStakingModalClass();
        const modal = createModal(StakingModalNew);
        arrangeExecutableZap(modal);
        modal.clearInputs = vi.fn();
        modal.loadUserBalances = vi.fn().mockResolvedValue(undefined);
        modal.loadZapTokenBalances = vi.fn().mockResolvedValue(undefined);
        modal.switchTab = vi.fn();

        const executePromise = modal.executeZap();
        await vi.runAllTimersAsync();
        await executePromise;

        expect(modal.clearInputs).toHaveBeenCalled();
    });

    it('executeZap does not leave zap quote auto-refresh running after success', async () => {
        vi.useFakeTimers();
        const StakingModalNew = await loadStakingModalClass();
        const modal = createModal(StakingModalNew);
        arrangeExecutableZap(modal);
        modal.isOpen = true;
        modal.currentTab = 'zap';
        modal.zapSelectedToken = { address: 'native' };
        modal.zapInputAmount = '1';
        modal.loadUserBalances = vi.fn().mockResolvedValue(undefined);
        modal.loadZapTokenBalances = vi.fn().mockResolvedValue(undefined);
        modal.switchTab = vi.fn(tab => {
            modal.currentTab = tab;
        });

        modal.startZapQuoteAutoRefresh();
        expect(modal.zapQuoteRefreshTimer).not.toBeNull();

        const executePromise = modal.executeZap();
        await vi.runAllTimersAsync();
        await executePromise;

        expect(modal.zapQuoteRefreshTimer).toBeNull();
        expect(modal.currentTab).toBe('stake');
    });

    it('rejects zap transactions returned for an unexpected Kyber router', async () => {
        const StakingModalNew = await loadStakingModalClass();
        const modal = createModal(StakingModalNew);

        expect(() => modal.getZapTransactionRequest({
            to: '0x1111111111111111111111111111111111111111',
            txData: '0xabcdef',
            value: '0'
        })).toThrow('Kyber returned an unexpected zap router');
    });

    it('allows zap transactions returned for the configured Kyber router', async () => {
        const StakingModalNew = await loadStakingModalClass();
        const modal = createModal(StakingModalNew);

        const request = modal.getZapTransactionRequest({
            to: '0x0e97c887b61ccd952a53578b04763e7134429e05',
            txData: '0xabcdef',
            value: '0'
        });

        expect(request.to).toBe('0x0e97c887b61ccd952a53578b04763e7134429e05');
    });

    it('highlights high slippage in the zap quote panel', async () => {
        const StakingModalNew = await loadStakingModalClass();
        const modal = createModal(StakingModalNew);
        modal.zapInputAmount = '1';
        modal.zapSelectedToken = { symbol: 'USDT', address: '0xtoken', decimals: 18 };
        modal.currentPair = { name: 'LIB/USDT' };
        modal.zapQuoteStatus = 'ready';
        modal.zapQuote = {
            data: {
                route: '0xroute',
                suggestedSlippage: 500,
                zapDetails: { priceImpact: 1 }
            }
        };

        const html = modal.renderZapQuotePanel();

        expect(html).toContain('<div class="zap-quote-row zap-risk-high">\n                        <dt>Slippage</dt>');
        expect(html).toContain('5.00%');
        expect(html).toContain('High slippage tolerance. This transaction may execute at a much worse rate.');
    });

    it('highlights very high price impact in the zap quote panel', async () => {
        const StakingModalNew = await loadStakingModalClass();
        const modal = createModal(StakingModalNew);
        modal.zapInputAmount = '1';
        modal.zapSelectedToken = { symbol: 'USDT', address: '0xtoken', decimals: 18 };
        modal.currentPair = { name: 'LIB/USDT' };
        modal.zapQuoteStatus = 'ready';
        modal.zapQuote = {
            data: {
                route: '0xroute',
                suggestedSlippage: 50,
                zapDetails: { priceImpactPcm: 6000 }
            }
        };

        const html = modal.renderZapQuotePanel();

        expect(html).toContain('<div class="zap-quote-row zap-risk-high">\n                        <dt>Price Impact</dt>');
        expect(html).toContain('6%');
        expect(html).toContain('High price impact. You may receive significantly less LP value than expected.');
    });
});
