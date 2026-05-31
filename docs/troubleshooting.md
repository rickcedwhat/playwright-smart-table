<!-- Last Reviewed: 02/06/2026 -->
# Troubleshooting & Debugging

Common issues, solutions, and debugging techniques for Playwright Smart Table.

<details>
<summary>Column Not Found Errors</summary>

### Problem

```
Error: Column "Email" not found
Available columns: Name, Position, Office, Age, Start date, Salary
```

### Solutions

**1. Check column name spelling and case**

Column names are case-sensitive:

```typescript
// ❌ Wrong
row.getCell('email'); 

// ✅ Correct
row.getCell('Email');
```

**2. Use headerTransformer to normalize**

```typescript
const table = useTable(page.locator('#table'), {
  headerTransformer: async ({ text }) => {
    return text.toLowerCase().trim();
  }
});

// Now you can use lowercase
row.getCell('email'); // Works!
```

**3. Check actual headers**

```typescript
const headers = await table.getHeaders();
console.log('Available columns:', headers);
```

Also check for extra text like sort icons or counts — normalize with `headerTransformer`:

```typescript
const table = useTable(page.locator('#table'), {
  headerTransformer: ({ text }) => text.replace(/Sort$/, '').trim()
});
```

</details>

<details>
<summary>Table Not Initialized</summary>

### Problem

```
Error: Table not initialized. Call init() first.
```

### Solutions

**1. Call init() before synchronous methods**

```typescript
const table = useTable(page.locator('#table'));

// ❌ Wrong - getRowByIndex is sync
const row = table.getRowByIndex(0);

// ✅ Correct
await table.init();
const row = table.getRowByIndex(0);
```

**2. Use async methods (auto-initialize)**

```typescript
// These methods auto-initialize
const row = await table.findRow({ Name: 'John' }); // ✅
const rows = await table.findRows({}); // ✅
```

**Check initialization state:**

```typescript
if (table.isInitialized()) {
    const headers = await table.getHeaders();
    console.log('Mapped Columns:', headers);
}
```

</details>

<details>
<summary>Pagination Not Working</summary>

### Problem

`findRows()` only returns results from the first page.

### Solutions

**1. Configure pagination strategy**

```typescript
import { Strategies } from '@rickcedwhat/playwright-smart-table';

const table = useTable(page.locator('#table'), {
  strategies: {
    pagination: Strategies.Pagination.click({ next: '.next-button' })
  },
  maxPages: 10
});
```

**2. Check pagination selector**

```typescript
// Verify the selector works
await page.locator('.next-button').click(); // Should navigate
```

**3. Set maxPages**

```typescript
const rows = await table.findRows(
  { Office: 'Tokyo' },
  { maxPages: 10 } // Default is 1; raise it to scan more pages
);
```

</details>

<details>
<summary>Flaky Tests</summary>

### Problem

Tests pass sometimes but fail randomly.

### Solutions

**1. Enable debug mode**

```typescript
const table = useTable(page.locator('#table'), {
  debug: {
    slow: 500,
    logLevel: 'verbose'
  }
});
```

**2. Wait for table to load**

```typescript
await page.waitForSelector('#table tbody tr');
await table.init();
```

**3. Use proper waits**

```typescript
// ❌ Avoid
await page.waitForTimeout(1000);

// ✅ Better
await expect(row.getCell('Status')).toHaveText('Active');
```

**4. Handle stale element references**

If the table re-renders (e.g., React/Vue update) and locators go stale, the library handles this automatically in most cases. If you see "Element is not attached" errors, try:

```typescript
await table.revalidate();
```

</details>

<details>
<summary>Duplicate Column Names</summary>

### Problem

```
Error: Duplicate column names found after transformation: ["Name", "Name"]
```

### Solutions

**1. Use headerTransformer to make unique**

```typescript
const table = useTable(page.locator('#table'), {
  headerTransformer: async ({ text, index }) => {
    // Add index to duplicates
    const normalized = text.trim();
    return `${normalized}_${index}`;
  }
});
```

**2. Use column index**

```typescript
// Access by index instead
const cell = row.locator('td').nth(2);
```

</details>

<details>
<summary>Cells Not Found in Row</summary>

### Problem

`getCell()` returns wrong cell or throws error.

### Solutions

**1. Check cell selector**

```typescript
const table = useTable(page.locator('#table'), {
  cellSelector: 'td' // Default
});

// For custom tables
const table = useTable(page.locator('#table'), {
  cellSelector: '.table-cell'
});
```

**2. Verify selectors against your DOM**

If `getHeaders()` returns an empty list, the table root or selectors are wrong. Start with the smallest config that matches your DOM:

```typescript
const table = useTable(page.locator('.grid-root'), {
  headerSelector: '[role="columnheader"]',
  rowSelector: '[role="row"]',
  cellSelector: '[role="gridcell"]'
});
```

