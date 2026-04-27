<!-- Last Reviewed: 03/07/2026 -->
# Strategies

Strategies define how the library interacts with different table implementations. They handle pagination, sorting, header scanning, cell resolution, and more.

## Strategy Types & Usage

| Strategy Type | Used By Methods | Description |
|--------------|----------------|-------------|
| **Pagination** | `findRow()`, `findRows()`, `forEach`, `map`, `filter` | Navigating to next pages |
| **Sorting** | `sorting.apply()` | Applying sort order |
| **Fill** | `row.smartFill()` | Entering data into cells |
| **Header** | `init()`, `revalidate()` | Finding and parsing column headers |
| **Cell Locator** | `getCell()`, `toJSON()` | Custom cell resolution within a row |
| **Viewport** | `getCell()`, `bringIntoView()` | Recovering rows/columns in 2D virtualized grids |

## Overview

```typescript
import { useTable, Strategies } from '@rickcedwhat/playwright-smart-table';

const table = useTable(page.locator('#table'), {
  strategies: {
    pagination: Strategies.Pagination.click({ next: '.next-btn' }),
    sorting: Strategies.Sorting.AriaSort(),
  }
});
```

---

## Pagination Strategies

Control how the library navigates through pages.

### `Strategies.Pagination.click(selectors, options?)`

Click pagination buttons (Next, Previous, First, bulk jump). The built-in strategy handles stabilization automatically.

```typescript
strategies: {
  pagination: Strategies.Pagination.click({
    next: '.pagination .next',      // required for forward navigation
    previous: '.pagination .prev',  // optional — enables bringIntoView backward nav
    first: '.pagination .first',    // optional — enables reset() auto-nav to page 1
    nextBulk: '.pagination .skip',  // optional — jumps N pages at once
  }, {
    nextBulkPages: 10,  // how many pages nextBulk advances (default: 10)
  })
}
```

Selectors can be a CSS string, a function returning a `Locator`, or a `Locator` directly.

### `Strategies.Pagination.infiniteScroll(options?)`

Handle infinite scroll tables (append-only or virtualized).

```typescript
strategies: {
  pagination: Strategies.Pagination.infiniteScroll({
    action: 'js-scroll',          // 'scroll' (mouse wheel) or 'js-scroll' (scrollTop)
    scrollAmount: 500,            // pixels per step
    scrollTarget: (root) => root, // defaults to table root
    stabilization: Strategies.Stabilization.rowCountIncreased({ timeout: 2000 })
  })
}
```

### Custom Pagination

Implement `goNext` (and optionally `goPrevious`, `goToFirst`, `goToPage`) directly as async functions. Each returns `true` if navigation succeeded, `false` if there are no more pages.

```typescript
strategies: {
  pagination: {
    goNext: async ({ root, page }) => {
      const btn = page.locator('.custom-next');
      if (await btn.isDisabled()) return false;
      await btn.click();
      return true;
    },
    goPrevious: async ({ root, page }) => {
      const btn = page.locator('.custom-prev');
      if (await btn.isDisabled()) return false;
      await btn.click();
      return true;
    },
    goToFirst: async ({ root, page }) => {
      await page.locator('.custom-first').click();
      return true;
    }
  }
}
```

> [!NOTE]
> The context object provides `{ root, page, config, resolve }`. Use `root` (not `rootLocator`) to access the table's root locator.

---

## Sorting Strategies

### `Strategies.Sorting.AriaSort()`

The built-in strategy. Clicks the column header to trigger sorting and reads the `aria-sort` attribute (`ascending`/`descending`) to detect the current state. The library handles retry logic — your `doSort` only needs to issue the click.

```typescript
strategies: {
  sorting: Strategies.Sorting.AriaSort()
}
```

### Custom Sorting

Implement `doSort` (trigger) and `getSortState` (state detection). The library calls `doSort` and then polls `getSortState` until the target state is reached (up to 3 retries).

```typescript
strategies: {
  sorting: {
    doSort: async ({ columnName, direction, context }) => {
      // Only issue the trigger — the library handles retry/verification
      const header = await context.getHeaderCell(columnName);
      await header.click();
    },
    getSortState: async ({ columnName, context }) => {
      const header = await context.getHeaderCell(columnName);
      const cls = await header.getAttribute('class') ?? '';
      if (cls.includes('sort-asc')) return 'asc';
      if (cls.includes('sort-desc')) return 'desc';
      return 'none';
    }
  }
}
```

---

## Fill Strategy

### Default (Auto-Detection)

`smartFill()` uses a built-in auto-detection strategy by default — it detects `<input>`, `<select>`, `<textarea>`, checkbox, and `contenteditable` elements automatically. No configuration needed in most cases.

```typescript
await row.smartFill({
  Name: 'John',        // fills <input type="text">
  Status: 'Active',    // selects <option> in <select>
  Active: true,        // checks/unchecks <input type="checkbox">
  Notes: 'Some text'  // fills <textarea>
});
```

### Custom Fill via `columnOverrides.write`

