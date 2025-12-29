# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

