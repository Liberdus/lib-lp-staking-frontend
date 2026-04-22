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

    it.each([
        { input: 12.345, expected: '$12.35' },
        { input: -5, expected: '$-5.00' },
        { input: 'not-a-number', expected: '$0.00' }
    ])('formatCurrency(%j) -> %s', async ({ input, expected }) => {
        const formatter = await loadFormatter();

        expect(formatter.formatCurrency(input)).toBe(expected);
    });

    it.each([
        { input: 999.5, expected: '$999.50' },
        { input: 1000, expected: '$1.00K' },
        { input: 1500000, expected: '$1.50M' },
        { input: 2000000000, expected: '$2.00B' },
        { input: Number.POSITIVE_INFINITY, expected: '$0.00' },
        { input: undefined, expected: '$0.00' }
    ])('formatCompactCurrency(%j) -> %s', async ({ input, expected }) => {
        const formatter = await loadFormatter();

        expect(formatter.formatCompactCurrency(input)).toBe(expected);
    });
});
