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
        textContent: '',
        hidden: false,
        style: {},
        dataset: {},
        innerHTML: '',
        classList: createClassList(classes),
        addEventListener: vi.fn(),
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
            QUOTE_RATE_LIMIT_MAX_REQUESTS: 8,
            RATE_LIMIT_WINDOW_MS: 10000,
            NATIVE_TOKEN_ADDRESS: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            CLIENT_ID: 'liberdus-lp-staking',
            NETWORKS: {
                BSC_MAINNET: {
                    CHAIN: 'bsc',
                    DEX: 'DEX_UNISWAPV2',
                    ROUTER_ADDRESS: '0x0e97C887b61cCd952a53578B04763E7134429e05',
                    WRAPPED_NATIVE_TOKEN_ADDRESS: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
                }
            }
        }
    };
    globalThis.CONFIG.DEX_REMOVE_LIQUIDITY = {
        56: {
            wrappedNative: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
            factories: {
                '0x8909dc15e40173ff4699343b6eb8132c65e18ec6': {
                    name: 'Uniswap V2',
                    type: 'uniswapV2',
                    router: '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24'
                }
            }
        }
    };
    globalThis.ethers = {
        BigNumber: {
            from: vi.fn(value => ({ value, toString: () => String(value) }))
        },
        utils: {
            parseUnits: vi.fn(value => ({
                value,
                gte: other => Number(value) >= Number(other?.value ?? other),
                toString: () => String(value)
            }))
        }
    };
    globalThis.console = console;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await import('../js/services/kyber-zap-rate-limiter.js');
    await import('../js/services/kyber-zap-service.js');
    await import('../js/services/v2-remove-liquidity-service.js');
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

async function createLoadedModal() {
    return createModal(await loadStakingModalClass());
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

function setZapBalance(modal, balanceValue) {
    modal.zapSelectedToken = { symbol: 'USDT', address: '0xtoken', decimals: 18 };
    modal.zapInputTokenBalances.set('0xtoken', {
        raw: {
            value: String(balanceValue),
            gte: other => Number(balanceValue) >= Number(other?.value ?? other)
        },
        formatted: String(balanceValue)
    });
}

function createZapRawBalance(value) {
    return {
        value,
        gte: other => Number(value) >= Number(other?.value ?? other),
        mul: multiplier => createZapRawBalance(Number(value) * Number(multiplier)),
        div: divisor => createZapRawBalance(Number(value) / Number(divisor)),
        toString: () => String(value)
    };
}

function arrangeQuoteFetch(modal, responsePayload = { data: { route: '0xroute' } }) {
    globalThis.walletManager = { address: '0xwallet' };
    modal.currentPair = { name: 'LIB/USDT', lpToken: '0xlp' };
    modal.zapSelectedToken = { symbol: 'USDT', address: '0xtoken', decimals: 18 };
    modal.zapInputAmount = '1';
    modal.getKyberZapService().getDexCandidates = vi.fn().mockResolvedValue(['DEX_UNISWAPV2']);
    globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(responsePayload)
    });
}

function arrangeReadyZapQuote(modal, data = { route: '0xroute' }) {
    modal.currentPair = { name: 'LIB/USDT', lpToken: '0xlp' };
    modal.zapSelectedToken = { symbol: 'USDT', address: '0xtoken', decimals: 18 };
    modal.zapInputTokens = [modal.zapSelectedToken];
    modal.zapInputAmount = '1';
    modal.zapQuoteStatus = 'ready';
    modal.zapQuote = { data };
}

function arrangeReadyRemoveLiquidityPreview(modal) {
    modal.currentPair = { name: 'LIB/USDT', lpToken: '0xlp', address: '0xlp' };
    modal.removeLiquidityAmount = '1';
    modal.removeLiquidityEnabled = true;
    modal.removeLiquidityPreviewStatus = 'ready';
    modal.removeLiquidityPreview = {
        supported: true,
        adapter: {
            name: 'Uniswap V2',
            routerAddress: '0xrouter',
            factoryAddress: '0xfactory'
        },
        token0: {
            address: '0xlib',
            symbol: 'LIB',
            decimals: 18,
            amount: { raw: '100000000000000000000', formatted: '100' },
            minAmount: { raw: '99500000000000000000', formatted: '99.5' }
        },
        token1: {
            address: '0xusdt',
            symbol: 'USDT',
            decimals: 18,
            amount: { raw: '50000000000000000000', formatted: '50' },
            minAmount: { raw: '49750000000000000000', formatted: '49.75' }
        }
    };
}

function registerRemoveLiquidityButton(title = 'Wait for a supported remove-liquidity preview.') {
    const icon = { textContent: 'swap_horiz' };
    const text = { textContent: ' Remove LP Liquidity' };
    const button = createElement({ classes: ['btn', 'btn-primary', 'remove-liquidity-action-btn'] });
    button.disabled = true;
    button.title = title;
    button.childNodes = [icon, text];
    button.querySelector = vi.fn(selector => selector === '.material-icons' ? icon : null);
    globalThis.document.querySelector = vi.fn(selector => (
        selector.includes('safeModalExecuteRemoveLiquidity') ? button : null
    ));
    return button;
}

