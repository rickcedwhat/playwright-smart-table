
import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';
import type { FillStrategy, CellNavigationStrategy } from '../src/types';
import { Strategies } from '../src/strategies';

test.describe('Live Glide Data Grid', () => {
    test('should scan headers and write to multiple columns', async ({ page }) => {
        // 1. Setup
        await page.goto('https://glideapps.github.io/glide-data-grid/iframe.html?viewMode=story&id=glide-data-grid-dataeditor-demos--add-data&globals=');
        // Stabilize: Wait for grid to be attached
        const grid = page.locator('table[role="grid"]').first();
        await expect(grid).toBeAttached({ timeout: 15000 });

        // 2. Define Custom Write Strategy
        // Custom fill strategy for Glide (Just typing/editing)
        // Navigation is now handled by ColumnStrategies.keyboard using rowIndex
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

        // 3. Configure Table
        // Root is the CANVAS itself as per user request
        const table = useTable(page.locator('canvas').first(), {
            headerSelector: 'thead th',
            rowSelector: 'tbody tr',
            cellSelector: 'td',
            strategies: {
                header: Strategies.Header.scrollRight,
                cellNavigation: Strategies.Column.keyboard,
                fill: glideFillStrategy,
                getCellLocator: ({ columnIndex, rowIndex }) => {
                    // Glide uses 1-based colIndex for data cells (colIndex 0 is row header usually)
                    // rowIndex seems to be 0-based in the ID based on "glide-cell-1-0"
                    return page.locator(`#glide-cell-${columnIndex + 1}-${rowIndex}`);
                }
            }
        });

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
});
