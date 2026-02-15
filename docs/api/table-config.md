<!-- NEEDS REVIEW -->
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
### `dataMapper`

Optional object defining custom data extraction logic per column. This is useful for parsing numbers, checking boolean states, or handling custom components.

```typescript
dataMapper: {
  // Parse 'ID' column as number
  ID: async (cell) => parseInt(await cell.innerText(), 10),
  // Check 'Active' column checkbox state
  Active: async (cell) => await cell.locator('input').isChecked()
}
```

The return types of these mappers must match the generic type `T` provided to `useTable<T>`.
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

**Type:** `string | ((root: Locator) => Locator)`  
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

**Type:** `(context: HeaderContext) => string | Promise<string>`  
**Required:** No

Transform header text before mapping to column names. Useful for normalizing column names.

```typescript
headerTransformer: async ({ text, index, locator }) => {
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
  pagination: Strategies.Pagination.ClickNext('.next-button'),
  sorting: Strategies.Sorting.AriaSort(),
  fill: Strategies.Fill.ClickAndType()
}
```

---

### debug

**Type:** `boolean | DebugConfig`  
**Required:** No  
**Default:** `false`

Enable debug mode for slow motion, logging, and strict validation.

```typescript
// Simple
debug: true

// Advanced
debug: {
  slow: 500,
  logLevel: 'verbose',
  strictValidation: true
}
```

See the debug configuration options above for more details.

---

### maxPages

**Type:** `number`  
**Required:** No  
**Default:** `Infinity`

Maximum number of pages to traverse when using pagination methods like `findRows()`.

```typescript
maxPages: 10 // Stop after 10 pages
```

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
    pagination: Strategies.Pagination.ClickNext('.pagination .next'),
    sorting: Strategies.Sorting.AriaSort()
  },
  
  debug: process.env.DEBUG === 'true',
  maxPages: 20
});

await table.init();
```
