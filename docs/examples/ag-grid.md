<!-- Last Reviewed: 02/06/2026 -->
# AG Grid Example

AG Grid is a high-performance table library that is fully virtualized and uses a complex DOM structure.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/rickcedwhat/playwright-smart-table/tree/main/examples/playground?file=tests%2Fdemo.spec.ts&title=Playwright%20Smart%20Table%20Demo)

> [!TIP]
> **Try it now**: Click the button above to start a playground. Open the [Live Demo](https://www.ag-grid.com/example/) to see the grid in action.

## Configuration

> [!WARNING]
> AG Grid has a complex DOM that relies on specific class names (e.g. `.ag-cell-value`) which are internal implementation details. These may change in future AG Grid versions. Using stable test attributes (like `data-test-id`) is recommended if you have control over the source code.

AG Grid is effectively tested by targeting its specific class names.

### Basic Setup

```typescript
import { useTable, Strategies } from 'playwright-smart-table';

const table = useTable(page.locator('.ag-root-wrapper'), {
  // AG Grid standard classes
  headerSelector: '.ag-header-cell-text', // Target the text container directly
  rowSelector: '.ag-row',
  cellSelector: '.ag-cell',
  
  strategies: {
    // AG Grid uses aria-sort
    sorting: Strategies.Sorting.AriaSort(),
    
    // Custom pagination (if using standard paging)
    pagination: Strategies.Pagination.ClickNext('.ag-paging-button[aria-label="Next Page"]')
  }
});

await table.init();
```

## Virtualization & Column Virtualization

AG Grid virtualizes both rows (vertical) and columns (horizontal). 

### Horizontal Scrolling

If columns are off-screen, `getCell()` won't find them by default. You need a `cellNavigation` strategy or use `scrollToColumn`.

```typescript
// 1. Scroll to column manually
await table.scrollToColumn('Status');
await row.getCell('Status').click();

// 2. Or configure a strategy to auto-scroll
strategies: {
  cellNavigation: Strategies.CellNavigation.Keyboard({
    rootSelector: '.ag-body-viewport' // Focus here first
  })
}
```

### Row Virtualization

For "Infinite Scroll" or "Server Side Row Model" in AG Grid:

## The Structure

AG Grid is complex because it splits headers and body content, and often uses row virtualization.

```mermaid
graph TD
    subgraph "AG Grid Container"
        H[Header Container .ag-header]
        B[Body Container .ag-body-viewport]
    end
    
    H --> H1[.ag-header-cell]
    H --> H2[.ag-header-cell]
    
    B --> R1[.ag-row]
    B --> R2[.ag-row]
    
    R1 --> C1[.ag-cell value="Name"]
    R1 --> C2[.ag-cell value="Role"]
    
    style H fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#bbf,stroke:#333,stroke-width:2px
```

```typescript
strategies: {
  pagination: Strategies.Pagination.InfiniteScroll({
    scrollContainer: page.locator('.ag-body-viewport'),
  })
}
```

## Checkbox Selection

AG Grid often has a checkbox column. You can resolve it using `getRowByIndex` or custom selectors.

```typescript
test('select row', async ({ page }) => {
  const table = useTable(page.locator('#myGrid'));
  
  const row = await table.findRow({ Model: 'Y' });
  
  // Assuming the first column is the checkbox
  await row.locator('.ag-selection-checkbox').click();
  
  // Or if it's a named column
  await row.getCell('Select').locator('input').check(); 
});
```

## Complete Test Example

```typescript
test('AG Grid flow', async ({ page }) => {
  await page.goto('https://www.ag-grid.com/example/');
  
  const table = useTable(page.locator('#myGrid'), {
    headerSelector: '.ag-header-cell-text',
    rowSelector: 'div[role="row"]', 
    cellSelector: 'div[role="gridcell"]',
  });
  
  // Sort by Price
  await table.sorting.apply('Price', 'desc');
  
  // Find expensive car
  const row = await table.findRow({ 
    Make: 'Porsche',
    Model: 'Boxster' 
  });
  
  // Verify
  await expect(row.getCell('Price')).toHaveText('72000');
});
```

## Next Steps

Learn about advanced patterns, validation, and scraping.

[Go to Recipes >](/recipes/)
