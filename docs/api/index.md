# API Reference

Use the API reference when you already know the method, config option, or strategy you need. If you are still learning the library, start with [Getting Started](/guide/getting-started) or [Examples](/examples/).

## Main References

- [TableConfig](/api/table-config): selectors, strategies, debug, pagination limits, and column overrides.
- [Table Methods](/api/table-methods): `getRow`, `findRow`, `findRows`, `map`, `forEach`, sorting, reset, and more.
- [SmartRow](/api/smart-row): row-level helpers like `getCell`, `toJSON`, `smartFill`, and `bringIntoView`.
- [SmartRowArray](/api/smart-row-array): array returned by `findRows()` and `filter()`.
- [Strategies](/api/strategies): built-in and custom pagination, sorting, header, cell, fill, and viewport behavior.

## Quick Method Map

| Need | API |
|---|---|
| Configure selectors or behavior | [TableConfig](/api/table-config) |
| Find rows and iterate pages | [Table Methods](/api/table-methods) |
| Read or interact with a row | [SmartRow](/api/smart-row) |
| Convert many rows to JSON | [SmartRowArray](/api/smart-row-array) |
| Adapt custom table behavior | [Strategies](/api/strategies) |

## Minimal Usage

```typescript
import { useTable } from '@rickcedwhat/playwright-smart-table';

const table = await useTable(page.locator('#my-table')).init();
const row = table.getRow({ Name: 'John Doe' });

await expect(row.getCell('Email')).toHaveText('john@example.com');
```

## Type Safety

Pass a row type to `useTable<T>()` when you want TypeScript to check filter keys and `toJSON()` output.

```typescript
type UserRow = {
  Name: string;
  Email: string;
  Status: string;
};

const table = useTable<UserRow>(page.locator('#table'));
const user = await table.findRow({ Status: 'Active' });
const data = await user.toJSON(); // UserRow
```
