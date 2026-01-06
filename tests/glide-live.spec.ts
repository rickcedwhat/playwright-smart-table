
import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';

test.describe('Live Glide Data Grid', () => {
    test('should inspect structure', async ({ page }) => {
        // 1. Go to Storybook
        await page.goto('https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--add-columns');

        // 2. Wait for Storybook to load
        const previewFrame = page.frameLocator('#storybook-preview-iframe');

        // Wait for something grid-like
        await expect(previewFrame.getByTestId('data-grid-canvas')).toBeVisible({ timeout: 10000 });

        // 3. Inspect DOM for Accessibility
        // User confirmed structure:
        // div.dvn-underlay -> canvas + table[role="grid"]
        const grid = previewFrame.locator('table[role="grid"]').first();

        await expect(grid).toBeAttached({ timeout: 10000 });
        console.log("Found table[role='grid']!");

        // 4. Configure useTable
        const table = useTable(grid, {
            headerSelector: 'thead tr th',
            rowSelector: 'tbody tr',
            cellSelector: 'td'
        });

        // 5. Test Reading
        await table.init();
        const headers = await table.getHeaders();
        console.log("Headers:", headers);
        expect(headers.length).toBeGreaterThan(0);

        // 6. Test Data Reading (Top rows)
        const rows = await table.getAllCurrentRows();
        console.log(`Read ${rows.length} rows`);
        expect(rows.length).toBeGreaterThan(0);

        const firstRow = await rows[0].toJSON();
        console.log("First Row Data:", firstRow);
    });

    test('should infinite scroll', async ({ page }) => {
        await page.goto('https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--add-columns');
        const previewFrame = page.frameLocator('#storybook-preview-iframe');
        const grid = previewFrame.locator('table[role="grid"]').first();
        await expect(grid).toBeAttached();

        const table = useTable(grid, {
            headerSelector: 'thead tr th',
            rowSelector: 'tbody tr',
            cellSelector: 'td',
            pagination: async (context) => {
                // Strategy: Scroll the overlay container directly
                const scroller = previewFrame.locator('.dvn-scroller').first();
                await expect(scroller).toBeAttached();

                // Force scroll via JS (most reliable for virtual lists)
                await scroller.evaluate(div => div.scrollTop += 500);

                // Wait for virtual rows to render
                await page.waitForTimeout(1000);

                return true;
            }
        });
        await table.init();

        // Collect data using iterateThroughTable
        const allData = await table.iterateThroughTable(
            async ({ rows }) => {
                return Promise.all(rows.map(r => r.toJSON()));
            },
            { maxIterations: 3 }
        );

        const flattenedData = allData.flat();

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
