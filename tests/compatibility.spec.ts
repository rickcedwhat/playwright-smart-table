import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';
import { TableStrategies } from '../src/strategies';

/**
 * Compatibility Test Suite
 * 
 * These tests ensure backwards compatibility across versions.
 * They focus on core functionality that must not break.
 * 
 * When a new version is released:
 * 1. Archive this file as compatibility_v<version>.spec.ts
 * 2. Update this file with any new critical tests
 * 3. Run all archived compatibility tests to ensure nothing broke
 */

test.describe('Backwards Compatibility Tests', () => {

  test('Core: useTable creates table instance', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });

    // Table should have all expected methods
    expect(table).toHaveProperty('getByRow');
    expect(table).toHaveProperty('getAllRows');
    expect(table).toHaveProperty('getHeaders');
    expect(table).toHaveProperty('getHeaderCell');
    expect(table).toHaveProperty('reset');
    expect(table).toHaveProperty('getColumnValues');
    expect(table).toHaveProperty('generateConfigPrompt');
    expect(table).toHaveProperty('generateStrategyPrompt');
  });

  test('Core: getByRow returns SmartRow with getCell method', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });

    const row = await table.getByRow({ Name: 'Airi Satou' });
    
    // SmartRow should have getCell method
    expect(typeof row.getCell).toBe('function');
    expect(typeof row.toJSON).toBe('function');
    
    // getCell should return a Locator
    const cell = row.getCell('Position');
    await expect(cell).toHaveText('Accountant');
  });

  test('Core: getByRow with multiple filters', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });

    const row = await table.getByRow({ Name: 'Airi Satou', Office: 'Tokyo' });
    await expect(row).toBeVisible();
  });

  test('Core: getByRow returns sentinel for non-existent rows', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });

    const row = await table.getByRow({ Name: 'NonExistentUser' });
    await expect(row).not.toBeVisible();
  });

  test('Core: getAllRows returns array of SmartRows', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });

    const rows = await table.getAllRows();
    
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    expect(typeof rows[0].getCell).toBe('function');
  });

  test('Core: getAllRows with filter option', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });

    const filtered = await table.getAllRows({
      filter: { Office: 'Tokyo' }
    });
    
    expect(Array.isArray(filtered)).toBe(true);
    expect(filtered.length).toBeGreaterThan(0);
  });

  test('Core: getAllRows with asJSON option', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });

    const data = await table.getAllRows({ asJSON: true });
    
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(typeof data[0]).toBe('object');
    expect(data[0]).toHaveProperty('Name');
  });

  test('Core: getByRow with asJSON option', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });

    const data = await table.getByRow({ Name: 'Airi Satou' }, { asJSON: true });
    
    expect(typeof data).toBe('object');
    expect(data).toHaveProperty('Name', 'Airi Satou');
    expect(data).toHaveProperty('Position');
  });

  test('Core: SmartRow.toJSON returns row data', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });

    const row = await table.getByRow({ Name: 'Airi Satou' });
    const data = await row.toJSON();
    
    expect(typeof data).toBe('object');
    expect(data).toHaveProperty('Name', 'Airi Satou');
    expect(data).toHaveProperty('Position');
  });

  test('Core: getHeaders returns array of column names', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });

    const headers = await table.getHeaders();
    
    expect(Array.isArray(headers)).toBe(true);
    expect(headers.length).toBeGreaterThan(0);
    expect(headers).toContain('Name');
    expect(headers).toContain('Position');
  });

  test('Core: getHeaderCell returns Locator', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });

    const headerCell = await table.getHeaderCell('Name');
    await expect(headerCell).toBeVisible();
    await expect(headerCell).toHaveText('Name');
  });

  test('Core: getColumnValues returns array of values', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });

    const offices = await table.getColumnValues('Office');
    
    expect(Array.isArray(offices)).toBe(true);
    expect(offices.length).toBeGreaterThan(0);
    expect(typeof offices[0]).toBe('string');
  });

  test('Core: reset method exists and is callable', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });

    // Should not throw
    await expect(table.reset()).resolves.not.toThrow();
  });

  test('Core: pagination with clickNext strategy', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    await page.waitForSelector('#example_wrapper');
    
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th',
      pagination: TableStrategies.clickNext(() => 
        page.getByRole('link', { name: 'Next' })
      ),
      maxPages: 2
    });

    // Should be able to find a row (even if it requires pagination)
    const row = await table.getByRow({ Name: 'Airi Satou' });
    await expect(row).toBeVisible();
  });

  test('Core: headerTransformer function is applied', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/tables');
    
    const table = useTable(page.locator('#table1'), {
      headerTransformer: ({ text }) => text.trim().toLowerCase()
    });

    const headers = await table.getHeaders();
    // Verify transformer was applied (headers should be lowercase)
    expect(headers.some(h => h === h.toLowerCase())).toBe(true);
  });

  test('Core: SmartRow extends Locator API', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });

    const row = await table.getByRow({ Name: 'Airi Satou' });
    
    // Should have standard Locator methods
    await expect(row).toBeVisible();
    await expect(row).toBeEnabled();
    const text = await row.textContent();
    expect(text).toBeTruthy();
  });
});

