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

    it('returns a loading placeholder until TVL is calculated', async () => {
        const homePagePrototype = await loadHomePage();

        expect(homePagePrototype.formatTvlDisplay.call({}, undefined)).toBe('...');
        expect(homePagePrototype.formatTvlDisplay.call({}, { tvlCalculated: false })).toBe('...');
    });

    it('returns N/A when USD pricing is unavailable', async () => {
        const homePagePrototype = await loadHomePage();

        expect(homePagePrototype.formatTvlDisplay.call({}, { tvlCalculated: true, tvlUsd: null })).toBe('N/A');
        expect(homePagePrototype.formatTvlDisplay.call({}, { tvlCalculated: true, tvlUsd: undefined })).toBe('N/A');
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
