import { describe, expect, it, vi } from 'vitest';
import createSmartRow from '../../src/smartRow';
import { muiDataGrid } from '../../src/presets/mui';
import type { FinalTableConfig } from '../../src/types';

describe('SmartRow cell navigation', () => {
    it('recovers a DataGrid row by its data-rowindex after column scrolling', async () => {
        const page = {};
        const root = { page: () => page };
        const row = { getAttribute: vi.fn().mockResolvedValue('42') };
        let recovered = false;
        const cell = {
            count: vi.fn(async () => Number(recovered)),
            innerText: vi.fn().mockResolvedValue('selected row'),
        };
        const getCellLocator = vi.fn(({ rowIndex }) => rowIndex === 42
            ? cell
            : { count: async () => 0 });
        const scrollToColumn = vi.fn().mockResolvedValue(undefined);
        const scrollToRow = vi.fn(async (_context, index) => {
            if (index === 42) recovered = true;
        });
        const config = {
            strategies: {
                resolveRowIndex: muiDataGrid.strategies!.resolveRowIndex,
                getCellLocator,
                viewport: {
                    getVisibleColumnRange: async () => ({ first: 0, last: 0 }),
                    scrollToColumn,
                    scrollToRow,
                },
            },
            debug: { logLevel: 'none' },
        } as unknown as FinalTableConfig;
        const smart = createSmartRow(
            row as any,
            new Map([['Notes', 5]]),
            1, // mounted-row position; this row's absolute data-rowindex is 42
            config,
            root as any,
            (() => row) as any,
            null,
            undefined,
            undefined,
            true,
        );

        expect(await smart.getValue('Notes')).toBe('selected row');
        expect(scrollToColumn).toHaveBeenCalledWith(expect.anything(), 5);
        expect(scrollToRow).toHaveBeenCalledWith(expect.anything(), 42);
        expect(getCellLocator).toHaveBeenCalledWith(expect.objectContaining({ rowIndex: 42 }));
    });
});
