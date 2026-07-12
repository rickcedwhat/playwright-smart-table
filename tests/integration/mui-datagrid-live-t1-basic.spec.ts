/**
 * Live site test — mui.com Table 1: Basic DataGrid
 *
 * Table: index 0 on the page. 9 data rows across 2 pages (5 + 4), 6 columns.
 * aria-rowcount=10 because MUI counts the header row.
 *
 * Uses presets.muiDataGrid with no overrides — standard button pagination is auto-detected.
 */
import { test, expect } from '@playwright/test';
import { useTable, presets } from '../../src/index';

const LIVE_URL = 'https://mui.com/x/react-data-grid/';
// Target by aria-rowcount=10 (9 data rows + 1 header row) — more stable than
// the React-generated ID which changes across MUI builds.
const GRID_SELECTOR = '.MuiDataGrid-root:has([aria-rowcount="10"])';

test.describe('MUI DataGrid — live site table 1 (basic)', () => {
    test.setTimeout(60_000);

    test.beforeEach(async ({ page }) => {
        await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded' });
        const consentBtn = page.getByRole('button', { name: /accept|agree|allow/i }).first();
        if (await consentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await consentBtn.click();
        }
        const grid = page.locator(GRID_SELECTOR).first();
        await grid.waitFor({ state: 'visible', timeout: 15000 });
        await grid.scrollIntoViewIfNeeded();
    });

    test('reads all headers', async ({ page }) => {
        const root = page.locator(GRID_SELECTOR).first();
        const table = await useTable(root, presets.muiDataGrid).init();

        const headers = await table.getHeaders();
        console.log('Headers:', headers);

        expect(headers).toContain('ID');
        expect(headers).toContain('First name');
        expect(headers).toContain('Last name');
        expect(headers).toContain('Age');
        expect(headers).toContain('Full name');
    });

    test('map() reads all rows across both pages', async ({ page }) => {
        const root = page.locator(GRID_SELECTOR).first();
        const table = await useTable(root, presets.muiDataGrid).init();

        // 9 data rows across 2 pages (5 + 4); aria-rowcount=10 includes the header row
        const rows = await table.map(({ row }) => row.toJSON(), { maxPages: 2 });
        console.log(`Collected ${rows.length} rows`);
        console.log('Sample row:', rows[0]);

        expect(rows.length).toBe(9);
        console.log('Sample rows:', rows.slice(0, 2));

        for (const row of rows) {
            const r = row as Record<string, string>;
            // ID is always present; Full name is always populated (even for Melisandre)
            expect(r['ID']).toBeTruthy();
            expect(r['Full name']).toBeTruthy();
        }
    });
});
