<!-- Last Reviewed: 05/07/2026 -->
# FAQ and Common Mistakes

Short answers for the problems new users tend to hit first.

## Do I need to call `init()` every time?

No. Call `init()` before synchronous current-page methods such as `getRow()`, `getRowByIndex()`, and `getHeaders()`.

```typescript
const table = useTable(page.locator('#orders'));

// Wrong: getRow() needs the header map to exist.
const wrongRow = table.getRow({ Status: 'Paid' });

// Correct.
await table.init();
const correctRow = table.getRow({ Status: 'Paid' });
```

Async methods such as `findRow()`, `findRows()`, `map()`, and `forEach()` initialize automatically.

```typescript
const table = useTable(page.locator('#orders'));
const row = await table.findRow({ Status: 'Paid' });
```

Use `reset()` when your app returns the table to its first page or default state. Use `revalidate()` when the visible columns changed and you only need to refresh the header map.

## What is the difference between `getRow()` and `findRow()`?

`getRow()` is synchronous and checks the rows Smart Table currently knows about. Use it when the row is already visible and you have already called `init()`.

```typescript
const table = await useTable(page.locator('#users')).init();
const row = table.getRow({ Email: 'ada@example.com' });
```

`findRow()` is asynchronous. It can initialize the table, use pagination or viewport strategies, and search beyond the current row set.

```typescript
const table = useTable(page.locator('#users'), {
  strategies: {
    pagination: Strategies.Pagination.click({ next: '.next' })
  },
  maxPages: 5
});

const row = await table.findRow({ Email: 'ada@example.com' });
```

If you are unsure whether the row is already visible, prefer `findRow()`.

## Why does `getRow()` return the wrong row sometimes?

Usually the filter is too broad or the column map does not match the table you meant to target.

Check these first:

- The root locator points to one table, not a page section containing multiple tables.
- Column names match the rendered headers exactly, including case and whitespace.
- You are filtering on a column with values that uniquely identify a row.
- You called `revalidate()` after hiding, showing, reordering, or renaming columns.

```typescript
const table = await useTable(page.locator('#users')).init();
console.log(await table.getHeaders());
```

If several rows can match the same filter, use a more specific filter or use `findRows()` and assert on the collection.

## Why is my column not found?

Smart Table resolves cells by header text. If the rendered header is `E-mail` and your test asks for `Email`, the lookup will fail.

```typescript
const headers = await table.getHeaders();
console.log(headers);
```

For inconsistent header text, normalize it with `headerTransformer`.

```typescript
const table = useTable(page.locator('#users'), {
  headerTransformer: async ({ text }) => text.trim().toLowerCase()
});

await table.init();
const row = table.getRow({ email: 'ada@example.com' });
```

For duplicate headers, include the index or another stable signal in the transformed name.

```typescript
headerTransformer: async ({ text, index }) => `${text.trim()}_${index}`
```

## Why does `findRows()` only search the first page?

By default, Smart Table does not know how your app moves to the next page. Add a pagination strategy and raise `maxPages`.

```typescript
const table = useTable(page.locator('#orders'), {
  strategies: {
    pagination: Strategies.Pagination.click({
      next: () => page.getByRole('button', { name: 'Next' })
    })
  },
  maxPages: 10
});

const rows = await table.findRows({ Status: 'Pending' });
```

If the app uses infinite scroll instead of buttons, use a viewport or custom pagination strategy that matches that behavior.

## Why do virtualized tables behave unexpectedly?

Virtualized grids only render the rows or columns visible in the viewport. Locators for off-screen cells may become detached as the grid scrolls.

Common fixes:

- Configure a viewport strategy for virtual rows or columns.
- Use `await row.bringIntoView()` before interacting with a row found through scanning.
- Avoid storing cell locators across scrolls; resolve the cell again after moving the viewport.
- Increase `maxPages` or the strategy limits when the target row may be far down the list.

```typescript
const row = await table.findRow({ Name: 'Ada Lovelace' });
await row.bringIntoView();
await expect(row.getCell('Role')).toHaveText('Admin');
```

## Should I use `locator('table')` or a wrapper element?

Use the smallest stable element that contains the table rows, headers, and any pagination controls Smart Table needs.

For a standard HTML table, the table itself is usually correct:

```typescript
const table = useTable(page.locator('table#users'));
```

For a component library, the wrapper is often better because headers, rows, scroll containers, and pagination controls may be siblings.

```typescript
const table = useTable(page.locator('[data-testid="users-grid"]'), {
  headerSelector: '[role="columnheader"]',
  rowSelector: '[role="row"]',
  cellSelector: '[role="gridcell"]'
});
```

If a selector works in Playwright Inspector but Smart Table still cannot find rows or cells, check whether the selector is scoped to the same root you passed to `useTable()`.

## Why are my tests flaky?

Most flaky table tests come from reading the table before the app has finished rendering or from using fixed timeouts.

Prefer waiting for specific UI state:

```typescript
await expect(page.locator('#users tbody tr')).toHaveCount(10);
const table = await useTable(page.locator('#users')).init();
```

Avoid:

```typescript
await page.waitForTimeout(1000);
```

Use debug mode when you need to see what Smart Table is doing:

```typescript
const table = useTable(page.locator('#users'), {
  debug: {
    slow: 250,
    logLevel: 'verbose'
  }
});
```

## When should I write a custom strategy?

Write a custom strategy when the table behavior cannot be described with selectors alone.

Good candidates:

- Pagination requires app-specific waits or disabled-state checks.
- Cells are not aligned by index.
- Sorting requires clicking custom controls.
- Editable cells need special open, fill, and save steps.

If the only problem is different markup, start with `headerSelector`, `rowSelector`, and `cellSelector` before writing a strategy.

## Where should I look next?

- [Troubleshooting](/troubleshooting) for longer problem/solution examples.
- [Configuration](/guide/configuration) for selector and strategy setup.
- [Pagination Strategies](/concepts/pagination-strategies) for multi-page tables.
- [Debugging](/guide/debugging) for logging and diagnosis tips.
