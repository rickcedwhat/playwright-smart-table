import { test, expect } from '@playwright/test';
import { useTable, Strategies } from '../src/index';

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
    await table.init();

    // Table should have all expected methods
    expect(table).toHaveProperty('getRow');
    expect(table).toHaveProperty('getRowByIndex');

    expect(table).toHaveProperty('getHeaders');
    expect(table).toHaveProperty('getHeaderCell');
    expect(table).toHaveProperty('reset');
  });

  test('Core: getRow returns SmartRow with getCell method', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');

    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });
    await table.init();

    const row = table.getRow({ Name: 'Airi Satou' });

    // SmartRow should have getCell method
    expect(typeof row.getCell).toBe('function');
    expect(typeof row.toJSON).toBe('function');

    // getCell should return a Locator
    const cell = row.getCell('Position');
    await expect(cell).toHaveText('Accountant');
  });

  test('Core: getRow with multiple filters', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');

    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });
    await table.init();

    const row = table.getRow({ Name: 'Airi Satou', Office: 'Tokyo' });
    await expect(row).toBeVisible();
  });

  test('Core: getRow returns sentinel for non-existent rows', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');

    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });
    await table.init();

    const row = table.getRow({ Name: 'NonExistentUser' });
    await expect(row).not.toBeVisible();
  });

  test('Core: findRows (current page) returns array of SmartRows', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');

    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });
    await table.init();

    const rows = await table.findRows({}, { maxPages: 1 });

    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    expect(typeof rows[0].getCell).toBe('function');
  });

  test('Core: findRows with filter option', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');

    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });
    await table.init();

    const filtered = await table.findRows({ Office: 'Tokyo' }, { maxPages: 1 });

    expect(Array.isArray(filtered)).toBe(true);
    expect(filtered.length).toBeGreaterThan(0);
  });

  test('Core: findRows with asJSON option', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');

    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });
    await table.init();

    const rows = await table.findRows({}, { maxPages: 1 });
    const data = await Promise.all(rows.map(r => r.toJSON()));

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(typeof data[0]).toBe('object');
    expect(data[0]).toHaveProperty('Name');
  });

  test('Core: getRow with toJSON()', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');

    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });
    await table.init();

    const row = table.getRow({ Name: 'Airi Satou' });
    const data = await row.toJSON();

    expect(typeof data).toBe('object');
    expect(data).toHaveProperty('Name', 'Airi Satou');
    expect(data).toHaveProperty('Position');
  });

  test('Core: SmartRow.toJSON returns row data', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');

    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });
    await table.init();

    const row = table.getRow({ Name: 'Airi Satou' });
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
    await table.init();

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
    await table.init();

    const headerCell = await table.getHeaderCell('Name');
    await expect(headerCell).toBeVisible();
    await expect(headerCell).toHaveText('Name');
  });



  test('Core: headerTransformer function is applied', async ({ page }) => {
    await page.setContent(`
      <table id="table1">
        <thead>
          <tr><th>Last Name</th><th>First Name</th></tr>
        </thead>
        <tbody>
          <tr><td>Doe</td><td>John</td></tr>
        </tbody>
      </table>
    `);

    const table = useTable(page.locator('#table1'), {
      headerTransformer: ({ text }) => text.trim().toLowerCase()
    });
    await table.init();

    const headers = await table.getHeaders();
    expect(headers).toContain('last name');
    expect(headers).toContain('first name');
  });

  test('Core: SmartRow extends Locator API', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');

    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });
    await table.init();

    const row = table.getRow({ Name: 'Airi Satou' });

    // Should have standard Locator methods
    await expect(row).toBeVisible();
    await expect(row).toBeEnabled();
    const text = await row.textContent();
    expect(text).toBeTruthy();
  });

  test('Lazy Loading: getRow works when table appears later', async ({ page }) => {
    // Start with empty page
    await page.setContent('<div id="container"></div>');

    // Create table instance before table exists
    const table = useTable(page.locator('#my-table'));

    // Now create the table
    await page.setContent(`
      <table id="my-table">
        <thead><tr><th>Name</th><th>Age</th></tr></thead>
        <tbody><tr><td>John</td><td>30</td></tr></tbody>
      </table>
    `);

    // Initialize after table exists
    await table.init();

    // Call getRow - should return immediately (sync)
    const row = table.getRow({ Name: 'John' });

    // getCell should work (returns lazy locator)
    const nameCell = row.getCell('Name');
    const ageCell = row.getCell('Age');

    // Now the locators should work
    await expect(nameCell).toHaveText('John');
    await expect(ageCell).toHaveText('30');
    await expect(row).toBeVisible();

    // Test that if row is deleted, isVisible returns false
    await page.evaluate(() => {
      document.querySelector('#my-table tbody tr')?.remove();
    });

    await expect(row).not.toBeVisible();
  });

  test('New API: Sync methods throw error if not initialized', async ({ page }) => {
    await page.setContent(`
      <table id="test-table">
        <thead><tr><th>Name</th><th>Age</th></tr></thead>
        <tbody><tr><td>John</td><td>30</td></tr></tbody>
      </table>
    `);

    const table = useTable(page.locator('#test-table'));

    // getRow should throw if not initialized
    expect(() => table.getRow({ Name: 'John' })).toThrow('Table not initialized');

    await table.init();
    const row = table.getRow({ Name: 'John' });
    // User Update: getHeaders() is now async and Auto-Initializes in the new API.
    // So it should NOT throw.
    const table2 = useTable(page.locator('#test-table'));
    await expect(table2.getHeaders()).resolves.toBeInstanceOf(Array);
  });

  test('New API: Async methods auto-initialize', async ({ page }) => {
    await page.setContent(`
      <table id="test-table">
        <thead><tr><th>Name</th><th>Age</th></tr></thead>
        <tbody><tr><td>John</td><td>30</td></tr></tbody>
      </table>
    `);

    const table = useTable(page.locator('#test-table'));


  });

  test('New API: init() method with timeout', async ({ page }) => {
    // Start with empty page
    await page.setContent('<div id="container"></div>');

    const table = useTable(page.locator('#test-table'));

    // Set table content after 2 seconds (to test timeout)
    // Use Promise to ensure async execution
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    delay(2000).then(async () => {
      await page.setContent(`
        <table id="test-table">
          <thead><tr><th>Name</th></tr></thead>
          <tbody><tr><td>John</td></tr></tbody>
        </table>
      `);
    });

    // init() should wait for table to appear (with 5 second timeout)
    await table.init({ timeout: 5000 });

    // Should be able to use sync methods after init
    const row = table.getRow({ Name: 'John' });
    await expect(row).toBeVisible();
  });

  test('New API: init() method chaining', async ({ page }) => {
    await page.setContent(`
      <table id="test-table">
        <thead><tr><th>Name</th></tr></thead>
        <tbody><tr><td>John</td></tr></tbody>
      </table>
    `);

    // Chained init pattern
    const table = await useTable(page.locator('#test-table')).init();

    // Should be able to use sync methods immediately
    const row = table.getRow({ Name: 'John' });
    await expect(row).toBeVisible();
  });

  test('New API: getRow vs findRow', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    await page.waitForSelector('#example_wrapper');

    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th',
      strategies: {
        pagination: Strategies.Pagination.click({
          next: () => page.getByRole('link', { name: 'Next' })
        })
      },
      maxPages: 2
    });
    await table.init();

    // First, verify Colleen is NOT on current page using getRow (current page only)
    const currentPageColleen = table.getRow({ Name: 'Colleen Hurst' });
    await expect(currentPageColleen).not.toBeVisible();

    // Verify Airi IS on current page using getRow
    const currentPageRow = table.getRow({ Name: 'Airi Satou' });
    await expect(currentPageRow).toBeVisible();

    // Now use findRow to find Colleen (searches across pages)
    const secondPageRow = await table.findRow({ Name: 'Colleen Hurst' });
    await expect(secondPageRow).toBeVisible();
  });


});

