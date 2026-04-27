# Debugging

When Smart Table cannot find a row or column, start by checking what it sees: headers, selectors, and pagination state.

## Turn On Logs

```typescript
const table = useTable(page.locator('#table'), {
  debug: {
    logLevel: 'verbose',
    slow: 250
  }
});
```

`logLevel: 'verbose'` prints table mapping, row search, pagination, and cell resolution decisions. `slow` adds small delays so you can watch the browser while a test runs.

## Check Detected Headers

Most “column not found” problems come from header text that does not match what the test expects.

```typescript
const table = await useTable(page.locator('#table')).init();
console.log(await table.getHeaders());
```

If headers include extra text like sort icons or counts, normalize them with `headerTransformer`.

```typescript
const table = useTable(page.locator('#table'), {
  headerTransformer: ({ text }) => text.replace(/Sort$/, '').trim()
});
```

## Verify Selectors

If `getHeaders()` returns an empty list, the table root or selectors are wrong. Start with the smallest config that matches your DOM:

```typescript
const table = useTable(page.locator('.grid-root'), {
  headerSelector: '[role="columnheader"]',
  rowSelector: '[role="row"]',
  cellSelector: '[role="gridcell"]'
});
```

## More Help

- [Troubleshooting](/troubleshooting): common errors and fixes.
- [TableConfig debug option](/api/table-config#debug): exact debug config shape.
- [Advanced Debugging](/advanced/debugging): lower-level diagnostics.
