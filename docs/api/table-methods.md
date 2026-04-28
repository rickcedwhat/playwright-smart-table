<!-- Last Reviewed: 02/06/2026 -->
# Table Methods

Methods available on the `TableResult` object returned by `useTable()`.



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

[Back to Top](#table-methods)

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

[Back to Top](#table-methods)

---

## getRow()

Get the first row matching the filter criteria on the current **page**. This is a synchronous-like operation that requires the table to be initialized.

If you need to search across multiple pages, use [findRow()](#findrow) instead.

Filters support `string`, `RegExp`, `number`, or `(cell: Locator) => Locator` for custom locator logic (e.g. checkbox checked).

<!-- api-signature: getRow -->

### Signature

```typescript
getRow(
  filters: Record<string, FilterValue>,
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

[Back to Top](#table-methods)

---


## getRowByIndex()

Get a row by its 0-based index on the current page.

> [!TIP]
> Use this when you need stable iteration or access by position, which is faster than filtering by content.


<!-- api-signature: getRowByIndex -->

### Signature

```typescript
getRowByIndex(index: number): SmartRow
```

### Parameters

- `index` - 0-based row index

<!-- /api-signature: getRowByIndex -->

[Back to Top](#table-methods)

---

## findRow()

Find **exactly one** row matching the filter. Throws an `"Ambiguous Row"` error if more than one match is found on a page — use this when your filters should uniquely identify a row. Use [`findRows()`](#findrows) if you expect multiple matches.

By default this scans one page (`maxPages: 1`); increase `maxPages` to search through pagination.

> [!NOTE]
> **Not-found behaviour:** when no row matches, `findRow` returns a sentinel `SmartRow` rather than throwing immediately. Any subsequent interaction on it (`.click()`, `.innerText()`, etc.) will fail with a Playwright locator error at that point. Use [`findRows()`](#findrows) and check `.length` if you need an explicit "not found" assertion.

<!-- api-signature: findRow -->

### Signature

```typescript
findRow(
  filters: Record<string, FilterValue>,
  options?: { exact?: boolean, maxPages?: number }
): Promise<SmartRow>
```

### Parameters

- `filters` - The filter criteria to match
- `options` - Search options including exact match and max pages

<!-- /api-signature: findRow -->

### Example

```typescript
// Expects exactly one match — throws if two rows both have Name: 'John Doe'
const row = await table.findRow({ Name: 'John Doe' });

// Search up to the first 5 pages
const rowWithinFivePages = await table.findRow(
  { Name: 'John Doe' },
  { maxPages: 5 }
);

// With exact match
const exactRow = await table.findRow(
  { Email: 'john@example.com' },
  { exact: true }
);
```

[Back to Top](#table-methods)

---

## findRows()

Find rows matching the filter. By default this scans one page (`maxPages: 1`); increase `maxPages` to collect rows across pagination.


<!-- api-signature: findRows -->

### Signature

```typescript
findRows(
  filters?: Record<string, FilterValue>,
  options?: { exact?: boolean, maxPages?: number }
): Promise<SmartRowArray<T>>
```

### Parameters

- `filters` - The filter criteria to match (omit or pass {} for all rows)
- `options` - Search options including exact match and max pages

<!-- /api-signature: findRows -->

To get the JSON content of the rows (using `columnOverrides.read` if configured), simply chain `.toJSON()` to the result:

```ts
const rows = await table.findRows({ Status: 'Active' });
const data = await rows.toJSON();
```


### Example

```typescript
// Find rows matching criteria on the default scan range
const rows = await table.findRows({ Status: 'Active' });

// Search up to the first 10 pages
const rowsWithinTenPages = await table.findRows(
  { Status: 'Active' },
  { maxPages: 10 }
);

// With exact match
const exactRows = await table.findRows(
  { Department: 'Engineering' },
  { exact: true }
);
```

[Back to Top](#table-methods)

---


## forEach()

Iterate rows in the configured scan range, calling the callback for side effects. Execution is sequential by default (safe for interactions like clicking/filling). Increase `maxPages` to iterate beyond the first page. Call `stop()` in the callback to end iteration early.

<!-- api-signature: forEach -->

### Signature

```typescript
forEach(
  callback: (ctx: RowIterationContext<T>) => void | Promise<void>,
  options?: RowIterationOptions
): Promise<void>
```

### Parameters

- `callback` - Function receiving { row, rowIndex, stop }
- `options` - maxPages, concurrency, dedupe, useBulkPagination

<!-- /api-signature: forEach -->

### Example

```typescript
await table.forEach(async ({ row, rowIndex, stop }) => {
  if (await row.getCell('Status').innerText() === 'Done') stop();
  await row.getCell('Checkbox').click();
});
```

[Back to Top](#table-methods)

---


## map()

Transform rows in the configured scan range into values. Returns a flat array. Execution is parallel within each page by default (safe for reads). Increase `maxPages` to map beyond the first page. Call `stop()` to halt after the current page finishes.

> [!WARNING]
> `map` defaults to `concurrency: 'parallel'`. If your callback opens popovers, fills inputs, or mutates UI state, pass `{ concurrency: 'sequential' }` or `{ concurrency: 'synchronized' }` as appropriate.

<!-- api-signature: map -->

### Signature

```typescript
map<R>(
  callback: (ctx: RowIterationContext<T>) => R | Promise<R>,
  options?: RowIterationOptions
): Promise<R[]>
```

### Example

```typescript
// Data extraction — parallel is safe
const emails = await table.map(({ row }) => row.getCell('Email').innerText());

// UI interactions — use sequential (or synchronized) concurrency
const assignees = await table.map(async ({ row }) => {
  await row.getCell('Assignee').locator('button').click();
  const name = await page.locator('.popover .name').innerText();
  await page.keyboard.press('Escape');
  return name;
}, { concurrency: 'sequential' });
```

[Back to Top](#table-methods)

---


## filter()

Filter rows in the configured scan range by an async predicate. Returns a [SmartRowArray](/api/smart-row-array). Execution is sequential by default. Increase `maxPages` to filter beyond the first page. Call `bringIntoView()` on each row if you need to interact after pagination.

<!-- api-signature: filter -->

### Signature

```typescript
filter(
  predicate: (ctx: RowIterationContext<T>) => boolean | Promise<boolean>,
  options?: RowIterationOptions
): Promise<SmartRowArray<T>>
```

### Example

```typescript
const active = await table.filter(async ({ row }) =>
  await row.getCell('Status').innerText() === 'Active'
);

for (const row of active) {
  await row.bringIntoView();
  await row.getCell('Checkbox').click();
}
```

[Back to Top](#table-methods)

---


## Async Iterator (`for await...of`)

The table is async iterable. Use `for await...of` for low-level page-by-page iteration.

```typescript
for await (const { row, rowIndex } of table) {
  console.log(rowIndex, await row.getCell('Name').innerText());
}
```

[Back to Top](#table-methods)

---


## getHeaders()

Get all column names.


<!-- api-signature: getHeaders -->

### Signature

```typescript
getHeaders(): Promise<string[]>
```

<!-- /api-signature: getHeaders -->

[Back to Top](#table-methods)

---

## getHeaderCell()

Get the header cell Locator for a specific column.


<!-- api-signature: getHeaderCell -->

### Signature

```typescript
getHeaderCell(columnName: string): Promise<Locator>
```

<!-- /api-signature: getHeaderCell -->

[Back to Top](#table-methods)

---


## scrollToColumn()

Scrolls the table horizontally to bring the given column's header into view.

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
const row = table.getRow({ Name: 'John' });
await row.getCell('Email').click();
```

---

[Back to Top](#table-methods)

---

## reset()

Reset table state and invoke the `onReset` strategy.

> [!WARNING]
> `reset()` clears internal row cache and flags (`tableMapper.clear()`), calls `pagination.goToFirst()` (if configured) to scroll or paginate back to page 1, and exits any active filter or sort state applied outside the library. Calling `reset()` around filtered/sorted reads may silently return unfiltered data — re-apply filters and sorts after calling it.

Use this between independent test operations to return the table to a clean baseline.


<!-- api-signature: reset -->

### Signature

```typescript
reset(): Promise<void>
```

<!-- /api-signature: reset -->

[Back to Top](#table-methods)

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
const row = table.getRow({ Name: 'John' });
await row.getCell('NewColumn').click();
```

### Notes

- Useful when columns change visibility or order dynamically
- Does not reset pagination state
- Does not clear row cache

[Back to Top](#table-methods)

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

Get current sort state for a column.

```typescript
const state = await table.sorting.getState('Name');
console.log(state); // 'asc' | 'desc' | 'none'
```

[Back to Top](#table-methods)

---

## generateConfig()

Generates an AI-friendly configuration prompt for debugging. Outputs table HTML and TypeScript definitions to help AI assistants generate config. **Throws an Error** containing the prompt (does not return).

### Signature

```typescript
generateConfig(): Promise<void>
```

[Back to Top](#table-methods)

---

## generateConfigPrompt()

Deprecated alias for `generateConfig()`. Use `generateConfig()` in new code; `generateConfigPrompt()` will be removed in v7.0.0.

### Signature

```typescript
generateConfigPrompt(): Promise<void>
```
