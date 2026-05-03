import { describe, it, expect, vi } from 'vitest';
import createSmartRow from '../../src/smartRow';
import { FinalTableConfig } from '../../src/types';

describe('Issue 82: Targeted navigation errors', () => {
    it('should throw a structured error with visibility context when navigation fails', async () => {
        const mockLocator = {
            count: vi.fn().mockResolvedValue(0),
            nth: vi.fn().mockReturnThis(),
            page: vi.fn().mockReturnValue({
                keyboard: { press: vi.fn() },
                waitForTimeout: vi.fn(),
            }),
            evaluate: vi.fn(),
            scrollIntoViewIfNeeded: vi.fn(),
        } as any;

        const mockConfig: FinalTableConfig<any> = {
            rowSelector: 'tr',
            headerSelector: 'th',
            cellSelector: 'td',
            strategies: {
                viewport: {
                    getVisibleColumnRange: vi.fn().mockResolvedValue({ first: 0, last: 5 }),
                    getVisibleRowRange: vi.fn().mockResolvedValue({ first: 0, last: 10 }),
                },
            },
            debug: { logLevel: 'none' },
        } as any;

        const rowMap = new Map([['Score', 10]]); // Column 10 is out of range [0-5]
        const smartRow = createSmartRow(
            mockLocator,
            rowMap,
            20, // Row 20 is out of range [0-10]
            mockConfig,
            mockLocator,
            (sel, parent) => mockLocator,
            null
        );

        await expect(smartRow.getCell('Score').bringIntoView()).rejects.toThrowError(
            /SmartTable: could not reach cell for column "Score" \(colIndex 10\) at row 20/
        );

        try {
            await smartRow.getCell('Score').bringIntoView();
        } catch (e: any) {
            expect(e.message).toContain('Visible column range: [0–5]');
            expect(e.message).toContain('Visible row range: [0–10]');
            expect(e.message).toContain('Row is out of view');
            expect(e.message).toContain('strategies.navigation');
        }
    });
});
