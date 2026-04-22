import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadFormatter() {
    vi.resetModules();
    globalThis.window = globalThis;
    delete globalThis.Formatter;

    await import('../js/utils/formatter.js');
    return globalThis.Formatter;
}

describe('Formatter currency helpers', () => {
    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.Formatter;
        delete globalThis.window;
    });

    it('formats currency values with cents and safe defaults', async () => {
        const formatter = await loadFormatter();

        expect(formatter.formatCurrency(12.345)).toBe('$12.35');
        expect(formatter.formatCurrency(-5)).toBe('$-5.00');
        expect(formatter.formatCurrency('not-a-number')).toBe('$0.00');
    });

    it('formats compact currency at threshold boundaries', async () => {
        const formatter = await loadFormatter();

        expect(formatter.formatCompactCurrency(999.5)).toBe('$999.50');
        expect(formatter.formatCompactCurrency(1000)).toBe('$1.00K');
        expect(formatter.formatCompactCurrency(1500000)).toBe('$1.50M');
        expect(formatter.formatCompactCurrency(2000000000)).toBe('$2.00B');
    });

    it('returns a safe default for non-finite compact currency input', async () => {
        const formatter = await loadFormatter();

        expect(formatter.formatCompactCurrency(Number.POSITIVE_INFINITY)).toBe('$0.00');
        expect(formatter.formatCompactCurrency(undefined)).toBe('$0.00');
    });
});
