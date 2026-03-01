import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';
import { Strategies } from '../src/index';

test.describe('README.md Examples Verification', () => {

  test('Quick Start + SmartRow: init, getRow, getCell, toJSON', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');

    // #region quick-start
    // Example from: https://datatables.net/examples/data_sources/dom
    const table = await useTable(page.locator('#example'), {
      headerSelector: 'thead th' // Override for this specific site
    }).init();

    // Find the row with Name="Airi Satou", then get the Position cell
    const row = table.getRow({ Name: 'Airi Satou' });

    const positionCell = row.getCell('Position');
    await expect(positionCell).toHaveText('Accountant');
    // #endregion quick-start

    // #region smart-row
    // Example from: https://datatables.net/examples/data_sources/dom

    // Interact with cell using column name (resilient to column reordering)
    await positionCell.click();

    // Extract row data as JSON
    const data = await row.toJSON();
    console.log(data);
    // { Name: "Airi Satou", Position: "Accountant", ... }
    // #endregion smart-row

    expect(data.Office).toBe('Tokyo');
  });

  test('Pagination: Click Next Strategy', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    await page.waitForSelector('#example_wrapper');

    // #region pagination
    // Example from: https://datatables.net/examples/data_sources/dom
    const table = useTable(page.locator('#example'), {
      rowSelector: 'tbody tr',
      headerSelector: 'thead th',
      cellSelector: 'td',
      // Strategy: Tell it how to find the next page
      strategies: {
        pagination: Strategies.Pagination.click({
          next: () => page.getByRole('link', { name: 'Next' })
        })
      },
      maxPages: 5 // Allow scanning up to 5 pages
    });
    await table.init();

    // ✅ Verify Colleen is NOT visible initially
    await expect(page.getByText("Colleen Hurst")).not.toBeVisible();

    // Use findRow for pagination
    await expect(await table.findRow({ Name: "Colleen Hurst" })).toBeVisible();
    // NOTE: We're now on the page where Colleen Hurst exists (typically Page 2)
    // #endregion pagination
  });

  test('getRow: Strict Retrieval & Negative Assertion', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');

    // #region get-by-row
    // Example from: https://datatables.net/examples/data_sources/dom
    const table = useTable(page.locator('#example'), { headerSelector: 'thead th' });
    await table.init();

    // Find a row where Name is "Airi Satou" AND Office is "Tokyo"
    const row = table.getRow({ Name: "Airi Satou", Office: "Tokyo" });
    await expect(row).toBeVisible();

    // Assert it does NOT exist
    await expect(table.getRow({ Name: "Ghost User" })).not.toBeVisible();
    // #endregion get-by-row
  });

  test('findRows: Multiple Usage Patterns', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), { headerSelector: 'thead th' });
    await table.init();

    // #region get-all-rows
    // Example from: https://datatables.net/examples/data_sources/dom
    // 1. Get ALL rows on the current page
    const allRows = await table.findRows({}, { maxPages: 1 });
    expect(allRows.length).toBeGreaterThan(0);

    // 2. Get subset of rows (Filtering)
    const tokyoUsers = await table.findRows({ Office: 'Tokyo' }, { maxPages: 1 });
    expect(tokyoUsers.length).toBeGreaterThan(0);

    // 3. Dump data to JSON
    const rows = await table.findRows({}, { maxPages: 1 });
    const data = await rows.toJSON();
    console.log(data); // [{ Name: "Airi Satou", ... }, ...]
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('Name');
    // #endregion get-all-rows
  });

  test('headerTransformer: Renaming Empty Columns', async ({ page }) => {
    await page.goto('https://mui.com/material-ui/react-table/');

    // #region header-transformer
    // Example from: https://mui.com/material-ui/react-table/
    const table = useTable(page.locator('.MuiDataGrid-root').first(), {
      rowSelector: '.MuiDataGrid-row',
      headerSelector: '.MuiDataGrid-columnHeader',
      cellSelector: '.MuiDataGrid-cell',
      strategies: {
        pagination: Strategies.Pagination.click({
          next: () => page.getByRole("button", { name: "Go to next page" })
        })
      },
      maxPages: 5,
      // Transform empty columns (detected as __col_0, __col_1, etc.) to meaningful names
      headerTransformer: ({ text }) => {
        // We know there is only one empty column which we will rename to "Actions" for easier reference
        if (text.includes('__col_') || text.trim() === '') {
          return 'Actions';
        }
        return text;
      }
    });
    await table.init();

    const headers = await table.getHeaders();
    // Now we can reference the "Actions" column even if it has no header text
    expect(headers).toContain('Actions');

    // Use the renamed column
    // First check it's not on the current page
    const currentPageRow = table.getRow({ "Last name": "Melisandre" });
    await expect(currentPageRow).not.toBeVisible();

    // Then find it across pages
    const row = await table.findRow({ "Last name": "Melisandre" });
    const actionsCell = row.getCell('Actions');
    await actionsCell.getByLabel("Select row").click();
    // #endregion header-transformer
  });

  test('headerTransformer: Normalizing Column Names', async ({ page }) => {
    await page.setContent(`
      <table id="table1">
        <thead>
          <tr><th> Last Name </th><th>First   Name </th><th> Email </th></tr>
        </thead>
        <tbody>
          <tr><td>Doe</td><td>Jason</td><td>jdoe@hotmail.com</td></tr>
        </tbody>
      </table>
    `);

    // #region header-transformer-normalize
    // Example from: https://the-internet.herokuapp.com/tables
    const table = useTable(page.locator('#table1'), {
      // Normalize column names: remove extra spaces, handle inconsistent casing
      headerTransformer: ({ text }) => {
        return text.trim()
          .replace(/\s+/g, ' ')  // Normalize whitespace
          .replace(/^\s*|\s*$/g, ''); // Remove leading/trailing spaces
      }
    });
    await table.init();

    // Now column names are consistent
    const row = table.getRow({ "Last Name": "Doe" });
    const emailCell = row.getCell("Email");
    await expect(emailCell).toHaveText("jdoe@hotmail.com");
    // #endregion header-transformer-normalize
  });

  test('Advanced: Debug Mode', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');

    // #region advanced-debug
    // Example from: https://datatables.net/examples/data_sources/dom
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th',
      debug: {
        logLevel: 'verbose' // Enables verbose logging of internal operations
      }
    });
    await table.init();

    const row = table.getRow({ Name: 'Airi Satou' });
    await expect(row).toBeVisible();
    // #endregion advanced-debug
  });

  test('Advanced: Reset Table State', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th',
      strategies: {
        pagination: Strategies.Pagination.click({
          next: () => page.getByRole('link', { name: 'Next' })
        })
      },
      maxPages: 5,
      onReset: async ({ page }) => {
        // Return to first page by clicking "First" link if available
        const firstLink = page.getByRole('link', { name: 'First' });
        if (await firstLink.isEnabled()) {
          await firstLink.click();
        }
      }
    });
    await table.init();

    // #region advanced-reset
    // Example from: https://datatables.net/examples/data_sources/dom
    // Navigate deep into the table by searching for a row on a later page
    try {
      await table.findRow({ Name: 'Angelica Ramos' });
    } catch (e) { }

    // Reset internal state (and potentially UI) to initial page
    await table.reset();
    await table.init(); // Re-init after reset

    // Now subsequent searches start from the beginning
    const currentPageRow = table.getRow({ Name: 'Airi Satou' });
    await expect(currentPageRow).toBeVisible();
    // #endregion advanced-reset
  });

  test('Advanced: Column Scanning', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th',
      strategies: {
        pagination: Strategies.Pagination.click({
          next: () => page.getByRole('link', { name: 'Next' })
        })
      },
      maxPages: 3
    });
    await table.init();

    // Example from: https://datatables.net/examples/data_sources/dom
    // Quickly grab all text values from the "Office" column
    const offices = await table.map(({ row }) => row.getCell('Office').innerText());
    expect(offices).toContain('Tokyo');
    expect(offices.length).toBeGreaterThan(0);
    // #endregion advanced-column-scan
  });

  test('findRows: Filtering with Exact Match', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    const table = useTable(page.locator('#example'), { headerSelector: 'thead th' });
    await table.init();

    // #region get-all-rows-exact
    // Get rows with exact match (default is fuzzy/contains match)
    const exactMatches = await table.findRows({ Office: 'Tokyo' }, {
      exact: true, // Requires exact string match
      maxPages: 1
    });

    expect(exactMatches.length).toBeGreaterThan(0);
    // #endregion get-all-rows-exact
  });

  test('table.map: Iterate through paginated data', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');
    await page.waitForSelector('#example_wrapper');

    const table = useTable(page.locator('#example'), {
      headerSelector: 'thead th',
      strategies: {
        pagination: Strategies.Pagination.click({
          next: () => page.getByRole('link', { name: 'Next' })
        })
      },
      maxPages: 3
    });
    await table.init();

    // #region iterate-through-table
    // Iterate through all pages and collect data
    const allNames = await table.map(({ row }) => row.getCell('Name').innerText());

    // allNames contains all names from all iterations
    // Verify we collected names from multiple pages
    expect(allNames.length).toBeGreaterThan(10);
    // #endregion iterate-through-table
  });

  test('table.map: Scrape all data with deduplication', async ({ page }) => {
    await page.goto('https://htmx.org/examples/infinite-scroll/');

    // #region iterate-through-table-dedupe
    const table = useTable(page.locator('table'), {
      rowSelector: 'tbody tr',
      headerSelector: 'thead th',
      cellSelector: 'td',
      strategies: {
        pagination: Strategies.Pagination.infiniteScroll(),
        dedupe: (row) => row.getCell('ID').innerText()
      },
      maxPages: 3
    });
    await table.init();

    // Scrape all data with deduplication (useful for infinite scroll)
    const allData = await table.map(({ row }) => row.toJSON());

    // allData contains all row data from all iterations (deduplicated at row level)
    expect(allData.length).toBeGreaterThan(0);
    // #endregion iterate-through-table-dedupe
  });


  test('table.forEach: Filter and Validate Across Pages', async ({ page }) => {
    // Create a self-contained paginated table with search functionality
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          .search-container { margin-bottom: 20px; }
          .search-container input { padding: 8px; margin-right: 10px; }
          .search-container button { padding: 8px 16px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f4f4f4; }
          .pagination { margin-top: 20px; }
          .pagination button { padding: 8px 16px; margin-right: 5px; }
          .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
        </style>
      </head>
      <body>
        <h1>Vehicle Search</h1>
        <div class="search-container">
          <input type="text" id="search-input" placeholder="Search by Make..." />
          <button id="search-btn">Search</button>
          <button id="reset-btn">Reset</button>
        </div>
        <div id="result-count"></div>
        <table id="vehicle-table">
          <thead>
            <tr>
              <th>VIN</th>
              <th>Year</th>
              <th>Make</th>
              <th>Model</th>
            </tr>
          </thead>
          <tbody id="table-body">
          </tbody>
        </table>
        <div class="pagination">
          <button id="next-btn">›</button>
        </div>

        <script>
          // Sample vehicle data
          const allVehicles = [
            { vin: '1HGBH41JXMN109186', year: '2020', make: 'Audi', model: 'A3' },
            { vin: '2HGBH41JXMN109187', year: '2021', make: 'Toyota', model: 'Camry' },
            { vin: '3HGBH41JXMN109188', year: '2019', make: 'Audi', model: 'A4' },
            { vin: '4HGBH41JXMN109189', year: '2022', make: 'Honda', model: 'Civic' },
            { vin: '5HGBH41JXMN109190', year: '2020', make: 'Audi', model: 'A5' },
            { vin: '6HGBH41JXMN109191', year: '2021', make: 'Ford', model: 'F-150' },
            { vin: '7HGBH41JXMN109192', year: '2019', make: 'Audi', model: 'A6' },
            { vin: '8HGBH41JXMN109193', year: '2022', make: 'Chevrolet', model: 'Silverado' },
            { vin: '9HGBH41JXMN109194', year: '2020', make: 'Audi', model: 'Q3' },
            { vin: 'AHGBH41JXMN109195', year: '2021', make: 'Nissan', model: 'Altima' },
            { vin: 'BHGBH41JXMN109196', year: '2019', make: 'Audi', model: 'Q5' },
            { vin: 'CHGBH41JXMN109197', year: '2022', make: 'BMW', model: '3 Series' },
            { vin: 'DHGBH41JXMN109198', year: '2020', make: 'Audi', model: 'Q7' },
            { vin: 'EHGBH41JXMN109199', year: '2021', make: 'Mercedes', model: 'C-Class' },
          ];

          let currentPage = 0;
          const rowsPerPage = 5;
          let filteredData = [...allVehicles];

          function renderTable() {
            const tbody = document.getElementById('table-body');
            tbody.innerHTML = '';

            const start = currentPage * rowsPerPage;
            const end = start + rowsPerPage;
            const pageData = filteredData.slice(start, end);

            pageData.forEach(vehicle => {
              const tr = document.createElement('tr');
              tr.innerHTML = \`
                <td>\${vehicle.vin}</td>
                <td>\${vehicle.year}</td>
                <td>\${vehicle.make}</td>
                <td>\${vehicle.model}</td>
              \`;
              tbody.appendChild(tr);
            });

            const totalPages = Math.ceil(filteredData.length / rowsPerPage);
            const nextBtn = document.getElementById('next-btn');
            nextBtn.disabled = currentPage >= totalPages - 1;
            
            document.getElementById('result-count').textContent = 
              \`Showing \${start + 1} to \${Math.min(end, filteredData.length)} of \${filteredData.length} vehicles\`;
          }

          document.getElementById('search-btn').addEventListener('click', () => {
            const searchTerm = document.getElementById('search-input').value.trim();
            if (searchTerm) {
              filteredData = allVehicles.filter(v => 
                v.make.toLowerCase().includes(searchTerm.toLowerCase())
              );
            } else {
              filteredData = [...allVehicles];
            }
            currentPage = 0;
            renderTable();
          });

          document.getElementById('reset-btn').addEventListener('click', () => {
            document.getElementById('search-input').value = '';
            filteredData = [...allVehicles];
            currentPage = 0;
            renderTable();
          });

          document.getElementById('next-btn').addEventListener('click', () => {
            const totalPages = Math.ceil(filteredData.length / rowsPerPage);
            if (currentPage < totalPages - 1) {
              currentPage++;
              renderTable();
            }
          });

          // Initial render
          renderTable();
        </script>
      </body>
      </html>
    `);

    const table = useTable(page.locator('#vehicle-table'), {
      rowSelector: 'tbody tr',
      headerSelector: 'thead th',
      cellSelector: 'td',
      strategies: {
        pagination: Strategies.Pagination.click({
          next: () => page.getByRole('button', { name: '›' })
        })
      },
      maxPages: 10
    });
    await table.init();

    // #region iterate-through-table-filter
    // Perform a search/filter action
    await page.getByPlaceholder('Search by Make...').fill('Audi');
    await page.getByRole('button', { name: 'Search' }).click();

    // Wait for table to update
    await page.waitForTimeout(500);

    // Reset table to start from page 1
    await table.reset();
    await table.init();

    // Validate all rows across all pages match the filter
    const searchTerm = 'Audi';
    let totalValidated = 0;

    await table.forEach(async ({ row }) => {
      await expect(row.getCell('Make')).toHaveText(searchTerm);
      totalValidated++;
    });

    // Assert we validated all filtered results (7 Audi vehicles)
    expect(totalValidated).toBe(7);
    // #endregion iterate-through-table-filter
  });

  test('fill: Intelligent Row Data Entry', async ({ page }) => {
    // Create a test table with editable inputs
    await page.setContent(`
      <table id="editable-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Status</th>
            <th>Active</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td><input type="text" value="John Doe" /></td>
            <td>
              <select>
                <option value="Pending">Pending</option>
                <option value="Active" selected>Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </td>
            <td><input type="checkbox" checked /></td>
            <td><textarea>Initial notes</textarea></td>
          </tr>
          <tr>
            <td>2</td>
            <td><input type="text" value="Jane Smith" /></td>
            <td>
              <select>
                <option value="Pending" selected>Pending</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </td>
            <td><input type="checkbox" /></td>
            <td><textarea>Another row</textarea></td>
          </tr>
        </tbody>
      </table>
    `);

    const table = useTable(page.locator('#editable-table'));
    await table.init();

    // #region fill-basic
    // Find a row and fill it with new data
    const row = table.getRow({ ID: '1' });

    await row.smartFill({
      Name: 'John Updated',
      Status: 'Inactive',
      Active: false,
      Notes: 'Updated notes here'
    });

    // Verify the values were filled correctly
    const nameCell = row.getCell('Name');
    const statusCell = row.getCell('Status');
    const activeCell = row.getCell('Active');
    const notesCell = row.getCell('Notes');
    await expect(nameCell.locator('input')).toHaveValue('John Updated');
    await expect(statusCell.locator('select')).toHaveValue('Inactive');
    await expect(activeCell.locator('input[type="checkbox"]')).not.toBeChecked();
    await expect(notesCell.locator('textarea')).toHaveValue('Updated notes here');
    // #endregion fill-basic
  });

  test('fill: With Custom Input Mappers', async ({ page }) => {
    // Create a test table with custom input structure
    await page.setContent(`
      <table id="custom-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>
              <div class="input-wrapper">
                <input class="primary-input" type="text" value="John Doe" />
                <input class="secondary-input" type="text" value="alt" />
              </div>
            </td>
            <td>
              <select>
                <option value="Pending">Pending</option>
                <option value="Active" selected>Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
    `);

    const table = useTable(page.locator('#custom-table'));
    await table.init();

    const row = table.getRow({ ID: '1' });

    // #region fill-custom-mappers
    // Use custom input mappers for specific columns
    await row.smartFill({
      Name: 'John Updated',
      Status: 'Inactive'
    }, {
      inputMappers: {
        // Name column has multiple inputs - target the primary one
        Name: (cell) => cell.locator('.primary-input'),
        // Status uses standard select, but we could customize if needed
        Status: (cell) => cell.locator('select')
      }
    });

    // Verify the values
    const nameCell = row.getCell('Name');
    const statusCell = row.getCell('Status');
    await expect(nameCell.locator('.primary-input')).toHaveValue('John Updated');
    await expect(statusCell.locator('select')).toHaveValue('Inactive');
    // #endregion fill-custom-mappers
  });
});
