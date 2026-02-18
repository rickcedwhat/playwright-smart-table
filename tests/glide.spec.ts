import { test, expect, Locator, Page } from '@playwright/test';
import { useTable } from '../src/index';
import { Plugins } from '../src/index';
import type { TableConfig, TableContext } from '../src/types';

test.describe('Live Glide Data Grid', () => {
    test.setTimeout(60000); // Increase timeout for CI

    // Shared Strategies & Configuration

    const glideConfig: TableConfig = {
        headerSelector: 'table[role="grid"] thead tr th',
        rowSelector: 'table[role="grid"] tbody tr',
        cellSelector: 'td',
        strategies: Plugins.Glide.Strategies
    };

    test('should scan headers and write to multiple columns', async ({ page }) => {
        // 1. Setup
        await page.goto('https://glideapps.github.io/glide-data-grid/iframe.html?viewMode=story&id=glide-data-grid-dataeditor-demos--add-data&globals=');
        // Stabilize: Wait for grid to be attached
        const grid = page.locator('table[role="grid"]').first();
        await expect(grid).toBeAttached({ timeout: 15000 });

        // 3. Configure Table
        // Root is the CANVAS itself as per user request for this test
        const table = useTable(page.locator('canvas').first(), glideConfig);

        await table.init();

        const headers = await table.getHeaders();
        console.log('Headers found:', headers);
        expect(headers.length).toBeGreaterThan(50); // Verify we found many columns

        // Use getRowByIndex(0) (0-indexed) to get the first row
        const firstRow = table.getRowByIndex(0);

        const newName = "Antigravity";
        const newTitle = "CEO";

        console.log(`Writing Name: ${newName}`);
        await firstRow.smartFill({ "First name": newName });

        console.log(`Writing Title: ${newTitle}`);
        await firstRow.smartFill({ "Title": newTitle });

        // 5. Verify using table helpers

        // Verify Title (should be visible as we just wrote to it)
        console.log("Verifying Title...");
        const titleCell = firstRow.getCell("Title");
        await expect(titleCell).toHaveText(newTitle);

        const nameCell = firstRow.getCell("First name");
        await expect(nameCell).toHaveText(newName);

        console.log("Verified successfully using table helpers!");
    });

    test('should infinite scroll', async ({ page }) => {
        await page.goto('https://glideapps.github.io/glide-data-grid/iframe.html?viewMode=story&id=glide-data-grid-dataeditor-demos--add-data&globals=');
        // Stabilize: Wait for grid to be attached
        const grid = page.locator('table[role="grid"]').first();
        await expect(grid).toBeAttached({ timeout: 15000 });

        // 3. Configure Table
        // Root is the CANVAS itself as per user request for this test
        const table = useTable(page.locator('canvas').first(), {
            ...glideConfig, debug: {
                logLevel: 'verbose'
            }
        });
        await table.init();

        // Collect data using iterateThroughTable
        const allData = await table.iterateThroughTable(
            async ({ rows }) => {
                return Promise.all(rows.map(r => r.toJSON({ columns: ['First name', 'Last name', 'Title', 'Email'] })));
            },
            { maxIterations: 3, autoFlatten: true }
        );

        // const flattenedData = allData.flat(); // No longer needed with autoFlatten: true
        const flattenedData = allData;

        console.log(`Collected ${flattenedData.length} total rows after scroll`);
        expect(flattenedData.length).toBeGreaterThan(12);

        // Verify we got new data
        const uniqueNames = new Set(flattenedData.map((r: any) => r["First name"]));
        console.log(`Unique Names: ${uniqueNames.size}`);


        console.log("--- Verification Data ---");
        const indicesToLog = [0, 10, 20, 30];
        indicesToLog.forEach(idx => {
            if (flattenedData[idx]) {
                console.log(`Row ${idx + 1}:`, flattenedData[idx]);
            } else {
                console.log(`Row ${idx + 1}: [NOT FOUND - Total rows: ${flattenedData.length}]`);
            }
        });
        console.log("-------------------------");

        // If we scrolled successfully, we should have more unique names than the page size (12)
        expect(uniqueNames.size).toBeGreaterThan(12);
    });

    test('should infinite scroll with scroll right', async ({ page }) => {
        await page.goto('https://glideapps.github.io/glide-data-grid/iframe.html?viewMode=story&id=glide-data-grid-dataeditor-demos--add-data&globals=');
        // Stabilize: Wait for grid to be attached
        const grid = page.locator('table[role="grid"]').first();
        await expect(grid).toBeAttached({ timeout: 15000 });

        // 3. Configure Table
        // Root is the CANVAS itself as per user request for this test
        const table = useTable(page.locator('canvas').first(), glideConfig);
        await table.init();

        const columns = ["First name", "Title", "Column 59"];

        // Collect data using iterateThroughTable
        const allData = await table.iterateThroughTable(
            async ({ rows }) => {
                return Promise.all(rows.map(r => r.toJSON({ columns })));
            },
            { maxIterations: 3, autoFlatten: true }
        );

        // const flattenedData = allData.flat(); // No longer needed
        const flattenedData = allData;

        console.log(`Collected ${flattenedData.length} total rows after scroll`);
        expect(flattenedData.length).toBeGreaterThan(12);

        // Verify we got new data
        const uniqueNames = new Set(flattenedData.map((r: any) => r["First name"]));
        console.log(`Unique Names: ${uniqueNames.size}`);


        console.log("--- Verification Data ---");
        const indicesToLog = [0, 10, 20, 30];
        indicesToLog.forEach(idx => {
            if (flattenedData[idx]) {
                console.log(`Row ${idx + 1}:`, flattenedData[idx]);
            } else {
                console.log(`Row ${idx + 1}: [NOT FOUND - Total rows: ${flattenedData.length}]`);
            }
        });
        console.log("-------------------------");

        // If we scrolled successfully, we should have more unique names than the page size (12)
        expect(uniqueNames.size).toBeGreaterThan(12);
    });
});
