import { test, expect } from '@playwright/test';
import { useTable, presets } from '../../src/index';

test.describe('MUI DataGrid Recon', () => {
    test.describe.configure({ retries: 2 });
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3050');
        await expect(page.locator('[role="grid"]')).toBeVisible();
        await expect(page.locator('.MuiDataGrid-footerContainer')).toBeVisible();
    });

    test('muiDataGrid viewport.getVisibleRowIndices returns valid visible DOM positions (A2, #353/#357)', async ({ page }) => {
        const root = page.locator('[role="grid"]').first();
        await expect(root).toBeVisible();

        const vp = presets.muiDataGrid.strategies!.viewport!;
        const visible = await vp.getVisibleRowIndices!({ root, config: presets.muiDataGrid } as any);
        const mounted = await root.locator('.MuiDataGrid-row').count();

        expect(visible.length).toBeGreaterThan(0);
        // Every entry is a valid DOM position within the mounted rows...
        expect(visible.every(i => Number.isInteger(i) && i >= 0 && i < mounted)).toBe(true);
        // ...and the visible set never exceeds what's mounted (overscan is excluded, not added).
        expect(visible.length).toBeLessThanOrEqual(mounted);
    });

    test('findRowByIndex reaches a row on a later page by its logical index (#354)', async ({ page }) => {
        const root = page.locator('[role="grid"]').first();
        await expect(root).toBeVisible();

        const table = await useTable(root, presets.muiDataGrid).init();
        await table.sorting.apply('Desk', 'asc'); // stable order (D-1000..D-1099)

        // data-rowindex 25 is on page 2 (pageSize 10) — not initially mounted. findRowByIndex
        // must navigate to it via the pagination fallback and identify it by resolveRowIndex.
        const row = await table.findRowByIndex(25, { maxPages: 10 });
        expect(row.rowIndex).toBe(25);
        expect(await row.getCell('Desk').innerText()).toBe('D-1025');
    });

    test('should scrape a virtualized DataGrid using preset', async ({ page }) => {
        const root = page.locator('[role="grid"]').first();
        await expect(root).toBeVisible();

        const table = await useTable(root, presets.muiDataGrid).init();

        // 1. Verify Headers
        const headers = await table.getHeaders();
        console.log('DEBUG: Found Headers:', headers);
        expect(headers).toContain('Trader Name');
        expect(headers).toContain('Trader Email');

        // 2. Test Pagination
        console.log('Testing pagination: finding row on page 2...');
        await table.sorting.apply('Desk', 'asc'); // Ensure stable order

        // D-1011 should be on page 2 (index 10-19) since pageSize is 10
        const rowOnPage2 = await table.findRow({ Desk: 'D-1011' }, { maxPages: 10 });
        expect(rowOnPage2.wasFound()).toBe(true);
        expect(table.currentPageIndex).toBe(1);

        const deskValue = (await rowOnPage2.toJSON()).Desk;
        console.log(`Found row on page 2: ${deskValue}`);
        expect(deskValue).toBe('D-1011');
    });

    test('map() reaches off-screen columns via barrier-coordinated scroll', async ({ page }) => {
        const root = page.locator('[role="grid"]').first();
        const table = await useTable(root, presets.muiDataGrid).init();

        const headers = await table.getHeaders();
        // Confirm column virtualization is active: off-screen columns exist
        expect(headers).toContain('Notes');
        expect(headers).toContain('Filled Qty');

        // map() must reach every column including those beyond the initial scroll position
        const rows = await table.map(({ row }) => row.toJSON(), { maxPages: 5 });
        expect(rows.length).toBeGreaterThan(0);

        const sample = rows[0] as Record<string, string>;
        expect(sample).toHaveProperty('Notes');
        expect(sample).toHaveProperty('Filled Qty');
        expect(sample).toHaveProperty('Desk');

        // Every row on every page must have all off-screen columns
        const missing = rows.filter(r => !r || !('Notes' in (r as object)));
        expect(missing.length).toBe(0);
    });

    test('should handle sorting via preset', async ({ page }) => {
        const root = page.locator('[role="grid"]').first();
        const table = await useTable(root, presets.muiDataGrid).init();

        console.log('Testing sort: Desk...');
        // DataGrid Name header is usually sortable
        await table.sorting.apply('Desk', 'asc');
        let state = await table.sorting.getState('Desk');
        expect(state).toBe('asc');

        await table.sorting.apply('Desk', 'desc');
        state = await table.sorting.getState('Desk');
        expect(state).toBe('desc');
    });
});
