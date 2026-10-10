import { test, expect, Page } from '@playwright/test';
import { useTable } from '../src';

async function setupTable(page: Page) {
  await page.setContent(`
    <table id="t">
      <thead><tr><th>Name</th><th>Status</th><th>Age</th></tr></thead>
      <tbody>
        <tr><td>Alice</td><td>Active</td><td>30</td></tr>
        <tr><td>Bob</td><td>Inactive</td><td>25</td></tr>
        <tr><td>Carol</td><td>Active</td><td>41</td></tr>
      </tbody>
    </table>
  `);
  return useTable(page.locator('#t')).init();
}

test.describe('locator descriptions (#485)', () => {
  test('getRow and getCell are named by their filters', async ({ page }) => {
    const table = await setupTable(page);

    const row = table.getRow({ Name: 'Bob', Status: /inact/i });
    const cell = row.getCell('Age');

    expect(row.description()).toBe('SmartRow where Name="Bob", Status=/inact/i');
    expect(cell.description()).toBe('SmartRow where Name="Bob", Status=/inact/i › "Age" cell');
    await expect(cell).toHaveText('25');
  });

  test('findRow names the found row and the sentinel by filters', async ({ page }) => {
    const table = await setupTable(page);

    const found = await table.findRow({ Name: 'Carol' });
    const missing = await table.findRow({ Name: 'Zed' });

    expect(found.description()).toBe('SmartRow where Name="Carol"');
    await expect(found.getCell('Status')).toHaveText('Active');
    expect(missing.description()).toBe('SmartRow not found: Name="Zed"');
    await expect(missing).not.toBeVisible();
  });

  test('index-based rows are named by index', async ({ page }) => {
    const table = await setupTable(page);

    const byIndex = table.getRowByIndex(2);
    const mapped = await table.map(({ row }) => row.description());

    expect(byIndex.description()).toBe('SmartRow #2');
    await expect(byIndex.getCell('Name')).toHaveText('Carol');
    expect(mapped).toEqual(['SmartRow #0', 'SmartRow #1', 'SmartRow #2']);
  });

  test('assertion failures show the description instead of the selector chain', async ({ page }) => {
    const table = await setupTable(page);
    const cell = table.getRow({ Name: 'Alice' }).getCell('Age');

    const error = await expect(cell).toHaveText('99', { timeout: 200 }).catch((e: Error) => e);

    expect(String(error)).toContain('SmartRow where Name="Alice" › "Age" cell');
  });
});
