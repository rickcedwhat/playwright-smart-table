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
const row = table.getByRow({ Name: 'Airi Satou' });

const positionCell = row.getCell('Position');
await expect(positionCell).toHaveText('Accountant');
```
<!-- /embed: quick-start -->

**What's happening here?**
- `useTable()` creates a smart table wrapper around your table locator
- `getByRow()` finds a specific row by column values
- The returned `SmartRow` knows its column structure, so `.getCell('Position')` works directly

### Step 2: Understanding SmartRow

The `SmartRow` is the core power of this library. Unlike a standard Playwright `Locator`, it understands your table's column structure.

<!-- embed: smart-row -->
```typescript
// Example from: https://datatables.net/examples/data_sources/dom

// Get SmartRow via getByRow
const row = table.getByRow({ Name: 'Airi Satou' });

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

// Use searchForRow for pagination
await expect(await table.searchForRow({ Name: "Colleen Hurst" })).toBeVisible();
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

const row = table.getByRow({ Name: 'Airi Satou' });
await expect(row).toBeVisible();
```
<!-- /embed: advanced-debug -->

This will log header mappings, row scans, and pagination triggers to help troubleshoot issues.

### Resetting Table State

If your tests navigate deep into a paginated table, use `.reset()` to return to the first page:

<!-- embed: advanced-reset -->
```typescript
// Example from: https://datatables.net/examples/data_sources/dom
// Navigate deep into the table by searching for a row on a later page
try {
  await table.searchForRow({ Name: 'Angelica Ramos' });
} catch (e) { }

// Reset internal state (and potentially UI) to initial page
await table.reset();
await table.init(); // Re-init after reset

// Now subsequent searches start from the beginning
const currentPageRow = table.getByRow({ Name: 'Airi Satou' });
await expect(currentPageRow).toBeVisible();
```
<!-- /embed: advanced-reset -->

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
const row = table.getByRow({ ID: '1' });

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
const currentPageRow = table.getByRow({ "Last name": "Melisandre" });
await expect(currentPageRow).not.toBeVisible();

// Then find it across pages
const row = await table.searchForRow({ "Last name": "Melisandre" });
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
const row = table.getByRow({ "Last Name": "Doe" });
const emailCell = row.getCell("Email");
await expect(emailCell).toHaveText("jdoe@hotmail.com");
```
<!-- /embed: header-transformer-normalize -->

---

## 📖 API Reference

### Table Methods

#### <a name="getbyrow"></a>`getByRow(filters, options?)`

**Purpose:** Strict retrieval - finds exactly one row matching the filters.

**Behavior:**
- ✅ Returns `SmartRow` if exactly one match
- ❌ Throws error if multiple matches (ambiguous query)
- 👻 Returns sentinel locator if no match (allows `.not.toBeVisible()` assertions)
- 🔄 Auto-paginates if row isn't on current page (when `maxPages > 1` and pagination strategy is configured)

**Type Signature:**
```typescript
getByRow: <T extends { asJSON?: boolean }>(
  filters: Record<string, string | RegExp | number>, 
  options?: { exact?: boolean, maxPages?: number } & T
) => Promise<T['asJSON'] extends true ? Record<string, string> : SmartRow>;
```

<!-- embed: get-by-row -->
```typescript
// Example from: https://datatables.net/examples/data_sources/dom
const table = useTable(page.locator('#example'), { headerSelector: 'thead th' });
await table.init();

// Find a row where Name is "Airi Satou" AND Office is "Tokyo"
const row = table.getByRow({ Name: "Airi Satou", Office: "Tokyo" });
await expect(row).toBeVisible();

// Assert it does NOT exist
await expect(table.getByRow({ Name: "Ghost User" })).not.toBeVisible();
```
<!-- /embed: get-by-row -->

Get row data as JSON:
<!-- embed: get-by-row-json -->
```typescript
// Get row data as JSON object
const row = table.getByRow({ Name: 'Airi Satou' });
const data = await row.toJSON();
// Returns: { Name: "Airi Satou", Position: "Accountant", Office: "Tokyo", ... }

expect(data).toHaveProperty('Name', 'Airi Satou');
expect(data).toHaveProperty('Position');

// Get specific columns only (faster for large tables)
const partial = await row.toJSON({ columns: ['Name'] });
expect(partial).toEqual({ Name: 'Airi Satou' });
```
<!-- /embed: get-by-row-json -->

#### <a name="getallcurrentrows"></a>`getAllCurrentRows(options?)`

**Purpose:** Inclusive retrieval - gets all rows on the current page matching optional filters.

**Best for:** Checking existence, validating sort order, bulk data extraction on the current page.

> **Note:** `getAllRows` is deprecated and will be removed in a future major version. Use `getAllCurrentRows` instead. The deprecated method still works for backwards compatibility.

