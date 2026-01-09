import { test, expect, Locator, Page } from '@playwright/test';
import { useTable } from '../src/useTable';
import type { FillStrategy, TableConfig, TableContext } from '../src/types';
import { Strategies } from '../src/strategies';

test.describe('Live Glide Data Grid', () => {
    // Shared Strategies & Configuration
    const glideFillStrategy: FillStrategy = async ({ value, page }) => {
        // Edit Cell
        await page.keyboard.press('Enter');
        // Wait for editor to appear
        const textarea = page.locator('textarea.gdg-input');
        await textarea.waitFor({ state: 'visible', timeout: 2000 });
        await page.keyboard.type(String(value));
        // Wait for textarea value to match what we typed
        await textarea.evaluate((el, expectedValue) => {
            return new Promise<void>((resolve) => {
                const checkValue = () => {
                    if ((el as HTMLTextAreaElement).value === expectedValue) {
                        resolve();
                    } else {
                        setTimeout(checkValue, 10);
                    }
                };
                checkValue();
            });
        }, String(value));
        // Small delay to let the grid process the value
        await page.waitForTimeout(50);
        await page.keyboard.press('Enter');
        // Wait for editor to close (commit completed)
        await textarea.waitFor({ state: 'detached', timeout: 2000 });
        // Wait for accessibility layer to sync with canvas state
        await page.waitForTimeout(300);
    };

    const glidePaginationStrategy = async ({ root }: TableContext) => {
        // Strategy: Scroll the overlay container.
        // We need to find the scroller within the same frame as the root.
        // Using xpath to go up to body and find the scroller ensures we stay in the frame.
        const scroller = root.locator('xpath=//ancestor::body//div[contains(@class, "dvn-scroller")]').first();
        await expect(scroller).toBeAttached();

        // Force scroll via JS (most reliable for virtual lists)
        await scroller.evaluate(div => div.scrollTop += 500);

        // Wait for virtual rows to render
        // We use root.page() for timeout which is fine (global timer)
        await root.page().waitForTimeout(1000);

        return true;
    };

    const glideConfig: TableConfig = {
        headerSelector: 'thead tr th',
        rowSelector: 'tbody tr',
        cellSelector: 'td',
        strategies: {
            header: Strategies.Header.scrollRight,
            cellNavigation: Strategies.Column.keyboard,
            fill: glideFillStrategy,
            pagination: glidePaginationStrategy,
            getCellLocator: ({ page, columnIndex, rowIndex }) => {
                // Glide uses 1-based colIndex for data cells (colIndex 0 is row header usually)
                // rowIndex seems to be 0-based in the ID based on "glide-cell-1-0"
                return page.locator(`#glide-cell-${columnIndex + 1}-${rowIndex}`);
            },
            getActiveCell: async ({ page }) => {
                // Find the focused cell/element
                // Use broad selector for focused element
                const focused = page.locator('*:focus').first();

                if (await focused.count() === 0) return null;

                // Debug log
                if (process.env.DEBUG) console.log('Found focused element:', await focused.evaluate(e => e.outerHTML));

                // Try to extract position from ID if possible
                const id = await focused.getAttribute('id') || '';
                // Expected format: glide-cell-COL-ROW
                const parts = id.split('-');

                let rowIndex = -1;
                let columnIndex = -1;

                if (parts.length >= 4 && parts[0] === 'glide' && parts[1] === 'cell') {
                    columnIndex = parseInt(parts[2]) - 1; // 1-based in ID to 0-based
                    rowIndex = parseInt(parts[3]);
                } else {
                    // Fallback: If we can't parse ID, we assume it's the correct cell 
                    // because we just navigated to it. 
                    // Returning -1 indices might be confusing but won't stop smartRow from using the locator.
                }

                return {
                    rowIndex,
                    columnIndex,
                    locator: focused
                };
            }
        }
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

        // Use getByRowIndex(1) (1-based index) to get the first row with rowIndex context
        const firstRow = table.getByRowIndex(1);

        const newName = "Antigravity";
        const newTitle = "CEO";

        console.log(`Writing Name: ${newName}`);
        await firstRow.fill({ "First name": newName });

        console.log(`Writing Title: ${newTitle}`);
        await firstRow.fill({ "Title": newTitle });

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
        const table = useTable(page.locator('canvas').first(), { ...glideConfig, debug: true });
        await table.init();

        // Collect data using iterateThroughTable
        const allData = await table.iterateThroughTable(
            async ({ rows }) => {
                return Promise.all(rows.map(r => r.toJSON({ columns: ['First name', 'Last name', 'Title', 'Email'] })));
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
