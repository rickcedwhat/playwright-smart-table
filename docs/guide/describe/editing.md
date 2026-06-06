# How do we write to cells?

`row.smartFill()` writes to editable cells by column name. By default it auto-detects the input type in each cell — text inputs, selects, checkboxes, and contenteditable elements are all handled without any config.

```typescript
await row.smartFill({ Status: 'Inactive', Note: 'Updated' })
```

If your table uses a custom editor — a modal, a date picker, a rich text field — you'll need a fill strategy to tell Playwright Smart Table how to interact with it.

_Config: `strategies.fill`, `columnOverrides.write`_