For cells with nonstandard input widgets (e.g., a rich-text editor, a date picker with a custom popover), define a `write` handler in `columnOverrides`:

```typescript
columnOverrides: {
  Tags: {
    write: async ({ cell, targetValue }) => {
      // e.g. a tag input: type and press Enter
      await cell.locator('.tag-input').click();
      await cell.page().keyboard.type(targetValue);
      await cell.page().keyboard.press('Enter');
    }
  },
  Price: {
    write: async ({ cell, targetValue, currentValue }) => {
      // currentValue is automatically provided when `read` is also defined
      if (currentValue === targetValue) return;
      await cell.locator('input').fill(String(targetValue));
    }
  }
}
```

### Custom Fill via `inputMappers`

For one-off overrides at call time (without modifying config), use `inputMappers` in the `smartFill` call:

```typescript
await row.smartFill(
  { Name: 'John' },
  {
    inputMappers: {
      // Target a specific input inside the cell
      Name: (cell) => cell.locator('.primary-input')
    }
  }
);
```

---

## Header Strategy

### Default

The default strategy reads visible `thead th` text (or whatever `headerSelector` resolves to) using `innerText`.

### Custom Header Strategy

Provide a function that returns `Promise<string[]>`. The array must be in DOM order (index 0 = first column).

```typescript
strategies: {
  header: async ({ root, resolve, config }) => {
    // Example: read from aria-label attributes instead of text
    const headers = await resolve(config.headerSelector, root).all();
    return Promise.all(
      headers.map(h => h.getAttribute('aria-label').then(v => v ?? ''))
    );
  }
}
```

---

## Cell Locator Strategy

### Default

The default strategy resolves cells using `.nth(columnIndex)` on the `cellSelector` within a row.

### Custom Cell Locator

When the DOM doesn't use predictable nth-child ordering (e.g. horizontally virtualized grids using `aria-colindex`), provide a `getCellLocator` function:

```typescript
strategies: {
  getCellLocator: ({ row, columnName, columnIndex, root, page, config }) => {
    // e.g. react-data-grid with aria-colindex attributes
    return row.locator(`[aria-colindex="${columnIndex}"]`);
  }
}
```

The function receives `{ row, root, columnName, columnIndex, rowIndex?, page, config }` and returns a `Locator`.

---

## Viewport Strategy

Viewport strategies help with 2D virtualized grids where rows and columns are both mounted only when visible. They let the cell-reading engine detect what is currently in the DOM and jump directly to the target row or column when scrolling one axis causes the other axis to unmount.

### `Strategies.Viewport.dataAttribute(options?)`

Use this when row and cell elements expose their indexes through DOM attributes.

```typescript
strategies: {
  viewport: Strategies.Viewport.dataAttribute({
    scrollContainer: '.grid-scroll-container',
    rowAttribute: 'data-index',
    columnAttribute: 'data-index'
  })
}
```

For ARIA grids, account for 1-based indexes:

```typescript
strategies: {
  viewport: Strategies.Viewport.dataAttribute({
    rowAttribute: 'aria-rowindex',
    columnAttribute: 'aria-colindex',
    rowOffset: 1,
    columnOffset: 1
  })
}
```

### Custom Viewport Strategy

Provide any combination of range oracles and scroll primitives:

```typescript
strategies: {
  viewport: {
    getVisibleRowRange: async ({ root }) => ({ first: 0, last: 20 }),
    getVisibleColumnRange: async ({ root }) => ({ first: 0, last: 8 }),
    scrollToRow: async ({ root }, rowIndex) => {
      await root.evaluate((el, index) => {
        el.querySelector(`[data-row-index="${index}"]`)?.scrollIntoView();
      }, rowIndex);
    },
    scrollToColumn: async ({ root }, columnIndex) => {
      await root.evaluate((el, index) => {
        el.querySelector(`[data-column-index="${index}"]`)?.scrollIntoView();
      }, columnIndex);
    }
  }
}
```

---

## Complete Example

```typescript
import { useTable, Strategies } from '@rickcedwhat/playwright-smart-table';

const table = useTable(page.locator('#complex-table'), {
  headerSelector: 'thead th',
  rowSelector: 'tbody tr',

  strategies: {
    pagination: Strategies.Pagination.click({
      next: '.pagination .next',
      previous: '.pagination .prev',
      first: '.pagination .first',
    }),

    sorting: Strategies.Sorting.AriaSort(),

    getCellLocator: ({ row, columnIndex }) =>
      row.locator(`[data-column-index="${columnIndex}"]`),
  },

  columnOverrides: {
    Status: {
      read: async (cell) => {
        return (await cell.locator('input[type="checkbox"]').isChecked())
          ? 'Active' : 'Inactive';
      },
      write: async ({ cell, targetValue }) => {
        const checkbox = cell.locator('input[type="checkbox"]');
        if ((await checkbox.isChecked()) !== (targetValue === 'Active')) {
          await checkbox.click();
        }
      }
    }
  }
});

await table.init();
```

## Next Steps

See how these strategies are applied in real-world scenarios.

[Go to Examples >](/examples/)
