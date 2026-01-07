
import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';
import type { FillStrategy } from '../src/types';

test.describe('Live Glide Data Grid - Writing', () => {
    test('should write to cells using custom fill strategy', async ({ page }) => {
        // 1. Setup
        await page.goto('https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--add-data');
        const previewFrame = page.frameLocator('#storybook-preview-iframe');
        const grid = previewFrame.locator('table[role="grid"]').first();
        await expect(grid).toBeAttached();

        // 2. Define Custom Strategy for Glide
        const glideFillStrategy: FillStrategy = async ({ row, columnName, value, page, table }) => {
            // Strategy: Interact with the visual Canvas
            const canvas = page.frameLocator('#storybook-preview-iframe').locator('canvas').first();

            // Focus Grid
            await canvas.click({ position: { x: 50, y: 50 }, force: true });

            // Navigate to Home (0,0)
            await page.keyboard.press('Control+Home');
            await page.keyboard.press('Home');

            // Navigate to correct column
            const headers = await table.getHeaders();
            const targetIndex = headers.indexOf(columnName);

            if (targetIndex === -1) throw new Error(`Column ${columnName} not found in headers`);

            for (let i = 0; i < targetIndex; i++) {
                await page.keyboard.press('ArrowRight');
            }

            // Wait for navigation stability
            await page.waitForTimeout(100);

            // Press Enter to enter edit mode explicitly
            await page.keyboard.press('Enter');
            await page.waitForTimeout(100);

            // Type the value
            await page.keyboard.type(String(value));
            await page.waitForTimeout(100);

            // Commit
            await page.keyboard.press('Enter');
            await page.waitForTimeout(500); // wait for commit and re-render
        };

        // 3. Configure Table
        const table = useTable(grid, {
            headerSelector: 'thead tr th',
            rowSelector: 'tbody tr',
            cellSelector: 'td',
            fillStrategy: glideFillStrategy
        });
        await table.init();

        // 4. Perform Write
        const rows = await table.getAllCurrentRows();
        const firstRow = rows[0];

        const newValue = "Thomas";

        console.log("Attempting to write:", newValue);
        await firstRow.fill({ "First name": newValue });

        // 5. Verify (Re-read from DOM)
        // Note: We depend on the accessibility table updating to match the canvas.
        // It should, but sometimes lags.
        await page.waitForTimeout(1500);

        const cell = firstRow.getCell("First name");
        const text = await cell.innerText();
        console.log("New value in DOM:", text);

        expect(text).toContain(newValue);
    });
});
