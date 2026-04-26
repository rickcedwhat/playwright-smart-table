# Changelog

## [6.10.0] - 2026-04-26

### Added
- **Viewport strategies for 2D virtualized grids** — `TableStrategies.viewport` can report visible row/column ranges and jump directly to target rows or columns, helping `SmartRow.getCell()` recover when horizontal scrolling knocks the target row out of the DOM.
- **`Strategies.Viewport.dataAttribute()`** — reusable viewport strategy for grids that expose row and column indexes via DOM attributes.
- **MUI DataGrid viewport support** — the MUI preset now supplies viewport range and scroll helpers for row and column virtualization.
- **2D virtualized playground page** for exercising row and column virtualization together.

### Changed
- `GetCellLocatorFn` now receives the table root and final config so strategies can re-query safely when row locators become stale.
- `useTable()` memoizes viewport range lookups by default and invalidates them after viewport scroll operations.

## [6.9.0] - 2026-03-24

### Breaking
- **`RowIterationOptions.parallel` removed** — use `concurrency: 'parallel' | 'sequential' | 'synchronized'` only. Replace `{ parallel: true }` with `{ concurrency: 'parallel' }` and `{ parallel: false }` with `{ concurrency: 'sequential' }`.

### Changed
- **`runMap`** resolves concurrency with `options.concurrency ?? config.concurrency ?? defaultMode` (no boolean `parallel` branch).

## [6.8.2] - 2026-03-24

### Added
- **`package.json` `exports`**: subpath `@rickcedwhat/playwright-smart-table/types` maps `types` to `dist/types.d.ts` (runtime still resolves to main `index.js`) so consumers can `import type { … } from '…/types'` when tooling handles subpath typings more reliably than the package root.

## [6.8.1] - 2026-03-23

### Changed
- Patch release only: `package.json` / embedded `PLAYWRIGHT_SMART_TABLE_VERSION` bumped so consumers can pin and verify the published build after the 6.8.0 packaging fixes.

## [6.8.0] - 2026-03-22

### Added
- **`concurrency` for row iteration** — `TableConfig` and `forEach` / `map` / `filter` options accept `concurrency: 'parallel' | 'sequential' | 'synchronized'`. `synchronized` runs navigation in parallel lock-step while serializing row callbacks (via `NavigationBarrier`), for grids where concurrent navigation would desync the viewport.
- **`Mutex`** and **`NavigationBarrier`** utilities (`src/utils/mutex.ts`, `src/utils/navigationBarrier.ts`) with unit tests.
- **Glide preset**: `aria-colindex`-based cell resolution, horizontal navigation on `.dvn-scroller`, `seekColumnIndex` / `snapFirstColumnIntoView`, default `concurrency: 'sequential'`, and canvas-aware fill with tighter textarea wait timeouts.

### Changed
- **`runMap`** (`src/engine/tableIteration.ts`) implements the three concurrency modes above; `parallel` option on iteration is deprecated in favor of `concurrency`.
- **SmartRow** navigation: improved virtualized grid handling (`targetReached`, conditional `Home`, removal of row `scrollIntoViewIfNeeded` where it hung); navigation primitives extended on `NavigationPrimitives` (`snapFirstColumnIntoView`, `seekColumnIndex`).
- **`.gitignore`**: local mapper / scratch `.txt` artifacts.

### Documentation
- README and API docs now describe `concurrency` for iteration; JSDoc on `TableResult` iteration methods updated accordingly.
- `scripts/generate-all-api-docs.mjs`: match `TableResult` / `TableConfig` declarations correctly, fix single-line JSDoc leaving the parser stuck in “comment” mode, and recognize multi-line `forEach` / `map` / `filter` signatures so `tableresult-signatures.json` stays in sync with `types.ts`.

## [6.7.9] - 2026-03-21

### Fixed
- Modified a code comment in `fill.ts` to prevent aggressive security scanners (like Socket.dev) from throwing false-positive Supply Chain Risk alerts regarding undefined `globalThis.fetch` behavior.

## [6.7.8] - 2026-03-20

### Added
- `Strategies.Header.horizontalScroll()` — a built-in header discovery strategy that uses DOM-level `scrollLeft` to pan across virtualized, horizontally-scrolled tables and collect all column headers.
- `Strategies.Header` namespace now exported alongside existing strategy namespaces.
- New integration tests for horizontal virtualization (`tests/horizontal-virtualization.spec.ts`, `tests/integration/virtualized-horizontal-dedupe.spec.ts`).
- Stryker mutation testing framework set up with daily scheduled CI runs (`stryker.config.json`, `.github/workflows/mutation-testing.yml`).
- `debug: { logLevel: 'verbose' }` support added to `useTable` for detailed runtime logging.

