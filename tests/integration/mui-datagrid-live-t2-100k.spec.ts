/**
 * Live site test — mui.com Table 2: 100k-row infinite scroll DataGrid
 *
 * Table: index 1 on the page. 100,000 rows, 32 columns, column virtualization
 * active (only ~6-9 columns rendered in DOM at a time based on scrollLeft).
 * The checkbox column is NOT pinned — it scrolls out of view like other columns.
 * Uses infinite scroll (not pagination buttons).
 *
 * Selector: .MuiDataGrid-root:has([aria-rowcount="100001"])
 */
import { test, expect } from '@playwright/test';
import { useTable, presets, Strategies } from '../../src/index';

const LIVE_URL = 'https://mui.com/x/react-data-grid/';
const GRID_SELECTOR = '.MuiDataGrid-root:has([aria-rowcount="100001"])';

const tableConfig = {
    ...presets.muiDataGrid as any,
    strategies: {
        ...(presets.muiDataGrid as any).strategies,
        pagination: Strategies.Pagination.infiniteScroll({
            scrollTarget: '.MuiDataGrid-virtualScroller',
            action: 'js-scroll',
            stabilization: Strategies.Stabilization.contentChanged({ timeout: 3000 }),
        }),
    },
};

test.describe('MUI DataGrid — live site table 2 (100k infinite scroll)', () => {
    test.setTimeout(120_000);

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

    test('reads headers from initial viewport', async ({ page }) => {
        const root = page.locator(GRID_SELECTOR).first();
        const table = await useTable(root, tableConfig).init();

        const headers = await table.getHeaders();
        console.log('Headers:', headers);

        // Core columns visible in the initial viewport
        expect(headers).toContain('Desk');
        expect(headers).toContain('Commodity');
        expect(headers).toContain('Trader Name');
        expect(headers).toContain('Quantity');
        // 32 total columns; header discovery is limited to the initial viewport window
        expect(headers.length).toBeGreaterThanOrEqual(6);
    });

    test('map() collects rows across pages including off-screen columns', async ({ page }) => {
        const root = page.locator(GRID_SELECTOR).first();
        const table = await useTable(root, tableConfig).init();

        const headers = await table.getHeaders();
        // Read all visible headers — checkbox column has no label so the preset
        // auto-names it __col_N; include it like any other column.
        const rows = await table.map(({ row }) => row.toJSON({ columns: headers }), { maxPages: 3 });
        console.log(`Collected ${rows.length} rows`);
        console.log('Sample row:', rows[0]);

        expect(rows.length).toBeGreaterThan(10);

        for (const row of rows) {
            const r = row as Record<string, string>;
            expect(r).toHaveProperty('Desk');
            expect(r).toHaveProperty('Commodity');
            expect(r).toHaveProperty('Trader Name');
            expect(r).toHaveProperty('Quantity');
            expect(r['Desk']).toBeTruthy();
        }
    });
});
