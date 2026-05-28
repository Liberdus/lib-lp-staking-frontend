import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const LIB_TOKEN_ADDRESS = '0x05A4cfAF5a8f939d61E4Ec6D6287c9a065d6574c';
const USDT_TOKEN_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const UNSTAKE_RECIPIENT_ADDRESS = '0x2222222222222222222222222222222222222222';
const CLAIM_RECIPIENT_ADDRESS = '0x3333333333333333333333333333333333333333';

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
            if (selector.startsWith('.') && !selector.includes(' ')) {
                const className = selector.slice(1).split('[')[0];
                return allElements.filter(element => element.classList.contains(className));
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
    globalThis.networkSelector = {
        getCurrentChainId: vi.fn(() => 56)
    };
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
        },
        DEFAULTS: {
            REWARD_TOKEN: LIB_TOKEN_ADDRESS
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
            from: vi.fn(value => createAmount(value))
        },
        utils: {
            isAddress: vi.fn(value => /^0x[a-fA-F0-9]{40}$/.test(String(value))),
            getAddress: vi.fn(value => String(value)),
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

function arrangeReadyRemoveLiquidityPreview(modal, { convert = false } = {}) {
    modal.currentPair = { name: 'LIB/USDT', lpToken: '0xlp', address: '0xlp' };
    modal.removeLiquidityAmount = '1';
    modal.userBalance = '10';
    modal.userBalanceRaw = createAmount(10);
    modal.removeLiquidityZapOutEnabled = convert;
    modal.removeLiquidityOutputTokens = [
        { address: LIB_TOKEN_ADDRESS, symbol: 'LIB', name: 'Liberdus', decimals: 18 },
        { address: USDT_TOKEN_ADDRESS, symbol: 'USDT', name: 'Tether USD', decimals: 18 }
    ];
    modal.removeLiquidityOutputTokenAddress = USDT_TOKEN_ADDRESS;
    modal.removeLiquiditySelectedOutputToken = modal.removeLiquidityOutputTokens[1];
    modal.removeLiquidityPreviewStatus = 'ready';
    modal.removeLiquidityPreview = {
        supported: true,
        adapter: {
            name: 'Uniswap V2',
            routerAddress: '0xrouter',
            factoryAddress: '0xfactory'
        },
        token0: {
            address: LIB_TOKEN_ADDRESS,
            symbol: 'LIB',
            decimals: 18,
            amount: { raw: '100000000000000000000', formatted: '100' },
            minAmount: { raw: '99500000000000000000', formatted: '99.5' }
        },
        token1: {
            address: USDT_TOKEN_ADDRESS,
            symbol: 'USDT',
            decimals: 18,
            amount: { raw: '50000000000000000000', formatted: '50' },
            minAmount: { raw: '49750000000000000000', formatted: '49.75' }
        }
    };

    if (convert) {
        modal.removeLiquidityPreview = {
            supported: true,
            zapOut: true,
            outputToken: modal.removeLiquiditySelectedOutputToken,
            liquidityRaw: '1',
            slippageBps: 50,
            data: {
                route: '0xout-route',
                routerAddress: '0x0e97C887b61cCd952a53578B04763E7134429e05',
                zapDetails: {
                    finalAmount: '140000000000000000000',
                    finalAmountUsd: '140',
                    priceImpact: 1
                }
            }
        };
    }
}

function arrangeRecipientSubmission(modal, contractMethods) {
    modal.currentPair = { lpToken: '0xlp', address: '0xlp' };
    modal.clearInputs = vi.fn();
    modal.close = vi.fn();
    globalThis.contractManager = {
        isReady: vi.fn(() => true),
        validateAndChecksumAddress: vi.fn(address => address),
        ...contractMethods
    };
    globalThis.notificationManager = {
        info: vi.fn(),
        success: vi.fn(),
        error: vi.fn()
    };
    globalThis.homePage = { refreshData: vi.fn().mockResolvedValue(undefined) };
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
        mul: other => createAmount(Number(value) * Number(other?.value ?? other)),
        div: other => createAmount(Number(value) / Number(other?.value ?? other)),
        lt: other => Number(value) < Number(other?.value ?? other),
        lte: other => Number(value) <= Number(other?.value ?? other),
        gte: other => Number(value) >= Number(other?.value ?? other),
        add: other => createAmount(Number(value) + Number(other?.value ?? other)),
        sub: other => createAmount(Number(value) - Number(other?.value ?? other)),
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
        delete globalThis.safeModalAddRemoveLiquidityCustomOutputToken;
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
        expect(modalContainer.innerHTML).toContain('<span class="material-icons" aria-hidden="true">arrow_upward</span>');
        expect(modalContainer.innerHTML).toContain('<span class="material-icons" aria-hidden="true">arrow_downward</span>');
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

    it.each([
        ['unstake', 'renderUnstakeTab', 'unstakeRecipientEnabled', 'unstakeRecipientAddress', UNSTAKE_RECIPIENT_ADDRESS],
        ['claim', 'renderClaimTab', 'claimRecipientEnabled', 'claimRecipientAddress', CLAIM_RECIPIENT_ADDRESS]
    ])('keeps the %s recipient field hidden until the recipient checkbox is enabled', async (
        action,
        renderMethod,
        enabledKey,
        addressKey,
        recipientAddress
    ) => {
        const modal = await createLoadedModal();

        const defaultHtml = modal[renderMethod]();
        modal[enabledKey] = true;
        modal[addressKey] = recipientAddress;
        const overrideHtml = modal[renderMethod]();

        expect(defaultHtml).toContain('Send to another wallet');
        expect(defaultHtml).toContain(`id="${action}-recipient-checkbox"`);
        expect(defaultHtml).toContain('Receiving wallet:');
        expect(defaultHtml).toContain('Connected wallet');
        expect(defaultHtml).not.toContain(`id="${action}-recipient-input"`);
        expect(overrideHtml).toContain(`id="${action}-recipient-input"`);
        expect(overrideHtml).toContain(recipientAddress);
        expect(overrideHtml).toContain('Receiving wallet:');
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

    it('sets and clears recipient override state from checkbox selection', async () => {
        const modal = await createLoadedModal();

        modal.setRecipientOverride('unstake', true);
        expect(modal.unstakeRecipientEnabled).toBe(true);

        modal.unstakeRecipientAddress = UNSTAKE_RECIPIENT_ADDRESS;
        modal.setRecipientOverride('unstake', false);
        expect(modal.unstakeRecipientEnabled).toBe(false);
        expect(modal.unstakeRecipientAddress).toBe('');

        modal.claimRecipientEnabled = true;
        modal.claimRecipientAddress = CLAIM_RECIPIENT_ADDRESS;
        modal.clearRecipientOverride('claim');
        expect(modal.claimRecipientEnabled).toBe(false);
        expect(modal.claimRecipientAddress).toBe('');
    });

    it('hides and ignores the unstake recipient override when rewards are not claimed', async () => {
        const modal = await createLoadedModal();
        modal.claimRewardsOnUnstake = false;
        modal.unstakeRecipientEnabled = true;
        modal.unstakeRecipientAddress = UNSTAKE_RECIPIENT_ADDRESS;

        const html = modal.renderUnstakeTab();

        expect(html).not.toContain('id="unstake-recipient-checkbox"');
        expect(html).not.toContain('id="unstake-recipient-input"');
        expect(modal.getValidatedRecipient('unstake')).toEqual({ success: true, address: null });
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
        expect(modal.zapQuoteStatus).toBe('idle');
        expect(modal.zapQuoteError).toBe('');
        expect(modal.canFetchZapQuote()).toBe(false);
        expect(customButton).not.toContain('active');
        expect(html).toContain('aria-invalid="true"');
        expect(html).toContain('zap-custom-slippage-error');
        expect(html.match(/Enter a custom slippage between 0\.01% and 100%\./g)).toHaveLength(1);
    });

    it('does not carry the Create LP custom slippage error into Remove LP', async () => {
        const StakingModalNew = await loadStakingModalClass();
        const modal = new StakingModalNew();
        arrangeReadyRemoveLiquidityPreview(modal);
        const tabContent = document.registerElement(createElement({ id: 'tab-content' }));

        modal.setZapCustomSlippageInput('101');
        modal.currentTab = 'remove-liquidity';
        modal.renderTabContent();

        expect(modal.zapCustomSlippageError).toBe('Enter a custom slippage between 0.01% and 100%.');
        expect(tabContent.innerHTML).not.toContain('zap-custom-slippage-error');
        expect(tabContent.innerHTML).not.toContain('id="zap-custom-slippage-error"');
    });

    it('clearInputs resets invalid custom zap slippage state', async () => {
        const modal = await createLoadedModal();
        modal.zapCustomSlippage = '0';
        modal.zapCustomSlippageError = modal.getZapCustomSlippageError();

        modal.clearInputs();

        expect(modal.zapCustomSlippage).toBe('');
        expect(modal.zapCustomSlippageError).toBe('');
        expect(modal.zapCustomSlippageSelected).toBe(false);
        expect(modal.hasInvalidZapCustomSlippage()).toBe(false);
    });

    it('highlights custom zap slippage when selected before typing a value', async () => {
        const modal = await createLoadedModal();
        arrangeReadyZapQuote(modal);

        modal.setZapSlippage('custom');
        const html = modal.renderZapTab();
        const slippageButtons = [...html.matchAll(/<button[\s\S]*?class="([^"]*)"[\s\S]*?data-slippage="([^"]+)"[\s\S]*?>/g)]
            .filter(([, className]) => className.includes('zap-slippage-btn'));
        const defaultButton = slippageButtons.find(([, , value]) => value === '50');
        const customButton = slippageButtons.find(([, , value]) => value === 'custom');

        expect(modal.zapCustomSlippageSelected).toBe(true);
        expect(defaultButton?.[1]).not.toContain('active');
        expect(customButton?.[1]).toContain('active');
    });

    it('highlights custom zap slippage when the input is focused', async () => {
        const modal = await createLoadedModal();
        const defaultButton = document.registerElement(createElement({
            classes: ['zap-slippage-btn', 'active']
        }));
        defaultButton.dataset.slippage = '50';
        const customButton = document.registerElement(createElement({
            classes: ['zap-slippage-btn']
        }));
        customButton.dataset.slippage = 'custom';
        const customInput = document.registerElement(createElement({
            id: 'zap-custom-slippage-input'
        }));
        const focusHandler = document.addEventListener.mock.calls.find(([eventName]) => eventName === 'focusin')?.[1];

        focusHandler({ target: customInput });

        expect(modal.zapCustomSlippageSelected).toBe(true);
        expect(defaultButton.classList.contains('active')).toBe(false);
        expect(customButton.classList.contains('active')).toBe(true);
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

    it('shows the high slippage warning while the zap quote is waiting to refresh', async () => {
        const modal = await createLoadedModal();
        arrangeReadyZapQuote(modal);
        modal.zapQuoteStatus = 'idle';
        modal.zapQuote = null;
        modal.zapSlippageBps = 500;

        const html = modal.renderZapQuotePanel();

        expect(html).toContain('zap-quote-row zap-risk-high');
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
        arrangeReadyRemoveLiquidityPreview(modal, { convert: true });
        modal.userBalance = '10';
        modal.currentPair = { ...modal.currentPair, tvlUsd: 1000, tvl: 100 };

        const html = modal.renderRemoveLiquidityTab();

        expect(html).toContain('10 LP <span class="lp-usd-estimate">($100.00)</span>');
        expect(html).toContain('id="remove-liquidity-amount-input"');
        expect(html).toContain('remove-liquidity-meta-row');
        expect(html).toContain('id="remove-liquidity-usd-estimate"');
        expect(html).toContain('id="remove-liquidity-checkbox"');
        expect(html).toContain('remove-liquidity-action-btn');
        expect(html).toContain('Convert to one preferred token');
        expect(html).toContain('<label class="form-label">Output Token</label>');
        expect(html).toContain('remove-liquidity-output-token-picker');
        expect(html).toContain('remove-liquidity-output-token-option');
        expect(html).toContain('Custom token');
        expect(html).toContain('Kyber zap-out to USDT');
        expect(html).toContain('remove-liquidity-settings-toggle');
        expect(html).toContain('Max slippage:');
        expect(html).not.toContain('id="remove-liquidity-deadline-input"');
        expect(html).toContain('Estimated USDT');
        expect(html).toContain('140 USDT');
        expect(html).toContain('Minimum received');
        expect(html).toContain('139.3 USDT');
        expect(html).toContain('Price impact');
        expect(html).not.toContain('<dt>Estimated token0</dt>');
        expect(html).not.toContain('<dt>Minimum token0</dt>');
        expect(html).not.toContain('<dt>Kyber Router</dt>');
    });

    it('renders remove-liquidity compact percentage buttons from the saved amount', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal, { convert: true });
        modal.userBalance = '5';
        modal.removeLiquidityAmount = '2.5';

        const html = modal.renderRemoveLiquidityTab();

        expect(html).toContain('zap-label-row zap-amount-label-row');
        expect(html).toContain('zap-percentage-buttons');
        expect(html).not.toContain('id="remove-liquidity-slider"');
        expect(html).toContain('class="zap-percentage-btn remove-liquidity-percentage-btn active" data-percentage="50"');
    });

    it('renders direct remove-liquidity preview and safeguards when conversion is unchecked', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);

        const html = modal.renderRemoveLiquidityTab();

        expect(html).toContain('Convert to one preferred token');
        expect(html).not.toContain('remove-liquidity-output-token-picker');
        expect(html).not.toContain('<label class="form-label">Output Token</label>');
        expect(html).toContain('LIB + USDT via Uniswap V2');
        expect(html).toContain('Max slippage:');
        expect(html).toContain('You receive');
        expect(html).toContain('100 LIB + 50 USDT');
        expect(html).toContain('Minimum received');
        expect(html).toContain('99.5 LIB + 49.75 USDT');
        expect(html).not.toContain('<dt>DEX</dt>');
        expect(html).not.toContain('id="remove-liquidity-deadline-input"');
        expect(html).not.toContain('<dt>Kyber Router</dt>');
    });

    it('flags high slippage in unchecked remove-liquidity previews', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        modal.removeLiquiditySlippageBps = 10000;

        const html = modal.renderRemoveLiquidityPreviewPanel();

        expect(html).toContain('zap-quote-row zap-risk-high');
        expect(html).toContain('Slippage');
        expect(html).toContain('100.00%');
        expect(html).toContain('High slippage tolerance. This transaction may execute at a much worse rate.');
        expect(html).not.toContain('Price impact');
    });

    it('shows the high slippage warning while remove-liquidity preview is waiting to refresh', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        modal.removeLiquidityPreviewStatus = 'idle';
        modal.removeLiquidityPreview = null;
        modal.removeLiquiditySlippageBps = 500;

        const html = modal.renderRemoveLiquidityPreviewPanel();

        expect(html).toContain('zap-quote-row zap-risk-high');
        expect(html).toContain('5.00%');
        expect(html).toContain('High slippage tolerance. This transaction may execute at a much worse rate.');
    });

    it('opens remove-liquidity slippage and deadline controls from the compact dropdown', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        modal.removeLiquiditySettingsOpen = true;

        const html = modal.renderRemoveLiquidityTab();

        expect(html).toContain('aria-expanded="true"');
        expect(html).toContain('0.1%');
        expect(html).toContain('0.5%');
        expect(html).toContain('1.0%');
        expect(html).toContain('Custom');
        expect(html).toContain('id="remove-liquidity-deadline-input"');
        expect(html).toContain('Transaction time limit');
        expect(html).toContain('data-tooltip="Maximum output movement allowed before the transaction reverts."');
        expect(html).toContain('data-tooltip="Latest time this transaction can execute before it reverts."');
        expect(html).toContain('aria-label="Max Slippage: Maximum output movement allowed before the transaction reverts."');
        expect(html).not.toContain('class="remove-liquidity-settings-label"\n                            title=');
    });

    it('highlights custom remove-liquidity slippage when selected before typing a value', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        modal.removeLiquiditySettingsOpen = true;

        modal.setRemoveLiquiditySlippage('custom');
        const html = modal.renderRemoveLiquidityTab();
        const slippageButtons = [...html.matchAll(/<button[\s\S]*?class="([^"]*)"[\s\S]*?data-slippage="([^"]+)"[\s\S]*?>/g)]
            .filter(([, className]) => className.includes('remove-liquidity-slippage-btn'));
        const defaultButton = slippageButtons.find(([, , value]) => value === '50');
        const customButton = slippageButtons.find(([, , value]) => value === 'custom');

        expect(modal.removeLiquidityCustomSlippageSelected).toBe(true);
        expect(defaultButton?.[1]).not.toContain('active');
        expect(customButton?.[1]).toContain('active');
    });

    it('highlights custom remove-liquidity slippage when the input is focused', async () => {
        const modal = await createLoadedModal();
        const defaultButton = document.registerElement(createElement({
            classes: ['zap-slippage-btn', 'remove-liquidity-slippage-btn', 'active']
        }));
        defaultButton.dataset.slippage = '50';
        const customButton = document.registerElement(createElement({
            classes: ['zap-slippage-btn', 'remove-liquidity-slippage-btn']
        }));
        customButton.dataset.slippage = 'custom';
        const customInput = document.registerElement(createElement({
            id: 'remove-liquidity-custom-slippage-input'
        }));
        const focusHandler = document.addEventListener.mock.calls.find(([eventName]) => eventName === 'focusin')?.[1];

        focusHandler({ target: customInput });

        expect(modal.removeLiquidityCustomSlippageSelected).toBe(true);
        expect(defaultButton.classList.contains('active')).toBe(false);
        expect(customButton.classList.contains('active')).toBe(true);
    });

    it('keeps invalid remove-liquidity custom slippage as a field error only', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        modal.removeLiquiditySettingsOpen = true;

        modal.setRemoveLiquidityCustomSlippageInput('101');
        const html = modal.renderRemoveLiquidityTab();

        expect(modal.removeLiquidityCustomSlippageError).toBe('Enter a custom slippage between 0.01% and 100%.');
        expect(modal.removeLiquidityPreviewError).toBe('');
        expect(html).toContain('Enter a valid custom slippage to preview remove liquidity.');
        expect(html).not.toContain('Checking remove liquidity support...');
        expect(html.match(/Enter a custom slippage between 0\.01% and 100%\./g)).toHaveLength(1);
    });

    it('shows a readable over-balance warning on unchecked remove liquidity', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        modal.removeLiquidityAmount = '2';
        modal.userBalance = '1.0';
        modal.userBalanceRaw = { gte: vi.fn(() => false) };

        const html = modal.renderRemoveLiquidityTab();

        expect(html).toContain('id="remove-liquidity-balance-error"');
        expect(html).toContain('Amount exceeds available LP balance (1.0 LP).');
        expect(html).not.toContain('aria-label="DEX:');
        expect(html).not.toContain('remove liquidity = 2000000000000000000');
        expect(modal.canFetchRemoveLiquidityPreview()).toBe(false);
    });

    it('shows a clear checked zap-out message above the LP balance without calling Kyber', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal, { convert: true });
        modal.removeLiquidityZapOutEnabled = true;
        modal.removeLiquidityAmount = '2';
        modal.userBalance = '1.0';
        modal.userBalanceRaw = { gte: vi.fn(() => false) };
        modal.removeLiquidityPreview = null;
        modal.removeLiquidityPreviewStatus = 'idle';
        const fetchOutQuote = vi.fn();
        modal.getKyberZapService().fetchOutQuote = fetchOutQuote;

        await modal.fetchRemoveLiquidityPreview({ force: true });
        const html = modal.renderRemoveLiquidityTab();

        expect(fetchOutQuote).not.toHaveBeenCalled();
        expect(html).toContain('Amount exceeds available LP balance (1.0 LP).');
        expect(html).toContain('zap-quote-card remove-liquidity-preview-card zap-quote-error');
        expect(html).toContain('Kyber cannot quote more LP than your available balance.');
        expect(html).toContain('Kyber quote');
        expect(html).toContain('Unavailable above LP balance');
        expect(html).not.toContain('zap-quote-placeholder');
        expect(html).not.toContain('Route</dt>');
        expect(html).not.toContain('Unsupported</dd>');
    });

    it('auto-refreshes checked remove-liquidity zap-out previews', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal, { convert: true });
        modal.isOpen = true;
        modal.currentTab = 'remove-liquidity';
        modal.fetchRemoveLiquidityPreview = vi.fn();
        const countdown = document.registerElement(createElement({ id: 'remove-liquidity-preview-countdown' }));

        modal.syncRemoveLiquidityPreviewAutoRefresh();
        await vi.advanceTimersByTimeAsync(1000);

        expect(countdown.textContent).toBe('9s');
        expect(modal.fetchRemoveLiquidityPreview).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(9000);

        expect(countdown.textContent).toBe('10s');
        expect(modal.removeLiquidityPreviewRefreshTimer).not.toBeNull();
        expect(modal.fetchRemoveLiquidityPreview).toHaveBeenCalledWith({ force: true });
        modal.stopRemoveLiquidityPreviewAutoRefresh();
    });

    it('renders a countdown for checked remove-liquidity zap-out previews', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal, { convert: true });
        modal.isOpen = true;
        modal.currentTab = 'remove-liquidity';

        const html = modal.renderRemoveLiquidityPreviewPanel();

        expect(html).toContain('id="remove-liquidity-preview-countdown"');
        expect(html).toContain('10s');
    });

    it('renders a countdown for direct remove-liquidity previews', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        modal.isOpen = true;
        modal.currentTab = 'remove-liquidity';

        const html = modal.renderRemoveLiquidityPreviewPanel();

        expect(html).toContain('id="remove-liquidity-preview-countdown"');
        expect(html).toContain('10s');
    });

    it('auto-refreshes direct remove-liquidity previews', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        modal.isOpen = true;
        modal.currentTab = 'remove-liquidity';
        modal.fetchRemoveLiquidityPreview = vi.fn();
        const countdown = document.registerElement(createElement({ id: 'remove-liquidity-preview-countdown' }));

        modal.syncRemoveLiquidityPreviewAutoRefresh();
        await vi.advanceTimersByTimeAsync(1000);

        expect(countdown.textContent).toBe('9s');
        expect(modal.fetchRemoveLiquidityPreview).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(9000);

        expect(countdown.textContent).toBe('10s');
        expect(modal.removeLiquidityPreviewRefreshTimer).not.toBeNull();
        expect(modal.fetchRemoveLiquidityPreview).toHaveBeenCalledWith({ force: true });
        modal.stopRemoveLiquidityPreviewAutoRefresh();
    });

    it('stops remove-liquidity zap-out auto-refresh when leaving the flow', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal, { convert: true });
        modal.isOpen = true;
        modal.currentTab = 'remove-liquidity';

        modal.syncRemoveLiquidityPreviewAutoRefresh();
        expect(modal.removeLiquidityPreviewRefreshTimer).not.toBeNull();

        modal.currentTab = 'zap';
        modal.syncRemoveLiquidityPreviewAutoRefresh();

        expect(modal.removeLiquidityPreviewRefreshTimer).toBeNull();
    });

    it('stops remove-liquidity zap-out auto-refresh when the form resets', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal, { convert: true });
        modal.isOpen = true;
        modal.currentTab = 'remove-liquidity';

        modal.syncRemoveLiquidityPreviewAutoRefresh();
        expect(modal.removeLiquidityPreviewRefreshTimer).not.toBeNull();

        modal.resetRemoveLiquidityFormState();

        expect(modal.removeLiquidityPreviewRefreshTimer).toBeNull();
    });

    it('derives checked remove-liquidity output amount from Kyber zap-out actions', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal, { convert: true });
        const bnbToken = { address: 'native', symbol: 'BNB', name: 'BNB', decimals: 18 };
        modal.removeLiquidityOutputTokens = [bnbToken];
        modal.removeLiquidityOutputTokenAddress = 'native';
        modal.removeLiquiditySelectedOutputToken = bnbToken;
        modal.removeLiquidityPreview = {
            supported: true,
            zapOut: true,
            outputToken: bnbToken,
            data: {
                route: '0xout-route',
                routerAddress: '0x0e97C887b61cCd952a53578B04763E7134429e05',
                zapDetails: {
                    finalAmountUsd: '0.40',
                    priceImpact: 1.26,
                    actions: [
                        {
                            type: 'ACTION_TYPE_AGGREGATOR_SWAP',
                            aggregatorSwap: {
                                swaps: [
                                    {
                                        tokenOut: {
                                            address: globalThis.CONFIG.KYBER_ZAP.NATIVE_TOKEN_ADDRESS,
                                            amount: '1230000000000000',
                                            amountUsd: '0.40'
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            }
        };

        const html = modal.renderRemoveLiquidityPreviewPanel();

        expect(html).toContain('Estimated BNB');
        expect(html).toContain('0.00123 BNB');
        expect(html).toContain('Minimum received');
        expect(html).toContain('Price impact');
    });

    it('renders Kyber Zap Fee when checked remove-liquidity route returns a protocol fee', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal, { convert: true });
        const daiToken = {
            address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
            symbol: 'DAI',
            name: 'Dai Token',
            decimals: 18
        };
        modal.removeLiquidityOutputTokens = [daiToken];
        modal.removeLiquidityOutputTokenAddress = daiToken.address;
        modal.removeLiquiditySelectedOutputToken = daiToken;
        modal.removeLiquidityPreview = {
            supported: true,
            zapOut: true,
            outputToken: daiToken,
            data: {
                route: '0xout-route',
                routerAddress: '0x0e97C887b61cCd952a53578B04763E7134429e05',
                zapDetails: {
                    finalAmount: '394877000000000000',
                    protocolFee: {
                        tokens: [{
                            address: daiToken.address,
                            amount: '2500000000000000',
                            symbol: 'DAI',
                            decimals: 18
                        }]
                    }
                }
            }
        };

        const html = modal.renderRemoveLiquidityPreviewPanel();

        expect(html).toContain('Kyber Zap Fee');
        expect(html).toContain('0.0025 DAI');
    });

    it('flags high price impact and slippage in checked remove-liquidity zap-out previews', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal, { convert: true });
        modal.removeLiquiditySlippageBps = 10000;
        modal.removeLiquidityPreview.data.zapDetails.priceImpact = 15.42;

        const html = modal.renderRemoveLiquidityPreviewPanel();

        expect(html.match(/zap-quote-row zap-risk-high/g)).toHaveLength(2);
        expect(html).toContain('15.42%');
        expect(html).toContain('100.00%');
        expect(html).toContain('High price impact. You may receive significantly less LP value than expected.');
        expect(html).toContain('High slippage tolerance. This transaction may execute at a much worse rate.');
    });

    it('renders every Kyber zap-out protocol fee token returned by the route', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal, { convert: true });
        const wbnbToken = {
            address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
            symbol: 'WBNB',
            name: 'Wrapped BNB',
            decimals: 18
        };
        modal.removeLiquidityOutputTokens = [
            { address: USDT_TOKEN_ADDRESS, symbol: 'USDT', name: 'Tether USD', decimals: 18 },
            { address: LIB_TOKEN_ADDRESS, symbol: 'LIB', name: 'Liberdus', decimals: 18 },
            wbnbToken
        ];
        modal.removeLiquidityOutputTokenAddress = wbnbToken.address;
        modal.removeLiquiditySelectedOutputToken = wbnbToken;
        modal.removeLiquidityPreview = {
            supported: true,
            zapOut: true,
            outputToken: wbnbToken,
            data: {
                route: '0xout-route',
                routerAddress: '0x0e97C887b61cCd952a53578B04763E7134429e05',
                zapDetails: {
                    finalAmount: '294841419648257',
                    actions: [{
                        type: 'ACTION_TYPE_PROTOCOL_FEE',
                        protocolFee: {
                            tokens: [
                                {
                                    address: USDT_TOKEN_ADDRESS,
                                    amount: '248488902181974'
                                },
                                {
                                    address: LIB_TOKEN_ADDRESS,
                                    amount: '25305065600541886'
                                }
                            ]
                        }
                    }]
                }
            }
        };

        const html = modal.renderRemoveLiquidityPreviewPanel();

        expect(html).toContain('Kyber Zap Fee');
        expect(html).toContain('0.000248 USDT + 0.025305 LIB');
    });

    it('does not render Kyber Zap Fee for unchecked remove liquidity', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal, { convert: false });

        const html = modal.renderRemoveLiquidityPreviewPanel();

        expect(html).not.toContain('Kyber Zap Fee');
    });

    it('does not double-count repeated Kyber action amounts for checked zap-out output', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal, { convert: true });
        const daiToken = {
            address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
            symbol: 'DAI',
            name: 'Dai Token',
            decimals: 18
        };
        const daiActionToken = {
            address: daiToken.address,
            amount: '394877000000000000',
            amountUsd: '0.40'
        };
        modal.removeLiquidityOutputTokens = [daiToken];
        modal.removeLiquidityOutputTokenAddress = daiToken.address;
        modal.removeLiquiditySelectedOutputToken = daiToken;
        modal.removeLiquidityPreview = {
            supported: true,
            zapOut: true,
            outputToken: daiToken,
            data: {
                route: '0xout-route',
                routerAddress: '0x0e97C887b61cCd952a53578B04763E7134429e05',
                zapDetails: {
                    finalAmountUsd: '0.40',
                    actions: [
                        { aggregatorSwap: { swaps: [{ tokenOut: daiActionToken }] } },
                        { refund: { tokens: [daiActionToken] } }
                    ]
                }
            }
        };

        const html = modal.renderRemoveLiquidityPreviewPanel();

        expect(html).toContain('Estimated DAI');
        expect(html).toContain('0.394877 DAI');
        expect(html).not.toContain('0.789754 DAI');
    });

    it('configured output token selection refreshes the zap-out quote', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        modal.removeLiquidityZapOutEnabled = true;
        modal.removeLiquidityPreview = null;
        modal.removeLiquidityPreviewStatus = 'idle';
        modal.userBalanceRaw = { gte: vi.fn(() => true) };
        globalThis.walletManager = { address: '0xwallet', provider: {} };
        globalThis.contractManager = { provider: {} };
        const fetchOutQuote = vi.fn().mockResolvedValue({
            data: {
                route: '0xroute',
                routerAddress: '0x0e97C887b61cCd952a53578B04763E7134429e05'
            }
        });
        modal.getKyberZapService().fetchOutQuote = fetchOutQuote;

        modal.setRemoveLiquidityOutputToken(LIB_TOKEN_ADDRESS);
        await vi.runAllTimersAsync();

        expect(modal.removeLiquiditySelectedOutputToken).toEqual(expect.objectContaining({ address: LIB_TOKEN_ADDRESS }));
        expect(fetchOutQuote).toHaveBeenCalledWith(expect.objectContaining({
            lpTokenAddress: '0xlp',
            walletAddress: '0xwallet',
            tokenOutAddress: LIB_TOKEN_ADDRESS,
            liquidityRaw: expect.objectContaining({ value: '1' }),
            slippageBps: 50
        }));
    });

    it('custom output token can be added and used for zap-out quote', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        modal.removeLiquidityZapOutEnabled = true;
        modal.removeLiquidityPreview = null;
        modal.removeLiquidityCustomOutputTokenAddress = '0x1111111111111111111111111111111111111111';
        modal.userBalanceRaw = { gte: vi.fn(() => true) };
        modal.getTokenMetadata = vi.fn().mockResolvedValue({ symbol: 'ABC', name: 'ABC Token', decimals: 18 });
        modal.loadRemoveLiquidityCustomOutputTokenIcon = vi.fn().mockResolvedValue(false);
        globalThis.walletManager = { address: '0xwallet', provider: {} };
        globalThis.contractManager = { provider: {} };
        const fetchOutQuote = vi.fn().mockResolvedValue({
            data: {
                route: '0xroute',
                routerAddress: '0x0e97C887b61cCd952a53578B04763E7134429e05'
            }
        });
        modal.getKyberZapService().fetchOutQuote = fetchOutQuote;

        await modal.addRemoveLiquidityCustomOutputToken();
        await vi.runAllTimersAsync();

        expect(modal.removeLiquiditySelectedOutputToken).toEqual(expect.objectContaining({
            address: '0x1111111111111111111111111111111111111111',
            symbol: 'ABC',
            custom: true
        }));
        expect(fetchOutQuote).toHaveBeenCalledWith(expect.objectContaining({
            tokenOutAddress: '0x1111111111111111111111111111111111111111'
        }));
    });

    it('keeps guided remove-liquidity controls out of the Unstake tab', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        modal.userStaked = '10';

        const html = modal.renderUnstakeTab();

        expect(html).not.toContain('id="remove-liquidity-checkbox"');
        expect(html).not.toContain('Convert to one preferred token');
        expect(html).not.toContain('remove-liquidity-preview-panel');
    });

    it('shows a blocking zap-out quote error when Kyber cannot route the checked flow', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal, { convert: true });
        modal.removeLiquidityPreviewStatus = 'error';
        modal.removeLiquidityPreviewError = 'Kyber could not build a zap-out route for this LP.';
        modal.removeLiquidityPreview = null;

        const html = modal.renderRemoveLiquidityTab();

        expect(html).toContain('Kyber could not build a zap-out route for this LP.');
        expect(html).toContain('<dd>Unsupported</dd>');
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

    it('keeps the direct remove-liquidity action disabled until a preview loads', async () => {
        const modal = await createLoadedModal();
        modal.currentPair = { name: 'LIB/USDT', lpToken: '0xlp' };
        modal.removeLiquidityAmount = '1';
        modal.removeLiquidityZapOutEnabled = false;
        modal.userBalanceRaw = { gte: vi.fn(() => true) };
        const removeButton = registerRemoveLiquidityButton();

        modal.updateRemoveLiquidityButton();

        expect(removeButton.disabled).toBe(true);
        expect(removeButton.title).toBe('Wait for a supported remove-liquidity preview.');
    });

    it('fetches a remove-liquidity preview on execute when details are closed', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        const readyPreview = modal.removeLiquidityPreview;
        modal.removeLiquidityZapOutEnabled = false;
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
        arrangeReadyRemoveLiquidityPreview(modal, { convert: true });
        modal.fetchRemoveLiquidityPreview = vi.fn();

        const sanitizedValue = modal.setRemoveLiquidityCustomSlippageInput('2.345');
        await vi.advanceTimersByTimeAsync(400);

        expect(sanitizedValue).toBe('2.34');
        expect(modal.removeLiquiditySlippageBps).toBe(234);
        expect(modal.removeLiquidityCustomSlippageError).toBe('');
        expect(modal.removeLiquidityPreview).toBeNull();
        expect(modal.fetchRemoveLiquidityPreview).toHaveBeenCalledTimes(1);
    });

    it('keeps the configured remove-liquidity deadline when the input is cleared', async () => {
        const modal = await createLoadedModal();
        modal.removeLiquidityDeadlineMinutes = 45;
        modal.updateRemoveLiquidityPreviewPanel = vi.fn();

        const sanitizedValue = modal.setRemoveLiquidityDeadlineInput('');

        expect(sanitizedValue).toBe('');
        expect(modal.removeLiquidityDeadlineMinutes).toBe(20);
        expect(modal.updateRemoveLiquidityPreviewPanel).toHaveBeenCalledTimes(1);
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

    it('passes a custom recipient when executing recipient-aware unstake', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        modal.unstakeAmount = '1';
        modal.unstakeRecipientEnabled = true;
        modal.unstakeRecipientAddress = UNSTAKE_RECIPIENT_ADDRESS;
        arrangeRecipientSubmission(modal, {
            unstake: vi.fn(async () => ({ success: true, hash: '0xunstake-to' }))
        });

        const executePromise = modal.executeUnstake();
        await vi.runAllTimersAsync();
        await executePromise;

        expect(globalThis.contractManager.unstake).toHaveBeenCalledWith(
            '0xlp',
            '1',
            true,
            UNSTAKE_RECIPIENT_ADDRESS
        );
        expect(globalThis.notificationManager.error).not.toHaveBeenCalled();
    });

    it('keeps unstake on the default recipient path when reward claiming is disabled', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        modal.unstakeAmount = '1';
        modal.claimRewardsOnUnstake = false;
        modal.unstakeRecipientEnabled = true;
        modal.unstakeRecipientAddress = UNSTAKE_RECIPIENT_ADDRESS;
        arrangeRecipientSubmission(modal, {
            unstake: vi.fn(async () => ({ success: true, hash: '0xunstake' }))
        });

        const executePromise = modal.executeUnstake();
        await vi.runAllTimersAsync();
        await executePromise;

        expect(globalThis.contractManager.unstake).toHaveBeenCalledWith('0xlp', '1', false);
        expect(globalThis.notificationManager.error).not.toHaveBeenCalled();
    });

    it('blocks unstake when the custom recipient is malformed', async () => {
        const modal = await createLoadedModal();
        modal.unstakeAmount = '1';
        modal.unstakeRecipientEnabled = true;
        modal.unstakeRecipientAddress = 'not-an-address';
        arrangeRecipientSubmission(modal, {
            unstake: vi.fn()
        });

        await modal.executeUnstake();

        expect(globalThis.contractManager.unstake).not.toHaveBeenCalled();
        expect(globalThis.notificationManager.error).toHaveBeenCalledWith('Enter a valid recipient address.');
        expect(modal.unstakeRecipientError).toBe('Enter a valid recipient address.');
        expect(modal.clearInputs).not.toHaveBeenCalled();
        expect(modal.close).not.toHaveBeenCalled();
    });

    it('keeps default claim rewards submission unchanged', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        modal.pendingRewards = '1';
        arrangeRecipientSubmission(modal, {
            claimRewards: vi.fn(async () => ({ success: true, hash: '0xclaim' }))
        });

        const executePromise = modal.executeClaim();
        await vi.runAllTimersAsync();
        await executePromise;

        expect(globalThis.contractManager.claimRewards).toHaveBeenCalledWith('0xlp');
        expect(globalThis.notificationManager.success).toHaveBeenCalledWith('Rewards claimed successfully!');
    });

    it('passes a custom recipient when executing recipient-aware claim', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        modal.pendingRewards = '1';
        modal.claimRecipientEnabled = true;
        modal.claimRecipientAddress = CLAIM_RECIPIENT_ADDRESS;
        arrangeRecipientSubmission(modal, {
            claimRewards: vi.fn(async () => ({ success: true, hash: '0xclaim-to' }))
        });

        const executePromise = modal.executeClaim();
        await vi.runAllTimersAsync();
        await executePromise;

        expect(globalThis.contractManager.claimRewards).toHaveBeenCalledWith(
            '0xlp',
            CLAIM_RECIPIENT_ADDRESS
        );
        expect(globalThis.notificationManager.error).not.toHaveBeenCalled();
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

    it('checked execute builds Kyber out route, approves LP to Kyber, and sends one zapOutLP transaction', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal, { convert: true });
        const liquidityRaw = createAmount(5);
        modal.getRemoveLiquidityAmountRaw = vi.fn(() => liquidityRaw);
        modal.loadUserBalances = vi.fn().mockResolvedValue(undefined);
        modal.clearInputs = vi.fn();
        modal.close = vi.fn();
        const routerAddress = '0x0e97C887b61cCd952a53578B04763E7134429e05';
        const buildOutRoute = vi.fn().mockResolvedValue({ txData: '0xzapdata', to: routerAddress, value: '0' });
        const validateRouterAddress = vi.fn();
        modal.getKyberZapService().buildOutRoute = buildOutRoute;
        modal.getKyberZapService().validateRouterAddress = validateRouterAddress;
        const approve = vi.fn().mockResolvedValue({ hash: '0xapprove-lp' });
        const allowance = vi.fn().mockResolvedValue(createAmount(0));
        const sendTransaction = vi.fn().mockResolvedValue({ hash: '0xzap' });
        globalThis.contractManager = {
            isReady: vi.fn(() => true),
            provider: {},
            ensureSigner: vi.fn().mockResolvedValue(undefined),
            signer: {
                provider: {},
                getAddress: vi.fn().mockResolvedValue('0xwallet'),
                sendTransaction
            },
            executeTransactionOnce: vi.fn(async (operation) => {
                const tx = await operation();
                return { success: true, hash: tx.hash };
            })
        };
        globalThis.ethers.Contract = vi.fn(function(address, abi, runner) {
            return (
            runner === globalThis.contractManager.signer
                ? { approve }
                : { allowance }
            );
        });
        globalThis.walletManager = { address: '0xwallet', provider: {} };
        globalThis.notificationManager = {
            info: vi.fn(),
            success: vi.fn(),
            error: vi.fn()
        };
        globalThis.homePage = { refreshData: vi.fn().mockResolvedValue(undefined) };

        const executePromise = modal.executeRemoveLiquidity();
        await vi.runAllTimersAsync();
        await executePromise;

        expect(buildOutRoute).toHaveBeenCalledWith(expect.objectContaining({
            route: '0xout-route',
            sender: '0xwallet',
            recipient: '0xwallet'
        }));
        expect(validateRouterAddress).toHaveBeenCalledWith(routerAddress, expect.any(Object));
        expect(allowance).toHaveBeenCalledWith('0xwallet', routerAddress);
        expect(approve).toHaveBeenCalledWith(routerAddress, liquidityRaw);
        expect(globalThis.contractManager.executeTransactionOnce).toHaveBeenNthCalledWith(1, expect.any(Function), 'approveRemoveLiquidityZapOut');
        expect(globalThis.contractManager.executeTransactionOnce).toHaveBeenNthCalledWith(2, expect.any(Function), 'zapOutLP');
        expect(sendTransaction).toHaveBeenCalledWith(expect.objectContaining({
            to: routerAddress,
            data: '0xzapdata'
        }));
        expect(globalThis.notificationManager.success).toHaveBeenCalledWith('LP tokens zapped out successfully!');
    });

    it('blocks checked zap-out execution when the amount exceeds the LP balance', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal, { convert: true });
        modal.removeLiquidityAmount = '2';
        modal.userBalance = '1.0';
        modal.userBalanceRaw = { gte: vi.fn(() => false) };
        modal.executeRemoveLiquidityZapOutTransaction = vi.fn();
        globalThis.contractManager = {
            isReady: vi.fn(() => true)
        };
        globalThis.notificationManager = {
            info: vi.fn(),
            success: vi.fn(),
            error: vi.fn()
        };

        await modal.executeRemoveLiquidity();

        expect(modal.executeRemoveLiquidityZapOutTransaction).not.toHaveBeenCalled();
        expect(globalThis.notificationManager.error).toHaveBeenCalledWith('Amount exceeds available LP balance (1.0 LP).');
    });

    it('unchecked execute still calls direct removeLiquidity and skips Kyber zap-out endpoints', async () => {
        vi.useFakeTimers();
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        modal.getRemoveLiquidityAmountRaw = vi.fn(() => createAmount(1));
        modal.executeRemoveLiquidityTransaction = vi.fn().mockResolvedValue({ success: true, hash: '0xremove' });
        modal.executeRemoveLiquidityZapOutTransaction = vi.fn();
        modal.getKyberZapService().fetchOutQuote = vi.fn();
        modal.getKyberZapService().buildOutRoute = vi.fn();
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
        expect(modal.executeRemoveLiquidityZapOutTransaction).not.toHaveBeenCalled();
        expect(modal.getKyberZapService().fetchOutQuote).not.toHaveBeenCalled();
        expect(modal.getKyberZapService().buildOutRoute).not.toHaveBeenCalled();
    });

    it('router mismatch blocks checked zap-out before LP approval or transaction send', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal, { convert: true });
        modal.getKyberZapService().buildOutRoute = vi.fn().mockResolvedValue({
            txData: '0xzapdata',
            to: '0x1111111111111111111111111111111111111111'
        });
        const sendTransaction = vi.fn();
        globalThis.ethers.Contract = vi.fn();
        globalThis.contractManager = {
            provider: {},
            ensureSigner: vi.fn().mockResolvedValue(undefined),
            signer: {
                getAddress: vi.fn().mockResolvedValue('0xwallet'),
                sendTransaction
            },
            executeTransactionOnce: vi.fn()
        };
        globalThis.walletManager = { address: '0xwallet', provider: {} };

        await expect(modal.executeRemoveLiquidityZapOutTransaction('0xlp', createAmount(5)))
            .rejects.toThrow('Kyber returned an unexpected zap router');

        expect(globalThis.ethers.Contract).not.toHaveBeenCalled();
        expect(globalThis.contractManager.executeTransactionOnce).not.toHaveBeenCalled();
        expect(sendTransaction).not.toHaveBeenCalled();
    });

    it('quote failures show errors and leave remove-liquidity inputs intact', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        modal.removeLiquidityZapOutEnabled = true;
        modal.removeLiquidityPreview = null;
        modal.removeLiquidityPreviewStatus = 'idle';
        modal.removeLiquidityAmount = '2';
        modal.userBalanceRaw = { gte: vi.fn(() => true) };
        globalThis.walletManager = { address: '0xwallet', provider: {} };
        globalThis.contractManager = { provider: {} };
        modal.getKyberZapService().fetchOutQuote = vi.fn().mockRejectedValue(new Error('Kyber quote failed'));

        await modal.fetchRemoveLiquidityPreview({ force: true });

        expect(modal.removeLiquidityPreviewStatus).toBe('error');
        expect(modal.removeLiquidityPreviewError).toBe('Kyber quote failed');
        expect(modal.removeLiquidityAmount).toBe('2');
        expect(modal.removeLiquiditySelectedOutputToken).toEqual(expect.objectContaining({ address: USDT_TOKEN_ADDRESS }));
    });

    it('shows a readable zap-out error when Kyber reports insufficient position liquidity', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        modal.removeLiquidityZapOutEnabled = true;
        modal.removeLiquidityPreview = null;
        modal.removeLiquidityPreviewStatus = 'idle';
        modal.removeLiquidityAmount = '1';
        modal.userBalanceRaw = { gte: vi.fn(() => true) };
        globalThis.walletManager = { address: '0xwallet', provider: {} };
        globalThis.contractManager = { provider: {} };
        modal.getKyberZapService().fetchOutQuote = vi.fn().mockRejectedValue(
            new Error('remove liquidity = 1000000000000000000 > position liquidity = 0')
        );

        await modal.fetchRemoveLiquidityPreview({ force: true });

        expect(modal.removeLiquidityPreviewError).toBe('Amount exceeds your available LP balance.');
        expect(modal.renderRemoveLiquidityPreviewPanel()).toContain('Amount exceeds your available LP balance.');
        expect(modal.renderRemoveLiquidityPreviewPanel()).not.toContain('1000000000000000000');
    });

    it('build failures show errors and leave checked zap-out inputs intact', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal, { convert: true });
        modal.getRemoveLiquidityAmountRaw = vi.fn(() => createAmount(1));
        modal.loadUserBalances = vi.fn().mockResolvedValue(undefined);
        modal.clearInputs = vi.fn();
        modal.close = vi.fn();
        modal.getKyberZapService().buildOutRoute = vi.fn().mockRejectedValue(new Error('Kyber build failed'));
        globalThis.contractManager = {
            isReady: vi.fn(() => true),
            provider: {},
            ensureSigner: vi.fn().mockResolvedValue(undefined),
            signer: {
                getAddress: vi.fn().mockResolvedValue('0xwallet'),
                sendTransaction: vi.fn()
            }
        };
        globalThis.walletManager = { address: '0xwallet', provider: {} };
        globalThis.notificationManager = {
            info: vi.fn(),
            success: vi.fn(),
            error: vi.fn()
        };

        await modal.executeRemoveLiquidity();

        expect(globalThis.notificationManager.error).toHaveBeenCalledWith('Kyber build failed', { title: undefined });
        expect(modal.removeLiquidityAmount).toBe('1');
        expect(modal.removeLiquiditySelectedOutputToken).toEqual(expect.objectContaining({ address: USDT_TOKEN_ADDRESS }));
        expect(modal.clearInputs).not.toHaveBeenCalled();
        expect(modal.close).not.toHaveBeenCalled();
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
            token0: LIB_TOKEN_ADDRESS,
            token1: USDT_TOKEN_ADDRESS,
            amount0Min: '99500000000000000000',
            amount1Min: '49750000000000000000',
            recipient: '0xuser'
        }));
    });

    it('continues removing liquidity when approval becomes sufficient before approval transaction', async () => {
        const modal = await createLoadedModal();
        arrangeReadyRemoveLiquidityPreview(modal);
        const liquidityRaw = createAmount(5);
        const service = {
            validateRouterFactory: vi.fn().mockResolvedValue(true),
            getBalance: vi.fn().mockResolvedValue(createAmount(10)),
            getAllowance: vi.fn().mockResolvedValue(createAmount(1)),
            approveIfNeeded: vi.fn().mockResolvedValue(null),
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

        expect(service.approveIfNeeded).toHaveBeenCalledWith(expect.objectContaining({
            lpTokenAddress: '0xlp',
            spender: '0xrouter',
            liquidityRaw
        }));
        expect(globalThis.contractManager.executeTransactionOnce).toHaveBeenCalledTimes(1);
        expect(globalThis.contractManager.executeTransactionOnce).toHaveBeenCalledWith(expect.any(Function), 'removeLiquidity');
        expect(service.removeLiquidity).toHaveBeenCalledWith(expect.objectContaining({
            routerAddress: '0xrouter',
            recipient: '0xuser'
        }));
    });
});
