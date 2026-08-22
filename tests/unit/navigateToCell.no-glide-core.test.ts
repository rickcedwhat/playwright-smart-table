import { describe, it, expect, vi } from 'vitest';
import type { Locator, Page } from '@playwright/test';
import createSmartRow from '../../src/smartRow';
import { FinalTableConfig } from '../../src/types';

type MockCellLocator = Pick<Locator, 'count' | 'focus' | 'nth'>;
type MockRowLocator = Pick<Locator, 'count' | 'nth' | 'page' | 'evaluate' | 'scrollIntoViewIfNeeded' | 'focus'>;
type MockPage = Pick<Page, 'keyboard' | 'waitForTimeout'>;

/**
 * #426 option B: core must not special-case Glide canvas / keyboard Home after
 * snapFirstColumnIntoView. That behavior belongs in the navigation primitive (or viewport).
 */
describe('Issue 426: no Glide canvas/Home in _navigateToCell', () => {
    it('calls snapFirstColumnIntoView without pressing Home or focusing a canvas', async () => {
        const keyboardPress = vi.fn();
        const waitForTimeout = vi.fn().mockResolvedValue(undefined);
        const evaluate = vi.fn().mockResolvedValue(undefined);

        let snapped = false;
        const cellLocator: MockCellLocator = {
            count: vi.fn().mockImplementation(async () => (snapped ? 1 : 0)),
            focus: vi.fn().mockResolvedValue(undefined),
            nth: vi.fn().mockReturnThis(),
        };

        const mockPage: MockPage = {
            keyboard: { press: keyboardPress },
            waitForTimeout,
        };

        const mockLocator: MockRowLocator = {
            count: vi.fn().mockImplementation(async () => (snapped ? 1 : 0)),
            nth: vi.fn().mockReturnValue(cellLocator),
            page: vi.fn().mockReturnValue(mockPage as Page),
            evaluate,
            scrollIntoViewIfNeeded: vi.fn(),
            focus: vi.fn().mockResolvedValue(undefined),
        };

        const snapFirstColumnIntoView = vi.fn().mockImplementation(async () => {
            snapped = true;
        });

        // Focus sits on col 5 until snap brings us to col 0.
        const getActiveCell = vi.fn().mockImplementation(async () => ({
            rowIndex: 2,
            columnIndex: snapped ? 0 : 5,
            locator: cellLocator as unknown as Locator,
        }));

        const mockConfig: FinalTableConfig<Record<string, unknown>> = {
            rowSelector: 'tr',
            headerSelector: 'th',
            cellSelector: 'td',
            maxPages: 1,
            autoScroll: false,
            headerTransformer: ({ text }) => text,
            onReset: async () => {},
            strategies: {
                getActiveCell,
                getCellLocator: () => cellLocator as unknown as Locator,
                navigation: {
                    snapFirstColumnIntoView,
                    goRight: vi.fn(),
                    goLeft: vi.fn(),
                    goDown: vi.fn(),
                    goUp: vi.fn(),
                    settleMs: 0,
                    maxWaitMs: 0,
                },
            },
            debug: { logLevel: 'none' },
        };

        const rowMap = new Map([['First', 0]]);
        const rowLocator = mockLocator as unknown as Locator;
        const resolve = (_sel: string, parent: Locator | Page): Locator => {
            if ('nth' in parent && typeof parent.nth === 'function') {
                return parent.nth(0);
            }
            return rowLocator;
        };

        const smartRow = createSmartRow(
            rowLocator,
            rowMap,
            2,
            mockConfig,
            rowLocator,
            resolve,
            null
        );

        await smartRow.getCell('First').bringIntoView();

        expect(snapFirstColumnIntoView).toHaveBeenCalledTimes(1);
        expect(keyboardPress).not.toHaveBeenCalled();
        expect(evaluate).not.toHaveBeenCalled();
    });
});
