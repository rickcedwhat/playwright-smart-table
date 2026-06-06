# How do we write to cells?

`row.smartFill()` writes to editable cells by column name. By default it auto-detects the input type in each cell and fills it:

- **Text input / textarea** → `fill(value)`
- **Select** → `selectOption(value)`
- **Checkbox / radio** → clicks only if the current state doesn't already match
- **Contenteditable** → clicks to focus, then fills
- **Anything else** → clicks the cell (which may trigger an inline editor)

```typescript
await row.smartFill({ Status: 'Inactive', Note: 'Updated' })
```

If your table uses a custom editor — a modal, a date picker, a rich text field — you'll need a fill strategy to tell Playwright Smart Table how to interact with it.

_Config: `strategies.fill`, `columnOverrides.write`_
