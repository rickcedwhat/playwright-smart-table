# Config Options

All options passed to `useTable(locator, config)`. Every option is optional unless noted.

```typescript
import { useTable } from '@rickcedwhat/playwright-smart-table';

const table = await useTable(page.locator('#my-table'), {
  rowSelector: 'tbody tr',
  maxPages: 20,
  strategies: { ... },
}).init();
```

→ [API: Table Methods](/api/table-methods) · [API: Strategies](/api/strategies)

---

## Selectors

### `headerSelector`

<!-- api-signature: headerSelector -->

### Signature

```typescript
headerSelector?: string | ((root: Locator) => Locator)
```

<!-- /api-signature: headerSelector -->

Selector for the column header elements. Accepts a CSS string or a function returning a Locator.

```typescript
// CSS string
headerSelector: 'thead th'

// Locator function
headerSelector: (root) => root.locator('[role="columnheader"]')
```

→ [Guide: Identify Your Table](/guide/describe/identify)

---

### `rowSelector`

<!-- api-signature: rowSelector -->

### Signature

```typescript
rowSelector?: string
```

<!-- /api-signature: rowSelector -->

CSS selector for the table rows. Scoped to the table locator.

```typescript
rowSelector: 'tbody tr'
rowSelector: '[role="row"].data-row'
```

→ [Guide: Identify Your Table](/guide/describe/identify)

---

### `cellSelector`

<!-- api-signature: cellSelector -->

### Signature

```typescript
cellSelector?: string | ((row: Locator) => Locator)
```

<!-- /api-signature: cellSelector -->

Selector for cells within a row. Accepts a CSS string or a function returning a Locator.

```typescript
// CSS string
cellSelector: 'td'

// Locator function
cellSelector: (row) => row.locator('[role="gridcell"]')
```

→ [Guide: Identify Your Table](/guide/describe/identify)

---

## Behavior

### `maxPages`

<!-- api-signature: maxPages -->

### Signature

```typescript
maxPages?: number
```

<!-- /api-signature: maxPages -->

Maximum number of pages to scan during iteration and search operations. Prevents runaway pagination on unexpectedly large tables.

Defaults to `1`. If you configure a pagination strategy, set this explicitly or iteration and search will never leave page 1 — `init()` logs a warning when it sees a pagination strategy with `maxPages: 1`.

```typescript
maxPages: 50
```

---

### `concurrency`

<!-- api-signature: concurrency -->

### Signature

```typescript
concurrency?: RowIterationMode
```

<!-- /api-signature: concurrency -->

Default concurrency mode for `forEach`, `map`, `filter`, and `toArray`. Can be overridden per-call.

- **`'sequential'`** — one row at a time, in order. Default for all iteration methods (since v6.22.0).
- **`'parallel'`** — all rows on the current page run concurrently. Faster for read-only callbacks.
- **`'synchronized'`** — rows run in parallel but page navigation waits for all callbacks to finish.

```typescript
concurrency: 'parallel'
```

→ [Guide: Iterate Rows](/guide/query/iterate)

---

### `autoScroll`

<!-- api-signature: autoScroll -->

### Signature

```typescript
autoScroll?: boolean
```

<!-- /api-signature: autoScroll -->

When `true`, PST scrolls the table locator into view during `init()`. Useful when tables render below the fold.

```typescript
autoScroll: true
```

---

## Hooks

### `headerTransformer`

<!-- api-signature: headerTransformer -->

### Signature

```typescript
headerTransformer?: (args: { text: string, index: number, locator: Locator, seenHeaders: Set<string> }) => string | Promise<string>
```

<!-- /api-signature: headerTransformer -->

Rename or normalize column headers at init time. Runs once per header cell during `init()`.

```typescript
headerTransformer: ({ text, index }) => text.trim() || `Column ${index}`
```

```typescript
// Rename a known system column
headerTransformer: ({ text }) =>
  text.includes('__checkbox__') ? 'Select' : text.trim()
```

