# TableConfig

Configuration options for initializing a table with `useTable()`.

## Overview

```typescript
const table = useTable<MyTableType>(page.locator('#table'), {
  headerSelector: 'thead th',
  rowSelector: 'tbody tr',
  cellSelector: 'td',
  // ... more options
});
```
### `columnOverrides`

Optional object defining custom data extraction logic (`read`) or fill logic (`write`) per column. This is useful for parsing numbers, checking boolean states, or handling custom widgets like dropdowns or multi-inputs.

```typescript
columnOverrides: {
  // Parse 'ID' column as number when reading data
  ID: {
    read: async (cell) => parseInt(await cell.innerText(), 10)
  },
  // Custom click logic for the 'Active' column checkbox when writing data
  Active: {
    write: async ({ cell, targetValue }) => {
      if (targetValue) await cell.locator('input').check();
      else await cell.locator('input').uncheck();
    }
  }
}
```

The return types of these `read` overrides must match the generic type `T` provided to `useTable<T>`.
## Properties

### headerSelector

**Type:** `string | ((root: Locator) => Locator)`  
**Required:** No  
**Default:** `'thead th'`

Selector for table header cells. Can be a CSS selector string or a function that returns a Locator.

```typescript
// CSS selector
headerSelector: 'thead th'

// Function
headerSelector: (root) => root.locator('thead').locator('th')
```

---

### rowSelector

**Type:** `string`  
**Required:** No  
**Default:** `'tbody tr'`

Selector for table rows.

```typescript
rowSelector: 'tbody tr'
```

---

### cellSelector

**Type:** `string | ((row: Locator) => Locator)`  
**Required:** No  
**Default:** `'td'`

Selector for cells within a row.

```typescript
cellSelector: 'td'
```

---

### headerTransformer

**Type:** `(args: { text, index, locator, seenHeaders }) => string | Promise<string>`  
**Required:** No

Transform header text before mapping to column names. Useful for normalizing column names.

```typescript
headerTransformer: async ({ text, index, locator, seenHeaders }) => {
  // Normalize: "First Name" → "firstName"
  return text.toLowerCase().replace(/\s+/g, '');
}
```

**Use Cases:**
- Normalize column names (remove spaces, lowercase)
- Handle dynamic headers
- Extract text from complex header structures

---

### strategies

**Type:** `Partial<TableStrategies>`  
**Required:** No

Custom strategies for pagination, sorting, filling, etc. See [Strategies](/api/strategies) for details.

```typescript
strategies: {
  pagination: Strategies.Pagination.click({ next: '.next-button' }),
  sorting: Strategies.Sorting.AriaSort(),
  fill: async ({ row, columnName, value }) => {
    await row.getCell(columnName).locator('input').fill(String(value));
  }
}
```

---

### debug

**Type:** `DebugConfig`  
**Required:** No  
**Default:** `undefined`

Enable verbose logging or slow down table operations while troubleshooting.

```typescript
debug: {
  slow: 500,
  logLevel: 'verbose'
}
```

See the debug configuration options above for more details.

---

### maxPages

**Type:** `number`  
**Required:** No  
**Default:** `1`

Maximum number of pages to traverse when using pagination methods like `findRow()`, `findRows()`, `map()`, `forEach()`, and `filter()`. Keep the default for current-page scans; increase it when you want Smart Table to move through pagination.

```typescript
maxPages: 10 // Stop after 10 pages
```

---

### concurrency

**Type:** `'parallel' | 'sequential' | 'synchronized'`  
**Required:** No

Default concurrency for `forEach`, `map`, and `filter`. Per-call options override this value.

- **`parallel`** — full parallelism where the engine allows it (default for `map`).
- **`sequential`** — one row at a time (default for `forEach` / `filter`).
- **`synchronized`** — parallel lock-step navigation with serialized callbacks (for virtualized grids where overlapping navigation would desync the viewport).

---

### autoScroll

**Type:** `boolean`  
**Required:** No  
**Default:** `true`

When `true`, scrolls the table root into view during initialization.

---

### onReset

**Type:** `(context: TableContext) => Promise<void>`  
**Required:** No

Hook invoked when `table.reset()` runs, before pagination `goToFirst` (if configured) and before internal caches are cleared. Use for app-specific cleanup.

---

## Complete Example

```typescript
import { useTable, Strategies } from '@rickcedwhat/playwright-smart-table';

type Employee = {
  name: string;
  email: string;
  department: string;
};

const table = useTable<Employee>(page.locator('#employees'), {
  headerSelector: 'thead th',
  rowSelector: 'tbody tr',
  cellSelector: 'td',
  
  headerTransformer: async ({ text }) => {
    return text.toLowerCase().replace(/\s+/g, '');
  },
  
  strategies: {
    pagination: Strategies.Pagination.click({ next: '.pagination .next' }),
    sorting: Strategies.Sorting.AriaSort()
  },
  
  debug: process.env.DEBUG === 'true'
    ? { logLevel: 'verbose' }
    : undefined,
  maxPages: 20
});

await table.init();
```
