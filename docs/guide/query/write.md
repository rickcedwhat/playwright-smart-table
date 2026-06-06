# Write to Cells

```typescript
await row.smartFill({ Status: 'Inactive', Note: 'Updated' })
```

Writes to cells by column name. By default `smartFill` auto-detects the input type — text inputs, selects, checkboxes, and contenteditable elements are handled without any config.

For custom editors, configure a fill strategy. See [How do we write to cells?](/guide/describe/editing).
