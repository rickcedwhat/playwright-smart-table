<!-- Last Reviewed: 02/06/2026 -->
# MUI DataGrid Example

Material UI (MUI) DataGrid is a popular React table library. It uses a virtualized `div` structure instead of standard HTML tables.

## Configuration

> [!WARNING]
> MUI DataGrid class names (like `.MuiDataGrid-root`) and DOM structure can change between major versions or in "Pro" vs "Community" editions. Always inspect your specific grid version. If possible, add stable `data-testid` attributes to your application code.

MUI DataGrid uses specific roles and classes. You'll need to configure selectors and potentially a custom cell resolution strategy if you are using the Pro/Premium versions with column grouping.

### Basic Setup

```typescript
import { useTable, presets } from '@rickcedwhat/playwright-smart-table';

const table = useTable(page.locator('.MuiDataGrid-root'), {
  ...presets.muiDataGrid,
  maxPages: 5
});

await table.init();
```

## Handling Virtualization

MUI DataGrid is virtualized, meaning only visible rows exist in the DOM.

### Viewport Recovery

The MUI DataGrid preset includes a viewport strategy that reports visible row/column ranges and scrolls directly to target rows or columns. This lets `row.getCell()` recover when horizontal column scrolling knocks the target row out of the DOM.

```typescript
const row = await table.findRow({ 'Last name': 'Lannister' });
await expect(row.getCell('First name')).toHaveText('Cersei');
```

## Cell Editing

For custom editors, use `columnOverrides.write` to describe exactly how to open and commit the widget.

```typescript
const table = useTable(page.locator('.MuiDataGrid-root'), {
  ...presets.muiDataGrid,
  columnOverrides: {
    'First name': {
      write: async ({ cell, targetValue }) => {
        await cell.dblclick();
        await cell.locator('input').fill(String(targetValue));
        await cell.page().keyboard.press('Enter');
      }
    }
  }
});

// Usage
await row.smartFill({ 'First name': 'Jane' });
```

## Complete Test Example

```typescript
test('MUI DataGrid interaction', async ({ page }) => {
  await page.goto('https://mui.com/x/react-data-grid/');
  
  const table = useTable(page.locator('.MuiDataGrid-root').first(), {
    ...presets.muiDataGrid,
    maxPages: 5
  });
  
  // Find a row
  const row = await table.findRow({ 'Last name': 'Lannister' });
  
  // Check data
  await expect(row.getCell('First name')).toHaveText('Cersei');
  
  // Sort
  await table.sorting.apply('Age', 'desc');
});
```
