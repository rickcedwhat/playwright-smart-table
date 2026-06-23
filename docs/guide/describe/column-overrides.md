# Do any columns need special treatment?

Some columns don't behave like regular text cells. A column might render a progress bar instead of plain text, or use a custom date picker that `smartFill` can't interact with automatically. `columnOverrides` lets you define custom read and write behavior per column.

## Custom read (affects `toJSON`)

By default `toJSON` reads each cell's `innerText`. If a column stores its value differently — a data attribute, an input's value, a nested element — override how it's read:

```typescript
useTable(locator, {
  columnOverrides: {
    Progress: {
      read: async (cell) => cell.getAttribute('data-value'),
    },
    Status: {
      read: async (cell) => cell.locator('.badge').innerText(),
    },
  }
})
```

## Custom write (affects `smartFill`)

If a column uses a custom editor that `smartFill` can't auto-detect, define how to write to it:

```typescript
useTable(locator, {
  columnOverrides: {
    StartDate: {
      write: async ({ cell, targetValue }) => {
        await cell.click()
        await page.getByRole('dialog').getByLabel('Date').fill(targetValue)
        await page.getByRole('button', { name: 'Confirm' }).click()
      },
    },
  }
})
```

## Both together

`read` and `write` can coexist on the same column. When both are defined, `smartFill` will call `read` first to get the current value before writing — useful when you need to compare before acting.

_Config: `columnOverrides`_


---

→ [API Reference: Config Options — columnOverrides](/api/table-config#columnoverrides)