→ [Guide: Custom Header Text](/guide/describe/header-text)

---

### `onReset`

<!-- api-signature: onReset -->

### Signature

```typescript
onReset?: (context: TableContext) => Promise<void>
```

<!-- /api-signature: onReset -->

Called after `table.reset()`. Use to navigate back to the first page, clear filters, or perform any teardown the table requires.

```typescript
onReset: async ({ root, page }) => {
  await page.locator('.pagination-first').click();
}
```

---

## Advanced

### `columnOverrides`

<!-- api-signature: columnOverrides -->

### Signature

```typescript
columnOverrides?: Partial<Record<keyof T, ColumnOverride<T[keyof T]>>>
```

<!-- /api-signature: columnOverrides -->

Per-column read and write overrides. Use `read` to customize how cell text is extracted; use `write` to customize how values are filled.

```typescript
columnOverrides: {
  Status: {
    read: async (cell) => cell.locator('.badge').innerText(),
    write: async ({ cell, targetValue }) => {
      await cell.locator('select').selectOption(targetValue);
    },
  },
}
```

→ [Guide: Column Overrides](/guide/describe/column-overrides) · [Guide: Fill Cells](/guide/describe/editing)

---

### `syntheticColumns`

<!-- api-signature: syntheticColumns -->

### Signature

```typescript
syntheticColumns?: Record<string, SyntheticColumnDef<T>>
```

<!-- /api-signature: syntheticColumns -->

Computed columns with no DOM presence. Each key becomes a virtual column whose value comes from `compute(row)`.

Synthetic columns are available in `toJSON()`, `row.getValue()`, `getHeaders()`, and `findRow` / `findRows` / `countRows` filters. They are **not** available in:

- `getRow()` filters — use `findRow()` (synthetics need async evaluation)
- `row.getCell()` or `smartFill()` — there's no cell to return or fill

`compute` may read real columns and `columnOverrides`, but not other synthetic columns.

```typescript
syntheticColumns: {
  Total: {
    compute: async (row) => {
      const price = Number(await row.getValue('Price'));
      const qty = Number(await row.getValue('Qty'));
      return price * qty;
    },
  },
}

// Computed values are stringified before matching
const row = await table.findRow({ Total: '40' }, { exact: true });
```

→ [Guide: Column Overrides](/guide/describe/column-overrides)

---

### `emptyState`

<!-- api-signature: emptyState -->

### Signature

```typescript
emptyState?: Locator
```

<!-- /api-signature: emptyState -->

Locator for the element that replaces the table when there are no results. If header resolution fails during `init()` and this locator is visible, `init()` succeeds and [`isEmpty()`](/api/table-methods#isempty) returns `true`. Without it, an empty table makes `init()` throw.

Row operations still throw on an empty table — check `isEmpty()` first.

```typescript
const table = await useTable(page.locator('#orders'), {
  emptyState: page.getByText('No orders found'),
}).init();

if (table.isEmpty()) return;
```

---

### `debug`

<!-- api-signature: debug -->

### Signature

```typescript
debug?: DebugConfig
```

<!-- /api-signature: debug -->

Development aids: internal logging and slow-motion delays. Remove before committing — `debug.slow` warns when it detects CI.

- **`logLevel`** — `'none'` (default) · `'error'` · `'info'` · `'verbose'`
- **`slow`** — delay in ms for every operation, or per type: `{ pagination, getCell, findRow, default }`

```typescript
debug: { logLevel: 'verbose' }

debug: { logLevel: 'info', slow: { pagination: 500 } }
```

---

### `strategies`

<!-- api-signature: strategies -->

### Signature

```typescript
strategies?: TableStrategies
```

<!-- /api-signature: strategies -->

All pluggable strategy overrides — pagination, loading detection, header discovery, sorting, viewport navigation, and more.

```typescript
strategies: {
  pagination: PaginationStrategies.infiniteScroll({ ... }),
  loading: { isCellLoading: async (cell) => ... },
}
```

→ [API: Strategies](/api/strategies)
