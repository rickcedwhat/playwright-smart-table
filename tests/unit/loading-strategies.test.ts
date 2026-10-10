import { describe, it, expect, vi } from 'vitest';
import { LoadingStrategies } from '../../src/strategies/loading';
import type { SmartRow, TableContext } from '../../src/types';

const contextWithSpinner = (isVisible: () => Promise<boolean>) => {
    const locator = vi.fn().mockReturnValue({ first: () => ({ isVisible }) });
    return { context: { root: { locator } } as unknown as TableContext, locator };
};

const rowWith = (fields: { cls?: string | null; text?: string }) => ({
    getAttribute: vi.fn().mockResolvedValue(fields.cls ?? null),
    innerText: vi.fn().mockResolvedValue(fields.text ?? ''),
}) as unknown as SmartRow;

describe('LoadingStrategies.Table.hasSpinner', () => {
    it('is loading while the spinner is visible, using .loading-spinner by default', async () => {
        const { context, locator } = contextWithSpinner(async () => true);
        expect(await LoadingStrategies.Table.hasSpinner()(context)).toBe(true);
        expect(locator).toHaveBeenCalledWith('.loading-spinner');
    });

    it('is not loading when a custom spinner is hidden', async () => {
        const { context, locator } = contextWithSpinner(async () => false);
        expect(await LoadingStrategies.Table.hasSpinner('.busy')(context)).toBe(false);
        expect(locator).toHaveBeenCalledWith('.busy');
    });

    it('treats a visibility check that throws as not loading', async () => {
        const { context } = contextWithSpinner(async () => { throw new Error('detached'); });
        expect(await LoadingStrategies.Table.hasSpinner()(context)).toBe(false);
    });
});

describe('LoadingStrategies.Row.hasClass', () => {
    it('matches the default "skeleton" class', async () => {
        expect(await LoadingStrategies.Row.hasClass()(rowWith({ cls: 'row skeleton' }))).toBe(true);
    });

    it('matches a custom class and ignores rows without it', async () => {
        const isLoading = LoadingStrategies.Row.hasClass('pending');
        expect(await isLoading(rowWith({ cls: 'row pending' }))).toBe(true);
        expect(await isLoading(rowWith({ cls: 'row ready' }))).toBe(false);
    });

    it('is not loading when the row has no class attribute', async () => {
        expect(await LoadingStrategies.Row.hasClass()(rowWith({ cls: null }))).toBe(false);
    });
});

describe('LoadingStrategies.Row.hasText', () => {
    it('matches the default "Loading..." text as a substring', async () => {
        const isLoading = LoadingStrategies.Row.hasText();
        expect(await isLoading(rowWith({ text: 'Loading... please wait' }))).toBe(true);
        expect(await isLoading(rowWith({ text: 'Alice' }))).toBe(false);
    });

    it('matches a RegExp', async () => {
        const isLoading = LoadingStrategies.Row.hasText(/^fetching/i);
        expect(await isLoading(rowWith({ text: 'Fetching row 3' }))).toBe(true);
        expect(await isLoading(rowWith({ text: 'Row 3 fetching' }))).toBe(false);
    });
});

describe('LoadingStrategies.Row.hasEmptyCells', () => {
    it('is loading when the row has only whitespace text', async () => {
        expect(await LoadingStrategies.Row.hasEmptyCells()(rowWith({ text: ' \n\t ' }))).toBe(true);
    });

    it('is not loading once the row has any text', async () => {
        expect(await LoadingStrategies.Row.hasEmptyCells()(rowWith({ text: 'Alice' }))).toBe(false);
    });
});
