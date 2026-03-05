<!-- Last Reviewed: 02/06/2026 -->
# Core Concepts

Understanding the key concepts of Playwright Smart Table.

## SmartRow

A SmartRow is a Playwright Locator enhanced with column-aware methods.

```typescript
const row = await table.findRow({ Name: 'John Doe' });

// Column-aware access
const email = row.getCell('Email');

// Still a Locator - all Playwright methods work
await expect(row).toBeVisible();
await row.click();
```

Learn more: [SmartRow API](/api/smart-row)

## Strategies

Strategies define how the library interacts with different table implementations. Use built-in strategies or provide your own.

```typescript
import { Strategies, useTable } from '@rickcedwhat/playwright-smart-table';

// Built-in strategies
const table = useTable(page.locator('#table'), {
  strategies: {
    pagination: Strategies.Pagination.click({ next: '.next-btn' }),
    sorting: Strategies.Sorting.AriaSort(),
    // Custom fill: click cell, then type (e.g. for inline editors)
    fill: async ({ row, columnName, value, page }) => {
      const cell = row.getCell(columnName);
      await cell.click();
      await page.keyboard.type(String(value));
    }
  }
});
```

Learn more: [Strategies API](/api/strategies)

## Auto-Initialization

Most methods auto-initialize the table:

```typescript
// No need to call init() for async methods
const row = await table.findRow({ Name: 'John' }); // Auto-initializes
const rows = await table.findRows({}, { maxPages: 1 }); // Auto-initializes

// Only needed for sync methods
await table.init();
const row = table.getRowByIndex(0); // Requires init()
```

## Type Safety

Define your table structure for full TypeScript support:

```typescript
type Employee = {
  Name: string;
  Email: string;
  Department: string;
  Salary: string;
};

const table = useTable<Employee>(page.locator('#table'));

// TypeScript knows the columns
const row = await table.findRow({ 
  Name: 'John',
  InvalidColumn: 'x' // ❌ TypeScript error
});
```

## Parallel Execution

Playwright Smart Table is fully compatible with Playwright's parallel execution.

- **Stateless**: `SmartRow` and `TableResult` objects are stateless wrappers around Playwright Locators.
- **Safe**: No global state is shared between tests or workers.
- **Independent**: Each `useTable` call creates a fresh instance scoped to the specific `page` object.

You can safely run tests in parallel using `fullyParallel: true` in your Playwright config.

## Next Steps

- [Configuration](/guide/configuration) - Customize table behavior
- [API Reference](/api/) - Complete method documentation
- [Examples](/examples/) - Real-world usage patterns
