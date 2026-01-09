# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

