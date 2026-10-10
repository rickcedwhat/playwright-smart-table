import { test, expect, Page } from '@playwright/test';
import { useTable, presets } from '../src/index';
import { createMuiTable, createMuiDataGrid } from '../src/presets/mui';
import type { TableContext } from '../src/types';

const FRENCH = { nextPage: 'Page suivante', previousPage: 'Page précédente' };

/** Two pages of two rows behind a French MUI footer. `footerClass` picks Table vs DataGrid markup. */
async function setupFrenchFooter(page: Page, footerClass: string) {
    await page.setContent(`
        <div id="paper">
            <table>
                <thead><tr><th>Name</th></tr></thead>
                <tbody id="body"><tr><td>Alice</td></tr><tr><td>Bob</td></tr></tbody>
            </table>
            <div class="${footerClass}">
                <p class="MuiTablePagination-displayedRows">1–2 sur 4</p>
                <button id="prev" aria-label="Page précédente" disabled>‹</button>
                <button id="next" aria-label="Page suivante">›</button>
            </div>
        </div>
        <script>
            window.nextClicks = 0;
            document.getElementById('next').addEventListener('click', () => {
                window.nextClicks++;
                document.getElementById('body').innerHTML = '<tr><td>Carol</td></tr><tr><td>Dan</td></tr>';
                document.querySelector('.MuiTablePagination-displayedRows').textContent = '3–4 sur 4';
                document.getElementById('next').disabled = true;
                document.getElementById('prev').disabled = false;
            });
        </script>
    `);
}

const nextClicks = (page: Page) => page.evaluate(() => (window as any).nextClicks as number);

test.describe('MUI presets buttonLabels', () => {
    test('createMuiTable with French labels paginates; the default preset stays on page 1', async ({ page }) => {
        await setupFrenchFooter(page, 'MuiTablePagination-root');

        const readNames = ({ row }: { row: { getCell(c: string): { innerText(): Promise<string> } } }) =>
            row.getCell('Name').innerText();

        const english = useTable(page.locator('#paper'), { ...presets.muiTable, maxPages: 2 });
        expect(await english.map(readNames)).toEqual(['Alice', 'Bob']);
        expect(await nextClicks(page)).toBe(0);

        const french = useTable(page.locator('#paper'), { ...createMuiTable({ buttonLabels: FRENCH }), maxPages: 2 });
        expect(await french.map(readNames)).toEqual(['Alice', 'Bob', 'Carol', 'Dan']);
        expect(await nextClicks(page)).toBe(1);
    });

    test('createMuiDataGrid goNext clicks the labeled button; the default returns false', async ({ page }) => {
        await setupFrenchFooter(page, 'MuiDataGrid-footerContainer');
        const context = { root: page.locator('#paper'), page, config: { strategies: {} } } as unknown as TableContext;

        expect(await createMuiDataGrid().strategies!.pagination!.goNext!(context)).toBe(false);
        expect(await nextClicks(page)).toBe(0);

        expect(await createMuiDataGrid({ buttonLabels: FRENCH }).strategies!.pagination!.goNext!(context)).toBe(true);
        expect(await nextClicks(page)).toBe(1);
        await expect(page.locator('.MuiTablePagination-displayedRows')).toHaveText('3–4 sur 4');
    });
});
