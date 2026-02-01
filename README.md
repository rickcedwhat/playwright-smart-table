# Playwright Smart Table 🧠

A production-ready, type-safe table wrapper for Playwright that abstracts away the complexity of testing dynamic web tables. Handles pagination, infinite scroll, virtualization, and data grids (MUI, AG-Grid) so your tests remain clean and readable.

## 📦 Installation

```bash
npm install @rickcedwhat/playwright-smart-table
```

> **Note:** Requires `@playwright/test` as a peer dependency.

---

## 🎯 Getting Started

### Step 1: Basic Table Interaction

For standard HTML tables (`<table>`, `<tr>`, `<td>`), the library works out of the box with sensible defaults:

<!-- embed: quick-start -->
```typescript
// Example from: https://datatables.net/examples/data_sources/dom
const table = await useTable(page.locator('#example'), {
  headerSelector: 'thead th' // Override for this specific site
}).init();

// Find the row with Name="Airi Satou", then get the Position cell
const row = table.getRow({ Name: 'Airi Satou' });

const positionCell = row.getCell('Position');
await expect(positionCell).toHaveText('Accountant');
```
<!-- /embed: quick-start -->

**What's happening here?**
- `useTable()` creates a smart table wrapper around your table locator
- `getRow()` finds a specific row by column values
- The returned `SmartRow` knows its column structure, so `.getCell('Position')` works directly

### Step 2: Understanding SmartRow

The `SmartRow` is the core power of this library. Unlike a standard Playwright `Locator`, it understands your table's column structure.

<!-- embed: smart-row -->
```typescript
// Example from: https://datatables.net/examples/data_sources/dom

// Get SmartRow via getByRow
const row = table.getRow({ Name: 'Airi Satou' });

// Interact with cell using column name (resilient to column reordering)
const positionCell = row.getCell('Position');
await positionCell.click();

// Extract row data as JSON
const data = await row.toJSON();
console.log(data);
// { Name: "Airi Satou", Position: "Accountant", ... }
```
<!-- /embed: smart-row -->

**Key Benefits:**
- ✅ Column names instead of indices (survives column reordering)
- ✅ Extends Playwright's `Locator` API (all `.click()`, `.isVisible()`, etc. work)
- ✅ `.toJSON()` for quick data extraction (uses `columnStrategy` to ensure visibility)

---

## 🔧 Configuration & Advanced Scenarios

### Working with Paginated Tables

For tables that span multiple pages, configure a pagination strategy:

<!-- embed: pagination -->
```typescript
// Example from: https://datatables.net/examples/data_sources/dom
const table = useTable(page.locator('#example'), {
  rowSelector: 'tbody tr',
  headerSelector: 'thead th',
  cellSelector: 'td',
  // Strategy: Tell it how to find the next page
  strategies: {
    pagination: Strategies.Pagination.clickNext(() =>
      page.getByRole('link', { name: 'Next' })
    )
  },
  maxPages: 5 // Allow scanning up to 5 pages
});
await table.init();

// ✅ Verify Colleen is NOT visible initially
await expect(page.getByText("Colleen Hurst")).not.toBeVisible();

// Use findRow for pagination
await expect(await table.findRow({ Name: "Colleen Hurst" })).toBeVisible();
// NOTE: We're now on the page where Colleen Hurst exists (typically Page 2)
```
<!-- /embed: pagination -->

### Debug Mode

Enable debug logging to see exactly what the library is doing:

<!-- embed: advanced-debug -->
```typescript
// Example from: https://datatables.net/examples/data_sources/dom
const table = useTable(page.locator('#example'), {
  headerSelector: 'thead th',
  debug: true // Enables verbose logging of internal operations
});
await table.init();

const row = table.getRow({ Name: 'Airi Satou' });
await expect(row).toBeVisible();
```
<!-- /embed: advanced-debug -->

This will log header mappings, row scans, and pagination triggers to help troubleshoot issues.

### Resetting Table State

If your tests navigate deep into a paginated table, use `.reset()` to return to the first page. You can also configure an `onReset` hook to define custom reset behavior (e.g., clicking a "First Page" button):

<!-- embed: advanced-reset -->
```typescript
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
```
<!-- /embed: advanced-reset -->

