# Plugin Development Guide 🧩

In v5, `playwright-smart-table` has adopted a lean core philosophy. While we provide essential strategies for standard tables, we encourage creating custom plugins for complex grids (like AG-Grid, Glide, or custom virtual lists).

This guide shows you how to build robust, reusable strategies.

## Core Concepts

All strategies receive a `TableContext` object:

```typescript
export interface TableContext {
  root: Locator;           // The root element of the table
  config: FinalTableConfig;// The full table configuration
  page: Page;              // The Playwright Page object
  resolve: (selector: Selector, parent: Locator | Page) => Locator; // Helper to resolve selectors
}
```

## 1. Pagination Strategies

A pagination strategy is responsible for moving to the next page of data.

**Signature:**
```typescript
type PaginationStrategy = (context: TableContext) => Promise<boolean>;
```

**Return Value:**
- `true`: Pagination succeeded (moved to next page).
- `false`: End of data reached (no next page).

**Example: Clicking a specific "Load More" button**

```typescript
import type { PaginationStrategy } from '@rickcedwhat/playwright-smart-table';

export const clickLoadMore = (buttonSelector: string): PaginationStrategy => {
  return async ({ root, page }) => {
    const btn = root.locator(buttonSelector);
    
    // Check if button exists and is enabled
    if (await btn.count() === 0 || !(await btn.isEnabled())) {
      return false; // No more pages
    }

    // Capture state before click (e.g., number of rows)
    const rowCountBefore = await root.locator('tbody tr').count();

    await btn.click();
    
    // Wait for effect (e.g., row count increase)
    await page.waitForFunction(
      (count) => document.querySelectorAll('tbody tr').length > count,
      rowCountBefore
    );

    return true; // Successfully loaded more
  };
};
```

## 2. Fill Strategies

A fill strategy defines how `smartFill` interacts with input fields.

**Signature:**
```typescript
type FillStrategy = (args: { 
  row: SmartRow; 
  data: Record<string, any>; 
  options?: FillOptions 
}) => Promise<void>;
```

**Example: Custom Date Picker Interaction**

If your table uses a complex date picker that `smartFill` doesn't handle natively:

```typescript
import type { FillStrategy } from '@rickcedwhat/playwright-smart-table';

export const customFill: FillStrategy = async ({ row, data, options }) => {
  for (const [column, value] of Object.entries(data)) {
    const cell = row.getCell(column);
    
    // Custom handling for 'Date' column
    if (column === 'Date') {
      await cell.click(); // Open picker
      await row.page().locator('.date-picker-day', { hasText: String(value) }).click();
      continue; // Skip default handling
    }

    // Fallback to default logic for other columns?
    // You might need to implement standard filling here or compose strategies.
    const input = cell.locator('input');
    await input.fill(String(value));
  }
};
```

## 3. Header Strategies

Strategies to find and parse column headers.

**Signature:**
```typescript
type HeaderStrategy = (context: TableContext) => Promise<string[]>;
```

**Example: Parsing complex usage of `aria-label`**

```typescript
export const ariaHeaderStrategy: HeaderStrategy = async ({ root, config, resolve }) => {
  const headers = await resolve(config.headerSelector, root).all();
  return Promise.all(headers.map(h => h.getAttribute('aria-label') || h.innerText()));
};
```

## Best Practices

1. **Use `resolve`**: Always use the `resolve` helper from context instead of `page.locator()` when finding elements inside the table. It handles the `Selector` type (string vs function) correctly.
2. **Wait for Stability**: Pagination strategies should wait for the table to stabilize (Spinner to disappear, row count to change) before returning `true`.
3. **Return False**: Ensure your pagination strategy clearly returns `false` when it's logically impossible to go further (button disabled, end of list).
4. **Type Safety**: Import types from `@rickcedwhat/playwright-smart-table` to ensure your plugins comply with the interface.

## Sharing Plugins

If you build a strategy for a popular library (like Material UI v6, TanStack Table v9), consider contributing it back to the core library or publishing it as a separate package!
