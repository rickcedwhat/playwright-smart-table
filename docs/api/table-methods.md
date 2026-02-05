<!-- NEEDS REVIEW -->
# Table Methods

Methods available on the `TableResult` object returned by `useTable()`.

> [!NOTE]
> See [TableResult in types.ts](https://github.com/rickcedwhat/playwright-smart-table/blob/main/src/types.ts) for the full interface definition.

## init()

Initialize the table by reading headers and setting up the column map.


<!-- api-signature: init -->

### Signature

```typescript
init(options?: { timeout?: number }): Promise<TableResult>
```

### Parameters

- `options` - Optional timeout for header resolution (default: 3000ms)

<!-- /api-signature: init -->

---


## isInitialized()

Check if the table has been initialized.

> [!TIP]
> This is mostly used internally or for advanced debugging. Async methods like `findRow` call `init()` automatically, so you rarely need to check this manually.

<!-- api-signature: isInitialized -->

### Signature

```typescript
isInitialized(): boolean
```

<!-- /api-signature: isInitialized -->

### Returns

`boolean` - true if init() has been called and completed

### Example

```typescript
const table = useTable(page.locator('#table'));

console.log(table.isInitialized()); // false

await table.init();

console.log(table.isInitialized()); // true
```

---

## getRow()

Get the first row matching the filter criteria on the current **page**. This is a synchronous-like operation that requires the table to be initialized.

If you need to search across multiple pages, use [findRow()](#findrow) instead.


<!-- api-signature: getRow -->

### Signature

```typescript
getRow(
  filters: Record<string, string | RegExp | number>,
  options?: { exact?: boolean }
): SmartRow
```

<!-- /api-signature: getRow -->

### Example

```typescript
// ✅ Simple single-column filter
const row = table.getRow({ Name: 'John' });

// ✅ Multi-column filter (must match ALL)
const adminRow = table.getRow({ 
  Role: 'Admin',
  Status: 'Active'
});

// ✅ Regex matching
const gmailRow = table.getRow({ 
  Email: /@gmail\.com$/ 
});
```

---

## getRows()

Get all rows on the current page (does not paginate). Returns a `SmartRowArray` which adds helper methods like `toJSON()`.


<!-- api-signature: getRows -->

### Signature

```typescript
getRows(options?: {
  filter?: Record<string, any>,
  exact?: boolean
}): Promise<SmartRowArray>
```

### Parameters

- `options` - Filter options

<!-- /api-signature: getRows -->

### Example

```typescript
const rows = await table.getRows();

// Filter in memory
const activeRows = rows.filter(async row => 
  await row.getCell('Status').innerText() === 'Active'
);

// Convert all to JSON
const data = await rows.toJSON();
console.log(data); 
// [{ Name: 'John', Status: 'Active' }, ...]
```

---

## getRowByIndex()

Get a row by its index on the current page.

> [!TIP]
> Use this when you need stable iteration or access by position, which is faster than filtering by content.


<!-- api-signature: getRowByIndex -->

### Signature

```typescript
getRowByIndex(
  index: number,
  options?: { bringIntoView?: boolean }
): SmartRow
```

### Parameters

- `index` - 1-based row index
- `options` - Optional settings including bringIntoView

<!-- /api-signature: getRowByIndex -->

---

## findRow()

Find the first row matching the filter, searching across multiple pages.


<!-- api-signature: findRow -->

### Signature

```typescript
findRow(
  filters: Record<string, string | RegExp | number>,
  options?: { exact?: boolean, maxPages?: number }
): Promise<SmartRow>
```

### Parameters

- `filters` - The filter criteria to match
- `options` - Search options including exact match and max pages

<!-- /api-signature: findRow -->

### Example

```typescript
// Find first row matching criteria (searches all pages)
const row = await table.findRow({ Name: 'John Doe' });

// Limit search to first 5 pages
const row = await table.findRow(
  { Name: 'John Doe' },
  { maxPages: 5 }
);

// With exact match
const exactRow = await table.findRow(
  { Email: 'john@example.com' },
  { exact: true }
);
```

---

## findRows()

Find all rows matching the filter across multiple pages.


<!-- api-signature: findRows -->

### Signature

```typescript
findRows(
  filters: Record<string, string | RegExp | number>,
  options?: { exact?: boolean, maxPages?: number }
): Promise<SmartRowArray>
```

### Parameters

- `filters` - The filter criteria to match
- `options` - Search options including exact match, max pages, and asJSON

<!-- /api-signature: findRows -->

### Example

```typescript
// Find all rows matching criteria (searches all pages)
const rows = await table.findRows({ Status: 'Active' });

// Limit search to first 10 pages
const rows = await table.findRows(
  { Status: 'Active' },
  { maxPages: 10 }
);

// With exact match
const exactRows = await table.findRows(
  { Department: 'Engineering' },
  { exact: true }
);
```

---

## getColumnValues()

Extract all values from a specific column across multiple pages.


<!-- api-signature: getColumnValues -->

### Signature

```typescript
getColumnValues<V = string>(
  column: string,
  options?: {
    mapper?: (cell: Locator) => Promise<V> | V,
    maxPages?: number
  }
): Promise<V[]>
```

### Parameters

- `column` - Name of the column to extract
- `options.mapper` - **Optional** function to transform the cell locator into a value (default: `innerText`). Use this to parse numbers, dates, or extract attributes.
```



<!-- /api-signature: getColumnValues -->

---

## getHeaders()

Get all column names.


<!-- api-signature: getHeaders -->

### Signature

```typescript
getHeaders(): Promise<string[]>
```

<!-- /api-signature: getHeaders -->

---

## getHeaderCell()

Get the header cell Locator for a specific column.


<!-- api-signature: getHeaderCell -->

### Signature

```typescript
getHeaderCell(columnName: string): Promise<Locator>
```

<!-- /api-signature: getHeaderCell -->

---

## iterateThroughTable()

Iterate through all rows across all pages with callbacks.


<!-- api-signature: iterateThroughTable -->

### Signature

```typescript
iterateThroughTable: <T = any>(
  callback: (context: {
  index: number;
  isFirst: boolean;
  isLast: boolean;
  rows: SmartRow[];
  allData: T[];
  table: RestrictedTableResult;
  batchInfo?: {
  startIndex: number;
  endIndex: number;
  size: number;
  };
  }) => T | Promise<T>,
  options?: {
  pagination?: PaginationStrategy;
  dedupeStrategy?: DedupeStrategy;
  maxIterations?: number;
  batchSize?: number;
  getIsFirst?: (context: { index: number }) => boolean;
  getIsLast?: (context: { index: number, paginationResult: boolean }) => boolean;
  beforeFirst?: (context: { index: number, rows: SmartRow[], allData: any[] }) => void | Promise<void>;
  afterLast?: (context: { index: number, rows: SmartRow[], allData: any[] }) => void | Promise<void>;
  }
```

<!-- /api-signature: iterateThroughTable -->


## scrollToColumn()

Navigate to a specific column using the configured cell navigation strategy.

<!-- api-signature: scrollToColumn -->

### Signature

```typescript
scrollToColumn(columnName: string): Promise<void>
```

<!-- /api-signature: scrollToColumn -->

### Example

```typescript
// Scroll to a column that's off-screen
await table.scrollToColumn('Email');

// Now interact with cells in that column
const row = await table.findRow({ Name: 'John' });
await row.getCell('Email').click();
```

---

---

## reset()

Reset table state and invoke onReset strategy. 

Use this when the table state matches what is in the DOM but appropriate cleanup (like clearing filters) needs to happen before a new test.


<!-- api-signature: reset -->

### Signature

```typescript
reset(): Promise<void>
```

<!-- /api-signature: reset -->

---


## revalidate()

Revalidate the table's structure without resetting pagination or state.

Use this when the DOM has changed (e.g. columns toggled) but you want to keep the current pagination/filter state.

<!-- api-signature: revalidate -->

### Signature

```typescript
revalidate(): Promise<void>
```

<!-- /api-signature: revalidate -->

### Example

```typescript
// Columns changed dynamically
await page.click('#toggle-columns');

// Revalidate to pick up new column structure
await table.revalidate();

// Now you can access the new columns
const row = await table.findRow({ Name: 'John' });
await row.getCell('NewColumn').click();
```

### Notes

- Useful when columns change visibility or order dynamically
- Does not reset pagination state
- Does not clear row cache

---

## sorting

Access sorting methods.

### apply()

Apply sorting to a column.

```typescript
await table.sorting.apply('Name', 'asc');
await table.sorting.apply('Salary', 'desc');
```

### getState()

Get current sort state.

```typescript
const state = await table.sorting.getState();
console.log(state); // { column: 'Name', direction: 'asc' }
```

---


### Returns

`Promise<string>` - Formatted configuration string

### Example

```typescript
const config = await table.generatePromptConfig();
console.log(config);
```
