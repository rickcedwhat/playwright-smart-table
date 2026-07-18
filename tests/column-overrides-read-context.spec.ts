import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';

/**
 * #365 — columnOverrides.read receives the parent row + column context as a second arg.
 *
 * Enables synthetic / row-derived columns (identity from a row-level a[href] or data-*)
 * without the getCellLocator-returns-row hack. Backwards-compatible: single-arg
 * read(cell) implementations keep working.
 */
test.describe('columnOverrides > read context (#365)', () => {
    const TABLE = `
        <table id="t">
            <thead><tr><th>Name</th><th>Link</th></tr></thead>
            <tbody>
                <tr data-uid="row-42"><td>Alpha</td><td><a href="/d/alpha">open</a></td></tr>
            </tbody>
        </table>
    `;

    test('toJSON passes { row, columnName, columnIndex } into read', async ({ page }) => {
        await page.setContent(TABLE);

        const table = await useTable(page.locator('#t'), {
            columnOverrides: {
                Link: {
                    // Derive from the ROW, not the cell: pull data-uid + href in one evaluate.
                    read: async (_cell, { row, columnName, columnIndex }) =>
                        row.evaluate(
                            (el, meta) => {
                                const uid = el.getAttribute('data-uid');
                                const href = el.querySelector('a')?.getAttribute('href');
                                return `${meta.columnName}#${meta.columnIndex}:${uid}:${href}`;
                            },
                            { columnName, columnIndex },
                        ),
                },
            },
        }).init();

        const result = (await table.getRowByIndex(0).toJSON()) as Record<string, string>;
        expect(result.Link).toBe('Link#1:row-42:/d/alpha');
    });

    test('mapColumn passes row context into read', async ({ page }) => {
        await page.setContent(TABLE);

        const table = await useTable(page.locator('#t'), {
            columnOverrides: {
                Link: {
                    read: async (_cell, { row }) =>
                        row.evaluate((el) => el.getAttribute('data-uid') ?? ''),
                },
            },
        }).init();

        const values = await table.mapColumn('Link');
        expect(values).toEqual(['row-42']);
    });

    test('single-argument read(cell) still works (backwards compatible)', async ({ page }) => {
        await page.setContent(TABLE);

        const table = await useTable(page.locator('#t'), {
            columnOverrides: {
                Name: {
                    read: async (cell) => (await cell.innerText()).toUpperCase(),
                },
            },
        }).init();

        const result = (await table.getRowByIndex(0).toJSON()) as Record<string, string>;
        expect(result.Name).toBe('ALPHA');
    });
});
