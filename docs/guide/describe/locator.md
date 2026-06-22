# Where is your table?

The root locator you pass to `useTable()`. Everything else — headers, rows, cells — is resolved relative to this element.

```typescript
useTable(page.locator('#my-table'))
useTable(page.locator('[role="grid"]'))
useTable(page.locator('.ag-root'))
```

_Config: first argument to `useTable()`_


---

→ [API Reference: Config Options](/api/table-config)
