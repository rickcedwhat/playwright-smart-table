# Implementation Plan: Enhancing Table APIs and Debuggability

This plan addresses several open issues from the project's backlog to improve API ergonomics and robustness:
1. **#89: Add table.countRows() helper method**
2. **#84: Add first-class mapColumn / getColumnValues helper**
3. **#43: Wrap getCell() with SmartCell (Locator + bringIntoView)**
4. **#82: Targeted error on navigation failure instead of generic locator timeout**

## User Review Required
Please review the finalized plan details below. Let me know if everything looks good, and I will begin execution!

## Proposed Changes

### `src/types.ts`
Modify the core types to include the new methods and `SmartCell`.

#### [MODIFY] src/types.ts
- Add `SmartCell` interface: `export type SmartCell = Locator & { bringIntoView(): Promise<void>; }`.
- Update `SmartRow.getCell(column: string)` to return `SmartCell`.
- Add `countRows(options?: { exact?: boolean }) => Promise<number>` to `TableResult`. (We'll keep this strictly async. In JS/TS, mixing synchronous and asynchronous return types based on parameters is an anti-pattern. Plus, Playwright's `.count()` is async anyway!)
- Add `mapColumn<R = unknown>(columnName: string, options?: RowIterationOptions) => Promise<R[]>` to `TableResult`.
- Add `getColumnValues(columnName: string, options?: RowIterationOptions) => Promise<string[]>` to `TableResult`.

---

### `src/smartRow.ts`
Implement `SmartCell` and throw targeted errors on navigation failure.

#### [MODIFY] src/smartRow.ts
- In `smart.getCell(colName)`, we will build `SmartCell` using the same object-assignment approach as `SmartRow` to avoid Proxy overhead and perfectly preserve Playwright `Locator` compatibility. We will cast the locator to `SmartCell` and attach `bringIntoView`.
- In `SmartCell.bringIntoView()`, we will reuse `_navigateToCell` for that specific column to bring the single cell into view.
- In `_navigateToCell`, if navigation fails (i.e. falls through and `targetReached` is false, or navigation strategy is missing/exhausted), we will throw a structured, targeted Error indicating exactly which column/row failed and the visibility state, rather than returning `null`. This fixes the generic timeout issue (#82).

---

### `src/useTable.ts`
Implement `countRows`, `mapColumn`, and `getColumnValues`.

#### [MODIFY] src/useTable.ts
- Implement `countRows`:
  ```typescript
  countRows: async () => {
    await _autoInit();
    return resolve(config.rowSelector, rootLocator).count();
  }
  ```
- Implement `mapColumn`:
  ```typescript
  mapColumn: async (columnName, options = {}) => {
    return result.map(async ({ row }) => {
      const cell = row.getCell(columnName);
      // Wait for it to be mounted and in view (single-cell navigation)
      await cell.bringIntoView();
      // Apply columnOverrides if any
      const columnOverride = config.columnOverrides?.[columnName as keyof T];
      if (columnOverride?.read) return await columnOverride.read(cell);
      
      const text = await cell.innerText();
      return (text || '').trim();
    }, options);
  }
  ```
- Implement `getColumnValues` as a wrapper around `mapColumn` that automatically coerces all results to strings (the most common use-case).

## Verification Plan

### Automated Tests
- Create or update existing tests in `tests/` to verify `table.countRows()`, `table.getColumnValues('Region')`, and `row.getCell('Region').bringIntoView()`.
- Add a test that deliberately fails cell navigation to verify the structured Error matches #82.

### Manual Verification
- We will run the Playwright test suite to ensure backwards compatibility with existing methods, particularly testing that `SmartCell` still behaves identically to a native Playwright `Locator`.
