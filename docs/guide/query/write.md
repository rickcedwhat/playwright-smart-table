# Write to Cells

```typescript
await row.smartFill({ Status: 'Inactive', Note: 'Updated' })
```

Writes to cells by column name. By default `smartFill` auto-detects the input type and fills it:

- **Text input / textarea** → `fill(value)`
- **Select** → `selectOption(value)`
- **Checkbox / radio** → clicks only if the current state doesn't already match
- **Contenteditable** → clicks to focus, then fills
- **Anything else** → `fill(value)` called directly on the cell

For one-off column customization without a full `columnOverrides` config, pass `inputMappers` inline:

```typescript
await row.smartFill(
  { StartDate: '2024-01-15' },
  { inputMappers: { StartDate: (cell) => cell.locator('input[type="date"]') } }
)
```

`inputMappers` lets you point `smartFill` at the right input inside a cell. For more complex interactions (modals, date pickers, rich editors), use `columnOverrides.write` instead — see [Column overrides](/guide/describe/column-overrides).

For custom editors that need full control, configure a fill strategy. See [How do we write to cells?](/guide/describe/editing).
