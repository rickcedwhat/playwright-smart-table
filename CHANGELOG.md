# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).



## [6.2.0] - 2026-02-14

### ⚡ Smart Initialization
- **New Feature**: Tables now intelligently handle "progressive loading" (when headers load one by one).
- **Strategy**: Added `isHeaderLoading` to `LoadingStrategies`.
- **Logic**: `TableMapper` now retries mapping if headers are detected as unstable/loading.

### 🧠 Smarter Fuzzy Matching
- **Refinement**: `levenshteinDistance` now weights case mismatches as **0.1** edits (instead of 1.0).
- **Result**: "Firstname" is now considered a ~97% match for "First Name", prioritizing it over other typos.

### 🧪 Unit Testing Framework
- **New Infrastructure**: Added `vitest` for robust unit testing of core logic.
- **Coverage**: Added unit tests for:
  - `stringUtils` (Fuzzy matching, Levenshtein)
  - `resolution` (Column name resolution)
  - `TableMapper` (Header mapping logic)
  - `FilterEngine` (Row filtering logic)
- **CI**: `npm test` now runs both Unit Tests (Vitest) and E2E Tests (Playwright).

### ♻️ Internal Refactoring
- **Modularization**: Split the monolithic `useTable.ts` into dedicated engines:
  - `TableMapper`: Handles header discovery and mapping.
  - `RowFinder`: Handles row searching and pagination.
  - `FilterEngine`: Handles filter application.
- **Type Safety**: Standardized `SmartRowArray` usage throughout the codebase.

## [6.1.0] - 2026-02-11

### ⚠️ Breaking Changes
- **`getRowByIndex` is now 0-indexed** for consistency with JavaScript arrays.
  - **Before**: `table.getRowByIndex(1)` returned the first row.
  - **After**: `table.getRowByIndex(0)` returns the first row.
  - **Migration**: Subtract 1 from all `getRowByIndex` calls.

## [6.0.1] - 2026-02-10

### 🐛 Fixed
- **Publishing**: Bumped version to ensure all v6.0.0 features (`seenHeaders`, `autoFlatten`) are correctly propagated to npm and clear any potential caching issues.

## [6.0.0] - 2026-02-08

### 🚀 Major Changes

#### Unified Pagination & Stabilization Architecture
- **NEW**: `StabilizationStrategy` pattern.
  - Strategies now **wrap** the action (click/scroll) to capture state *before* and *after*, eliminating race conditions on fast tables.
  - `Strategies.Stabilization.contentChanged({ scope: 'all' })` - Robust fingerprinting for virtualized tables.
  - `Strategies.Stabilization.rowCountIncreased()` - Standard check for append-only tables.
- **NEW**: Unified `infiniteScroll` strategy.
  - Merged "Simple" and "Virtualized" logic into a single factory.
  - Configurable `action` ('scroll' vs 'js-scroll') and `stabilization` (content vs count).

#### Interactive Playground
- **NEW**: Included a `react-virtuoso` based playground in `/playground` for testing complex virtualization scenarios.
- Used to verify the library against infinite scroll, stuttering networks, and "deep scrolling" (100k+ rows).

### ✨ Added
- **Strategies**: `Strategies.Loading` module for defining `isTableLoading` / `isRowLoading`.
- **Developer Experience**:
  - `headerTransformer` now receives `seenHeaders: Set<string>` for easier deduplication.
  - `getHeaders()` and `getHeaderCell()` now **auto-initialize** the table (no more "Table not initialized" errors for simple lookups).
- **Config**: "Strict Mode" configuration option.

### 🔄 Changed
- **BREAKING**: `StabilizationStrategy` signature changed to `(context, action) => Promise<boolean>`.
- **BREAKING**: `Strategies.Pagination.virtualizedInfiniteScroll` is removed. Use `infiniteScroll({ action: 'js-scroll', stabilization: contentChanged() })`.
- **Internal**: `useTable` iteration loop refactored to support new stabilization pattern.

