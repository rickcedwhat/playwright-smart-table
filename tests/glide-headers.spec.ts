
import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';
import { HeaderStrategies } from '../src/strategies/headers';

test.describe('Live Glide Data Grid - Headers', () => {
    test('should scan for headers using scrollRight strategy', async ({ page }) => {
        await page.goto('https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--add-data');
        const previewFrame = page.frameLocator('#storybook-preview-iframe');
        const grid = previewFrame.locator('table[role="grid"]').first();
        await expect(grid).toBeAttached();

        const table = useTable(grid, {
            headerSelector: 'thead tr th',
            rowSelector: 'tbody tr',
            cellSelector: 'td',
            headerStrategy: HeaderStrategies.scrollRight
        });

        await table.init();

        const headers = await table.getHeaders();
        console.log('ScrollRight Headers:', headers);

        expect(headers.length).toBeGreaterThan(0);
        expect(headers).toContain('First name');
    });

    test('should scan for headers using keyboard strategy', async ({ page }) => {
        await page.goto('https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--add-data');
        const previewFrame = page.frameLocator('#storybook-preview-iframe');
        const grid = previewFrame.locator('table[role="grid"]').first();
        await expect(grid).toBeAttached();

        const table = useTable(grid, {
            headerSelector: 'thead tr th',
            rowSelector: 'tbody tr',
            cellSelector: 'td',
            headerStrategy: HeaderStrategies.keyboard
        });

        await table.init();

        const headers = await table.getHeaders();
        console.log('Keyboard Strategy Headers:', headers);

        expect(headers.length).toBeGreaterThan(0);
        expect(headers).toContain('First name');
    });
});
