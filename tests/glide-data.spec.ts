
import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';

test.describe('Glide Data Grid Inspection', () => {
    test('should inspect new demo', async ({ page }) => {
        await page.goto('https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--add-data');
        const previewFrame = page.frameLocator('#storybook-preview-iframe');
        await expect(previewFrame.getByTestId('data-grid-canvas')).toBeVisible({ timeout: 10000 });

        const grid = previewFrame.locator('table[role="grid"]').first();
        await expect(grid).toBeAttached();

        const table = useTable(grid, {
            headerSelector: 'thead tr th',
            rowSelector: 'tbody tr',
            cellSelector: 'td'
        });
        await table.init();

        const headers = await table.getHeaders();
        console.log("Headers detected:", headers);

        const rows = await table.getAllCurrentRows();
        if (rows.length > 0) {
            console.log("First row:", await rows[0].toJSON());
        }
    });
});
