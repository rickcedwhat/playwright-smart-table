import { test, expect, Page } from '@playwright/test';
import { useTable, PaginationStrategies } from '../src/useTable';
import { StabilizationStrategies } from '../src/strategies/stabilization';

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
    // Wait for reload (spinner) - use loose check as it might be too fast
    try {
        await page.locator('.spinner').waitFor({ state: 'visible', timeout: 2000 });
    } catch (e) {
        // Ignored - might have missed it
    }
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
                pagination: PaginationStrategies.infiniteScroll({
                    scrollTarget: '[data-testid="virtuoso-scroller"]',
                    scrollAmount: 500,
                    action: 'js-scroll',
                    stabilization: StabilizationStrategies.contentChanged()
                })
            }
        });

        // 3. Get Rows (First batch)
        const rows = await table.findRows({}, { maxPages: 1 });

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
                pagination: PaginationStrategies.infiniteScroll({
                    scrollTarget: '[data-testid="virtuoso-scroller"]',
                    scrollAmount: 1000,
                    action: 'js-scroll',
                    stabilization: StabilizationStrategies.contentChanged({ timeout: 500 })
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
                pagination: PaginationStrategies.infiniteScroll({
                    scrollTarget: '[data-testid="virtuoso-scroller"]',
                    scrollAmount: 1000,
                    action: 'js-scroll',
                    stabilization: StabilizationStrategies.contentChanged({ timeout: 500 })
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
                pagination: PaginationStrategies.infiniteScroll({
                    scrollTarget: '[data-testid="virtuoso-scroller"]',
                    scrollAmount: 300,
                    action: 'js-scroll',
                    stabilization: StabilizationStrategies.contentChanged({ timeout: 1000 })
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
                },
                autoFlatten: true
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

    test('should return batches by default (autoFlatten=false)', async ({ page }) => {
        // 1. Setup simple table
        await setPlaygroundConfig(page, {
            rowCount: 10,
            defaults: { generator: "simple" } // Fast generator
        });

        await page.waitForTimeout(500);

        const table = useTable(page.locator('.virtual-table-container'), {
            rowSelector: '.virtual-row',
            headerSelector: '.header [role="columnheader"]',
            cellSelector: '[role="cell"]',
            strategies: {
                pagination: PaginationStrategies.infiniteScroll({
                    scrollTarget: '[data-testid="virtuoso-scroller"]',
                    scrollAmount: 500,
                    action: 'js-scroll',
                    stabilization: StabilizationStrategies.contentChanged()
                })
            }
        });

        // 2. Iterate with batching, relying on default autoFlatten=false
        const batchedData = await table.iterateThroughTable(
            async ({ rows }) => {
                return await rows.toJSON();
            },
            {
                maxIterations: 2,
                batchSize: 5
                // autoFlatten: false (implicit default)
            }
        );

        // Should return array of arrays (batches)
        expect(Array.isArray(batchedData)).toBe(true);
        expect(batchedData.length).toBeGreaterThan(0);
        // First item should be an array of rows
        expect(Array.isArray(batchedData[0])).toBe(true);

        // Safety check: ensure INNER items are row objects
        const firstBatch = batchedData[0] as any[];
        if (firstBatch.length > 0) {
            expect(firstBatch[0]).toHaveProperty('ID');
        }
    });

    test('should flatten batches when autoFlatten is true', async ({ page }) => {
        // 1. Reuse setup logic (or setup anew to be safe)
        await setPlaygroundConfig(page, {
            rowCount: 10,
            defaults: { generator: "simple" }
        });
        await page.waitForTimeout(500);

        const table = useTable(page.locator('.virtual-table-container'), {
            rowSelector: '.virtual-row',
            headerSelector: '.header [role="columnheader"]',
            cellSelector: '[role="cell"]',
            strategies: {
                pagination: PaginationStrategies.infiniteScroll({
                    scrollTarget: '[data-testid="virtuoso-scroller"]',
                    scrollAmount: 500,
                    action: 'js-scroll',
                    stabilization: StabilizationStrategies.contentChanged()
                })
            }
        });

        // 2. Iterate with explicit autoFlatten=true
        const flatData = await table.iterateThroughTable(
            async ({ rows }) => {
                return await rows.toJSON();
            },
            {
                maxIterations: 2,
                batchSize: 5,
                autoFlatten: true
            }
        );

        // Should return flat array of rows
        expect(Array.isArray(flatData)).toBe(true);
        expect(flatData.length).toBeGreaterThan(0);

        // First item should be a row object, NOT an array
        expect(Array.isArray(flatData[0])).toBe(false);
        expect(flatData[0]).toHaveProperty('ID');
    });

    test('should cache previously loaded rows (skip delay)', async ({ page }) => {
        page.on('console', msg => console.log(`[Browser] ${msg.text()}`));
        test.setTimeout(60000);
        // 1. Setup: 2s delay, row caching ON
        await setPlaygroundConfig(page, {
            rowCount: 100,
            defaults: {
                tableInitDelay: 500,
                rowDelay: 2000,
                generator: "simple",
                rowCache: true
            }
        });
        await page.waitForTimeout(500);
        // Ensure new config is applied
        await expect(page.locator('.virtual-table-container')).toHaveAttribute('data-debug-row-delay', '2000');

        const table = useTable(page.locator('.virtual-table-container'), {
            rowSelector: '.virtual-row',
            headerSelector: '.header [role="columnheader"]',
            cellSelector: '[role="cell"]',
            strategies: {
                pagination: PaginationStrategies.infiniteScroll({
                    scrollTarget: '[data-testid="virtuoso-scroller"]',
                    scrollAmount: 500,
                    action: 'js-scroll',
                    stabilization: StabilizationStrategies.contentChanged({ timeout: 200 })
                }),
                loading: {
                    isTableLoading: async ({ root }) => {
                        return (await root.locator('.skeleton-row').count()) > 0;
                    }
                }
            },
            maxPages: 20
        });

        // 2. Find row 20 (First time: should be slow due to delay)
        // Note: Row 20 might be around 1000px down.
        const start1 = Date.now();
        await table.findRow({ ID: '20' });
        const duration1 = Date.now() - start1;

        expect(duration1).toBeGreaterThan(1200); // At least delay time (minus some jitter/overhead margin) // At least delay time (minus some jitter/overhead margin)

        // 3. Reset scroll to top (destroying row 20)
        await page.locator('[data-testid="virtuoso-scroller"]').evaluate(el => el.scrollTop = 0);
        await page.waitForTimeout(500); // Wait for unmount/render

        // 4. Find row 20 again (Second time: should be fast)
        const start2 = Date.now();
        await table.findRow({ ID: '20' });
        const duration2 = Date.now() - start2;

        console.log(`First load: ${duration1}ms, Second load: ${duration2}ms`);
        // Should be much faster. Allow some buffer for scrolling/rendering (e.g. 1000ms), but definitely less than 2000ms delay + scroll
        // Actually, without delay, it should be instant (< 1000ms depending on scroll speed).
        expect(duration2).toBeLessThan(duration1);
        expect(duration2).toBeLessThan(1500);
    });
});