**Custom Reset Behavior:**

Use the `onReset` configuration option to define what happens when `table.reset()` is called:

```typescript
const table = useTable(page.locator('#example'), {
  strategies: {
    pagination: Strategies.Pagination.clickNext(() => page.getByRole('link', { name: 'Next' }))
  },
  // Define custom reset logic
  onReset: async ({ page }) => {
    // Click "First" button to return to page 1
    await page.getByRole('link', { name: 'First' }).click();
  }
});
```

### Column Scanning

Efficiently extract all values from a specific column:

<!-- embed: advanced-column-scan -->
```typescript
// Example from: https://datatables.net/examples/data_sources/dom
// Quickly grab all text values from the "Office" column
const offices = await table.getColumnValues('Office');
expect(offices).toContain('Tokyo');
expect(offices.length).toBeGreaterThan(0);
```
<!-- /embed: advanced-column-scan -->

### Filling Row Data

Use `smartFill()` to intelligently populate form fields in a table row. The method automatically detects input types (text inputs, selects, checkboxes, contenteditable divs) and fills them appropriately. You can still use Locator's standard `fill()` method for single-input scenarios.

<!-- embed: fill-basic -->
```typescript
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
```
<!-- /embed: fill-basic -->

**Auto-detection supports:**
- Text inputs (`input[type="text"]`, `textarea`)
- Select dropdowns (`select`)
- Checkboxes/radios (`input[type="checkbox"]`, `input[type="radio"]`, `[role="checkbox"]`)
- Contenteditable divs (`[contenteditable="true"]`)

**Custom input mappers:**

For edge cases where auto-detection doesn't work (e.g., custom components, multiple inputs in a cell), use per-column mappers:

<!-- embed: fill-custom-mappers -->
```typescript
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
```
<!-- /embed: fill-custom-mappers -->

### Transforming Column Headers

Use `headerTransformer` to normalize or rename column headers. This is especially useful for tables with empty headers, inconsistent formatting, or when you want to use cleaner names in your tests.

**Example 1: Renaming Empty Columns**

Tables with empty header cells (like Material UI DataGrids) get auto-assigned names like `__col_0`, `__col_1`. Transform them to meaningful names:

<!-- embed: header-transformer -->
```typescript
// Example from: https://mui.com/material-ui/react-table/
const table = useTable(page.locator('.MuiDataGrid-root').first(), {
  rowSelector: '.MuiDataGrid-row',
  headerSelector: '.MuiDataGrid-columnHeader',
  cellSelector: '.MuiDataGrid-cell',
  strategies: {
    pagination: Strategies.Pagination.clickNext(
      (root) => root.getByRole("button", { name: "Go to next page" })
    )
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
```
<!-- /embed: header-transformer -->

**Example 2: Normalizing Column Names**

Clean up inconsistent column names (extra spaces, inconsistent casing):

<!-- embed: header-transformer-normalize -->
```typescript
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
```
<!-- /embed: header-transformer-normalize -->

### Iterating Through Paginated Tables

Use `iterateThroughTable()` to process all rows across multiple pages. This is perfect for data scraping, validation, or bulk operations.

<!-- embed: iterate-through-table -->
```typescript
// Iterate through all pages and collect data
const allNames = await table.iterateThroughTable(async ({ rows, index }) => {
  // Return names from this iteration - automatically appended to allData
  return await Promise.all(rows.map(r => r.getCell('Name').innerText()));
});

// allNames contains all names from all iterations
// Verify sorting across allNames
expect(allNames.flat().length).toBeGreaterThan(10);
```
<!-- /embed: iterate-through-table -->

**With Deduplication (for infinite scroll):**

<!-- embed: iterate-through-table-dedupe -->
```typescript
// Scrape all data with deduplication (useful for infinite scroll)
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

// allData contains all row data from all iterations (deduplicated at row level)
expect(allData.flat().length).toBeGreaterThan(0);
```
<!-- /embed: iterate-through-table-dedupe -->

**With Hooks:**