### 🧪 Testing
- **New Test Suite**: `tests/playground-virtualization.spec.ts` (30+ new tests).
- Verified compatibility with **Glide Data Grid** and **React Data Grid**.
- 97/97 tests passing.

---

## [5.0.0] - 2026-01-22

### 🚀 Major Changes

#### API Simplification & Consistency
- **BREAKING**: Method naming standardized for clarity
  - `getByRow()` → `getRow()` - Removed `By` for consistency
  - `getByRowIndex()` → `getRowByIndex()` - Clearer "by index" phrasing
  - `getAllCurrentRows()` → `getRows()` - Simpler, shorter
  - `searchForRow()` → `findRow()` - Clearer intent
- **BREAKING**: Removed `fill()` from SmartRow - use `smartFill()` only
- **BREAKING**: Removed `getRequestIndex()` from public API (internal use only)

#### Clear Naming Pattern
**New mental model:**
- `get*()` - Sync or async, current page only (fast)
- `find*()` - Async, searches across pages (uses pagination)

**Examples:**
- `getRow()` - Sync, current page
- `getRowByIndex()` - Sync, current page
- `getRows()` - Async, current page
- `findRow()` - Async, paginated search
- `findRows()` - Async, all matching rows across pages

#### Removed Deprecated Code
- **BREAKING**: Removed `getAllRows()` (was deprecated in v3.x)
- **BREAKING**: Removed `generateStrategyPrompt()` (use `generateConfigPrompt()` or plugin docs)
- **BREAKING**: Removed `DeprecatedTableStrategies` exports
- **BREAKING**: Removed specialized strategies (moved to examples):
  - `Strategies.Header.scrollRight` → See `examples/glide-strategies/`
  - `Strategies.Column.keyboard` → See `examples/glide-strategies/`

#### Strategy Validation
- **NEW**: Runtime validation for pagination strategies
- Catches common mistakes (returning `undefined` instead of `boolean`)
- Clear error messages guide users to fix issues
- Prevents infinite loops from malformed strategies

### ✨ Added

- `findRows()` - Find all matching rows across pages (symmetric with `findRow()`)
- `isInitialized()` - Check if table has been initialized
- Strategy validation with helpful error messages
- Method comparison table in README
- Comprehensive JSDoc comments for JavaScript users
- Examples directory with Glide-specific strategies

### 🔄 Changed

- **BREAKING**: All method names updated for consistency (see above)
- **BREAKING**: `smartFill()` is now the only fill method on SmartRow
- Error messages improved to suggest async alternatives
- README completely rewritten with:
  - Method comparison table
  - Clear sync vs async distinction
  - Hook timing documentation (`onFirst`, `onLast`)
  - Comprehensive `iterateThroughTable` examples

### 🗑️ Removed

- **BREAKING**: `getAllRows()` - Use `getRows()` instead
- **BREAKING**: `generateStrategyPrompt()` - Use `generateConfigPrompt()` or see plugin docs
- **BREAKING**: `fill()` from SmartRow - Use `smartFill()` instead
- **BREAKING**: `getRequestIndex()` from SmartRow - Internal use only
- **BREAKING**: Specialized strategies - See `examples/` directory

### 📚 Documentation

- Complete README rewrite with v5 API
- Method comparison table showing async/sync and pagination behavior
- Hook timing clarification (onFirst runs before first page, onLast runs after last page)
- Plugin development guide for custom strategies
- Comprehensive examples for `iterateThroughTable()`

### 🔧 Migration from v4.x

**Method Renames:**
```typescript
// ❌ v4.x
const row = table.getByRow({ Name: 'John' });
const rows = await table.getAllCurrentRows();
const found = await table.searchForRow({ Name: 'John' });

// ✅ v5.0
const row = table.getRow({ Name: 'John' });
const rows = await table.getRows();
const found = await table.findRow({ Name: 'John' });
```

