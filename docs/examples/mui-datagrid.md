<!-- Last Reviewed: 02/06/2026 -->
# MUI DataGrid Example

Material UI (MUI) DataGrid is a popular React table library. It uses a virtualized `div` structure instead of standard HTML tables.

Material UI (MUI) DataGrid is a popular React table library. It uses a virtualized `div` structure instead of standard HTML tables.

[![Run on Replit](https://replit.com/badge/github/rickcedwhat/playwright-smart-table)](https://replit.com/github/rickcedwhat/playwright-smart-table)

> [!TIP]
> **Try it now**: Click the button above to start a playground. Open the [Live Demo](https://mui.com/x/react-data-grid/) to inspect the structure.

## Configuration

> [!WARNING]
> MUI DataGrid class names (like `.MuiDataGrid-root`) and DOM structure can change between major versions or in "Pro" vs "Community" editions. Always inspect your specific grid version. If possible, add stable `data-testid` attributes to your application code.

MUI DataGrid uses specific roles and classes. You'll need to configure selectors and potentially a custom cell resolution strategy if you are using the Pro/Premium versions with column grouping.

### Basic Setup

```typescript
import { useTable, Strategies } from 'playwright-smart-table';

const table = useTable(page.locator('.MuiDataGrid-root'), {
  // MUI uses ARIA roles efficiently
  rowSelector: 'div[role="row"]',
  cellSelector: 'div[role="gridcell"]',
  headerSelector: 'div[role="columnheader"]',
  
  // Header text often includes sort icons/menus, so we clean it up
  headerTransformer: ({ text }) => text.trim(),
  
  strategies: {
    // MUI uses standard ARIA sort attributes
    sorting: Strategies.Sorting.AriaSort(),
    
    // Pagination (if using paginated view)
    pagination: Strategies.Pagination.ClickNext(
      'button[title="Go to next page"]'
    )
  }
});

await table.init();
```

## Handling Virtualization

MUI DataGrid is virtualized, meaning only visible rows exist in the DOM.

### Scrolling

The library's `findRow` naturally handles searching across pages, but for virtual scrolling (infinite scroll style), you should use the `InfiniteScroll` pagination strategy.

```typescript
strategies: {
  pagination: Strategies.Pagination.InfiniteScroll({
    scrollContainer: page.locator('.MuiDataGrid-virtualScroller'),
    waitForNewRows: 500 // Wait for virtualization to render
  })
}
```

## Cell Editing

MUI DataGrid often requires a double-click to edit.

```typescript
strategies: {
  fill: Strategies.Fill.DoubleClickAndType({
    clearFirst: true,
    pressEnter: true
  })
}

// Usage
await row.smartFill({ 'First Name': 'Jane' });
```

## Complete Test Example

```typescript
test('MUI DataGrid interaction', async ({ page }) => {
  await page.goto('https://mui.com/x/react-data-grid/');
  
  const table = useTable(page.locator('.MuiDataGrid-root').first(), {
    rowSelector: 'div[role="row"]',
    cellSelector: 'div[role="gridcell"]',
    headerSelector: 'div[role="columnheader"]',
  });
  
  // Find a row
  const row = await table.findRow({ 'Last name': 'Lannister' });
  
  // Check data
  await expect(row.getCell('First name')).toHaveText('Cersei');
  
  // Sort
  await table.sorting.apply('Age', 'desc');
});
```