**Type Signature:**
```typescript
getAllCurrentRows: <T extends { asJSON?: boolean }>(
  options?: { filter?: Record<string, any>, exact?: boolean } & T
) => Promise<T['asJSON'] extends true ? Record<string, string>[] : SmartRow[]>;
```

<!-- embed: get-all-rows -->
```typescript
// Example from: https://datatables.net/examples/data_sources/dom
// 1. Get ALL rows on the current page
const allRows = await table.getAllCurrentRows();
expect(allRows.length).toBeGreaterThan(0);

// 2. Get subset of rows (Filtering)
const tokyoUsers = await table.getAllCurrentRows({
  filter: { Office: 'Tokyo' }
});
expect(tokyoUsers.length).toBeGreaterThan(0);

// 3. Dump data to JSON
const data = await table.getAllCurrentRows({ asJSON: true });
console.log(data); // [{ Name: "Airi Satou", ... }, ...]
expect(data.length).toBeGreaterThan(0);
expect(data[0]).toHaveProperty('Name');
```
<!-- /embed: get-all-rows -->

Filter rows with exact match:
<!-- embed: get-all-rows-exact -->
```typescript
// Get rows with exact match (default is fuzzy/contains match)
const exactMatches = await table.getAllCurrentRows({
  filter: { Office: 'Tokyo' },
  exact: true // Requires exact string match
});

expect(exactMatches.length).toBeGreaterThan(0);
```
<!-- /embed: get-all-rows-exact -->

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

Best for "Load More" buttons. Clicks and waits for row count to increase.

```typescript
strategies: {
  pagination: Strategies.Pagination.clickLoadMore((root) =>
    root.getByRole('button', { name: 'Load More' })
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
export type SmartRow<T = any> = Locator & {
  getRequestIndex(): number | undefined;
  rowIndex?: number;
  getCell(column: string): Locator;
  toJSON(options?: { columns?: string[] }): Promise<T>;
  /**
   * Scrolls/paginates to bring this row into view.
   * Only works if rowIndex is known.
   */
  bringIntoView(): Promise<void>;
  /**
   * Fills the row with data. Automatically detects input types.
   */
  fill: (data: Partial<T> | Record<string, any>, options?: FillOptions) => Promise<void>;
  /**
   * Alias for fill() to avoid conflict with Locator.fill()
   */
  smartFill: (data: Partial<T> | Record<string, any>, options?: FillOptions) => Promise<void>;
};
```
<!-- /embed-type: SmartRow -->

**Methods:**
- `getCell(column: string)`: Returns a `Locator` for the specified cell in this row
- `toJSON()`: Extracts all cell data as a key-value object
- `smartFill(data, options?)`: Intelligently fills form fields in the row. Automatically detects input types or use `inputMappers` for custom control. Use Locator's standard `fill()` for single-input scenarios.

All standard Playwright `Locator` methods (`.click()`, `.isVisible()`, `.textContent()`, etc.) are also available.

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

## 🔄 Migration Guide

### Upgrading from v3.x to v4.0

**Breaking Change**: Strategy imports are now consolidated under the `Strategies` object.

#### Import Changes
```typescript
// ❌ Old (v3.x)
import { PaginationStrategies, SortingStrategies } from '../src/useTable';

// ✅ New (v4.0)
import { Strategies } from '../src/strategies';
// or
import { useTable, Strategies } from '../src/useTable';
```

#### Strategy Usage
```typescript
// ❌ Old (v3.x)
strategies: {
  pagination: PaginationStrategies.clickNext(() => page.locator('#next')),
  sorting: SortingStrategies.AriaSort(),
  header: HeaderStrategies.scrollRight,
  cellNavigation: ColumnStrategies.keyboard
}

// ✅ New (v4.0)
strategies: {
  pagination: Strategies.Pagination.clickNext(() => page.locator('#next')),
  sorting: Strategies.Sorting.AriaSort(),
  header: Strategies.Header.scrollRight,
  cellNavigation: Strategies.Column.keyboard
}
```

#### New Features (Optional)

**Generic Type Support:**
```typescript
interface User {
  Name: string;
  Email: string;
  Office: string;
}

const table = useTable<User>(page.locator('#table'), config);
const data = await row.toJSON(); // Type: User (not Record<string, string>)
```

**Revalidate Method:**
```typescript
// Refresh column mappings when table structure changes
await table.revalidate();
```

For detailed migration instructions optimized for AI code transformation, see the [AI Migration Guide](./MIGRATION_v4.md).

---

## 🚀 Tips & Best Practices

1. **Start Simple**: Try the defaults first - they work for most standard HTML tables
2. **Use Debug Mode**: When troubleshooting, enable `debug: true` to see what the library is doing
3. **Leverage SmartRow**: Use `.getCell()` instead of manual column indices - your tests will be more maintainable
4. **Type Safety**: All methods are fully typed - use TypeScript for the best experience
5. **Pagination Strategies**: Create reusable strategies for tables with similar pagination patterns

---

## 📝 License

ISC
