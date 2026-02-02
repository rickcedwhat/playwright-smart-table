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

Strategies define how the library interacts with different table implementations.

```typescript
import { Strategies } from '@rickcedwhat/playwright-smart-table';

const table = useTable(page.locator('#table'), {
  strategies: {
    pagination: Strategies.Pagination.ClickNext('.next-btn'),
    sorting: Strategies.Sorting.AriaSort(),
    fill: Strategies.Fill.ClickAndType()
  }
});
```

Learn more: [Strategies API](/api/strategies)

## Auto-Initialization

Most methods auto-initialize the table:

```typescript
// No need to call init() for async methods
const row = await table.findRow({ Name: 'John' }); // Auto-initializes
const rows = await table.getRows(); // Auto-initializes

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

## Next Steps

- [Configuration](/guide/configuration) - Customize table behavior
- [API Reference](/api/) - Complete method documentation
- [Examples](/examples/) - Real-world usage patterns
