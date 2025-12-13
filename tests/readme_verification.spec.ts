import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';

test.describe('README.md Examples Verification', () => {

  test('getAllRows({ asJSON: true }) returns data objects', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    
    const table = useTable(page.locator('#example'), { 
      headerSelector: 'thead th' 
    });

    // ✅ v2.0 UPDATE: Renamed to getAllRows
    const rows = await table.getAllRows({ asJSON: true });

    expect(rows[0]['Name']).toBe('Airi Satou');
    expect(rows[1]['Name']).toBe('Angelica Ramos');
  });

  test('SmartRow interaction (v2.0 Feature)', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), { headerSelector: 'thead th' });

    // 1. Get SmartRow via getByRow
    const row = await table.getByRow({ Name: 'Airi Satou' });
    
    // 2. Interact with cell (No more getByCell needed!)
    await expect(row.getCell('Position')).toHaveText('Accountant');
    
    // 3. Dump data from row
    const data = await row.toJSON();
    expect(data.Office).toBe('Tokyo');
  });

  test('Single Row Data Dump (asJSON)', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), { headerSelector: 'thead th' });

    // ✅ v2.0 UPDATE: getRowAsJSON replaced by getByRow option
    const data = await table.getByRow({ Name: 'Ashton Cox' }, { asJSON: true });

    expect(data['Name']).toBe('Ashton Cox');
    expect(data['Position']).toBe('Junior Technical Author');
  });
});