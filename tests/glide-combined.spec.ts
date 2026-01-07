
import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';
import type { FillStrategy, ColumnStrategy } from '../src/types';
import { HeaderStrategies } from '../src/strategies/headers';
import { ColumnStrategies } from '../src/strategies/columns'

test.describe('Live Glide Data Grid - Combined', () => {
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
            await page.waitForTimeout(100);
            await page.keyboard.type(String(value));
            await page.waitForTimeout(200);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(500);
        };

        // 3. Configure Table
        // Root is the CANVAS itself as per user request
        const table = useTable(page.locator('canvas').first(), {
            headerStrategy: HeaderStrategies.scrollRight,
            columnStrategy: ColumnStrategies.keyboard, // Use our refactored keyboard strategy
            fillStrategy: glideFillStrategy, // Pass the custom fill strategy
            // Update cellResolver for virtualized columns using ID selector
            cellResolver: ({ row, columnIndex, rowIndex }) => {
                // Glide uses 1-based colIndex for data cells (colIndex 0 is row header usually)
                // rowIndex seems to be 0-based in the ID based on "glide-cell-1-0"
                return page.locator(`#glide-cell-${columnIndex + 1}-${rowIndex}`);
            }
        });

        await table.init();

        const headers = await table.getHeaders();
        console.log('Headers found:', headers);
        expect(headers.length).toBeGreaterThan(50); // Verify we found many columns

        // Use getByRow(1) (1-based index) to get the first row with rowIndex context
        const firstRow = table.getByRow(1);

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
