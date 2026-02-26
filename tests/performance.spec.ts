import { test, expect, Page } from '@playwright/test';
import { useTable, Strategies } from '../src/index';
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
    try {
        await page.locator('.spinner').waitFor({ state: 'visible', timeout: 2000 });
    } catch (e) {
        // Ignored - might have missed it
    }
    await expect(page.locator('.spinner')).not.toBeVisible();
}

test.describe('Performance Benchmark', () => {
    test.beforeEach(async ({ page }) => {
        try {
            const response = await page.request.get('http://localhost:3000/virtualized');
            if (!response.ok()) throw new Error('Local server not running');
        } catch (e) {
            test.skip(true, 'Skipping: Local playground server not running at localhost:3000');
        }

        await page.goto('http://localhost:3000/virtualized');
        await expect(page.getByRole('heading', { name: 'Virtualized Table Scenario' })).toBeVisible();
    });

    test('should iterate 10,000 virtualized rows in a performant manner', async ({ page }) => {

        await setPlaygroundConfig(page, {
            rowCount: 10000,
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
                pagination: Strategies.Pagination.infiniteScroll({
                    scrollTarget: '[data-testid="virtuoso-scroller"]',
                    scrollAmount: 1500, // scroll more aggressively for performance
                    action: 'js-scroll',
                    stabilization: StabilizationStrategies.contentChanged({ timeout: 500 })
                })
            }
        });

        const start = Date.now();

        // Find the last row to force iteration through all pages. 
        // We set maxPages to 1000 to ensure we search enough times to reach 10000 rows.
        const targetRow = await table.findRow({ ID: '10000' }, { maxPages: 1000 });

        const duration = Date.now() - start;
        console.log(`⏱️ Performance Benchmark: Finding row 10000 took ${duration}ms`);

        expect(targetRow).toBeTruthy();
        const data = await targetRow.toJSON();
        expect(data).toEqual(expect.objectContaining({ ID: '10000', Name: 'Item 10000' }));

        expect(duration).toBeLessThan(20000);
    });

    test('should extract virtualized column values with static headers', async ({ page }) => {
        await setPlaygroundConfig(page, {
            rowCount: 20,
            columnCount: 100,
            virtualizeColumns: true,
            virtualizeHeaders: false, // Ensure headers are in DOM to simulate static columns
            defaults: {
                tableInitDelay: 0,
                rowDelay: 0,
                generator: "simple"
            }
        });

        await page.waitForTimeout(500);

        const table = useTable(page.locator('.virtual-table-container'), {
            rowSelector: '.virtual-row',
            headerSelector: '.header [role="columnheader"]',
            cellSelector: '[role="cell"]'
            // No custom header strategy needed as headers are fully mounted
        });

        const start = Date.now();

        await table.init();

        // The default HeaderStrategies.visible will instantly map all 100 static column headers
        const row = table.getRowByIndex(0);

        // If we want to extract text from a virtualized cell on the far right, we must 
        // explicitly scroll the empty placeholder div into view so the element mounts.
        const targetCell = row.getCell('Column 100');
        await targetCell.scrollIntoViewIfNeeded();

        // Wait for react-virtuoso to replace the empty placeholder with actual content
        await expect(targetCell).not.toBeEmpty();

        // Extract the target data
        const data = await row.toJSON({ columns: ['Column 100'] });

        const duration = Date.now() - start;
        console.log(`⏱️ Performance Benchmark: Finding Column 100 took ${duration}ms`);

        expect(data['Column 100']).toBe('Data for Row 1 Column 100');
        expect(duration).toBeLessThan(5000);
    });

    test('should extract virtualized column values with fully virtualized headers', async ({ page }) => {
        await setPlaygroundConfig(page, {
            rowCount: 20,
            columnCount: 100,
            virtualizeColumns: true,
            virtualizeHeaders: true,
            defaults: {
                tableInitDelay: 0,
                rowDelay: 0,
                generator: "simple"
            }
        });

        await page.waitForTimeout(500);

        const table = useTable(page.locator('.virtual-table-container'), {
            rowSelector: '.virtual-row',
            headerSelector: '.header [role="columnheader"]',
            cellSelector: '[role="cell"]',
            strategies: {
                header: async ({ root, config, resolve, page }: any) => {
                    const scroller = root.locator('.virtuoso-scroller').or(page.locator('[data-testid="virtuoso-scroller"]'));
                    const finalHeaders: string[] = new Array(100).fill('');

                    for (let i = 0; i < 50; i++) {
                        // Bulk evaluate synchronously in browser context to avoid 
                        // sequential allInnerTexts() lag and to preserve array index alignment
                        const domStates = await resolve(config.headerSelector, root).evaluateAll((elements: any[]) =>
                            elements.map((el: any) => el.textContent?.trim() || '')
                        );

                        let foundNew = false;
                        for (let j = 0; j < domStates.length; j++) {
                            const text = domStates[j];
                            if (text && finalHeaders[j] === '') {
                                finalHeaders[j] = text;
                                foundNew = true;
                            }
                        }

                        if (!foundNew && i > 0) break;

                        await scroller.evaluate((s: any) => s.scrollLeft += 1000);
                        await page.waitForTimeout(50); // let virtuoso unmount
                    }
                    return finalHeaders;
                }
            }
        });

        const start = Date.now();

        await table.init();

        // Mappings happen under the hood 
        const row = table.getRowByIndex(0);

        // Force virtualized DOM cell to mount
        const targetCell = row.getCell('Column 100');
        await targetCell.scrollIntoViewIfNeeded();
        await expect(targetCell).not.toBeEmpty();

        const data = await row.toJSON({ columns: ['Column 100'] });
        const duration = Date.now() - start;
        console.log(`⏱️ Performance Benchmark: Finding completely virtualized Column 100 took ${duration}ms`);

        expect(data['Column 100']).toBe('Data for Row 1 Column 100');
        expect(duration).toBeLessThan(5000);
    });
});