### Changed
- MUI DataGrid support refactored under `Presets.MUIDataGrid` (from `Plugins`).
- `src/strategies/index.ts` now correctly exports `Header: HeaderStrategies`.

## [6.7.7] - 2026-03-05

### Added
- Edge-case unit tests for pagination planning & execution (`tests/unit/paginationPath.edge.test.ts`).
- CI & safety: CodeQL analysis, Dependabot weekly updates, and a smoke-pack workflow to validate `npm pack` installs.
- Dependabot auto-merge workflow for non-major updates.
- LICENSE (MIT).

### Changed
- Improved pagination retry/error diagnostics: errors now list available pagination primitives to aid debugging.
- Stop tracking `dist/`; updated `.gitignore` and Husky pre-commit to avoid committing built artifacts.

### Fixed
- Consolidated duplicate unit tests and added missing tests for table mapping and debug utilities to improve coverage.
- Merged overlapping unit test files into consolidated suites (`tests/unit/paginationPath.coverage.test.ts`, `tests/unit/debugUtils.coverage.test.ts`) and removed redundant edge/unit variants to reduce CI runtime and flakiness.
- Updated project roadmap to include mutation testing (Stryker) to measure test effectiveness beyond line/branch coverage.

## [6.7.6] - 2026-03-05

### Added
- Tests: Added targeted unit tests to improve coverage for pagination planning and execution (`tests/unit/paginationPath.coverage.test.ts`), debug utilities (`tests/unit/debugUtils.coverage.test.ts`), and `TableMapper` header mapping (`tests/unit/tableMapper.unit.test.ts`).

### Changed
- Test suite cleanup: removed duplicate/overlapping unit test files and consolidated assertions to reduce CI runtime and reduce flakiness.
- `.gitignore` updated to exclude local playground artifacts and coverage/raw output.

### Fixed
- Improved unit test coverage and CI test config (V8 coverage reporting). No runtime behavior changes.

## [6.7.5] - 2026-03-01

### Added
- **MUI (Material UI) plugin**: `Plugins.MUI` preset for MUI Data Grid (selectors, header transformer for empty "Actions" column, pagination). Use: `useTable(loc, { ...Plugins.MUI, maxPages: 5 })`. Dedicated tests in `tests/mui.spec.ts`; more MUI table types to be supported in future.
- **Plugin shape unified**: All plugins now expose both `Plugins.X` (full preset: selectors + headerTransformer if any + strategies) and `Plugins.X.Strategies` (strategies only). Use preset: `useTable(loc, { ...Plugins.MUI, maxPages: 5 })`. Use strategies only: `useTable(loc, { rowSelector: '...', strategies: Plugins.MUI.Strategies })`. Applied to RDG, Glide, and MUI.
- **Tests**: Reset + goToFirst, revalidate (no DOM change), sorting when no strategy, scrollToColumn, getRow exact match, findRow maxPages sentinel, columnOverrides.read-only, beforeCellRead hook. Core/edge tests moved from removed compatibility suite into `edge-cases.spec.ts`.

### Changed
- **SmartRow cell navigation**: After keyboard navigation (goUp/goDown/goLeft/goRight), the engine now polls `getActiveCell` until the active cell matches the target (10ms interval, 50ms max) when the strategy is set, then returns the cell locator. If no match within 50ms, a final `getActiveCell` call is used. When `getActiveCell` is not configured, no delay is used and the function returns immediately. This reduces reliance on fixed delays when virtualized grids expose the strategy.
- **Sentinel row**: "Not found" rows are now marked with an internal symbol (`SENTINEL_ROW`) instead of `_isSentinel`. Use `SmartRow.wasFound()` to detect; do not rely on internal properties.
- **Strategy context**: `useTable` now builds strategy/table context via a single `createStrategyContext()` helper so `getHeaderCell`, `getHeaders`, and `scrollToColumn` are consistently available to reset, sorting, and pagination.
- **Iteration engine**: `forEach`, `map`, and `filter` logic moved to `engine/tableIteration.ts` (`runForEach`, `runMap`, `runFilter`) to shorten `useTable.ts` and centralize the row-iteration loop.
- **JSDoc**: `FilterStrategy`, `LoadingStrategy`, and `getRow` (note on `rowIndex` when using `getRow()` vs `getRowByIndex`) improved in `types.ts`.

