import { test, expect } from '@playwright/test';
import { useTable, presets } from '../../src/index';

test.describe('MUI DataGrid Recon', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('https://mui.com/x/react-data-grid/pagination/');

        // Handle cookie banner if present
        const acceptBtn = page.locator('#docs-cookie-consent button:has-text("Accept all")').first();
        if (await acceptBtn.isVisible()) {
            await acceptBtn.click();
        }
    });

    test('should scrape a virtualized DataGrid using preset', async ({ page }) => {
        const root = page.locator('.MuiDataGrid-root').first();
        await expect(root).toBeVisible();

        const table = await useTable(root, { ...presets.muiDataGrid as any }).init();

        // 1. Verify Headers
        const headers = await table.getHeaders();
        console.log('Headers:', headers);
        expect(headers).toContain('Desk');
        expect(headers).toContain('Commodity');
        expect(headers).toContain('Trader Name');

        // 2. Map current page rows
        const currentRows = await table.map(({ row }) => row.toJSON());
        console.log(`Found ${currentRows.length} rows on first page.`);
        expect(currentRows.length).toBeGreaterThan(0);

        // 3. Test Pagination
        console.log('Testing pagination: next page...');
        await table.sorting.apply('Desk', 'asc'); // Ensure stable order

        const firstRowBefore = (await table.getRowByIndex(0).toJSON()).Desk;
        await table.reset(); // reset after sort

        // Use the internal goNext via raw primitives for debug check
        const moved = await presets.muiDataGrid.strategies!.pagination!.goNext!({
            root,
            page,
            config: {} as any, // Dummy for cast
            resolve: (s: any, p: any) => (typeof s === 'string' ? p.locator(s) : (s as any)(p))
        });

        expect(moved).toBe(true);
        await table.revalidate();

        const firstRowAfter = (await table.getRowByIndex(0).toJSON()).Desk;
        console.log(`Row 0 before: ${firstRowBefore}, after: ${firstRowAfter}`);
        expect(firstRowAfter).not.toBe(firstRowBefore);
    });

    test('should handle sorting via preset', async ({ page }) => {
        const root = page.locator('.MuiDataGrid-root').first();
        const table = await useTable(root, { ...presets.muiDataGrid as any }).init();

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