function createAmount(value) {
    return {
        value,
        lt: other => Number(value) < Number(other?.value ?? other),
        gte: other => Number(value) >= Number(other?.value ?? other),
        toString: () => String(value)
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
        delete globalThis.walletManager;
        delete globalThis.networkSelector;
        delete globalThis.notificationManager;
        delete globalThis.homePage;
        delete globalThis.Formatter;
        delete globalThis.fetch;
        delete globalThis.KyberZapRateLimitError;
        delete globalThis.KyberZapQuoteRateLimiter;
        delete globalThis.KyberZapService;
        delete globalThis.V2RemoveLiquidityService;
        delete globalThis.StakingModalNew;
        delete globalThis.stakingModal;
        delete globalThis.stakingModalNew;
        delete globalThis.getStakingModal;
        delete globalThis.safeModalClose;
        delete globalThis.safeModalExecuteStake;
        delete globalThis.safeModalExecuteUnstake;
        delete globalThis.safeModalExecuteClaim;
        delete globalThis.safeModalExecuteRemoveLiquidity;
        delete globalThis.safeModalFetchZapQuote;
        delete globalThis.safeModalExecuteZap;
        delete globalThis.safeModalAddZapCustomToken;
        delete globalThis.safeModalFetchRemoveLiquidityPreview;
    });

    it('clearInputs removes active zap percentage button state', async () => {
        const modal = await createLoadedModal();
        const activeButton = document.registerElement(createElement({ classes: ['zap-percentage-btn', 'active'] }));
        const inactiveButton = document.registerElement(createElement({ classes: ['zap-percentage-btn'] }));

        modal.clearInputs();

        expect(activeButton.classList.contains('active')).toBe(false);
        expect(inactiveButton.classList.contains('active')).toBe(false);
    });

    it('renders modal tabs with hideable labels and accessible names', async () => {
        const StakingModalNew = await loadStakingModalClass();
        const modalContainer = document.registerElement(createElement({ id: 'modal-container' }));

        new StakingModalNew();

        expect(modalContainer.innerHTML).toContain('class="modal-tabs"');
        expect(modalContainer.innerHTML).toContain('aria-label="Create LP"');
        expect(modalContainer.innerHTML).toContain('<span class="material-icons" aria-hidden="true">bolt</span>');
        expect(modalContainer.innerHTML).toContain('<span class="tab-label">Create LP</span>');
        expect(modalContainer.innerHTML).toContain('<span class="tab-label">Unstake</span>');
        expect(modalContainer.innerHTML).toContain('<span class="tab-label">Remove LP</span>');
    });

    it('derives LP USD estimates from pair TVL data', async () => {
        const modal = await createLoadedModal();
        modal.currentPair = { tvlUsd: 500, tvl: 100 };

        expect(modal.getLpUsdPrice()).toBe(5);
        expect(modal.getLpUsdEstimate('2.5')).toBe(12.5);
        expect(modal.formatLpUsdEstimate('2.5')).toBe('$12.50');
    });

    it.each([
        { currentPair: { tvl: 100 }, amount: '2' },
        { currentPair: { tvlUsd: 500 }, amount: '2' },
        { currentPair: { tvlUsd: 500, tvl: 0 }, amount: '2' },
        { currentPair: { tvlUsd: -1, tvl: 100 }, amount: '2' },
        { currentPair: { tvlUsd: 500, tvl: 'not-a-number' }, amount: '2' },
        { currentPair: { tvlUsd: 500, tvl: 100 }, amount: '' },
        { currentPair: { tvlUsd: 500, tvl: 100 }, amount: 'not-a-number' }
    ])('returns no display value for unavailable LP USD estimate data %#', async ({ currentPair, amount }) => {
        const modal = await createLoadedModal();
        modal.currentPair = currentPair;

        expect(modal.getLpUsdEstimate(amount)).toBeNull();
        expect(modal.formatLpUsdEstimate(amount)).toBe('');
    });

    it('renders stake LP balance and input USD estimates', async () => {
        const modal = await createLoadedModal();
        modal.currentPair = { tvlUsd: 1200, tvl: 100 };
        modal.userBalance = '12.5';
        modal.stakeAmount = '3';

        const html = modal.renderStakeTab();

        expect(html).toContain('12.5 LP <span class="lp-usd-estimate">($150.00)</span>');
        expect(html).toContain('id="stake-usd-estimate"');
        expect(html).toContain('$36.00');
    });

    it('updates stake input USD estimates from input and percentage paths', async () => {
        const modal = await createLoadedModal();
        modal.currentPair = { tvlUsd: 1000, tvl: 100 };
        modal.userBalance = '8';
        modal.currentTab = 'stake';
        const estimateElement = document.registerElement(createElement({ id: 'stake-usd-estimate' }));
        const inputHandler = document.addEventListener.mock.calls.find(([eventName]) => eventName === 'input')?.[1];

        inputHandler({ target: createElement({ id: 'stake-amount-input', value: '2' }) });

        expect(modal.stakeAmount).toBe('2');
        expect(estimateElement.textContent).toBe('$20.00');
        expect(estimateElement.hidden).toBe(false);

        modal.setPercentage(25);

        expect(modal.stakeAmount).toBe('2.000000');
        expect(estimateElement.textContent).toBe('$20.00');
    });

    it('renders unstake LP balance and input USD estimates', async () => {
        const modal = await createLoadedModal();
        modal.currentPair = { tvlUsd: 2000, tvl: 100 };
        modal.userStaked = '4';
        modal.unstakeAmount = '1.5';

        const html = modal.renderUnstakeTab();

        expect(html).toContain('4 LP <span class="lp-usd-estimate">($80.00)</span>');
        expect(html).toContain('id="unstake-usd-estimate"');
        expect(html).toContain('$30.00');
    });

    it('updates unstake input USD estimates from the slider path', async () => {
        const modal = await createLoadedModal();
        modal.currentPair = { tvlUsd: 2000, tvl: 100 };
        modal.userStaked = '8';
        const estimateElement = document.registerElement(createElement({ id: 'unstake-usd-estimate' }));
        const inputElement = document.registerElement(createElement({ id: 'unstake-amount-input' }));

        modal.updateAmountFromSlider({ dataset: { type: 'unstake' }, value: '50' });

        expect(modal.unstakeAmount).toBe('4.000000');
        expect(inputElement.value).toBe('4.000000');
        expect(estimateElement.textContent).toBe('$80.00');
    });

    it('hides unavailable stake input USD estimates instead of rendering N/A', async () => {
        const modal = await createLoadedModal();
        modal.currentPair = { tvlUsd: 1000, tvl: 0 };
        modal.stakeAmount = '2';
        const estimateElement = document.registerElement(createElement({ id: 'stake-usd-estimate' }));

        const html = modal.renderStakeTab();
        modal.updateStakeUsdEstimate();

        expect(html).toContain('id="stake-usd-estimate"');
        expect(html).toContain('hidden></div>');
        expect(html).not.toContain('(N/A)');
        expect(estimateElement.textContent).toBe('');
        expect(estimateElement.hidden).toBe(true);
    });

    it('renders claim tab staked amount with a USD estimate', async () => {
        const modal = await createLoadedModal();
        modal.currentPair = { tvlUsd: 2000, tvl: 100 };
        modal.userStaked = '4';

        const html = modal.renderClaimTab();

        expect(html).toContain('4 LP <span class="lp-usd-estimate">($80.00)</span>');
    });

    it('startZapQuoteAutoRefresh stops instead of refreshing while zap is executing', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
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

    it('fetches zap quote previews when the amount exceeds the selected token balance', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        setZapBalance(modal, 5);
        modal.zapInputAmount = '10';
        modal.fetchZapQuote = vi.fn();

        modal.debounceZapQuote(0);
        await vi.runAllTimersAsync();

        expect(modal.fetchZapQuote).toHaveBeenCalled();
        expect(modal.canFetchZapQuote()).toBe(true);
    });

    it('starts zap quote auto-refresh when the amount exceeds the selected token balance', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        modal.isOpen = true;
        modal.currentTab = 'zap';
        setZapBalance(modal, 5);
        modal.zapInputAmount = '10';

        modal.syncZapQuoteAutoRefresh();

        expect(modal.zapQuoteRefreshTimer).not.toBeNull();
        modal.stopZapQuoteAutoRefresh();
    });

    it('debounces rapid zap percentage clicks before fetching a quote', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        modal.zapSelectedToken = { symbol: 'USDT', address: '0xtoken', decimals: 0 };
        modal.zapInputTokenBalances.set('0xtoken', {
            raw: createZapRawBalance(100),
            formatted: '100'
        });
        modal.fetchZapQuote = vi.fn();

        modal.setZapAmountPercentage(25);
        modal.setZapAmountPercentage(50);
        await vi.advanceTimersByTimeAsync(599);

        expect(modal.fetchZapQuote).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);

        expect(modal.zapInputAmount).toBe('50');
        expect(modal.fetchZapQuote).toHaveBeenCalledTimes(1);
    });

    it('deduplicates identical non-forced zap quote requests', async () => {
        const modal = await createLoadedModal();
        arrangeQuoteFetch(modal);
        arrangeReadyZapQuote(modal);
        modal.zapQuoteKey = modal.getZapQuoteRequestKey();

        await modal.fetchZapQuote();

        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('rate-limits Kyber quote HTTP requests', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-27T12:00:00Z'));
        const modal = await createLoadedModal();
        arrangeQuoteFetch(modal);
        globalThis.CONFIG.KYBER_ZAP.QUOTE_RATE_LIMIT_MAX_REQUESTS = 2;

        await modal.fetchZapQuote({ force: true });
        await modal.fetchZapQuote({ force: true });
        await modal.fetchZapQuote({ force: true });

        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        expect(modal.zapQuoteStatus).toBe('ready');
        expect(modal.zapQuoteRateLimitMessage).toContain('Quote refresh paused');

        modal.clearZapQuoteRateLimitTimer();
    });

    it('auto-refresh skips zap quote fetches while rate-limited', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-27T12:00:00Z'));
        const modal = await createLoadedModal();
        modal.isOpen = true;
        modal.currentTab = 'zap';
        modal.zapSelectedToken = { symbol: 'USDT', address: '0xtoken', decimals: 18 };
        modal.zapInputAmount = '1';
        modal.fetchZapQuote = vi.fn();
        globalThis.CONFIG.KYBER_ZAP.QUOTE_RATE_LIMIT_MAX_REQUESTS = 2;
        modal.getKyberZapService().quoteRateLimiter.timestamps = [Date.now(), Date.now()];

        modal.startZapQuoteAutoRefresh();
        await vi.advanceTimersByTimeAsync(1000);

        expect(modal.fetchZapQuote).not.toHaveBeenCalled();
        expect(modal.zapQuoteRefreshTimer).toBeNull();

        modal.clearZapQuoteRateLimitTimer();
    });

    it('renders an insufficient balance error for impossible zap amounts', async () => {
        const modal = await createLoadedModal();
        modal.currentPair = { name: 'LIB/USDT' };
        modal.zapInputTokens = [{ symbol: 'USDT', address: '0xtoken', decimals: 18 }];
        modal.zapInputTokenAddress = '0xtoken';
        setZapBalance(modal, 5);
        modal.zapInputAmount = '10';

        const html = modal.renderZapTab();

        expect(html).toContain('Insufficient USDT balance.');
    });

    it('renders abbreviated token addresses in zap token options', async () => {
        const modal = await createLoadedModal();
        modal.currentPair = { name: 'LIB/USDT' };
        modal.zapInputTokens = [
            { symbol: 'BNB', address: 'native', decimals: 18 },
            { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 }
        ];
        modal.zapInputTokenAddress = 'native';
        modal.zapSelectedToken = modal.zapInputTokens[0];
        modal.zapInputTokenBalances.set('native', { formatted: '1.25' });
        modal.zapInputTokenBalances.set('0x55d398326f99059fF775485246999027B3197955', { formatted: '50' });

        const html = modal.renderZapTab();

        expect(html).toContain('BNB');
        expect(html).toContain('zap-token-icon-bnb');
        expect(html).toContain('src="assets/images/tokens/bsc/0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c.png"');
        expect(html).toContain('1.25 BNB');
        expect(html).toContain('USDT</span> <span class="zap-token-option-address">0x55d3...7955</span>');
        expect(html).toContain('zap-token-icon-usdt');
        expect(html).toContain('src="assets/images/tokens/bsc/0x55d398326f99059ff775485246999027b3197955.png"');
        expect(html).toContain('50 USDT');
        expect(html).not.toContain('Balance:');
    });

    it('sorts zap input tokens alphabetically by symbol', async () => {
        const modal = await createLoadedModal();

        const sortedTokens = modal.sortZapInputTokens([
            { symbol: 'USDT', address: '0xusdt' },
            { symbol: 'BNB', address: 'native' },
            { symbol: 'DAI', address: '0xdai' },
            { symbol: 'CAKE', address: '0xcake' }
        ]);

        expect(sortedTokens.map(token => token.symbol)).toEqual(['BNB', 'CAKE', 'DAI', 'USDT']);
    });

    it('invalid custom zap slippage clears stale quotes and is not shown as active', async () => {
        const modal = await createLoadedModal();
        arrangeReadyZapQuote(modal);
        modal.zapSlippageBps = 50;

        const sanitizedValue = modal.setZapCustomSlippageInput('0');
        const html = modal.renderZapTab();
        const customButton = html.match(/<button class="zap-slippage-btn[^"]*" data-slippage="custom">Custom<\/button>/)?.[0] || '';

        expect(sanitizedValue).toBe('0');
        expect(modal.zapSlippageBps).toBe(50);
        expect(modal.zapQuote).toBeNull();
        expect(modal.zapQuoteStatus).toBe('error');
        expect(modal.zapQuoteError).toContain('Enter a custom slippage');
        expect(modal.canFetchZapQuote()).toBe(false);
        expect(customButton).not.toContain('active');
        expect(html).toContain('aria-invalid="true"');
        expect(html).toContain('zap-custom-slippage-error');
    });

    it('clearInputs resets invalid custom zap slippage state', async () => {
        const modal = await createLoadedModal();
        modal.zapCustomSlippage = '0';
        modal.zapCustomSlippageError = modal.getZapCustomSlippageError();

        modal.clearInputs();

        expect(modal.zapCustomSlippage).toBe('');
        expect(modal.zapCustomSlippageError).toBe('');
        expect(modal.hasInvalidZapCustomSlippage()).toBe(false);
    });

    it('valid custom zap slippage applies bps and refreshes quotes', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        arrangeReadyZapQuote(modal);
        modal.fetchZapQuote = vi.fn();

        const sanitizedValue = modal.setZapCustomSlippageInput('2.345');
        await vi.advanceTimersByTimeAsync(600);

        expect(sanitizedValue).toBe('2.34');
        expect(modal.zapSlippageBps).toBe(234);
        expect(modal.zapCustomSlippageError).toBe('');
        expect(modal.zapQuote).toBeNull();
        expect(modal.zapQuoteStatus).toBe('idle');
        expect(modal.fetchZapQuote).toHaveBeenCalledTimes(1);
    });

    it('does not execute zap while custom slippage is invalid', async () => {
        const modal = await createLoadedModal();
        arrangeExecutableZap(modal);
        modal.zapCustomSlippage = '101';
        modal.zapCustomSlippageError = modal.getZapCustomSlippageError();

        await modal.executeZap();

        expect(modal.buildZapRoute).not.toHaveBeenCalled();
        expect(globalThis.notificationManager.error).toHaveBeenCalledWith('Enter a custom slippage between 0.01% and 100%.');
    });

    it('applies a GeckoTerminal icon URL to custom zap tokens after metadata loads', async () => {
        const modal = await createLoadedModal();
        modal.zapInputTokens = [
            { symbol: 'ABC', address: '0xabc', decimals: 18, custom: true }
        ];
        modal.zapInputTokenAddress = '0xabc';
        modal.zapSelectedToken = modal.zapInputTokens[0];
        modal.getTokenMarketMetadata = vi.fn().mockResolvedValue({
            imageUrl: 'https://assets.geckoterminal.com/abc'
        });

        const updated = await modal.loadZapCustomTokenIcon('0xABC');

        expect(updated).toBe(true);
        expect(modal.zapInputTokens[0].iconUrl).toBe('https://assets.geckoterminal.com/abc');
        expect(modal.zapSelectedToken.iconUrl).toBe('https://assets.geckoterminal.com/abc');
        expect(modal.renderTabContent).toHaveBeenCalled();
    });

    it('keeps the symbol badge when custom token metadata returns an unsafe icon URL', async () => {
        const modal = await createLoadedModal();
        modal.zapInputTokens = [
            { symbol: 'ABC', address: '0xabc', decimals: 18, custom: true }
        ];
        modal.zapInputTokenAddress = '0xabc';
        modal.zapSelectedToken = modal.zapInputTokens[0];
        modal.getTokenMarketMetadata = vi.fn().mockResolvedValue({
            imageUrl: 'javascript:alert(1)'
        });

        const updated = await modal.loadZapCustomTokenIcon('0xABC');

        expect(updated).toBe(false);
        expect(modal.zapInputTokens[0].iconUrl).toBeUndefined();
        expect(modal.renderTabContent).not.toHaveBeenCalled();
    });

    it('updates the visible zap balance error without re-rendering the tab', async () => {
        const modal = await createLoadedModal();
        const errorElement = document.registerElement(createElement({ id: 'zap-balance-error' }));
        setZapBalance(modal, 5);
        modal.zapInputAmount = '10';

        modal.updateZapBalanceError();

        expect(errorElement.textContent).toBe('Insufficient USDT balance.');
        expect(errorElement.hidden).toBe(false);

        modal.zapInputAmount = '5';
        modal.updateZapBalanceError();

        expect(errorElement.textContent).toBe('');
        expect(errorElement.hidden).toBe(true);
    });

    it('does not execute a ready zap quote when the amount exceeds the selected token balance', async () => {
        const modal = await createLoadedModal();
        arrangeExecutableZap(modal);
        setZapBalance(modal, 5);
        modal.zapInputAmount = '10';

        await modal.executeZap();

        expect(modal.buildZapRoute).not.toHaveBeenCalled();
        expect(globalThis.notificationManager.error).toHaveBeenCalledWith('Insufficient USDT balance.');
    });

    it('executeZap stops quote auto-refresh before building the zap transaction', async () => {
        const modal = await createLoadedModal();
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
        const modal = await createLoadedModal();
        arrangeExecutableZap(modal, {
            sendTransaction: vi.fn().mockRejectedValue(new Error('User rejected transaction'))
        });
        modal.syncZapQuoteAutoRefresh = vi.fn();

        await modal.executeZap();

        expect(modal.syncZapQuoteAutoRefresh).toHaveBeenCalled();
    });

    it('executeZap clears inputs after a successful confirmed zap transaction', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
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
        const modal = await createLoadedModal();
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
        const modal = await createLoadedModal();

        expect(() => modal.getZapTransactionRequest({
            to: '0x1111111111111111111111111111111111111111',
            txData: '0xabcdef',
            value: '0'
        })).toThrow('Kyber returned an unexpected zap router');
    });

    it('allows zap transactions returned for the configured Kyber router', async () => {
        const modal = await createLoadedModal();

        const request = modal.getZapTransactionRequest({
            to: '0x0e97c887b61ccd952a53578b04763e7134429e05',
            txData: '0xabcdef',
            value: '0'
        });

        expect(request.to).toBe('0x0e97c887b61ccd952a53578b04763e7134429e05');
    });

    it('renders LP USD estimates beside the zap Estimated LP amount', async () => {
        const modal = await createLoadedModal();
        arrangeReadyZapQuote(modal, {
            route: '0xroute',
            positionDetails: {
                addedLiquidity: '2500000000000000000'
            },
            zapDetails: {
                priceImpact: 1
            }
        });
        modal.currentPair = {
            ...modal.currentPair,
            tvlUsd: 1000,
            tvl: 100
        };

        const html = modal.renderZapQuotePanel();

        expect(html).toContain('<dt>Estimated LP</dt>');
        expect(html).toContain('2.5 LP ($25.00)');
    });

    it('keeps zap Estimated LP visible without appending N/A when USD estimate is unavailable', async () => {
        const modal = await createLoadedModal();
        arrangeReadyZapQuote(modal, {
            route: '0xroute',
            positionDetails: {
                addedLiquidity: '2500000000000000000'
            },
            zapDetails: {
                priceImpact: 1
            }
        });

        const html = modal.renderZapQuotePanel();

        expect(html).toContain('<dt>Estimated LP</dt>');
        expect(html).toContain('2.5 LP');
        expect(html).not.toContain('2.5 LP (N/A)');
    });

    it('highlights high slippage in the zap quote panel', async () => {
        const modal = await createLoadedModal();
        arrangeReadyZapQuote(modal, {
            route: '0xroute',
            suggestedSlippage: 500,
            zapDetails: { priceImpact: 1 }
        });

        const html = modal.renderZapQuotePanel();

        expect(html).toContain('zap-quote-row zap-risk-high');
        expect(html).toContain('<dt>Slippage</dt>');
        expect(html).toContain('5.00%');
        expect(html).toContain('High slippage tolerance. This transaction may execute at a much worse rate.');
    });

    it('highlights very high price impact in the zap quote panel', async () => {
        const modal = await createLoadedModal();
        arrangeReadyZapQuote(modal, {
            route: '0xroute',
            suggestedSlippage: 50,
            zapDetails: { priceImpactPcm: 6000 }
        });

        const html = modal.renderZapQuotePanel();

        expect(html).toContain('zap-quote-row zap-risk-high');
        expect(html).toContain('<dt>Price Impact</dt>');
        expect(html).toContain('6%');
        expect(html).toContain('High price impact. You may receive significantly less LP value than expected.');
    });

    it('renders Kyber Zap Fee when protocol fee is returned in zap actions', async () => {
        const modal = await createLoadedModal();
        arrangeReadyZapQuote(modal, {
            route: '0xroute',
            zapDetails: {
                priceImpact: 1,
                actions: [
                    {
                        type: 'ACTION_TYPE_PROTOCOL_FEE',
                        protocolFee: {
                            tokens: [
                                {
                                    address: '0xtoken',
                                    amount: '250000000000000000',
                                    decimals: 18,
                                    symbol: 'USDT'
                                }
                            ]
                        }
                    }
                ]
            }
        });

        const html = modal.renderZapQuotePanel();

        expect(html).toContain('<dt>Kyber Zap Fee</dt>');
        expect(html).toContain('0.25 USDT');
    });

    it('renders Kyber Zap Fee as none when the protocol fee is zero', async () => {
        const modal = await createLoadedModal();
        arrangeReadyZapQuote(modal, {
            route: '0xroute',
            zapDetails: {
                priceImpact: 1,
                actions: [
                    {
                        type: 'ACTION_TYPE_PROTOCOL_FEE',
                        protocolFee: {
                            tokens: [
                                {
                                    address: '0xtoken',
                                    amount: '0',
                                    decimals: 18,
                                    symbol: 'USDT'
                                }
                            ]
                        }
                    }
                ]
            }
        });

        const html = modal.renderZapQuotePanel();

        expect(html).toContain('<dt>Kyber Zap Fee</dt>');
        expect(html).toContain('<dd>None</dd>');
    });

    it('renders guided remove-liquidity controls and preview on the Remove LP tab', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        modal.userBalance = '10';
        modal.currentPair = { ...modal.currentPair, tvlUsd: 1000, tvl: 100 };

        const html = modal.renderRemoveLiquidityTab();

        expect(html).toContain('10 LP <span class="lp-usd-estimate">($100.00)</span>');
        expect(html).toContain('id="remove-liquidity-amount-input"');
        expect(html).toContain('id="remove-liquidity-usd-estimate"');
        expect(html).toContain('id="remove-liquidity-checkbox"');
        expect(html).toContain('remove-liquidity-action-btn');
        expect(html).toContain('Show pair-token return preview and settings');
        expect(html).toContain('LIB + USDT via Uniswap V2');
        expect(html).toContain('<dt>Minimum token0</dt>');
        expect(html).toContain('99.5 LIB');
        expect(html).toContain('49.75 USDT');
    });

    it('keeps guided remove-liquidity controls out of the Unstake tab', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        modal.userStaked = '10';

        const html = modal.renderUnstakeTab();

        expect(html).not.toContain('id="remove-liquidity-checkbox"');
        expect(html).not.toContain('Show pair-token return preview and settings');
        expect(html).not.toContain('remove-liquidity-preview-panel');
    });

    it('shows a blocking unsupported message for unknown remove-liquidity factories', async () => {
        const modal = await createLoadedModal();
        modal.currentPair = { name: 'LIB/USDT', lpToken: '0xlp' };
        modal.removeLiquidityAmount = '1';
        modal.removeLiquidityEnabled = true;
        modal.removeLiquidityPreviewStatus = 'error';
        modal.removeLiquidityPreviewError = 'This LP factory is not supported for guided remove liquidity.';
        modal.removeLiquidityPreview = {
            supported: false,
            factoryAddress: '0x9999999999999999999999999999999999999999'
        };

        const html = modal.renderRemoveLiquidityTab();

        expect(html).toContain('This LP factory is not supported for guided remove liquidity.');
        expect(html).toContain('Unsupported factory 0x9999...9999');
    });

    it('enables the remove-liquidity action after a supported preview loads', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        const readyPreview = modal.removeLiquidityPreview;
        const removeButton = registerRemoveLiquidityButton();
        globalThis.contractManager = { provider: {} };
        modal.userBalanceRaw = { gte: vi.fn(() => true) };
        modal.removeLiquidityPreview = null;
        modal.removeLiquidityPreviewStatus = 'idle';
        modal.getRemoveLiquidityService = vi.fn(() => ({
            getPreview: vi.fn().mockResolvedValue(readyPreview)
        }));

        await modal.fetchRemoveLiquidityPreview({ force: true });

        expect(removeButton.disabled).toBe(false);
        expect(removeButton.title).toBe('Remove LP liquidity');
    });

    it('enables the remove-liquidity action with a valid amount when details are closed', async () => {
        const modal = await createLoadedModal();
        modal.currentPair = { name: 'LIB/USDT', lpToken: '0xlp' };
        modal.removeLiquidityAmount = '1';
        modal.removeLiquidityEnabled = false;
        modal.userBalanceRaw = { gte: vi.fn(() => true) };
        const removeButton = registerRemoveLiquidityButton('Confirm the remove-liquidity details first');

        modal.updateRemoveLiquidityButton();

        expect(removeButton.disabled).toBe(false);
        expect(removeButton.title).toBe('Remove LP liquidity');
    });

    it('fetches a remove-liquidity preview on execute when details are closed', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        const readyPreview = modal.removeLiquidityPreview;
        modal.removeLiquidityEnabled = false;
        modal.removeLiquidityPreview = null;
        modal.removeLiquidityPreviewStatus = 'idle';
        modal.getRemoveLiquidityAmountRaw = vi.fn(() => createAmount(1));
        modal.fetchRemoveLiquidityPreview = vi.fn(async () => {
            modal.removeLiquidityPreview = readyPreview;
            modal.removeLiquidityPreviewStatus = 'ready';
        });
        modal.executeRemoveLiquidityTransaction = vi.fn().mockResolvedValue({ success: true, hash: '0xremove' });
        modal.loadUserBalances = vi.fn().mockResolvedValue(undefined);
        modal.clearInputs = vi.fn();
        modal.close = vi.fn();
        globalThis.contractManager = {
            isReady: vi.fn(() => true)
        };
        globalThis.notificationManager = {
            info: vi.fn(),
            success: vi.fn(),
            error: vi.fn()
        };
        globalThis.homePage = { refreshData: vi.fn().mockResolvedValue(undefined) };

        const executePromise = modal.executeRemoveLiquidity();
        await vi.runAllTimersAsync();
        await executePromise;

        expect(modal.fetchRemoveLiquidityPreview).toHaveBeenCalledWith({ force: true });
        expect(modal.executeRemoveLiquidityTransaction).toHaveBeenCalledWith('0xlp', expect.objectContaining({ value: 1 }));
        expect(globalThis.notificationManager.error).not.toHaveBeenCalledWith('Confirm the remove-liquidity details before continuing.');
    });

    it('valid custom remove-liquidity slippage applies bps and refreshes the preview', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        modal.fetchRemoveLiquidityPreview = vi.fn();

        const sanitizedValue = modal.setRemoveLiquidityCustomSlippageInput('2.345');
        await vi.advanceTimersByTimeAsync(400);

        expect(sanitizedValue).toBe('2.34');
        expect(modal.removeLiquiditySlippageBps).toBe(234);
        expect(modal.removeLiquidityCustomSlippageError).toBe('');
        expect(modal.removeLiquidityPreview).toBeNull();
        expect(modal.fetchRemoveLiquidityPreview).toHaveBeenCalledTimes(1);
    });

    it('keeps executeUnstake focused on unstaking only', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        const calls = [];
        modal.getRemoveLiquidityAmountRaw = vi.fn(() => createAmount(1));
        modal.executeRemoveLiquidityTransaction = vi.fn(async () => {
            calls.push('remove');
        });
        modal.unstakeAmount = '1';
        modal.loadUserBalances = vi.fn().mockResolvedValue(undefined);
        modal.clearInputs = vi.fn();
        modal.close = vi.fn();
        globalThis.contractManager = {
            isReady: vi.fn(() => true),
            unstake: vi.fn(async () => {
                calls.push('unstake');
                return { success: true, hash: '0xunstake' };
            })
        };
        globalThis.notificationManager = {
            info: vi.fn(),
            success: vi.fn(),
            error: vi.fn()
        };
        globalThis.homePage = { refreshData: vi.fn().mockResolvedValue(undefined) };

        const executePromise = modal.executeUnstake();
        await vi.runAllTimersAsync();
        await executePromise;

        expect(calls).toEqual(['unstake']);
        expect(globalThis.contractManager.unstake).toHaveBeenCalledWith('0xlp', '1', true);
        expect(modal.executeRemoveLiquidityTransaction).not.toHaveBeenCalled();
        expect(modal.clearInputs).toHaveBeenCalled();
        expect(modal.close).toHaveBeenCalled();
    });

    it('executes remove liquidity from the dedicated Remove LP tab', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        modal.getRemoveLiquidityAmountRaw = vi.fn(() => createAmount(1));
        modal.executeRemoveLiquidityTransaction = vi.fn().mockResolvedValue({ success: true, hash: '0xremove' });
        modal.loadUserBalances = vi.fn().mockResolvedValue(undefined);
        modal.clearInputs = vi.fn();
        modal.close = vi.fn();
        globalThis.contractManager = {
            isReady: vi.fn(() => true)
        };
        globalThis.notificationManager = {
            info: vi.fn(),
            success: vi.fn(),
            error: vi.fn()
        };
        globalThis.homePage = { refreshData: vi.fn().mockResolvedValue(undefined) };

        const executePromise = modal.executeRemoveLiquidity();
        await vi.runAllTimersAsync();
        await executePromise;

        expect(modal.executeRemoveLiquidityTransaction).toHaveBeenCalledWith('0xlp', expect.objectContaining({ value: 1 }));
        expect(modal.clearInputs).toHaveBeenCalled();
        expect(modal.close).toHaveBeenCalled();
        expect(globalThis.notificationManager.success).toHaveBeenCalledWith('Liquidity removed successfully!');
    });

    it('approves the router when needed before removing liquidity', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        const liquidityRaw = createAmount(5);
        const service = {
            validateRouterFactory: vi.fn().mockResolvedValue(true),
            getBalance: vi.fn().mockResolvedValue(createAmount(10)),
            getAllowance: vi.fn().mockResolvedValue(createAmount(1)),
            approveIfNeeded: vi.fn().mockResolvedValue({ hash: '0xapprove' }),
            removeLiquidity: vi.fn().mockResolvedValue({ hash: '0xremove' })
        };
        modal.removeLiquidityService = service;
        globalThis.contractManager = {
            provider: {},
            ensureSigner: vi.fn().mockResolvedValue(undefined),
            signer: {
                provider: {},
                getAddress: vi.fn().mockResolvedValue('0xuser')
            },
            executeTransactionOnce: vi.fn(async (operation) => {
                const tx = await operation();
                return { success: true, hash: tx.hash };
            })
        };
        globalThis.walletManager = { provider: {} };
        globalThis.notificationManager = {
            info: vi.fn(),
            success: vi.fn(),
            error: vi.fn()
        };

        await modal.executeRemoveLiquidityTransaction('0xlp', liquidityRaw);

        expect(globalThis.contractManager.executeTransactionOnce).toHaveBeenNthCalledWith(1, expect.any(Function), 'approveRemoveLiquidity');
        expect(globalThis.contractManager.executeTransactionOnce).toHaveBeenNthCalledWith(2, expect.any(Function), 'removeLiquidity');
        expect(service.approveIfNeeded).toHaveBeenCalledWith(expect.objectContaining({
            lpTokenAddress: '0xlp',
            spender: '0xrouter',
            liquidityRaw
        }));
        expect(service.removeLiquidity).toHaveBeenCalledWith(expect.objectContaining({
            routerAddress: '0xrouter',
            token0: '0xlib',
            token1: '0xusdt',
            amount0Min: '99500000000000000000',
            amount1Min: '49750000000000000000',
            recipient: '0xuser'
        }));
    });
});
