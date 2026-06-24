import { describe, it, expect, vi } from 'vitest';
import { muiDataGrid } from '../../src/presets/mui';

describe('muiDataGrid.strategies.sorting.doSort — no fixed delay', () => {
    it('does not call waitForTimeout with a fixed 500ms value', async () => {
        const waitForTimeout = vi.fn().mockResolvedValue(undefined);

        // Minimal MUI-like context: header with sort state toggling asc → desc on each click
        let sortState = 'none';
        const clickTarget = {
            isVisible: vi.fn().mockResolvedValue(true),
            click: vi.fn().mockImplementation(async () => { sortState = 'ascending'; }),
        };
        const header = {
            locator: vi.fn().mockReturnValue({ first: vi.fn().mockReturnValue(clickTarget) }),
            click: vi.fn(),
            getAttribute: vi.fn().mockImplementation(() => sortState),
        };

        const stubLocator = {
            count: vi.fn().mockResolvedValue(0),
            isVisible: vi.fn().mockResolvedValue(false),
            innerText: vi.fn().mockResolvedValue('1–10 of 10'),
            waitFor: vi.fn().mockResolvedValue(undefined),
            first: vi.fn().mockReturnThis(),
        };

        const context = {
            page: { waitForTimeout },
            root: { locator: vi.fn().mockReturnValue(stubLocator) },
            getHeaderCell: vi.fn().mockResolvedValue(header),
            config: {
                strategies: {
                    sorting: {
                        getSortState: vi.fn().mockImplementation(() => sortState === 'ascending' ? 'asc' : 'none'),
                    },
                },
            },
        } as any;

        const doSort = (muiDataGrid as any).strategies.sorting.doSort;
        await doSort({ columnName: 'Name', direction: 'asc', context });

        const fixedDelays = waitForTimeout.mock.calls.filter(([ms]) => ms === 500);
        expect(fixedDelays).toHaveLength(0);
    });
});