<!-- embed: iterate-through-table-hooks -->
```typescript
const allData = await table.iterateThroughTable(
  async ({ rows, index, isFirst, isLast }) => {
    // Normal logic for each iteration - return value appended to allData
    return await Promise.all(rows.map(r => r.toJSON()));
  },
  {
    getIsLast: ({ paginationResult }) => !paginationResult,
    beforeFirst: async ({ allData }) => {
      console.log('Starting data collection...');
      // Could perform setup actions
    },
    afterLast: async ({ allData }) => {
      console.log(`Collected ${allData.length} total items`);
      // Could perform cleanup or final actions
    }
  }
);
```
<!-- /embed: iterate-through-table-hooks -->

**Hook Timing:**
- `beforeFirst`: Runs **before** your callback processes the first page
- `afterLast`: Runs **after** your callback processes the last page
- Both are optional and receive `{ index, rows, allData }`

#### Batching (v5.1+)

Process multiple pages at once for better performance:

```typescript
const results = await table.iterateThroughTable(
  async ({ rows, batchInfo }) => {
    // rows contains data from multiple pages
    console.log(`Processing pages ${batchInfo.startIndex}-${batchInfo.endIndex}`);
    console.log(`Batch has ${rows.length} total rows from ${batchInfo.size} pages`);
    
    // Bulk process (e.g., batch database insert)
    await bulkInsert(rows);
    return rows.length;
  },
  { 
    batchSize: 3  // Process 3 pages at a time
  }
);

// With 6 pages total:
// - Batch 1: pages 0,1,2 (batchInfo.size = 3)
// - Batch 2: pages 3,4,5 (batchInfo.size = 3)
// results.length === 2 (fewer callbacks than pages)
```

**Key Points:**
- `batchSize` = number of **pages**, not rows
- `batchInfo` is undefined when not batching (`batchSize` undefined or `1`)
- Works with deduplication, pagination strategies, and hooks
- Reduces callback overhead for bulk operations
- Default: no batching (one callback per page)

---

## 📖 API Reference

### Method Comparison

Quick reference for choosing the right method:

| Method | Async/Sync | Paginates? | Returns | Use When |
|--------|------------|------------|---------|----------|
| `getRow()` | **Sync** | ❌ No | Single `SmartRow` | Finding row on current page only |
| `findRow()` | **Async** | ✅ Yes | Single `SmartRow` | Searching across pages |
| `getRows()` | **Async** | ❌ No | `SmartRow[]` | Getting all rows on current page |
| `findRows()` | **Async** | ✅ Yes | `SmartRow[]` | Getting all matching rows across pages |
| `iterateThroughTable()` | **Async** | ✅ Yes | `T[]` | Processing/scraping all pages with custom logic |

**Naming Pattern:**
- `get*` = Current page only (fast, no pagination)
- `find*` = Search across pages (slower, uses pagination)

### Table Methods

#### <a name="getrow"></a>`getRow(filters, options?)`

**Purpose:** Strict retrieval - finds exactly one row matching the filters on the **current page**.

**Behavior:**
- ✅ Returns `SmartRow` if exactly one match
- ❌ Throws error if multiple matches (ambiguous query)
- 👻 Returns sentinel locator if no match (allows `.not.toBeVisible()` assertions)
- ℹ️ **Sync method**: Returns immediate locator result.
- 🔍 **Filtering**: Uses "contains" matching by default (e.g., "Tokyo" matches "Tokyo Office"). Set `exact: true` for strict equality.

**Type Signature:**
```typescript
getRow: <T extends { asJSON?: boolean }>(
  filters: Record<string, string | RegExp | number>, 
  options?: { exact?: boolean } & T
) => SmartRow;
```

<!-- embed: get-by-row -->
```typescript
// Example from: https://datatables.net/examples/data_sources/dom
const table = useTable(page.locator('#example'), { headerSelector: 'thead th' });
await table.init();

// Find a row where Name is "Airi Satou" AND Office is "Tokyo"
const row = table.getRow({ Name: "Airi Satou", Office: "Tokyo" });
await expect(row).toBeVisible();

// Assert it does NOT exist
await expect(table.getRow({ Name: "Ghost User" })).not.toBeVisible();
```
<!-- /embed: get-by-row -->

