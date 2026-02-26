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

    test('should iterate 1,000 virtualized rows in a performant manner', async ({ page }) => {
        // Warning: Currently O(N^2), so this will take a while. We set a high timeout to establish a baseline.
        test.setTimeout(120000);

        await setPlaygroundConfig(page, {
            rowCount: 1000,
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
        // We set maxPages to 100 to ensure we search enough times to reach 1000 rows.
        const targetRow = await table.findRow({ ID: '1000' }, { maxPages: 100 });

        const duration = Date.now() - start;
        console.log(`⏱️ Performance Benchmark: Finding row 1000 took ${duration}ms`);

        expect(targetRow).toBeTruthy();
        const data = await targetRow.toJSON();
        expect(data).toEqual(expect.objectContaining({ ID: '1000', Name: 'Item 1000' }));

        // Assert that the duration is within a baseline threshold, e.g. 60 seconds.
        // Once O(N^2) is fixed, this should be drastically reduced.
        expect(duration).toBeLessThan(60000);
    });
});
