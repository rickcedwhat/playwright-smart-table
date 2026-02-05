<!-- NEEDS REVIEW -->
# API Reference

Welcome to the Playwright Smart Table API documentation. This library provides a powerful, type-safe way to interact with HTML tables in Playwright tests.

## Quick Navigation

### Configuration
- [**TableConfig**](/api/table-config) - Configure table selectors, strategies, and behavior

### Core Methods
- [**Table Methods**](/api/table-methods) - Methods for finding and interacting with rows
- [**SmartRow**](/api/smart-row) - Methods available on row objects
- [**Strategies**](/api/strategies) - Built-in and custom strategies

## Basic Usage

```typescript
import { useTable } from '@rickcedwhat/playwright-smart-table';

const table = useTable(page.locator('#my-table'), {
  headerSelector: 'thead th',
  rowSelector: 'tbody tr',
  cellSelector: 'td'
});

await table.init();

// Find a row
const row = await table.findRow({ Name: 'John Doe' });

// Get a cell value
const email = await row.getCell('Email').textContent();
```

## Type Safety

The library is fully typed. When you initialize a table, TypeScript will infer the column names:

```typescript
type MyTableRow = {
  Name: string;
  Email: string;
  Status: string;
};

const table = useTable<MyTableRow>(page.locator('#table'), config);
```
