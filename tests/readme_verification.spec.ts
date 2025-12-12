import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';

test.describe('README.md Examples Verification', () => {

  test('getRows() returns array of objects (Matches README)', async ({ page }) => {
    // 1. Arrange: Go to a standard table with a "Name" column
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), { 
      headerSelector: 'thead th' 
    });

    // 2. Act: Get all rows as JSON objects
    const rows = await table.getRows();

    // 3. Assert: Verify the structure matches the README example
    console.log('First Row:', rows[0]); 

    // Datatables.net default sort order:
    // Row 0: Airi Satou
    // Row 1: Angelica Ramos
    expect(rows[0]['Name']).toBe('Airi Satou');
    expect(rows[1]['Name']).toBe('Angelica Ramos');
    
    // Verify other columns to ensure mapping is correct
    expect(rows[0]['Position']).toBe('Accountant');
    expect(rows[0]['Office']).toBe('Tokyo');
  });

  test('getRowAsJSON() returns single object', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), { 
      headerSelector: 'thead th' 
    });

    // Act
    const data = await table.getRowAsJSON({ Name: 'Ashton Cox' });

    // Assert
    expect(data['Name']).toBe('Ashton Cox');
    expect(data['Position']).toBe('Junior Technical Author');
    expect(data['Salary']).toContain('$86,000');

    console.log({data});
  });

});