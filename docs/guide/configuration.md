<!-- Last Reviewed: 02/06/2026 -->
# Configuration Guide

The default configuration works out of the box for standard HTML tables (`<table>`, `<thead>`, `<tbody>`, `<tr>`, `<td>`).

However, modern web applications often use `div` structures, virtualization, or custom components. This guide explains how to adapt Playwright Smart Table to any structure.

## Selectors

The most common configuration is telling the library where to find headers, rows, and cells.

### Standard Tables

If your HTML looks like this, you don't need any config:

```html
<table>
  <thead>
    <tr><th>Name</th><th>Email</th></tr>
  </thead>
  <tbody>
    <tr><td>John</td><td>john@example.com</td></tr>
  </tbody>
</table>
```

### Div-Based Tables

For grids built with `div`s (e.g., AG Grid, React Data Grid), you need to specify selectors:

```typescript
const table = useTable(page.locator('.grid-container'), {
  headerSelector: '.header-row .header-cell',
  rowSelector: '.body-row',
  cellSelector: '.cell'
});
```

> [!TIP]
> You can pass functions if you need complex logic like filtering:
> ```typescript
> // Only select rows that contain actual data cells (excluding headers/separators)
> rowSelector: (root) => root.locator('div.row').filter({ has: root.locator('.cell') })
> ```

## Header Transformation

Sometimes the text visible in the header isn't what you want to use in your tests.

- **Whitespace**: "  First Name  " -> "First Name"
- **Case**: "EMAIL" -> "Email"
- **Updates**: "Status (Sortable)" -> "Status"

Use `headerTransformer` to normalize these names BEFORE they are used in the library.

```typescript
const table = useTable(loc, {
  headerTransformer: async ({ text, index }) => {
    // 1. Trim whitespace
    let normalized = text.trim();
    
    // 2. Remove icons/metadata
    normalized = normalized.replace(/🔼|🔽/g, '');
    
    // 3. Normalize case (optional)
    return normalized; 
  }
});

// Now you can use the clean name:
table.getCell('First Name');
```

## Strategies

Configuration is also where you attach behavior strategies.

```typescript
import { Strategies } from 'playwright-smart-table';

const table = useTable(loc, {
  strategies: {
    // Handle "Load More" buttons
    pagination: Strategies.Pagination.ClickNext('.load-more-btn'),
    
    // Handle column sorting
    sorting: Strategies.Sorting.AriaSort()
  }
});
```

See [Strategies](/api/strategies) for full details.

## Debugging

Enable debug mode to see exactly what the library is doing: detecting headers, matching rows, and executing strategies.

```typescript
const table = useTable(loc, {
  debug: {
    logLevel: 'verbose', // See every decision
    slow: 500            // Slow down interactions by 500ms
  }
});
```

## Dynamic Config

You can reuse configuration objects across tests.

```typescript
// table-config.ts
export const AGGridConfig = {
  headerSelector: '.ag-header-cell',
  rowSelector: '.ag-row',
  cellSelector: '.ag-cell',
  headerTransformer: ({ text }) => text.trim()
};

// test.spec.ts
import { AGGridConfig } from './table-config';

test('verify grid', async ({ page }) => {
  const table = useTable(page.locator('#my-grid'), AGGridConfig);
  await table.init();
});
```

## Next Steps

Now that you've configured your table, explore the API reference to see what methods are available.

[Go to API Reference >](/api/)
