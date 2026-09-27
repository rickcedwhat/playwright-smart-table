# Where is your table?

The root locator you pass to `useTable()`. Everything else — headers, rows, cells — is resolved relative to this element.

```typescript
useTable(page.locator('#my-table'))
useTable(page.locator('[role="grid"]'))
useTable(page.locator('.ag-root'))
```

_Config: first argument to `useTable()`_

---

## What if there's no table?

A lot of apps don't render an empty table when there are no results — they swap it out for a "No results" message. Without being told, we'll go looking for headers that aren't there and `init()` will fail.

Point us at the empty-state element instead:

```typescript
const table = await useTable(page.locator('#orders'), {
  emptyState: page.getByText('No orders found'),
}).init()

if (table.isEmpty()) {
  // nothing to check
}
```

If the headers can't be found but that element is visible, `init()` succeeds and `isEmpty()` returns `true`. Row methods still throw on an empty table, so check `isEmpty()` before reaching for rows.

_Config: `emptyState`_

---

→ [API Reference: Config Options](/api/table-config) · [Config Options — emptyState](/api/table-config#emptystate)
