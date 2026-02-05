# TypeScript Integration

Playwright Smart Table is written in TypeScript and provides first-class type support.

## Typed Tables

You can define an interface for your row data to get autocomplete and type checking for your filter objects.

```typescript
// 1. Define your data shape
interface Employee {
    ID: string;
    Name: string;
    Role: 'Admin' | 'User' | 'Guest';
    Active: boolean;
}

// 2. Pass it to useTable
const table = useTable<Employee>(page.locator('table'));

// ✅ Autocomplete for properties!
// ✅ Type checking for values!
await table.findRow({ 
    Role: 'Admin' // Type checked: must be one of the union values
});

// ❌ Error: 'Salary' does not exist in type 'Employee'
await table.findRow({ Salary: 50000 });
```

## return Types

Methods like `getColumnValues` allow you to specify the return type when using a mapper.

```typescript
const ids = await table.getColumnValues<number>('ID', {
    mapper: async (cell) => parseInt(await cell.innerText())
});

// ids is number[]
```

## Custom Context

If you are writing custom strategies, you can use the `TableContext` type to understand what arguments are available.

```typescript
import type { TableContext } from 'playwright-smart-table';

const myStrategy = async ({ page, rootLocator }: TableContext) => {
    // ...
};
```

## Exported Types

All major types are exported for your use:

- `TableConfig`
- `SmartRow`
- `SmartRowArray`
- `TableResult`

```typescript
import type { SmartRow } from 'playwright-smart-table';

// Helper function
async function activateUser(row: SmartRow) {
    await row.getCell('Actions').getByText('Activate').click();
}
```
