import { describe, it, expect, vi } from 'vitest';
import createSmartRow from '../../src/smartRow';
import { FinalTableConfig } from '../../src/types';

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
        const cellLocator = {
            count: vi.fn().mockImplementation(async () => (snapped ? 1 : 0)),
            focus: vi.fn().mockResolvedValue(undefined),
            nth: vi.fn().mockReturnThis(),
        };

        const mockLocator = {
            count: vi.fn().mockImplementation(async () => (snapped ? 1 : 0)),
            nth: vi.fn().mockReturnValue(cellLocator),
            page: vi.fn().mockReturnValue({
                keyboard: { press: keyboardPress },
                waitForTimeout,
            }),
            evaluate,
            scrollIntoViewIfNeeded: vi.fn(),
            focus: vi.fn().mockResolvedValue(undefined),
        } as any;

        const snapFirstColumnIntoView = vi.fn().mockImplementation(async () => {
            snapped = true;
        });

        // Focus sits on col 5 until snap brings us to col 0.
        const getActiveCell = vi.fn().mockImplementation(async () => ({
            rowIndex: 2,
            columnIndex: snapped ? 0 : 5,
            locator: cellLocator,
        }));

        const mockConfig: FinalTableConfig<any> = {
            rowSelector: 'tr',
            headerSelector: 'th',
            cellSelector: 'td',
            strategies: {
                getActiveCell,
                getCellLocator: () => cellLocator as any,
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
        } as any;

        const rowMap = new Map([['First', 0]]);
        const smartRow = createSmartRow(
            mockLocator,
            rowMap,
            2,
            mockConfig,
            mockLocator,
            (_sel, parent) => ((parent as any).nth ? (parent as any).nth(0) : mockLocator),
            null
        );

        await smartRow.getCell('First').bringIntoView();

        expect(snapFirstColumnIntoView).toHaveBeenCalledTimes(1);
        expect(keyboardPress).not.toHaveBeenCalled();
        expect(evaluate).not.toHaveBeenCalled();
    });
});