### Removed
- **compatibility.spec.ts**: Removed; useful cases (core methods, init timeout/chaining, lazy load, getRow vs findRow, revalidate, scrollToColumn) moved into `edge-cases.spec.ts` or covered by existing error-handling/readme tests.

### Tests
- **strategies.spec.ts**: Now only HTMX infinite-scroll example. MUI Data Grid tests moved to `tests/mui.spec.ts`.
- **readme_verification.spec.ts**: "Quick Start" and "SmartRow: Core Pattern" merged into one test with both `#region` blocks for doc generation.

### Moved
- **Plugins to `src/plugins/`**: All library plugins (MUI, RDG, Glide) now live in `src/plugins/` instead of `src/strategies/`. Entry point is `src/plugins/index.ts`; `src/plugins.ts` removed. Plugin template and docs updated to use `src/plugins/` as the plugin directory.
- **Plugin layout (directory per plugin)**: Each plugin is now a directory with `index.ts` (e.g. `src/plugins/glide/index.ts`, `src/plugins/rdg/index.ts`, `src/plugins/mui/index.ts`). Helper modules live alongside (e.g. `glide/columns.ts`, `glide/headers.ts`). Public API unchanged; imports like `Plugins.Glide` are unchanged.

## [6.7.4] - 2026-02-28

### Documentation
- **getRowByIndex**: JSDoc and API docs now correctly describe the index as **0-based** (was incorrectly documented as 1-based since v6.1.0). Removed non-existent `options` / `bringIntoView` parameter from signatures.
- **README**: Added note on `useBulkPagination` for `map`/`forEach`/`filter` when using strategies with `goNextBulk`.
- **API signature JSON**: Removed deprecated `getColumnValues`, `iterateThroughTable`, and `getRows` from VitePress signature files; updated `getRowByIndex` signature and params.
- **CHANGELOG [6.5.0]**: Clarified that `currentPageIndex` is updated by `findRows` and iteration methods (`map`, `forEach`, `filter`).

## [6.7.3] - 2026-02-26

### Fixed
- **TypeScript Strictness**: Resolved a TS compilation lint error in `PaginationPrimitives` by relaxing the internal `createClicker` return type, allowing seamless mixing of boolean and numeric bulk pagination returns without throwing assignment errors.

## [6.7.2] - 2026-02-26

### Performance Optimizations 🚀
- **O(N²) Infinite Scroll Bottleneck Eliminated**: Replaced the legacy DOM-rescan array mechanisms with an optimized, constant-time `evaluateAll` browser-side injection. The Smart Table engine now only parses the precise delta of new elements natively via a `WeakMap`, dropping 10,000-row traversal times from multple seconds to ~400ms without memory leaks.
- **Virtualized Horizontal Text Extraction (`allInnerTexts` latency)**: Upgraded internal horizontal lookup strategies to utilize generic layout maps mapped inside the CDP browser context. By resolving unmounted horizontal placeholders synchronously, the table scales past Playwright's network connection limits.

### Playground Features 🏗️
- Added advanced 2D Data-Grid simulation to the `<VirtualizedTable />` component.
- Introduced `virtualizeColumns`, `columnCount`, and `virtualizeHeaders` controls directly into the `PlaygroundConfig` UI panel to support robust Playwright grid isolation rendering configurations.
- Engineered aggressive port 3000 `lsof -ti` teardown controls natively into the `package.json` testing lifecycles (`pretest`, `posttest`) to strictly prevent `vite` and `<react-virtuoso>` from causing zombie runner scenarios during benchmark CI verification.

## [6.7.1] - 2026-02-26

### Documentation & Cleanup
- **Documentation Revamp**: Completely updated the `docs/` directory, `README.md`, examples, and recipes to exclusively use the new v6.6.0 iteration APIs (`map`, `filter`, `forEach`). 
- **Column Overrides**: Added comprehensive documentation for the `columnOverrides` feature.
- **Internal Cleanups**: Removed lingering dead code, types, and JSDoc references associated with the deprecated `dataMapper` and `cellNavigation`.

## [6.7.0] - 2026-02-23

### Breaking Changes ⚠️
- **Removed deprecated `iterateThroughTable` method**. `table.map()`, `table.filter()`, or `table.forEach()` are drop-in replacements.
- **Removed deprecated `getColumnValues` method**. Use `table.map(({ row }) => row.getCell(columnName).innerText())`.
- **Removed deprecated `dataMapper` table configuration**. Read and write operations now use `columnOverrides`.
- **Removed deprecated `clickNext` pagination strategy**. Pass a `next:` selector to `Strategies.Pagination.click()` instead.

