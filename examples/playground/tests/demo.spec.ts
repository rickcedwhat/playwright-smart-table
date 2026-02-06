import { test, expect } from '@playwright/test';
import { useTable } from '@rickcedwhat/playwright-smart-table';

test('demo: interacts with datatables.net', async ({ page }) => {
    // 1. Navigate to the page
    await page.goto('https://datatables.net/examples/data_sources/dom');

    // 2. Initialize the table
    const table = useTable(page.locator('#example'), {
        headerSelector: 'thead th' // Explicitly tell it where headers are
    });

    // 3. Find a row by content ("Airi Satou")
    const row = await table.findRow({ Name: 'Airi Satou' });

    // 4. Verify data in other columns
    await expect(row.getCell('Position')).toHaveText('Accountant');
    await expect(row.getCell('Office')).toHaveText('Tokyo');

    console.log('Test completed successfully!');
});
