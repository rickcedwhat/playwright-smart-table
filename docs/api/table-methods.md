# Table Methods

Methods on the object returned by `useTable(...).init()`.

```typescript
const table = await useTable(page.locator('#my-table'), config).init();
```

→ [API: Config Options](/api/table-config) · [API: SmartRow](/api/smart-row)

---

## Lifecycle

### `init`

<!-- api-signature: init -->

### Signature

```typescript
init(options?: { timeout?: number }): Promise<TableResult>
```

### Parameters

- `options` - Optional timeout for header resolution (default: 3000ms)

<!-- /api-signature: init -->

Resolves column headers and prepares the table for use. Must be called before any sync methods (`getRow`, `getRowByIndex`). Async methods auto-initialize if needed.

```typescript
const table = await useTable(locator, config).init();
const table = await useTable(locator, config).init({ timeout: 5000 });
```

---

### `isInitialized`

<!-- api-signature: isInitialized -->

### Signature

```typescript
isInitialized(): boolean
```

<!-- /api-signature: isInitialized -->

Returns `true` if `init()` has completed successfully.

```typescript
if (!table.isInitialized()) await table.init();
```

---

### `reset`

<!-- api-signature: reset -->

### Signature

```typescript
reset(): Promise<void>
```

<!-- /api-signature: reset -->

Resets table state (clears cached page position) and calls the `onReset` strategy if configured. Use after iteration to restore the table to its first page.

```typescript
await table.reset();
```

---

### `revalidate`

<!-- api-signature: revalidate -->

### Signature

```typescript
revalidate(): Promise<void>
```

<!-- /api-signature: revalidate -->

Re-scans headers and rebuilds the column map without resetting pagination state. Use when columns change visibility or order dynamically (e.g., after toggling column visibility).

```typescript
await table.revalidate();
```

---

## Row Access

### `getRow`

<!-- api-signature: getRow -->

### Signature

```typescript
getRow(
  filters: Record<string, FilterValue>,
  options?: { exact?: boolean }
): SmartRow
```

<!-- /api-signature: getRow -->

Finds a row on the **current page only** by column filters. Returns synchronously — does not paginate.

```typescript
const row = table.getRow({ Name: 'John Doe' });
const email = await row.getCell('Email').innerText();
```

::: warning
`getRow` only searches the currently visible page. Use `findRow` to search across pages.
:::

→ [Guide: Find Rows](/guide/query/find-rows)

---

### `getRowByIndex`

<!-- api-signature: getRowByIndex -->

### Signature

```typescript
getRowByIndex(index: number): SmartRow
```

### Parameters

- `index` - 0-based row index

<!-- /api-signature: getRowByIndex -->

Gets a row by 0-based index on the current page. The returned `SmartRow` has its `rowIndex` set, enabling `bringIntoView()`.

```typescript
const firstRow = table.getRowByIndex(0);
```

---

### `findRow`

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

Searches for a single matching row **across pages**. Paginates automatically. Returns the first match.

```typescript
const row = await table.findRow({ Email: 'john@example.com' });
const row = await table.findRow({ Status: 'Active' }, { maxPages: 10 });
```

→ [Guide: Find Rows](/guide/query/find-rows)

---

### `findRows`

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
- `options` - Search options (exact, maxPages). `useBulkPagination` defaults to `false`: pages advance one at a time via `goNext` so no intermediate page is skipped. Set it to `true` to opt into `goNextBulk` (faster, but skips the rows on jumped-over pages).

<!-- /api-signature: findRows -->

Searches for **all** matching rows across pages. Pass empty filters `{}` or omit to collect every row.

```typescript
const activeRows = await table.findRows({ Status: 'Active' });
const allRows = await table.findRows();
```

→ [Guide: Find Rows](/guide/query/find-rows)

---

## Iteration

### `forEach`

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

Iterates every row across all pages. Runs sequentially by default. Call `stop()` in the callback to halt early (stops after the current page finishes).

```typescript
await table.forEach(async ({ row, stop }) => {
  const status = await row.getCell('Status').innerText();
  if (status === 'Archived') stop();
  await row.getCell('Checkbox').click();
});
```

→ [Guide: Iterate Rows](/guide/query/iterate)

---

### `map`

<!-- api-signature: map -->

### Signature

```typescript
map<R>(
  callback: (ctx: RowIterationContext<T>) => R | Promise<R>,
  options?: RowIterationOptions
): Promise<R[]>
```

### Parameters

- `callback` - Function receiving { row, rowIndex, stop }
- `options` - maxPages, concurrency, dedupe, useBulkPagination

<!-- /api-signature: map -->