**3. Use custom resolution strategy**

```typescript
strategies: {
  getCellLocator: ({ row, columnName, columnIndex }) => {
    return row.locator(`[data-column="${columnName}"]`);
  }
}
```

</details>

<details>
<summary>Performance Issues</summary>

### Problem

Tests are slow when iterating through large tables.

### Solutions

**1. Use built-in iteration methods**

```typescript
// ❌ Slow: Looping manually
for (let i = 0; i < 10; i++) {
   await table.findRows({});
}

// ✅ Fast: Built-in iteration
await table.forEach(async ({ row }) => {
   // Automation handles pagination seamlessly
});
```

**2. Limit pages**

```typescript
const rows = await table.findRows(
  { Department: 'Engineering' },
  { maxPages: 5 } // Don't search entire table
);
```

**3. Use filtering in DOM, not in code**

```typescript
// ❌ Slow - gets all rows then filters in code
const allRows = await table.findRows({});
const filtered = allRows.filter(/* ... */);

// ✅ Fast - filters in DOM
const filtered = await table.findRows({ Office: 'Tokyo' });
```

**4. Use Locator assertions over text extraction**

```typescript
// ❌ Slow: Extracts text (round trip to browser)
const text = await row.getCell('Status').innerText();
expect(text).toBe('Active');

// ✅ Fast: Playwright assertion (runs in browser context)
await expect(row.getCell('Status')).toHaveText('Active');
```

**5. Avoid `findRow` for simple on-screen checks**

```typescript
// Slower: async search path
await table.findRow({ ID: '123' });

// Faster: checks the current page immediately
table.getRow({ ID: '123' }); 
```

</details>

<details>
<summary>TypeScript Type Errors</summary>

### Problem

TypeScript doesn't recognize column names.

### Solutions

**1. Define table type**

```typescript
type Employee = {
  Name: string;
  Email: string;
  Office: string;
};

const table = useTable<Employee>(page.locator('#table'));

// Now TypeScript knows the columns
const row = await table.findRow({ 
  Name: 'John', // ✅ Autocomplete works
  InvalidColumn: 'x' // ❌ TypeScript error
});
```

**2. Use Record for dynamic columns**

```typescript
const table = useTable<Record<string, string>>(page.locator('#table'));
```

</details>

<details>
<summary>Smart Errors Not Showing</summary>

### Problem

Not getting helpful error messages with column suggestions or pagination diagnostics.

### Solutions

**Enable verbose logging**

Smart errors (column not found, pagination failures) are emitted automatically. For maximum diagnostic output, enable verbose logging:

```typescript
const table = useTable(page.locator('#table'), {
  debug: {
    logLevel: 'verbose'
  }
});
```

Smart errors are automatic for:
- `getCell()` — Column not found (with nearest-match suggestion)
- `findRow()` — No matching rows found
- `init()` — Empty or duplicate column names detected
- Pagination — Lists available primitives when navigation fails

</details>

<details>
<summary>Responsive / Mobile Tables</summary>

### Problem

Table transforms into a list or card view on mobile screens (responsive design).

### Solution

The library works on the *visible* DOM. If the table structure changes significantly (e.g., `<table>` becomes `<div>` cards), you may need conditional logic.

```typescript
if (isMobile) {
  // Mobile strategy (cards)
  const cards = page.locator('.card');
  // ... customized logic for cards
} else {
  // Desktop strategy (table)
  const table = useTable(page.locator('#table'));
  await table.findRow({ ... });
}
```

> [!NOTE]
> `SmartRow` locators are resilient to minor layout shifts, but fundamental structure changes require different selectors.

</details>

<details>
<summary>Enabling Debug Logging</summary>

The easiest way to see what the library is doing is to enable logging in the table config.

```typescript
const table = useTable(loc, {
    debug: {
        logLevel: 'verbose', // 'none' | 'error' | 'info' | 'verbose'
        slow: 500            // formatting delay in ms
    }
});
```

**Output:**
```
🔍 [SmartTable] Finding row with filters: { Name: 'John' }
ℹ️ [SmartTable] Scanned 10 rows on page 1
🔍 [SmartTable] Checking row 1: Name="Alice" (Mismatch)
🔍 [SmartTable] Checking row 2: Name="John" (Match!)
```

See [`debug`](/api/table-config#debug) in the API reference for the exact config shape.

</details>

<details>
<summary>Visual Debugging</summary>

Since `SmartRow` returns standard Playwright Locators, you can use Playwright's built-in visual tools:

```typescript
// Highlight the specific cell
await row.getCell('Status').highlight();

// Pause execution to inspect DOM
await page.pause();
```

</details>

---

## Need More Help?

- Check [Examples](/examples/) for working code
- Review [API Reference](/api/) for method details
- Open an issue on [GitHub](https://github.com/rickcedwhat/playwright-smart-table/issues)
