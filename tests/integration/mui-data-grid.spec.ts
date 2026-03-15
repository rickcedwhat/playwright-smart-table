import { test, expect } from '@playwright/test';
import { useTable, presets } from '../../src/index';

test.describe('MUI DataGrid Recon', () => {
    test.describe.configure({ retries: 2 });
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3050');
        await expect(page.locator('[role="grid"]')).toBeVisible();
        await expect(page.locator('.MuiDataGrid-footerContainer')).toBeVisible();
    });

    test('should scrape a virtualized DataGrid using preset', async ({ page }) => {
        const root = page.locator('[role="grid"]').first();
        await expect(root).toBeVisible();

        const table = await useTable(root, { 
            ...presets.muiDataGrid as any,
            maxPages: 10
        }).init();

        // 1. Verify Headers
        const headers = await table.getHeaders();
        console.log('DEBUG: Found Headers:', headers);
        expect(headers).toContain('Trader Name');
        expect(headers).toContain('Trader Email');

        // 2. Test Pagination
        console.log('Testing pagination: finding row on page 2...');
        await table.sorting.apply('Desk', 'asc'); // Ensure stable order

        // D-1011 should be on page 2 (index 10-19) since pageSize is 10
        const rowOnPage2 = await table.findRow({ Desk: 'D-1011' });
        expect(rowOnPage2.wasFound()).toBe(true);
        expect(table.currentPageIndex).toBe(1);

        const deskValue = (await rowOnPage2.toJSON()).Desk;
        console.log(`Found row on page 2: ${deskValue}`);
        expect(deskValue).toBe('D-1011');
    });

    test('should handle sorting via preset', async ({ page }) => {
        const root = page.locator('[role="grid"]').first();
        const table = await useTable(root, { 
            ...presets.muiDataGrid as any,
            maxPages: 10
        }).init();

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
