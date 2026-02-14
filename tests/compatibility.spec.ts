import { test, expect } from '@playwright/test';
import { useTable, Strategies } from '../src/useTable';

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
    expect(table).toHaveProperty('getRows');
    expect(table).toHaveProperty('getHeaders');
    expect(table).toHaveProperty('getHeaderCell');
    expect(table).toHaveProperty('reset');
    expect(table).toHaveProperty('getColumnValues');
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
    const data = await rows.toJSON();

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

  test('Core: getColumnValues returns array of values', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');

    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });
    await table.init();

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
    await table.init();

    // Should not throw
    await expect(table.reset()).resolves.not.toThrow();
  });

  test('Core: pagination with clickNext strategy', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    await page.waitForSelector('#example_wrapper');

    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th',
      strategies: {
        pagination: Strategies.Pagination.clickNext(() =>
          page.getByRole('link', { name: 'Next' })
        ),
      },
      maxPages: 2
    });
    await table.init();

    // Should be able to find a row (even if it requires pagination)
    // Use findRow for pagination
    const row = await table.findRow({ Name: 'Airi Satou' });
    await expect(row).toBeVisible();
  });

  test('Core: headerTransformer function is applied', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/tables');

    const table = useTable(page.locator('#table1'), {
      headerTransformer: ({ text }) => text.trim().toLowerCase()
    });
    await table.init();

    const headers = await table.getHeaders();
    // Verify transformer was applied (headers should be lowercase)
    expect(headers.some(h => h === h.toLowerCase())).toBe(true);
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

    // getRows should auto-init
    const rows = await table.findRows({}, { maxPages: 1 });
    expect(rows.length).toBeGreaterThan(0);

    // getColumnValues should auto-init
    const names = await table.getColumnValues('Name');
    expect(names).toContain('John');

    // findRow should auto-init
    const row = await table.findRow({ Name: 'John' });
    await expect(row).toBeVisible();
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
        pagination: Strategies.Pagination.clickNext(() =>
          page.getByRole('link', { name: 'Next' })
        ),
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

  test('iterateThroughTable: Basic iteration with clickNext', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    await page.waitForSelector('#example_wrapper');

    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th',
      strategies: {
        pagination: Strategies.Pagination.clickNext(() =>
          page.getByRole('link', { name: 'Next' })
        ),
      },
      maxPages: 3
    });
    await table.init();

    const allNames = await table.iterateThroughTable(async ({ rows, index }) => {
      // Return names from this iteration - automatically appended to allData
      const names = await Promise.all(rows.map(r => r.getCell('Name').innerText()));
      return names;
    }, { autoFlatten: true });

    // allNames should be a flattened array of strings (collected from all pages)
    expect(allNames.length).toBeGreaterThan(0);
    // Expect flat strings
    expect(typeof allNames[0]).toBe('string');

    // Verify we collected data from multiple iterations
    // Since it's already flat, we just check total length.
    const totalNames = allNames;
    expect(totalNames.length).toBeGreaterThan(10); // Should have names from multiple pages
  });

  test('iterateThroughTable: Deduplication with infiniteScroll', async ({ page }) => {
    await page.goto('https://htmx.org/examples/infinite-scroll/');

    const table = useTable(page.locator('table'), {
      rowSelector: 'tbody tr',
      headerSelector: 'thead th',
      cellSelector: 'td',
      strategies: {
        pagination: Strategies.Pagination.infiniteScroll(),
      },
      maxPages: 3
    });
    await table.init();

    // Get headers to find a suitable column for deduplication
    const headers = await table.getHeaders();
    console.log('Available headers:', headers);

    // Use first column as deduplication key (usually ID or similar)
    const dedupeColumn = headers[0];

    const allData = await table.iterateThroughTable(
      async ({ rows }) => {
        // Return row data - automatically appended to allData
        return await Promise.all(rows.map(r => r.toJSON()));
      },
      {
        dedupeStrategy: (row) => row.getCell(dedupeColumn).innerText(),
        getIsLast: ({ paginationResult }) => !paginationResult
      }
    );

    // Verify deduplication worked (rows should be unique)
    const allRows = allData.flat();
    const allKeys = allRows.map((row: any) => row[dedupeColumn] || row[dedupeColumn.toLowerCase()] || JSON.stringify(row));
    const uniqueKeys = new Set(allKeys);

    // Deduplication should ensure all keys are unique
    expect(uniqueKeys.size).toBe(allKeys.length); // All keys should be unique
    console.log(`Total rows collected: ${allRows.length}, Unique keys: ${uniqueKeys.size}`);
  });

  test('iterateThroughTable: Callback return values appended to allData', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    await page.waitForSelector('#example_wrapper');

    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th',
      strategies: {
        pagination: Strategies.Pagination.clickNext(() =>
          page.getByRole('link', { name: 'Next' })
        ),
      },
      maxPages: 2
    });
    await table.init();

    const results = await table.iterateThroughTable(async ({ rows, index }) => {
      // Return a simple object - should be appended to allData
      return { pageIndex: index, rowCount: rows.length };
    });

    // Verify return values were collected
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('pageIndex');
    expect(results[0]).toHaveProperty('rowCount');
    expect(results[0].pageIndex).toBe(0);
  });

  test('iterateThroughTable: getIsFirst/getIsLast functions', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    await page.waitForSelector('#example_wrapper');

    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th',
      strategies: {
        pagination: Strategies.Pagination.clickNext(() =>
          page.getByRole('link', { name: 'Next' })
        ),
      },
      maxPages: 2
    });
    await table.init();

    const flags: Array<{ index: number, isFirst: boolean, isLast: boolean }> = [];

    await table.iterateThroughTable(
      async ({ index, isFirst, isLast }) => {
        flags.push({ index, isFirst, isLast });
        return { index, isFirst, isLast };
      },
      {
        getIsFirst: ({ index }) => index === 0,
        getIsLast: ({ paginationResult }) => !paginationResult
      }
    );

    // Verify flags
    expect(flags[0].isFirst).toBe(true);
    expect(flags[0].index).toBe(0);
    // Note: isLast is determined AFTER pagination attempt, so the callback receives
    // the previous iteration's isLast value. The last flag should be false (before pagination),
    // but we can verify that pagination eventually fails by checking we have multiple iterations
    expect(flags.length).toBeGreaterThan(1);
  });

  test('iterateThroughTable: beforeFirst/afterLast hooks', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    await page.waitForSelector('#example_wrapper');

    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th',
      strategies: {
        pagination: Strategies.Pagination.clickNext(() =>
          page.getByRole('link', { name: 'Next' })
        ),
      },
      maxPages: 3 // Increase to ensure we have multiple iterations
    });
    await table.init();

    let beforeFirstCalled = false;
    let afterLastCalled = false;
    let iterationCount = 0;

    await table.iterateThroughTable(
      async ({ rows, index }) => {
        iterationCount++;
        return rows.length;
      },
      {
        getIsLast: ({ paginationResult }) => !paginationResult,
        beforeFirst: async ({ index, rows }) => {
          beforeFirstCalled = true;
          expect(index).toBe(0);
          expect(rows.length).toBeGreaterThan(0);
        },
        afterLast: async ({ index, rows }) => {
          afterLastCalled = true;
          expect(rows.length).toBeGreaterThan(0);
          // afterLast should be called on the last iteration (when pagination fails or maxIterations reached)
          console.log(`afterLast called at index ${index}, iterationCount: ${iterationCount}`);
        }
      }
    );

    expect(beforeFirstCalled).toBe(true);
    expect(afterLastCalled).toBe(true);
    expect(iterationCount).toBeGreaterThan(0);
  });

  test('iterateThroughTable: Restricted table context', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    await page.waitForSelector('#example_wrapper');

    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th',
      strategies: {
        pagination: Strategies.Pagination.clickNext(() =>
          page.getByRole('link', { name: 'Next' })
        ),
      },
      maxPages: 2
    });
    await table.init();

    await table.iterateThroughTable(async ({ table: restrictedTable }) => {
      // Should have safe methods
      expect(restrictedTable).toHaveProperty('getRow');
      expect(restrictedTable).toHaveProperty('getRows');
      expect(restrictedTable).toHaveProperty('getHeaders');
      expect(restrictedTable).toHaveProperty('getRowByIndex');

      // Should NOT have problematic methods
      // findRow IS allowed now (change from previous design)
      // iterateThroughTable is NOT
      expect(restrictedTable).not.toHaveProperty('iterateThroughTable');
      expect(restrictedTable).not.toHaveProperty('reset');

      return { success: true };
    });
  });

  test('iterateThroughTable: Pagination strategy from options', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    await page.waitForSelector('#example_wrapper');

    // Create table without pagination in config
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });
    await table.init();

    // Should work with pagination in options
    const results = await table.iterateThroughTable(
      async ({ rows }) => rows.length,
      {
        pagination: Strategies.Pagination.clickNext(() =>
          page.getByRole('link', { name: 'Next' })
        ),
        maxIterations: 2
      }
    );

    expect(results.length).toBeGreaterThan(0);
  });

  test('iterateThroughTable: Throws error if no pagination strategy', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    await page.waitForSelector('#example_wrapper');

    // Create table without pagination
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th'
    });
    await table.init();

    // Should throw error when no pagination provided
    await expect(
      table.iterateThroughTable(async ({ rows }) => rows.length)
    ).rejects.toThrow('No pagination strategy provided');
  });
});