Transforms every row across all pages into a value. Runs in parallel by default (safe for reads). Use `concurrency: 'sequential'` when callbacks interact with UI.

```typescript
const emails = await table.map(({ row }) => row.getCell('Email').innerText());

// UI interactions — use sequential
const results = await table.map(async ({ row }) => {
  await row.getCell('Actions').locator('button').click();
  return page.locator('.dialog .title').innerText();
}, { concurrency: 'sequential' });
```

→ [Guide: Iterate Rows](/guide/query/iterate)

---

### `filter`

<!-- api-signature: filter -->

### Signature

```typescript
filter(
  predicate: (ctx: RowIterationContext<T>) => boolean | Promise<boolean>,
  options?: RowIterationOptions
): Promise<SmartRowArray<T>>
```

<!-- /api-signature: filter -->

Collects rows matching an async predicate across all pages. Returns a `SmartRowArray`.

```typescript
const highEarners = await table.filter(async ({ row }) => {
  const salary = await row.getCell('Salary').innerText();
  return parseInt(salary.replace(/\D/g, '')) > 50000;
});
```

→ [Guide: Iterate Rows](/guide/query/iterate)

---

### Async iteration

The table implements `AsyncIterable`, so you can use `for await...of` for fine-grained control with `break`:

```typescript
for await (const { row, rowIndex } of table) {
  if (await row.getCell('Status').innerText() === 'Archived') break;
}
```

→ [Guide: Iterate Rows](/guide/query/iterate)

---

## Column Utilities

### `getHeaders`

<!-- api-signature: getHeaders -->

### Signature

```typescript
getHeaders(): Promise<string[]>
```

<!-- /api-signature: getHeaders -->

Returns the resolved column header names in order.

```typescript
const headers = await table.getHeaders();
// ['Name', 'Email', 'Status', ...]
```

---

### `getHeaderCell`

<!-- api-signature: getHeaderCell -->

### Signature

```typescript
getHeaderCell(columnName: string): Promise<Locator>
```

<!-- /api-signature: getHeaderCell -->

Returns a Locator for the header cell of a named column.

```typescript
const nameHeader = await table.getHeaderCell('Name');
await nameHeader.click(); // sort by Name
```

---

### `scrollToColumn`

<!-- api-signature: scrollToColumn -->

### Signature

```typescript
scrollToColumn(columnName: string): Promise<void>
```

<!-- /api-signature: scrollToColumn -->

Scrolls horizontally to bring a column into view. Uses the configured navigation strategy.

```typescript
await table.scrollToColumn('Notes');
```

---

### `countRows`

<!-- api-signature: countRows -->

### Signature

```typescript
countRows: () => Promise<number>
```

<!-- /api-signature: countRows -->

Returns the number of rows currently visible on the page. Does not paginate.

```typescript
const count = await table.countRows();
```

---

### `mapColumn`

<!-- api-signature: mapColumn -->

### Signature

```typescript
mapColumn<R = string>(columnName: string, options?: RowIterationOptions): Promise<R[]>
```

### Parameters

- `columnName` - The name of the column to extract
- `options` - Iteration options

<!-- /api-signature: mapColumn -->

Extracts all values for a single column across pages. More efficient than `map` + `toJSON` for single-column reads.

```typescript
const statuses = await table.mapColumn('Status');
const counts = await table.mapColumn<number>('Count');
```

---

### `getColumnValues`

<!-- api-signature: getColumnValues -->

### Signature

```typescript
getColumnValues(columnName: string, options?: RowIterationOptions): Promise<string[]>
```

### Parameters

- `columnName` - The name of the column to extract
- `options` - Iteration options

<!-- /api-signature: getColumnValues -->

Extracts all values for a single column as strings. Convenience wrapper around `mapColumn`.

```typescript
const names = await table.getColumnValues('Name');
```

---

## Sorting

### `sorting.apply`

<!-- api-signature: sorting -->

### Signature

```typescript
sorting?: SortingStrategy
```

<!-- /api-signature: sorting -->

Applies the configured sorting strategy to a column.

```typescript
await table.sorting.apply('Name', 'asc');
await table.sorting.apply('Created At', 'desc');
```

→ [API: Strategies — sorting](/api/strategies#sorting)

---

## Diagnostics

### `generateConfig`

<!-- api-signature: generateConfig -->

### Signature

```typescript
generateConfig: () => Promise<void>
```

<!-- /api-signature: generateConfig -->

Dumps table HTML and TypeScript type definitions to help generate PST configuration. Intentionally throws an error containing the prompt — copy the output and pass it to an AI assistant.

```typescript
await table.generateConfig();
```
