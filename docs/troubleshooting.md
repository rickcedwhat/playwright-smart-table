<!-- Last Reviewed: 02/06/2026 -->
# Troubleshooting

Common issues and solutions when using Playwright Smart Table.

## Column Not Found Errors

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

---

## Table Not Initialized

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

---

## Pagination Not Working

### Problem

`findRows()` only returns results from the first page.

### Solutions

**1. Configure pagination strategy**

```typescript
import { Strategies } from '@rickcedwhat/playwright-smart-table';

const table = useTable(page.locator('#table'), {
  strategies: {
    pagination: Strategies.Pagination.ClickNext('.next-button')
  }
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
  { maxPages: 10 } // Limit search
);
```

---

## Flaky Tests

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

---

## Duplicate Column Names

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

---

## Cells Not Found in Row

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

**2. Use custom resolution strategy**

```typescript
strategies: {
  getCellLocator: ({ row, columnName, columnIndex }) => {
    return row.locator(`[data-column="${columnName}"]`);
  }
}
```

---

## Performance Issues

### Problem

Tests are slow when iterating through large tables.

### Solutions

**1. Use batching**

```typescript
await table.forEach(async ({ row }) => {
  // Process row
});
```

**2. Limit pages**

```typescript
const rows = await table.findRows(
  { Department: 'Engineering' },
  { maxPages: 5 } // Don't search entire table
);
```

**3. Use filtering**

```typescript
// ❌ Slow - gets all rows then filters in code
const allRows = await table.findRows({});
const filtered = allRows.filter(/* ... */);

// ✅ Fast - filters in DOM
const filtered = await table.findRows({ Office: 'Tokyo' });
```

---

## TypeScript Type Errors

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

---

## Smart Errors Not Showing

### Problem

Not getting helpful error messages with suggestions.

### Solutions

**1. Enable strict validation**

```typescript
const table = useTable(page.locator('#table'), {
  debug: {
    strictValidation: true
  }
});
```

**2. Check error messages**

Smart errors are automatic for:
- `getCell()` - Column not found
- `findRow()` - No matching rows
- `init()` - Empty or duplicate columns

---

## Responsive / Mobile Tables

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

---

## Need More Help?

- Check [Examples](/examples/) for working code
- Review [API Reference](/api/) for method details
- Open an issue on [GitHub](https://github.com/rickcedwhat/playwright-smart-table/issues)