Get row data as JSON:
<!-- embed: get-by-row-json -->
```typescript
// Get row data as JSON object
const row = table.getRow({ Name: 'Airi Satou' });
const data = await row.toJSON();
// Returns: { Name: "Airi Satou", Position: "Accountant", Office: "Tokyo", ... }

expect(data).toHaveProperty('Name', 'Airi Satou');
expect(data).toHaveProperty('Position');

// Get specific columns only (faster for large tables)
const partial = await row.toJSON({ columns: ['Name'] });
expect(partial).toEqual({ Name: 'Airi Satou' });
```
<!-- /embed: get-by-row-json -->

#### <a name="findrow"></a>`findRow(filters, options?)`

**Purpose:** Async retrieval - finds exactly one row matching the filters **across multiple pages** (pagination).

**Behavior:**
- 🔄 Auto-initializes table if needed
- 🔎 Paginates through data until match is found or `maxPages` reached
- ✅ Returns `SmartRow` if found
- 👻 Returns sentinel locator if not found

**Type Signature:**
```typescript
findRow: (
  filters: Record<string, string | RegExp | number>,
  options?: { exact?: boolean, maxPages?: number }
) => Promise<SmartRow>;
```

#### <a name="getrows"></a>`getRows(options?)`

**Purpose:** Inclusive retrieval - gets all rows on the **current page** matching optional filters.

**Best for:** Checking existence, validating sort order, bulk data extraction on the current page.

**Type Signature:**
```typescript
getRows: <T extends { asJSON?: boolean }>(
  options?: { filter?: Record<string, any>, exact?: boolean } & T
) => Promise<T['asJSON'] extends true ? Record<string, string>[] : SmartRow[]>;
```

<!-- embed: get-all-rows -->
```typescript
// Example from: https://datatables.net/examples/data_sources/dom
// 1. Get ALL rows on the current page
const allRows = await table.getRows();
expect(allRows.length).toBeGreaterThan(0);

// 2. Get subset of rows (Filtering)
const tokyoUsers = await table.getRows({
  filter: { Office: 'Tokyo' }
});
expect(tokyoUsers.length).toBeGreaterThan(0);

// 3. Dump data to JSON
const data = await table.getRows({ asJSON: true });
console.log(data); // [{ Name: "Airi Satou", ... }, ...]
expect(data.length).toBeGreaterThan(0);
expect(data[0]).toHaveProperty('Name');
```
<!-- /embed: get-all-rows -->

Filter rows with exact match:
<!-- embed: get-all-rows-exact -->
```typescript
// Get rows with exact match (default is fuzzy/contains match)
const exactMatches = await table.getRows({
  filter: { Office: 'Tokyo' },
  exact: true // Requires exact string match
});

expect(exactMatches.length).toBeGreaterThan(0);
```
<!-- /embed: get-all-rows-exact -->

#### <a name="findrows"></a>`findRows(filters, options?)`

**Purpose:** Async retrieval - finds **all** rows matching filters **across multiple pages**.

**Behavior:**
- 🔄 Paginates and accumulates matches
- ⚠️ Can be slow on large datasets, use `maxPages` to limit scope

**Type Signature:**
```typescript
findRows: (
  filters: Record<string, string | RegExp | number>,
  options?: { exact?: boolean, maxPages?: number }
) => Promise<SmartRow[]>;
```

#### <a name="getcolumnvalues"></a>`getColumnValues(column, options?)`

Scans a specific column across all pages and returns values. Supports custom mappers for extracting non-text data.

**Type Signature:**
```typescript
getColumnValues: <V = string>(
  column: string, 
  options?: { 
    mapper?: (cell: Locator) => Promise<V> | V, 
    maxPages?: number 
  }
) => Promise<V[]>;
```

Basic usage:
<!-- embed: advanced-column-scan -->
```typescript
// Example from: https://datatables.net/examples/data_sources/dom
// Quickly grab all text values from the "Office" column
const offices = await table.getColumnValues('Office');
expect(offices).toContain('Tokyo');
expect(offices.length).toBeGreaterThan(0);
```
<!-- /embed: advanced-column-scan -->

With custom mapper:
<!-- embed: advanced-column-scan-mapper -->
```typescript
// Extract numeric values from a column
const ages = await table.getColumnValues('Age', {
  mapper: async (cell) => {
    const text = await cell.innerText();
    return parseInt(text, 10);
  }
});

// Now ages is an array of numbers
expect(ages.every(age => typeof age === 'number')).toBe(true);
expect(ages.length).toBeGreaterThan(0);
```
<!-- /embed: advanced-column-scan-mapper -->

