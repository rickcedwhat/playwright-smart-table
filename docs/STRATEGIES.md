# Smart Table Strategies Guide

`playwright-smart-table` is designed to be highly extensible. Almost every aspect of how the table is interacted with can be customized using **Strategies**.

This guide details the available strategy interfaces and how to implement them.

## Overview of Strategies

1.  **Header Strategy**: How column names are discovered.
2.  **Pagination Strategy**: How to navigate to the next page.
3.  **Fill Strategy**: How to fill data into a row.
4.  **Sorting Strategy**: How to sort columns.
5.  **Column Strategy**: How to scroll/negotiate visibility of a column before access.
6.  *New in 3.2.0*: **Filter Strategy**: Custom logic for filtering rows.
7.  *New in 3.2.0*: **Column Resolution Strategy**: Custom logic for matching column names (e.g. Regex).

---

## 1. Header Strategy
**Purpose**: Finds the header elements and extracts their text to map column names to indices.

**Interface**:
```typescript
type HeaderStrategy = (context: StrategyContext) => Promise<string[]>;
```

**Example: Multi-row Headers**
If your table has two rows of headers and you want to combine them:
```typescript
const customHeaderStrategy: HeaderStrategy = async ({ root, config }) => {
  const headerRows = root.locator('thead tr');
  // ... logic to merge text from two rows ...
  return ['Col1', 'Col2 - Sub', 'Col2 - Sub2'];
};

useTable(loc, { headerStrategy: customHeaderStrategy });
```

---

## 2. Pagination Strategy
**Purpose**: Determines if there is a next page and performs the action to go there. Returns `true` if navigation happened, `false` if it was the last page.

**Interface**:
```typescript
type PaginationStrategy = (context: TableContext) => Promise<boolean>;
```

**Example: Clicking a "Load More" button**
```typescript
const loadMoreParams: PaginationStrategy = async ({ page }) => {
   const btn = page.getByRole('button', { name: 'Load More' });
   if (await btn.isVisible()) {
       await btn.click();
       await page.waitForTimeout(500); // Wait for content
       return true;
   }
   return false;
};
```

---

## 3. Fill Strategy
**Purpose**: Handles filling a specific cell with data. Useful for complex inputs (Date pickers, custom dropdowns).

**Interface**:
```typescript
type FillStrategy = (options: {
  row: SmartRow;
  columnName: string;
  value: any;
  /* ... others ... */
}) => Promise<void>;
```

**Example: Handling a Custom Switch**
```typescript
const customFill: FillStrategy = async ({ row, columnName, value, fillOptions }) => {
    const cell = row.getCell(columnName);
    if (columnName === 'Active') {
        const toggle = cell.locator('.toggle-switch');
        const isActive = await toggle.hasClass('on');
        if (isActive !== value) await toggle.click();
        return;
    }
    // Fallback to default
    await FillStrategies.default({ row, columnName, value, ... });
};
```

---

## 4. Column Resolution Strategy (New)
**Purpose**: Controls how a requested column name (e.g. `table.getCell('Name')`) is matched against the actual headers found (`['First Name', 'Age']`).

**Interface**:
```typescript
interface ColumnResolutionStrategy {
    resolveIndex(options: { 
        query: string | RegExp;
        headerMap: Map<string, number>;
        context: StrategyContext 
    }): number | undefined;
}
```

**Default Behavior**: 
- Exact string match.
- Regex match (first match wins).

**Usage**:
This strategy is used internally by default. To customize it, you would need to modify the library source currently, but in future versions this will be exposed in `TableConfig`.

---

## 5. Filter Strategy (New)
**Purpose**: Determines how to filter rows when using `table.getByRow({ Status: 'Active' })`.

**Interface**:
```typescript
interface FilterStrategy {
   apply(options: {
       rows: Locator;
       filter: { column: string, value: string | RegExp | number };
       colIndex: number;
       tableContext: TableContext;
   }): Locator;
}
```

**Default Behavior**:
Uses standard Playwright `.filter({ has: ... })` text matching.

---

For more examples, check the `tests/strategies.spec.ts` file in the repository.
