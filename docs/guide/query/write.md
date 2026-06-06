# Write to Cells

```typescript
await row.smartFill({ Status: 'Inactive', Note: 'Updated' })
```

Writes to cells by column name. By default `smartFill` auto-detects the input type and fills it:

- **Text input / textarea** → `fill(value)`
- **Select** → `selectOption(value)`
- **Checkbox / radio** → clicks only if the current state doesn't already match
- **Contenteditable** → clicks to focus, then fills
- **Anything else** → clicks the cell (may trigger an inline editor)

For custom editors, configure a fill strategy. See [How do we write to cells?](/guide/describe/editing).