#### <a name="getheaders"></a>`getHeaders()`

Returns an array of all column names in the table.

**Type Signature:**
```typescript
getHeaders: () => Promise<string[]>;
```

#### <a name="getheadercell"></a>`getHeaderCell(columnName)`

Returns a Playwright `Locator` for the specified header cell.

**Type Signature:**
```typescript
getHeaderCell: (columnName: string) => Promise<Locator>;
```

#### <a name="reset"></a>`reset()`

Resets table state (clears cache, pagination flags) and invokes the `onReset` strategy to return to the first page.

**Type Signature:**
```typescript
reset: () => Promise<void>;
```

#### <a name="sorting"></a>`sorting.apply(column, direction)` & `sorting.getState(column)`

If you've configured a sorting strategy, use these methods to sort columns and check their current sort state.

**Apply Sort:**
```typescript
// Configure table with sorting strategy
const table = useTable(page.locator('#sortable-table'), {
  strategies: {
    sorting: Strategies.Sorting.AriaSort()
  }
});
await table.init();

// Sort by Name column (ascending)
await table.sorting.apply('Name', 'asc');

// Sort by Age column (descending)
await table.sorting.apply('Age', 'desc');
```

**Check Sort State:**
```typescript
// Get current sort state of a column
const nameSort = await table.sorting.getState('Name');
// Returns: 'asc' | 'desc' | 'none'

expect(nameSort).toBe('asc');
```

**Type Signatures:**
```typescript
sorting: {
  apply: (columnName: string, direction: 'asc' | 'desc') => Promise<void>;
  getState: (columnName: string) => Promise<'asc' | 'desc' | 'none'>;
}
```

---

## 🧩 Pagination Strategies

This library uses the **Strategy Pattern** for pagination. Use built-in strategies or write custom ones.

### Built-in Strategies

#### <a name="tablestrategiesclicknext"></a>`Strategies.Pagination.clickNext(selector)`

Best for standard paginated tables (Datatables, lists). Clicks a button/link and waits for table content to change.

```typescript
strategies: {
  pagination: Strategies.Pagination.clickNext((root) =>
    root.page().getByRole('button', { name: 'Next' })
  )
}
```

#### <a name="tablestrategiesinfinitescroll"></a>`Strategies.Pagination.infiniteScroll()`

Best for virtualized grids (AG-Grid, HTMX). Aggressively scrolls to trigger data loading.

```typescript
strategies: {
  pagination: Strategies.Pagination.infiniteScroll()
}
```

#### <a name="tablestrategiesclickloadmore"></a>`Strategies.Pagination.clickLoadMore(selector)`

Best for "Load More" buttons that may not be part of the table. Clicks and waits for row count to increase.

```typescript
strategies: {
  pagination: Strategies.Pagination.clickLoadMore((page) =>
    page.getByRole('button', { name: 'Load More' })
  )
}
```

### Custom Strategies

A pagination strategy is a function that receives a `TableContext` and returns `Promise<boolean>` (true if more data loaded, false if no more pages):

<!-- embed-type: PaginationStrategy -->
```typescript
export type PaginationStrategy = (context: TableContext) => Promise<boolean>;
```
<!-- /embed-type: PaginationStrategy -->

<!-- embed-type: TableContext -->
```typescript
export interface TableContext {
  root: Locator;
  config: FinalTableConfig;
  page: Page;
  resolve: (selector: Selector, parent: Locator | Page) => Locator;
}
```
<!-- /embed-type: TableContext -->

---

## 🛠️ Developer Tools

### <a name="generateconfigprompt"></a>`generateConfigPrompt(options?)`

Generates a prompt you can paste into ChatGPT/Gemini to automatically generate the `TableConfig` for your specific HTML.

```typescript
await table.generateConfigPrompt({ output: 'console' });
```

### <a name="generatestrategyprompt"></a>`generateStrategyPrompt(options?)`

Generates a prompt to help you write a custom pagination strategy.

```typescript
await table.generateStrategyPrompt({ output: 'console' });
```

