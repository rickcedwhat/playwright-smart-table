import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';
import { Plugins } from '../src/plugins';
import type { TableContext } from '../src/types';

test.describe('React Data Grid (RDG)', () => {
    test.setTimeout(60000);

    // Optimized header strategy using aria-colcount
    const scrollRightHeaderRDG = async (context: TableContext) => {
        const { resolve, config, root, page } = context;
        const collectedHeaders = new Set<string>();

        const gridHandle = await root.evaluateHandle((el) => {
            return el.querySelector('[role="grid"]') || el.closest('[role="grid"]');
        });

        const expectedColumns = await gridHandle.evaluate(el =>
            el ? parseInt(el.getAttribute('aria-colcount') || '0', 10) : 0
        );

        const getVisible = async () => {
            const headerLoc = resolve(config.headerSelector, root);
            const texts = await headerLoc.allInnerTexts();
            return texts.map(t => {
                const trimmed = t.trim();
                return trimmed.length > 0 ? trimmed : 'Checkbox';
            });
        };

        let currentHeaders = await getVisible();
        currentHeaders.forEach(h => collectedHeaders.add(h));
        console.log(`Initial headers: ${collectedHeaders.size} / ${expectedColumns}`);

        const hasScroll = await gridHandle.evaluate(el =>
            el ? el.scrollWidth > el.clientWidth : false
        );

        if (hasScroll) {
            await gridHandle.evaluate(el => el!.scrollLeft = 0);
            await page.waitForTimeout(200);

            let iteration = 0;
            while (collectedHeaders.size < expectedColumns && iteration < 30) {
                await gridHandle.evaluate(el => el!.scrollLeft += 500);
                await page.waitForTimeout(300);

                const newHeaders = await getVisible();
                newHeaders.forEach(h => collectedHeaders.add(h));

                const atEnd = await gridHandle.evaluate(el =>
                    el!.scrollLeft >= el!.scrollWidth - el!.clientWidth - 10
                );

                iteration++;
                console.log(`Iteration ${iteration}: ${collectedHeaders.size} / ${expectedColumns} columns`);

                if (atEnd) break;
            }

            await gridHandle.evaluate(el => el!.scrollLeft = 0);
            await page.waitForTimeout(200);
        }

        const result = Array.from(collectedHeaders);
        console.log(`Final: ${result.length} columns collected`);
        console.log('Headers collected:', result);
        return result;
    };




    test('should collect all headers from virtualized columns', async ({ page }) => {
        await page.goto('https://comcast.github.io/react-data-grid/#/CommonFeatures');

        const grid = page.locator('[role="grid"]').first();
        await expect(grid).toBeAttached({ timeout: 10000 });

        const table = useTable(grid, {
            rowSelector: '[role="row"].rdg-row',
            cellSelector: '[role="gridcell"]',
            headerSelector: '[role="columnheader"]',
            strategies: Plugins.RDG.Strategies
        });

        await table.init();
        const headers = await table.getHeaders();

        console.log('Headers found:', headers);
        console.log('Total headers:', headers.length);

        // The example has 16 columns
        expect(headers.length).toBeGreaterThanOrEqual(15); // Allow 15 or 16
        expect(headers).toContain('ID');
        expect(headers).toContain('Task');
    });

    test('should read data from all columns including virtualized ones', async ({ page }) => {
        await page.goto('https://comcast.github.io/react-data-grid/#/CommonFeatures');

        const grid = page.locator('[role="grid"]').first();
        await expect(grid).toBeAttached({ timeout: 10000 });

        const table = useTable(grid, {
            rowSelector: '[role="row"].rdg-row',
            cellSelector: '[role="gridcell"]',
            headerSelector: '[role="columnheader"]',
            strategies: Plugins.RDG.Strategies
        });

        await table.init();

        // Get first few rows
        const rows = await table.getRows();
        const firstRow = rows[0];

        const rowData = await firstRow.toJSON();
        console.log('First row data:', rowData);
        console.log('Columns in row:', Object.keys(rowData).length);

        // Should have 15+ columns
        expect(Object.keys(rowData).length).toBeGreaterThanOrEqual(15);
        expect(rowData).toHaveProperty('ID');
        expect(rowData).toHaveProperty('Task');
    });

    test('should paginate through virtualized rows', async ({ page }) => {
        await page.goto('https://comcast.github.io/react-data-grid/#/CommonFeatures');

        const grid = page.locator('[role="grid"]').first();
        await expect(grid).toBeAttached({ timeout: 10000 });

        const table = useTable(grid, {
            rowSelector: '[role="row"].rdg-row',
            cellSelector: '[role="gridcell"]',
            headerSelector: '[role="columnheader"]',
            strategies: Plugins.RDG.Strategies,
            maxPages: 3  // Reduced to avoid virtualization issues
        });

        await table.init();

        const allData = await table.iterateThroughTable(
            async ({ rows, index }) => {
                console.log(`Page ${index + 1}: ${rows.length} rows`);
                // Only read first 10 rows per page to stay within viewport
                const rowsToRead = rows.slice(0, Math.min(10, rows.length));
                return Promise.all(rowsToRead.map(r => r.toJSON({ columns: ['ID', 'Task', 'Client'] })));
            },
            { maxIterations: 3 }
        );

        const flatData = allData.flat();
        console.log(`Total rows collected: ${flatData.length}`);

        // Filter out the sticky summary row ("Total")
        const dataRows = flatData.filter((r: any) => r.ID !== 'Total');
        console.log(`Data rows: ${dataRows.length}`);

        // Should have collected more than the initial viewport
        expect(dataRows.length).toBeGreaterThan(20);

        // Verify we got unique IDs in the data rows
        const uniqueIds = new Set(dataRows.map((r: any) => r.ID));
        console.log(`Unique IDs: ${uniqueIds.size}`);
        expect(uniqueIds.size).toBe(dataRows.length);
    });

    test('should handle reading specific columns from middle of table', async ({ page }) => {
        await page.goto('https://comcast.github.io/react-data-grid/#/CommonFeatures');

        const grid = page.locator('[role="grid"]').first();
        await expect(grid).toBeAttached({ timeout: 10000 });

        const table = useTable(grid, {
            rowSelector: '[role="row"].rdg-row',
            cellSelector: '[role="gridcell"]',
            headerSelector: '[role="columnheader"]',
            strategies: Plugins.RDG.Strategies
        });

        await table.init();
        const headers = await table.getHeaders();
        console.log('All headers:', headers);

        // Get a row and read specific columns
        const rows = await table.getRows();
        const firstRow = rows[0];

        // Read columns from different positions (left, middle, right)
        const selectedData = await firstRow.toJSON({
            columns: ['ID', 'Task', 'Completion']
        });

        console.log('Selected columns:', selectedData);
        expect(selectedData).toHaveProperty('ID');
        expect(selectedData).toHaveProperty('Task');
        expect(selectedData).toHaveProperty('Completion');
    });
});
