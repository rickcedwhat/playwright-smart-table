# 🚧 Roadmap (v2.2+)
# 🚧 Roadmap


This document tracks the strategic direction, planned features, and development priorities for the Smart Table library.

> **Note**: All implementations are tentative. Features may be modified, re-prioritized, or removed based on community feedback and development constraints.

---


## 🎯 High Priority


### Feature: Sorting & Sort Assertions




**Priority**: High  
**Status**: Planned  
**Target Version**: Next Minor Release


**Goal**: Introduce robust, extensible sorting capabilities to the `useTable` helper, allowing users to both perform and validate sorting operations on table columns.



**Description**:
This feature will add a new `sorting` strategy to the table configuration, allowing for customized sorting logic. It will also introduce assertion methods to verify the sort state of a column.


















**API & Implementation Details**:
- **New `SortingStrategy` Interface**: Define a new strategy interface for sorting.
  ```typescript
  interface SortingStrategy {
    doSort(columnName: string, direction: 'asc' | 'desc'): Promise<void>;
    getSortState(columnName:string): Promise<'asc' | 'desc' | 'none'>;
  }
  ```
- **Evolve `useTable` API for Clarity**:
  - **Introduce `SortingStrategy`**: A new `sorting` property will be added to the `useTable` config to accept a `SortingStrategy`.
  - **Rename for Semantic Clarity**: The existing `TableStrategies` object will be renamed to `PaginationStrategies` to accurately reflect its purpose.
  - **Ensure Backward Compatibility**: A `TableStrategies` constant will be kept as a deprecated alias pointing to `PaginationStrategies`, ensuring no breaking changes for existing users. This allows for a graceful migration.
- **New Namespaced API**: A `sorting` property will be added to the `TableResult`, providing a clean namespace for sorting actions (`table.sorting.apply(...)`) and assertions (`table.sorting.getState(...)`).
  ```typescript
  // Example Usage
  const table = useTable(locator, { sorting: SortingStrategies.AriaSort });
  await table.sorting.apply('User', 'asc');
  expect(await table.sorting.getState('User')).toBe('asc');
  ```








---


## 🚀 Medium Priority


### Initiative: Enhanced Test Coverage

**Priority**: Medium  
**Status**: Planned  

**Target Version**: Ongoing


**Goal**: Increase test coverage to ensure library robustness, prevent regressions, and validate the functionality of all core features and strategies.



**Tasks**:
- **Unit Tests**: Add unit tests for the core `useTable` logic, ensuring it can be tested independent of a browser environment.
- **Integration Tests**: Create integration tests for each default pagination and sorting strategy to validate real-world behavior.
- **Edge Case Testing**: Implement tests for known edge cases, including:
  - Empty tables (no rows)
  - Tables with no `<thead>`
  - Tables with `colspan` or `rowspan` attributes
  - Rows with missing cells





---

## 🛠️ Low Priority

### Feature: `auditPages` - Multi-Page Verification

**Priority**: Low  
**Status**: Planned  
**Target Version**: Future Release

**Goal**: Provide a utility method to walk through every page of a table and run a verification or audit function, useful for end-to-end data integrity checks.

**Proposed API**:
```typescript
await table.auditPages({
  maxPages: 10,
  audit: async (rows: SmartRow[], page: number) => {





    // Custom verification logic for each page
  }
});
```











### Feature: Table Scraping with Deduplication











**Priority**: Low  
**Status**: Planned  

**Target Version**: Future Release


**Goal**: Scrape table data from tables with dynamic or infinite scrolling, handling the deduplication of rows that may appear multiple times as new data loads.










**Proposed API**:
```typescript
const allData = await table.scrapeAllRows({
  uniqueKey: 'ID', // Column to use for deduplication




});

```






### Initiative: Developer Experience Improvements

**Priority**: Low  
**Status**: Planned  
**Target Version**: Ongoing

**Goal**: Make the codebase easier for contributors to understand and maintain.

**Tasks**:
- **Clarify Type Generation**: Add detailed comments to the top of `src/types.ts` and `src/typeContext.ts` explaining their relationship and the `npm run generate-docs` build process.
- **Review JSDoc**: Audit all public-facing JSDoc comments for clarity, accuracy, and completeness.

---

## ✅ Recently Completed

### `fill` - Intelligent Row Data Entry

**Status**: ✅ Implemented in v2.2.0

**Description**: A `row.fill()` method to populate form fields within a table row. The feature intelligently detects and interacts with various input types (text inputs, selects, checkboxes) without requiring explicit selector configuration.

---

## Version History




- **v2.2.0**: Added `fill()` method to SmartRow for intelligent row data entry, enhanced error messages.
- **v2.1.3**: Enhanced documentation with type references, headerTransformer examples.
- **v2.1.2**: Core table functionality, pagination strategies, SmartRow pattern.

---

## Contributing

If you're interested in implementing any of these features or have suggestions for improvements, please:




1. Open an issue to discuss the approach.
2. Submit a pull request with your implementation.
3. Include tests and documentation updates.
