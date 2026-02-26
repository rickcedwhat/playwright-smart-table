<!-- Last Reviewed: 02/06/2026 -->
# Strategies

Strategies define how the library interacts with different table implementations. They handle pagination, sorting, filling, and more.

## Strategy Types & Usage

| Strategy Type | Used By Methods | Description |
|--------------|----------------|-------------|
| **Pagination** | `findRow()`, `findRows()`, `forEach`, `map` | Navigating to next pages |
| **Sorting** | `sorting.apply()` | applying sort order |
| **Fill** | `row.smartFill()` | Entering data into cells |
| **Header** | `init()`, `revalidate()` | Finding and parsing column headers |
| **Resolution** | `getCell()` | Locating specific cells within a row |

## Overview

```typescript
import { useTable, Strategies } from '@rickcedwhat/playwright-smart-table';

const table = useTable(page.locator('#table'), {
  strategies: {
    pagination: Strategies.Pagination.ClickNext('.next-btn'),
    sorting: Strategies.Sorting.AriaSort(),
    fill: Strategies.Fill.ClickAndType()
  }
});
```

## Pagination Strategies

Control how the library navigates through pages.

### ClickNext

Click a "Next" button to navigate to the next page.

```typescript
Strategies.Pagination.ClickNext(selector: string | Locator)
```

**Example:**

```typescript
strategies: {
  pagination: Strategies.Pagination.ClickNext('.pagination .next')
}
```

### ClickPageNumber

Click specific page numbers.

```typescript
Strategies.Pagination.ClickPageNumber(options: {
  pageNumberSelector: string | ((page: number) => Locator),
  currentPageSelector?: string
})
```

**Example:**

```typescript
strategies: {
  pagination: Strategies.Pagination.ClickPageNumber({
    pageNumberSelector: (page) => 
      page.locator(`.pagination button:has-text("${page}")`)
  })
}
```

### InfiniteScroll

Handle infinite scroll tables.

```typescript
Strategies.Pagination.InfiniteScroll(options?: {
  scrollContainer?: Locator,
  waitForNewRows?: number
})
```

**Example:**

```typescript
strategies: {
  pagination: Strategies.Pagination.InfiniteScroll({
    scrollContainer: page.locator('.table-container'),
    waitForNewRows: 500
  })
}
```

### Custom Pagination

Create your own pagination logic:

```typescript
strategies: {
  pagination: async ({ page, rootLocator }) => {
    // Your custom logic
    const nextBtn = page.locator('.custom-next');
    
    if (await nextBtn.isDisabled()) {
      return false; // Stop pagination
    }
    
    await nextBtn.click();
    await page.waitForLoadState('networkidle');
    
    return true; // Continue pagination
  }
}

> [!NOTE]
> Return `true` if a new page was loaded successfully, or `false` if there are no more pages.
```

---

## Sorting Strategies

Define how sorting is applied.

### ClickHeader

Click column headers to sort.

```typescript
Strategies.Sorting.ClickHeader(options?: {
  detectState?: (header: Locator) => Promise<'asc' | 'desc' | null>
})
```

**Example:**

```typescript
strategies: {
  sorting: Strategies.Sorting.AriaSort()
}
```

### Custom Sorting

```typescript
strategies: {
  sorting: {
    apply: async ({ columnName, direction, page }) => {
      // Custom sort logic
      await page.locator(`[data-sort="${columnName}"]`).click();
    },
    getState: async ({ page }) => {
      // Return current sort state
      return { column: 'Name', direction: 'asc' };
    }
  }
}
```

---


## Fill Strategies

Control how cells are filled.

### ClickAndType

Click cell, clear, and type (default).

```typescript
Strategies.Fill.ClickAndType(options?: {
  clearFirst?: boolean,
  pressEnter?: boolean
})
```

**Example:**

```typescript
strategies: {
  fill: Strategies.Fill.ClickAndType({
    clearFirst: true,
    pressEnter: true
  })
}
```

### DoubleClickAndType

Double-click to enter edit mode.

```typescript
Strategies.Fill.DoubleClickAndType(options?: {
  clearFirst?: boolean
})
```

### Custom Fill

```typescript
strategies: {
  fill: async ({ cell, value, columnName }) => {
    // Custom fill logic
    await cell.dblclick();
    await cell.locator('input').fill(value);
    await cell.press('Enter');
  }
}
```

---

## Header Strategies

Customize header detection.

### Default

Standard `thead th` selector.

### Custom

```typescript
strategies: {
  header: async ({ rootLocator }) => {
    // Return array of header locators
    return rootLocator.locator('.custom-header').all();
  }
}
```

---

## Resolution Strategies

Control how cells are resolved within rows.

### NthChild

Use nth-child selectors (default).

```typescript
Strategies.Resolution.NthChild()
```

### DataAttribute

Use data attributes to find cells.

```typescript
Strategies.Resolution.DataAttribute('data-column')
```

**Example:**

```typescript
// HTML: <td data-column="email">...</td>
strategies: {
  resolution: Strategies.Resolution.DataAttribute('data-column')
}
```

### Custom Resolution

```typescript
strategies: {
  getCellLocator: ({ row, columnName, columnIndex }) => {
    // Custom cell resolution
    return row.locator(`[data-col="${columnName}"]`);
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
    // Pagination
    pagination: Strategies.Pagination.ClickNext('.pagination .next'),
    
    // Sorting
    sorting: Strategies.Sorting.AriaSort(),
    
    // Fill
    fill: Strategies.Fill.DoubleClickAndType({
      clearFirst: true
    }),
    
    // Custom resolution
    getCellLocator: ({ row, columnName }) => {
      return row.locator(`[data-column="${columnName}"]`);
    }
  }
});

await table.init();
```

## Next Steps

See how these strategies are applied in real-world scenarios.

[Go to Examples >](/examples/)
