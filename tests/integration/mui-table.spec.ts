import { test, expect } from '@playwright/test';
import { useTable, presets } from '../../src/index';

test.describe('MUI Table Preset Integration', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('https://mui.com/material-ui/react-table/');
        // Wait for the docs page to fully load
        await page.waitForSelector('.MuiTableContainer-root', { state: 'attached' });

        // Dismiss any cookie banner or preferences dialog if it exists
        const cookieSelectors = [
            '#docs-cookie-consent button:has-text("Accept all")',
            'button:has-text("Allow analytics")',
            'button:has-text("Essential only")',
            'button:has-text("Accept all cookies")'
        ];

        for (const selector of cookieSelectors) {
            const btn = page.locator(selector).first();
            if (await btn.isVisible().catch(() => false)) {
                await btn.click().catch(() => {});
                await page.waitForTimeout(500); // Wait for animation
            }
        }
    });

    test('Basic Table - Read all rows', async ({ page }) => {
        const heading = page.getByRole('heading', { name: /^Basic table$/i });
        const container = heading.locator('xpath=following::div[contains(@class, "MuiTableContainer-root") or .//table][1]');

        const table = await useTable(container, { ...presets.muiTable });

        // The basic table has exactly 5 rows
        const rows = await table.map(async ({ row }) => await row.toJSON());
        expect(rows.length).toBe(5);

        // Spot check data extraction
        expect(rows[0]['Dessert (100g serving)']).toBe('Frozen yoghurt');
        expect(rows[4]['Dessert (100g serving)']).toBe('Gingerbread');
    });

    test('Sorting API Integration', async ({ page }) => {
        const heading = page.getByRole('heading', { name: /^Sorting & selecting$/i });
        const container = heading.locator('xpath=following::div[contains(@class, "MuiTableContainer-root") or .//table][1]');

        const table = await useTable(container, { ...presets.muiTable });

        // Sort by Calories Ascending
        await table.sorting.apply('Calories', 'asc');
        expect(await table.sorting.getState('Calories')).toBe('asc');

        let firstRowAsc = await table.getRowByIndex(0).getCell('Calories').innerText();

        // Sort by Calories Descending
        await table.sorting.apply('Calories', 'desc');
        expect(await table.sorting.getState('Calories')).toBe('desc');

        let firstRowDesc = await table.getRowByIndex(0).getCell('Calories').innerText();

        // Ensure sorting actually swapped the items
        expect(firstRowAsc).not.toBe(firstRowDesc);
    });

    test('Pagination Integration', async ({ page }) => {
        // Tests pagination against the Sorting & Selecting table which has a valid `thead`
        const heading = page.getByRole('heading', { name: /^Sorting & selecting$/i });
        const container = heading.locator('xpath=following::div[contains(@class, "MuiTableContainer-root") or .//table][1]');

        const table = await useTable(container, { ...presets.muiTable, maxPages: 5 });

        // The table has 13 items, shown 5 per page default.
        // Calling findRows() with no filters should scrape all pages and return every row.
        const allRows = await table.findRows();
        expect(allRows.length).toBeGreaterThan(5);
    });
});
