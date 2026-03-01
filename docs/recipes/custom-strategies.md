# Custom Strategies

Strategies allow you to adapt the library to any table implementation, no matter how complex.

## Overview

A Strategy is simply a function that implements specific behavior. You can override ANY default behavior by passing a custom strategy.

## Custom Pagination

Handle complex pagination logic like "Load More" buttons or infinite scroll triggers.

```typescript
import { useTable, Strategies } from 'playwright-smart-table';

const table = useTable(page.locator('table'), {
  strategies: {
    pagination: {
      goNext: async ({ page, rootLocator }) => {
          // 1. Detect if there's a next page
          const loadMore = page.locator('button:has-text("Load More")');
          
          if (await loadMore.isDisabled() || !(await loadMore.isVisible())) {
              return false; // No more pages
          }
          
          // 2. Perform navigation
          await loadMore.click();
          
          // 3. Wait for new content
          await page.waitForResponse(resp => resp.url().includes('/api/data'));
          
          return true; // Successfully navigated
      }
    }
  }
});
```

## Custom Filling

Customize how data is entered into cells (e.g., custom dropdowns, date pickers).

```typescript
// Example: select a value from a custom dropdown
const customSelect = async ({ cell, value }) => {
    // 1. Click cell to open dropdown
    await cell.click();
    
    // 2. Wait for dropdown (often attached to body)
    const option = cell.page().locator(`.dropdown-option:has-text("${value}")`);
    await option.click();
    
    // 3. Verify value was set
    await expect(cell).toHaveText(value);
};

const table = useTable(loc, {
    strategies: {
        fill: customSelect
    }
});

// Usage
await row.smartFill({ Status: 'Active' });
```

## Custom Cell Resolution

If your table uses a non-standard layout (e.g., grid divs instead of `td`), you can define how to find a cell for a given column.

```typescript
const table = useTable(loc, {
    strategies: {
        getCellLocator: ({ row, columnName, columnIndex }) => {
            // Example: Cells are identified by a 'data-field' attribute matching the column name
            return row.locator(`div[data-field="${columnName}"]`);
        }
    }
});
```

## Reusing Strategies

Strategies are just functions, so you can easily reuse and share them.

```typescript
// my-strategies.ts
export const MyCompanyTableStrategies = {
    pagination: { goNext: async (...) => { ... } },
    fill: async (...) => { ... }
};

// test.spec.ts
import { MyCompanyTableStrategies } from './my-strategies';

const table = useTable(loc, {
    strategies: MyCompanyTableStrategies
});
```
