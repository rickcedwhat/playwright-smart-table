<!-- Last Reviewed: 02/06/2026 -->
# Core Concepts

There are three ideas to understand: a table helper, smart rows, and strategies.

## 1. The Table Helper

`useTable(root)` creates a helper around one table-like element. It reads headers, caches the column map, and uses that map whenever you ask for a row or cell.

```typescript
const table = await useTable(page.locator('#employees')).init();
const headers = await table.getHeaders();
```

Call `reset()` when your app returns the table to its starting state. Call `revalidate()` when the visible columns changed and you want to refresh the header map without resetting pagination.

## 2. SmartRow

A `SmartRow` is a Playwright `Locator` with table-aware methods added.

```typescript
const row = table.getRow({ Name: 'Airi Satou' });

// Column-aware access
await expect(row.getCell('Office')).toHaveText('Tokyo');

// It is still a Locator
await expect(row).toBeVisible();
await row.click();
```

Use `row.toJSON()` to read row data, `row.smartFill()` to fill editable cells, and `row.bringIntoView()` before interacting with a row returned from a paginated scan.

Learn more in the [SmartRow API](/api/smart-row).

## 3. Strategies

Strategies tell Smart Table how your table behaves when normal HTML-table assumptions are not enough.

```typescript
import { Strategies, useTable } from '@rickcedwhat/playwright-smart-table';

const table = useTable(page.locator('#table'), {
  strategies: {
    pagination: Strategies.Pagination.click({ next: '.next-btn' }),
    sorting: Strategies.Sorting.AriaSort()
  }
});
```

Common strategies:

| Strategy | Use it when... |
|---|---|
| `pagination` | Smart Table needs to move to the next page or scroll batch. |
| `sorting` | You want `table.sorting.apply()` and `table.sorting.getState()`. |
| `viewport` | Rows and columns are virtualized and may unmount while scrolling. |
| `getCellLocator` | Cells cannot be resolved by simple column index. |
| `fill` / `columnOverrides.write` | Editable cells need app-specific interaction logic. |

Learn more in the [Strategies API](/api/strategies).

## Auto-Initialization

Async search and iteration methods initialize automatically. Current-page sync methods need `init()` first.

```typescript
const asyncTable = useTable(page.locator('#table'));
const row = await asyncTable.findRow({ Name: 'John' }); // auto-initializes

const table = await useTable(page.locator('#table')).init();
const firstRow = table.getRowByIndex(0); // current-page sync access
```

## Type Safety

Define your row shape when you want TypeScript to check column names and JSON output.

```typescript
type Employee = {
  Name: string;
  Email: string;
  Department: string;
  Salary: string;
};

const table = useTable<Employee>(page.locator('#table'));

const row = await table.findRow({ 
  Name: 'John',
  InvalidColumn: 'x' // TypeScript error
});
```

## Next Steps

- [Configuration](/guide/configuration): customize selectors and behavior.
- [Examples](/examples/): choose a task-based example.
- [API Reference](/api/): look up exact method details.
