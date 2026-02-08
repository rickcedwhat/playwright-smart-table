import { test, expect, Page } from '@playwright/test';
import { useTable, PaginationStrategies } from '../src/useTable';

// Helper to set config
async function setPlaygroundConfig(page: Page, config: any) {
    const json = JSON.stringify(config, null, 2);
    // Clear and type
    await page.locator('textarea').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await page.locator('textarea').fill(json);
    // Apply
    await page.getByRole('button', { name: 'Apply & Reload Table' }).click();
    // Wait for reload (spinner)
    await expect(page.locator('.spinner')).toBeVisible();
    await expect(page.locator('.spinner')).not.toBeVisible();
}



test.describe('Playground: Virtualized Table', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/virtualized');
        // Ensure ready
        await expect(page.getByRole('heading', { name: 'Virtualized Table Scenario' })).toBeVisible();
    });

    test('should fetch rows with infinite scroll', async ({ page }) => {
        // 1. Setup: 100 rows, simple data
        await setPlaygroundConfig(page, {
            rowCount: 100,
            defaults: {
                tableInitDelay: 1000,
                rowDelay: 2500,
                generator: "simple" // { id, value, description }
            }
        });

        // 2. Init Table
        const table = useTable(page.locator('.virtual-table-container'), {
            rowSelector: '.virtual-row',
            headerSelector: '.header [role="columnheader"]',
            cellSelector: '[role="cell"]',
            strategies: {
                pagination: PaginationStrategies.virtualInfiniteScroll({
                    scrollTarget: '[data-testid="virtuoso-scroller"]',
                    scrollAmount: 500
                })
            }
        });

        // 3. Get Rows (First batch)
        const rows = await table.getRows();

        expect(rows.length).toBeGreaterThan(0);
        expect(rows.length).toBeLessThan(100);

        const firstRowData = await rows[0].toJSON();
        // Maps to "ID" and "Name" columns
        expect(firstRowData).toEqual(expect.objectContaining({ ID: '1', Name: 'Item 1' }));
    });

    test('should find specific row by filtering (deep scroll)', async ({ page }) => {
        test.setTimeout(60000);

        // 1. Setup: 100 rows
        await setPlaygroundConfig(page, {
            rowCount: 100,
            defaults: {
                tableInitDelay: 0,
                rowDelay: 0,
                generator: "simple"
            }
        });

        // Add safety wait
        await page.waitForTimeout(500);

        const table = useTable(page.locator('.virtual-table-container'), {
            rowSelector: '.virtual-row',
            headerSelector: '.header [role="columnheader"]',
            cellSelector: '[role="cell"]',
            strategies: {
                pagination: PaginationStrategies.virtualInfiniteScroll({
                    scrollTarget: '[data-testid="virtuoso-scroller"]',
                    scrollAmount: 1000,
                    stabilityTimeout: 500,
                    retries: 5,
                    useJsScroll: true
                })
            },
            debug: {
                logLevel: 'verbose'
            }
        });

        // 2. Find specific ID at index 99 (ID: 100)
        // Set maxPages: 20
        const targetRow = await table.findRow({ ID: '100' }, { maxPages: 20 });

        expect(targetRow).toBeTruthy();
        const data = await targetRow.toJSON();
        expect(data).toEqual(expect.objectContaining({ ID: '100', Name: 'Item 100' }));
    });

    test('should handle random stutter delays', async ({ page }) => {
        // 1. Setup: Stutter (Base 200, Jitter 50)
        await setPlaygroundConfig(page, {
            rowCount: 100,
            defaults: {
                tableInitDelay: 0,
                rowDelay: { base: 2000, stutter: 500 },
                generator: "users"
            }
        });

        const table = useTable(page.locator('.virtual-table-container'), {
            rowSelector: '.virtual-row',
            headerSelector: '.header [role="columnheader"]',
            cellSelector: '[role="cell"]',
            strategies: {
                pagination: PaginationStrategies.virtualInfiniteScroll({
                    scrollTarget: '[data-testid="virtuoso-scroller"]',
                    scrollAmount: 1000,
                    stabilityTimeout: 500,
                    useJsScroll: true
                })
            }
        });

        // 2. Fetch all
        const start = Date.now();

        // Just verify we can fetch rows despite delays
        // Filter by "ID" (User 20 is last item)
        const row = await table.findRow({ ID: '100' });

        const duration = Date.now() - start;

        expect(row).toBeTruthy();
        expect(duration).toBeGreaterThan(0);
    });

    test('should iterate through 100 rows with late-loading cells', async ({ page }) => {
        test.setTimeout(120000); // Allow time for slow iteration

        // 1. Setup: 100 rows with delay
        await setPlaygroundConfig(page, {
            rowCount: 100,
            defaults: {
                tableInitDelay: 500,
                rowDelay: { base: 500, stutter: 200 },
                generator: "simple"
            }
        });

        await page.waitForTimeout(1000);

        const table = useTable(page.locator('.virtual-table-container'), {
            rowSelector: '.virtual-row',
            headerSelector: '.header [role="columnheader"]',
            cellSelector: '[role="cell"]',
            strategies: {
                pagination: PaginationStrategies.virtualInfiniteScroll({
                    scrollTarget: '[data-testid="virtuoso-scroller"]',
                    scrollAmount: 300,
                    stabilityTimeout: 1000,
                    useJsScroll: true
                })
            }
        });

        // 2. Iterate and collect all data
        const results = await table.iterateThroughTable(
            async ({ rows }) => {
                return await rows.toJSON();
            },
            {
                maxIterations: 30,
                dedupeStrategy: async (row) => {
                    // Use ID or unique content as key
                    const data = await row.toJSON();
                    return data.ID;
                }
            }
        );

        // Flatten if needed (iterateThroughTable returns T[])
        // But our callback returns Promise<any[]> (toJSON returns object array?)
        // Wait, rows.toJSON() returns Promise<any[]>.
        // iterateThroughTable collects results.
        // If callback returns array, iterateThroughTable flattens result if T[] matches?
        // Let's check iterateThroughTable implementation.
        // If callback returns T[], allData.push(...returnValue).
        // So results will be array of ROW OBJECTS.

        console.log(`Collected ${results.length} rows.`);

        expect(results.length).toBeGreaterThanOrEqual(100);

        const hasId1 = results.some((r: any) => r.ID === '1');
        const hasId100 = results.some((r: any) => r.ID === '100');

        expect(hasId1).toBe(true);
        expect(hasId100).toBe(true);
    });
});