**SmartRow Changes:**
```typescript
// ❌ v4.x
await row.fill({ Name: 'John' });
const index = row.getRequestIndex();

// ✅ v5.0
await row.smartFill({ Name: 'John' });
// getRequestIndex removed (was internal only)
```

**Removed Methods:**
```typescript
// ❌ v4.x
await table.getAllRows(); // Deprecated
await table.generateStrategyPrompt();

// ✅ v5.0
await table.getRows(); // Use this instead
await table.generateConfigPrompt(); // Or see plugin docs
```

### 🧪 Testing

- All 63 tests passing
- Updated all tests to use new API
- Added compatibility tests for method existence
- Verified all examples work with new naming

---

## [4.0.0] - 2026-01-09

### 🚀 Major Changes

#### Strategy Consolidation
- **BREAKING**: All strategy imports consolidated under `Strategies` object
  - `PaginationStrategies.X` → `Strategies.Pagination.X`
  - `SortingStrategies.X` → `Strategies.Sorting.X`
  - `HeaderStrategies.X` → `Strategies.Header.X`
  - `ColumnStrategies.X` → `Strategies.Column.X`
- Individual strategy exports maintained for backward compatibility (deprecated)

#### Generic Type Support
- **NEW**: `useTable<T>()` now accepts generic type parameter for type-safe row data
- `SmartRow.toJSON()` returns `Promise<T>` instead of `Promise<Record<string, string>>`
- `getByRow()` and `searchForRow()` accept `Partial<T>` for filters
- Full type inference throughout the API

#### New Methods
- **NEW**: `table.revalidate()` - Refresh column mappings without resetting pagination state
- Useful when table columns change dynamically (visibility, reordering)

### ✨ Added

- `Strategies` unified export object containing all strategy types
- Generic type parameter `<T>` for `useTable`, `SmartRow`, and `TableResult`
- `revalidate()` method for refreshing table structure
- 3 new tests for RowType generic support

### 🔄 Changed

- **BREAKING**: Import path for strategies changed to use `Strategies` object
- Strategy organization improved for better discoverability
- Type definitions enhanced with generic support

### 📚 Documentation

- Added AI-optimized migration guide (MIGRATION_v4.md)
- Updated all examples to use `Strategies` object
- Added TypeScript generic usage examples
- Documented `revalidate()` method

### 🔧 Migration Guide

See [MIGRATION_v4.md](./MIGRATION_v4.md) for detailed AI-assisted migration instructions.

**Quick Reference:**
```typescript
// Before (v3.2)
import { PaginationStrategies } from '../src/useTable';
strategies: {
  pagination: PaginationStrategies.clickNext(...)
}

// After (v4.0)
import { Strategies } from '../src/strategies';
strategies: {
  pagination: Strategies.Pagination.clickNext(...)
}

// Optional: Add type safety
interface User { Name: string; Email: string; }
const table = useTable<User>(locator, config);
const data = await row.toJSON(); // Type: User
```

### 🧪 Testing

- All 66 tests passing (consolidated from 69)
- Added 3 RowType generic tests
- Consolidated test files for better organization

---

## [3.1.0] - 2024-12-XX

### 🚀 Major Changes

#### API Simplification
- **BREAKING**: Removed `asJSON` option from `getByRow()` and `searchForRow()` - use `.toJSON()` method directly
- **BREAKING**: Renamed `getByRowAcrossPages()` to `searchForRow()` for better clarity (works with any strategy, not just pagination)

#### Lazy Initialization API
- **BREAKING**: `getByRow()` is now **synchronous** (was async in 2.x)
- **NEW**: `init()` method must be called before using synchronous methods
- **NEW**: `searchForRow()` - async method for finding rows across all available data using configured strategy
- Auto-initialization only happens for async methods (e.g., `searchForRow`, `getAllRows`)