### Added
- **`goNextBulk` & `goPreviousBulk` Pagination Primitives**: Define bulk skip navigation in your custom strategies when dealing with large pagination sets. Built-in `click` strategy supports `nextBulk` and `previousBulk` selectors natively.
- **`getHeaderCell` exposed on `StrategyContext`**: Strategies now have native access to column header locators.
- **`reset()` auto-navigates to the first page**: Calling `table.reset()` now implicitly calls `goToFirst()` immediately following `onReset()`.

### Changed
- **Sorting Execution Flow Simplified**: Sorting logic is now exclusively managed centrally by the Smart Table engine. It handles verification retries and loading states behind the scenes. Custom strategies should now only issue the interaction *(e.g. 'click')* without awaiting state resolution.

### Fixed
- Iterators (`map`, `forEach`, `filter`) now correctly default to the global `config.strategies.dedupe()` when skipping options.

## [6.6.0] - 2026-02-23

### Added
- **`table.forEach(callback, options?)`**: Iterates every row across all pages sequentially. Call `stop()` to end early.
  ```typescript
  await table.forEach(async ({ row, rowIndex, stop }) => {
    if (rowIndex > 5) stop();
    await row.getCell('Checkbox').click();
  });
  ```
- **`table.map(callback, options?)`**: Transforms every row across all pages into a value. Parallel within each page by default.
  ```typescript
  const emails = await table.map(({ row }) => row.getCell('Email').innerText());
  ```
- **`table.filter(predicate, options?)`**: Filters rows across all pages by an async predicate. Returns a `SmartRowArray<T>` as-is.
  ```typescript
  const active = await table.filter(async ({ row }) =>
    await row.getCell('Status').innerText() === 'Active'
  );
  ```
- **Public Async Iterator** (`[Symbol.asyncIterator]`): Enables `for await...of` syntax over a table, page by page.
  ```typescript
  for await (const { row, rowIndex } of table) { ... }
  ```
- **Shared options** across all three methods:
  - `maxPages?: number` — limits pages traversed.
  - `parallel?: boolean` — within-page concurrency. Default: `false` for `forEach`/`filter`, `true` for `map`.
  - `dedupe?: DedupeStrategy` — skip rows already seen by key (useful for infinite scroll tables).
- **`RowIterationContext<T>`** and **`RowIterationOptions`** exported types for the new API.

### Deprecated
- **`iterateThroughTable`**: Use `forEach`, `map`, or `filter` instead. Only retain for advanced scenarios (batchSize, beforeFirst/afterLast hooks). Will be removed in v7.0.0.
- **`getColumnValues`**: Use `table.map(({ row }) => row.getCell(col).innerText())` instead. Will be removed in v7.0.0.

### Fixed
- **`filter` now sets `tablePageIndex`** on returned rows, so `bringIntoView()` works correctly after a cross-page filter scan.
  ```typescript
  const active = await table.filter(...);
  for (const row of active) {
    await row.bringIntoView(); // ✅ navigates back to the correct page
    await row.getCell('Checkbox').click();
  }
  ```

### Notes
- **`map` + UI interactions**: `map` defaults to `parallel: true` (safe for reads). If your callback opens popovers, fills inputs, or otherwise mutates UI state, you **must** pass `{ parallel: false }` to avoid concurrent interactions breaking each other.
  ```typescript
  // ✅ Safe for popover interactions
  await table.map(async ({ row }) => { ... }, { parallel: false });
  ```

---

## [6.5.0] - 2026-02-23

### Added
- **`PaginationPrimitives` API**: New interface for defining bidirectional pagination primitives that power stateful cross-page navigation.
  - `goNext`, `goPrevious`, `goToPage`, `goToFirst` — define how the library moves between pages.
  - **`Strategies.Pagination.click`**: Updated with full `previous` and `first` selectors in addition to `next`.
- **`SmartRow.bringIntoView()` — Cross-Page Navigation**: `SmartRow` can now intelligently navigate back to the page it was found on.
  - Uses `goToPage` for instant O(1) jumps if provided.
  - Falls back to looping `goPrevious` N times based on the tracked page diff.
  - Falls back to `goToFirst` + N loops of `goNext` if no backward primitive exists.
- **`TableResult.currentPageIndex`**: Tracks the current DOM page index as `findRows` and iteration methods (`map`, `forEach`, `filter`) paginate forward. Updated by `bringIntoView` when navigating backwards.
- **`SmartRow.table`**: Back-reference to the parent `TableResult` instance, enabling state queries like `rows[0].table.currentPageIndex`.
- **`SmartRow.tablePageIndex`**: Records which page index the row was originally found on during `findRows`.

