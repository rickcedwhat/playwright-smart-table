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
headerSelector?: Selector
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
rowSelector?: Selector
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
cellSelector?: Selector
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

Default concurrency mode for `forEach`, `map`, and `filter`. Can be overridden per-call.

- **`'sequential'`** — one row at a time, in order. Default for `forEach` and `filter`.
- **`'parallel'`** — all rows on the current page run concurrently. Default for `map`.
- **`'synchronized'`** — rows run in parallel but page navigation waits for all callbacks to finish.

```typescript
concurrency: 'sequential'
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
headerTransformer?: (args: {
  text: string,
  index: number,
  locator: Locator
}) => string | Promise<string>
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

### `debug`

<!-- api-signature: debug -->

### Signature

```typescript
debug?: boolean | DebugConfig
```

<!-- /api-signature: debug -->

Enable verbose logging for development. Pass `true` for default verbosity or a config object for fine-grained control.

```typescript
debug: true

debug: { logLevel: 'verbose' }
```

---

### `strategies`

<!-- api-signature: strategies -->

### Signature

```typescript
strategies?: Partial<TableStrategies>
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