#### New Feature: `iterateThroughTable()`
- Iterate through paginated table data with full control
- Automatic callback return value accumulation
- Optional deduplication via `dedupeStrategy`
- Custom hooks: `onFirst`, `onLast`
- Flexible iteration control: `getIsFirst`, `getIsLast`
- Restricted table context to prevent problematic nested calls

### ✨ Added

- `table.init(options?: { timeout?: number })` - Explicit initialization method
- `table.searchForRow()` - Find rows across all available data using configured strategy (async, auto-initializes)
- `table.iterateThroughTable()` - Iterate through paginated data with callbacks
- `DedupeStrategy` type for row deduplication
- `RestrictedTableResult` type for safe table access within iteration callbacks

### 🔄 Changed

- **BREAKING**: `getByRow()` is now synchronous - returns `SmartRow` immediately (no `await`)
- **BREAKING**: `getByRow()` throws error if table is not initialized
- **BREAKING**: Removed `asJSON` option from `getByRow()` - use `row.toJSON()` instead
- **BREAKING**: Removed `asJSON` option from `searchForRow()` - use `row.toJSON()` instead
- **BREAKING**: `getByRowAcrossPages()` renamed to `searchForRow()` for clarity
- **BREAKING**: All sync methods require `await table.init()` first
- Async methods (`searchForRow`, `getAllRows`, `getColumnValues`, etc.) auto-initialize
- Terminology updated: "first page" → "current page" for accuracy

### 🐛 Fixed

- Fixed lazy loading issues where table operations failed when table didn't exist yet
- Improved error messages for uninitialized table usage

### 📚 Documentation

- Added comprehensive examples for `iterateThroughTable()`:
  - Basic iteration
  - Deduplication with infinite scroll
  - Using hooks and custom logic
- Updated all examples to use new `init()` API
- Updated terminology throughout documentation

### 🔧 Migration Guide

#### Upgrading from 2.x to 3.0.0

**Before (2.x):**
```typescript
const table = useTable(page.locator('#example'));
const row = await table.getByRow({ Name: 'John' }); // async
const data = await table.getByRow({ Name: 'John' }, { asJSON: true }); // get JSON directly
```

**After (3.1.0):**
```typescript
const table = useTable(page.locator('#example'));
await table.init(); // Initialize first
const row = table.getByRow({ Name: 'John' }); // sync - no await needed
const data = await row.toJSON(); // call toJSON() method
```

**For searching across all data:**
```typescript
// Old way (2.x) - getByRow would paginate automatically
const row = await table.getByRow({ Name: 'John' });
const data = await table.getByRow({ Name: 'John' }, { asJSON: true });

// New way (3.1.0) - explicit method for searching
const row = await table.searchForRow({ Name: 'John' });
const data = await row.toJSON();
```

**One-liner initialization:**
```typescript
const table = await useTable(page.locator('#example')).init();
```

### 🧪 Testing

- All 50+ existing tests updated for new API
- Added 8 new tests for `iterateThroughTable()` functionality
- Added tests for lazy initialization behavior
- Added tests for sync vs async method behavior

---

## [3.0.0] - 2024-12-XX

### 🚀 Major Changes

#### Lazy Initialization API
- **BREAKING**: `getByRow()` is now **synchronous** (was async in 2.x)
- **NEW**: `init()` method must be called before using synchronous methods
- **NEW**: `getByRowAcrossPages()` - async method for finding rows across multiple pages with pagination
- Auto-initialization only happens for async methods

#### New Feature: `iterateThroughTable()`
- Iterate through paginated table data with full control
- Automatic callback return value accumulation
- Optional deduplication via `dedupeStrategy`
- Custom hooks: `onFirst`, `onLast`
- Flexible iteration control: `getIsFirst`, `getIsLast`
- Restricted table context to prevent problematic nested calls

---

## [2.3.1] - Previous Version

See git history for previous changelog entries.