**Options:**
<!-- embed-type: PromptOptions -->
```typescript
export interface PromptOptions {
  /**
   * Output Strategy:
   * - 'error': Throws an error with the prompt (useful for platforms that capture error output cleanly).
   * - 'console': Standard console logs (Default).
   */
  output?: 'console' | 'error';
  includeTypes?: boolean;
}
```
<!-- /embed-type: PromptOptions -->

---

## 📚 Type Reference

### Core Types

#### <a name="smartrow"></a>`SmartRow`

A `SmartRow` extends Playwright's `Locator` with table-aware methods.

<!-- embed-type: SmartRow -->
```typescript
/**
 * Function to get the currently active/focused cell.
 * Returns null if no cell is active.
 */
export type GetActiveCellFn = (args: TableContext) => Promise<{
  rowIndex: number;
  columnIndex: number;
  columnName?: string;
  locator: Locator;
} | null>;


/**
 * SmartRow - A Playwright Locator with table-aware methods.
 * 
 * Extends all standard Locator methods (click, isVisible, etc.) with table-specific functionality.
 * 
 * @example
 * const row = table.getRow({ Name: 'John Doe' });
 * await row.click(); // Standard Locator method
 * const email = row.getCell('Email'); // Table-aware method
 * const data = await row.toJSON(); // Extract all row data
 * await row.smartFill({ Name: 'Jane', Status: 'Active' }); // Fill form fields
 */
export type SmartRow<T = any> = Locator & {
  /** Optional row index (0-based) if known */
  rowIndex?: number;

  /**
   * Get a cell locator by column name.
   * @param column - Column name (case-sensitive)
   * @returns Locator for the cell
   * @example
   * const emailCell = row.getCell('Email');
   * await expect(emailCell).toHaveText('john@example.com');
   */
  getCell(column: string): Locator;

  /**
   * Extract all cell data as a key-value object.
   * @param options - Optional configuration
   * @param options.columns - Specific columns to extract (extracts all if not specified)
   * @returns Promise resolving to row data
   * @example
   * const data = await row.toJSON();
   * // { Name: 'John', Email: 'john@example.com', ... }
   * 
   * const partial = await row.toJSON({ columns: ['Name', 'Email'] });
   * // { Name: 'John', Email: 'john@example.com' }
   */
  toJSON(options?: { columns?: string[] }): Promise<T>;

  /**
   * Scrolls/paginates to bring this row into view.
   * Only works if rowIndex is known (e.g., from getRowByIndex).
   * @throws Error if rowIndex is unknown
   */
  bringIntoView(): Promise<void>;

  /**
   * Intelligently fills form fields in the row.
   * Automatically detects input types (text, select, checkbox, contenteditable).
   * 
   * @param data - Column-value pairs to fill
   * @param options - Optional configuration
   * @param options.inputMappers - Custom input selectors per column
   * @example
   * // Auto-detection
   * await row.smartFill({ Name: 'John', Status: 'Active', Subscribe: true });
   * 
   * // Custom input mappers
   * await row.smartFill(
   *   { Name: 'John' },
   *   { inputMappers: { Name: (cell) => cell.locator('.custom-input') } }
   * );
   */
  smartFill: (data: Partial<T> | Record<string, any>, options?: FillOptions) => Promise<void>;
};
```
<!-- /embed-type: SmartRow -->

**Methods:**
- `getCell(column: string)`: Returns a `Locator` for the specified cell in this row
- `toJSON()`: Extracts all cell data as a key-value object
- `smartFill(data, options?)`: Intelligently fills form fields in the row. Automatically detects input types (text, select, checkbox) or use `inputMappers` option for custom control.

All standard Playwright `Locator` methods (`.click()`, `.isVisible()`, `.textContent()`, etc.) are also available.

**Note**: `getRequestIndex()` is an internal method for row tracking - you typically won't need it.

#### <a name="tableconfig"></a>`TableConfig`

Configuration options for `useTable()`.