### Changed
- **`Strategies.Pagination.click`**: Now returns a `PaginationPrimitives` object instead of a single `PaginationStrategy` function, giving `bringIntoView` bidirectional awareness.
- **`Strategies.Pagination.clickNext`**: Marked as `@deprecated`. Migrate to `Strategies.Pagination.click({ next: selector })`.

### Fixed
- `bringIntoView` no longer relies on `Locator.isVisible()` for cross-page position detection (which was unreliable as it matched the selector on the *current* page DOM). Now uses deterministic state-diff arithmetic.

### Deprecated
- **`Strategies.Pagination.clickNext`**: Use `Strategies.Pagination.click({ next: selector })` instead. Will be removed in v7.0.0.

---

## [6.4.0] - 2026-02-18

### ⚠️ Breaking Changes
- **Removed `getRows`**: The deprecated `getRows` method has been removed. Use `findRows` or `iterateThroughTable` instead.
- **Removed `cellNavigation`**: The deprecated `cellNavigation` strategy type has been removed in favor of `navigation` primitives.

### Added
- **Explicit Strategies Export**: `Strategies` are now explicitly exported from the main index, improving discovery.

### Changed
- **`headerSelector` Type**: Updated to strictly allow `string | ((root: Locator) => Locator)`.
- **Internal Cleanup**: Removed redundant types and aliases (`FinalTableConfigLike`).

## [6.3.2] - 2026-02-17

### Fixed
- **Glide Canvas Focus**: Fixed `glideGoHome` to correctly find and focus the parent canvas element that contains the accessibility table, resolving navigation issues when root locator is already a canvas or contains canvas elements.

### Added
- **`Plugins.Glide.Strategies.fillSimple`**: Exported alternative fill strategy for Glide implementations that don't use the standard textarea editor. This simpler strategy (Enter → Type → Enter) is faster but may not work for all Glide configurations.

### Changed
- **`glideFillStrategy`**: Remains the default fill strategy with textarea validation for maximum compatibility with standard Glide Data Grid implementations.

## [6.3.1] - 2026-02-17

### Added
- **Navigation Primitives (`NavigationPrimitives`)**: New interface for defining primitive table navigation functions.
  - `goUp`, `goDown`, `goLeft`, `goRight`, `goHome` - Simple movement primitives
  - Strategies now define **HOW to move**, orchestration logic handles **WHEN to move**
  - Cleaner separation of concerns and easier customization
- **Glide Primitive Functions**: Implemented primitive navigation for Glide Data Grid
  - `glideGoUp`, `glideGoDown`, `glideGoLeft`, `glideGoRight`, `glideGoHome`
  - Reduced from 60-line complex strategy to 5 simple functions (~7 lines each)
- **Plugin Export**: `Plugins` object now exported from main entry point
  - Access via `import { Plugins } from '@rickcedwhat/playwright-smart-table'`

### Changed
- **`_navigateToCell` Refactor**: Internal helper now orchestrates navigation using primitives
  - Calls `getActiveCell` for optimization
  - Skips navigation if already at target cell
  - Uses primitive functions when available, falls back to legacy `cellNavigation`
- **`TableStrategies` Interface**: Added `navigation?: NavigationPrimitives` field
- **Glide Strategy Export**: Now exports `navigation` object with primitive functions

### Deprecated
- **`cellNavigation`**: Marked as deprecated in favor of `navigation` primitives
  - Still supported for backward compatibility
  - Will be removed in a future major version

### Internal
- Simplified navigation logic by moving orchestration from strategies to `_navigateToCell`
- Improved code reusability and composability

## [6.3.0] - 2026-02-15

### Added
- **Data Mapper (`dataMapper`)**: New configuration option in `TableConfig<T>` allowing custom data extraction logic per column.
  - Supports returning complex types (boolean, number, etc.) instead of just strings.
  - Ensures strict type safety when using the new generic `useTable<T>`.
- **Generic `useTable<T>`**: The `useTable` hook now accepts a generic type parameter `T` to define the shape of your row data.

### Changed
- **`findRows` API Update**: REMOVED the `asJSON` option.
  - `findRows` now always returns `Promise<SmartRowArray<T>>`.
  - To get the JSON data (using the `dataMapper`), chain `.toJSON()` on the result: `await (await table.findRows({...})).toJSON()`.
- **Type Safety**: `SmartRow.toJSON()` now returns `Promise<T>` instead of `Promise<Record<string, string>>`.

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

