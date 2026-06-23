# Table Methods

Utility methods on the initialized `TableResult` object for headers, counting, columns, sorting, and lifecycle management.

---

## Headers

### `getHeaders()`

```typescript
const columns = await table.getHeaders()
// ['ID', 'Name', 'Status', 'Email']
```

Returns all column names in the order they were resolved during `init()`.

---

### `getHeaderCell(columnName)`

```typescript
const header = await table.getHeaderCell('Status')
await header.click() // sort by Status
await expect(header).toHaveAttribute('aria-sort', 'ascending')
```

Returns a Playwright `Locator` for the header cell of a named column. Useful for clicking to sort, reading sort indicators, or hovering to reveal filter controls.

---

### `scrollToColumn(columnName)`

```typescript
await table.scrollToColumn('Notes')
```

Scrolls the table horizontally until the named column's header is in the viewport. Delegates to `strategies.viewport.scrollToColumn` when set, otherwise falls back to `scrollIntoViewIfNeeded()` on the header cell.

---

## Counting & column extraction

### `countRows()`

```typescript
const total = await table.countRows()
```

Counts all rows across all pages up to `config.maxPages` and resets to page 1. On single-page tables this is equivalent to counting visible rows.

---

### `mapColumn(columnName, options?)`

```typescript
const statuses = await table.mapColumn('Status')
// ['Active', 'Active', 'Inactive', 'Active', ...]
```

Iterates all rows and extracts a single column's value as an array. Accepts the same `RowIterationOptions` as `forEach`.

---

### `getColumnValues(columnName, options?)`

```typescript
const ids = await table.getColumnValues('ID')
// ['1', '2', '3', '4', ...]
```

Like `mapColumn` but always returns strings (calls `innerText()` on each cell). Use `mapColumn` when you need a custom extractor via a generic return type.

---

## Sorting

### `sorting.apply(columnName, direction)`

```typescript
await table.sorting.apply('Name', 'asc')
await table.sorting.apply('Name', 'desc')
await table.sorting.apply('Name', 'none')
```

Applies a sort via `strategies.sorting.doSort`. The direction values accepted depend on your sorting strategy.

---

### `sorting.getState(columnName)`

```typescript
const state = await table.sorting.getState('Name')
// 'asc' | 'desc' | 'none'
```

Reads the current sort state for a column via `strategies.sorting.getSortState`.

---

## Lifecycle

### `isInitialized()`

```typescript
if (!table.isInitialized()) await table.init()
```

Synchronous check — returns `true` after `init()` has completed successfully.

---

### `currentPageIndex`

```typescript
console.log(table.currentPageIndex) // 0-based
```

The current page the table's DOM is showing. Read-only during iteration; can be set directly when you need to restore a known page position.

---

### `reset()`

```typescript
await table.reset()
```

Clears internal cache and flags, then fires `config.onReset`. Use between test cases that reuse the same `TableResult` instance.

---

### `revalidate()`

```typescript
await table.revalidate()
```

Re-reads the header map without resetting pagination state. Use when columns are added or removed dynamically (e.g. after toggling column visibility).

---

## Diagnostics

### `generateConfig()`

```typescript
await table.generateConfig()
```

Prints an AI-friendly configuration prompt to the terminal — useful when setting up a new table and you want a starting-point config to paste into your test file.

---

→ [API: Table Methods](/api/table-methods)