<!-- embed-type: TableConfig -->
```typescript
/**
 * Strategy to filter rows based on criteria.
 */
export interface FilterStrategy {
  apply(options: {
    rows: Locator;
    filter: { column: string, value: string | RegExp | number };
    colIndex: number;
    tableContext: TableContext;
  }): Locator;
}

/**
 * Organized container for all table interaction strategies.
 */
export interface TableStrategies {
  /** Strategy for discovering/scanning headers */
  header?: HeaderStrategy;
  /** Strategy for navigating to specific cells (row + column) */
  cellNavigation?: CellNavigationStrategy;
  /** Strategy for filling form inputs */
  fill?: FillStrategy;
  /** Strategy for paginating through data */
  pagination?: PaginationStrategy;
  /** Strategy for sorting columns */
  sorting?: SortingStrategy;
  /** Function to get a cell locator */
  getCellLocator?: GetCellLocatorFn;
  /** Function to get the currently active/focused cell */
  getActiveCell?: GetActiveCellFn;
}

/**
 * Configuration options for useTable.
 */
export interface TableConfig {
  /** Selector for the table headers */
  headerSelector?: string;
  /** Selector for the table rows */
  rowSelector?: string;
  /** Selector for the cells within a row */
  cellSelector?: string;
  /** Number of pages to scan for verification */
  maxPages?: number;
  /** Hook to rename columns dynamically */
  headerTransformer?: (args: { text: string, index: number, locator: Locator }) => string | Promise<string>;
  /** Automatically scroll to table on init */
  autoScroll?: boolean;
  /** Enable debug logs */
  debug?: boolean;
  /** Reset hook */
  onReset?: (context: TableContext) => Promise<void>;
  /** All interaction strategies */
  strategies?: TableStrategies;
}
```
<!-- /embed-type: TableConfig -->

**Property Descriptions:**

- `rowSelector`: CSS selector or function for table rows (default: `"tbody tr"`)
- `headerSelector`: CSS selector or function for header cells (default: `"th"`)
- `cellSelector`: CSS selector or function for data cells (default: `"td"`)
- `strategies`: Configuration object for interaction strategies (pagination, sorting, etc.)
- `maxPages`: Maximum pages to scan when searching (default: `1`)
- `headerTransformer`: Function to transform/rename column headers dynamically
- `autoScroll`: Automatically scroll table into view (default: `true`)
- `debug`: Enable verbose logging (default: `false`)
- `onReset`: Strategy called when `table.reset()` is invoked

#### <a name="selector"></a>`Selector`

Flexible selector type supporting strings, functions, or existing locators.

<!-- embed-type: Selector -->
```typescript
/**
 * Flexible selector type - can be a CSS string, function returning a Locator, or Locator itself.
 * @example
 * // String selector
 * rowSelector: 'tbody tr'
 * 
 * // Function selector
 * rowSelector: (root) => root.locator('[role="row"]')
 */
export type Selector = string | ((root: Locator | Page) => Locator);

/**
 * Function to get a cell locator given row, column info.
 * Replaces the old cellResolver.
 */
```
<!-- /embed-type: Selector -->

**Examples:**
```typescript
// String selector
rowSelector: 'tbody tr'

// Function selector (useful for complex cases)
rowSelector: (root) => root.locator('[role="row"]')

// Can also accept a Locator directly
```

#### <a name="paginationstrategy"></a>`PaginationStrategy`

Function signature for custom pagination logic.

<!-- embed-type: PaginationStrategy -->
```typescript
export type PaginationStrategy = (context: TableContext) => Promise<boolean>;
```
<!-- /embed-type: PaginationStrategy -->
Returns `true` if more data was loaded, `false` if pagination should stop.

---

## 🚀 Tips & Best Practices

1. **Start Simple**: Try the defaults first - they work for most standard HTML tables
2. **Use Debug Mode**: When troubleshooting, enable `debug: true` to see what the library is doing
3. **Leverage SmartRow**: Use `.getCell()` instead of manual column indices - your tests will be more maintainable
4. **Type Safety**: All methods are fully typed - use TypeScript for the best experience
5. **Pagination Strategies**: Create reusable strategies for tables with similar pagination patterns
6. **Async vs Sync**: Use `findRow()` for paginated searches and `getRow()` for strict, single-page assertions.
7. **Sorting**: Use `table.sorting.apply()` to sort columns and `table.sorting.getState()` to check sort state.

---

## 📝 License

ISC
