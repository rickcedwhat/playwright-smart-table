import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';
import { Plugins } from '../src/index';

/**
 * Material UI Data Grid plugin tests.
 * Uses the live MUI table demo. Run with network for best reliability.
 */
test.describe('MUI Data Grid Plugin', () => {
  test.setTimeout(60000);

  test('should find row across pages and read cell data', async ({ page }) => {
    await page.goto('https://mui.com/material-ui/react-table/');

    const tableLocator = page.locator('.MuiDataGrid-root').first();
    const table = useTable(tableLocator, {
      ...Plugins.MUI,
      maxPages: 5,
    });
    await table.init();

    const headers = await table.getHeaders();
    expect(headers).toContain('Actions');

    const currentPageRow = table.getRow({ 'Last name': 'Melisandre' });
    await expect(currentPageRow).not.toBeVisible();

    const row = await table.findRow({ 'Last name': 'Melisandre' });
    await expect(row).toBeVisible();

    const ageCell = row.getCell('Age');
    await expect(ageCell).toHaveText('150');

    const userData = await row.toJSON();
    expect(userData).toHaveProperty('Last name', 'Melisandre');
  });

  test('should interact with Actions column (checkbox)', async ({ page }) => {
    await page.goto('https://mui.com/material-ui/react-table/');

    const table = useTable(page.locator('.MuiDataGrid-root').first(), {
      ...Plugins.MUI,
      maxPages: 5,
    });
    await table.init();

    const actionsRow = await table.findRow({ Age: '150' });
    const actionsCell = actionsRow.getCell('Actions');
    await actionsCell.getByLabel('Select row').click();
  });
});
