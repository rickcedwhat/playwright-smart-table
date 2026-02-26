# Roadmap

## Short Term - Quality of Life & Safety

### 🛡️ Safety & Stability
<!-- No items currently in this section -->

### 👩‍💻 Developer Experience
- [x] **`columnOverrides`**: Introduce `columnOverrides` to `TableConfig`.
    - **Purpose**: Unified interface for two-way data binding per column, overriding `smartFill` and `toJSON`.

- [x] **Test Coverage for `bringIntoView` with `findRows`**:
    - **Purpose**: Ensure `row.bringIntoView()` works reliably for rows found across multiple pages via `findRows`.
- [x] **Array-like Iteration Methods (`map`, `forEach`, `filter`)**:
    - **Purpose**: Introduce familiar, high-level array methods on the `TableResult` interface with a public async iterator as the engine.
    - **Callback**: `{ row, rowIndex, stop }` — call `stop()` to end iteration early.
    - **Options**: `{ parallel?: boolean, maxPages?: number, dedupe?: DedupeStrategy }`.
      - `forEach` and `filter`: `parallel: false` default (interaction ordering matters).
      - `map`: `parallel: true` default (reads are safely concurrent within a page).
    - **Also adds**: Public `[Symbol.asyncIterator]` on `TableResult` — enables `for await (const { row } of table)`.
    - **Deprecates**:
      - `iterateThroughTable` (use `forEach`/`map`/`filter` instead).
      - `getColumnValues` (use `map` instead).
- [x] **Document `forEach`/`map`/`filter` in README**
- [x] **JSDoc `@note` on `map`'s `parallel` default**

### 🧹 Cleanup (next major version)
- [x] **Remove Deprecated APIs**:
    - `iterateThroughTable` → replaced by `forEach`/`map`/`filter`.
    - `getColumnValues` → replaced by `map`.
    - `dataMapper` → replaced by `columnOverrides.read`.
    - `clickNext` pagination strategy → replaced by `click({ next: ... })`.

### ⚡ Performance
- [ ] **Improve infinite scroll iteration**:
    - **Problem**: Re-scans entire DOM on every infinite scroll iteration (O(N^2)).
    - **Solution**: Implement a "cursor" or "incremental scan" strategy that only processes new rows.
    - **Impact**: Critical for enterprise-scale tests (10k+ rows).

### 🛠️ Implementation Improvements
- [x] **Expose `getHeaderCell` in `StrategyContext`**: Allow custom strategies to easily resolve header cells without manual locators.
- [x] **Simplify Sorting Strategy API**: Refactor `doSort` so that strategies only define the *trigger* (e.g., "click this"), while the library handles the loop, state verification, and retries.
- [x] **`goNextBulk` / `goPreviousBulk` Pagination Primitives**: Add bulk-jump primitives to `PaginationPrimitives` for navigating N pages at a time (e.g., a `»` button that skips 10 pages). Useful for sparse sampling across large paginated tables.
- [x] **`reset()` auto-navigates to first page**: If the pagination strategy provides `goToFirst`, `reset()` should call it automatically after `onReset`. If `goToFirst` is not configured, log a message so the user knows the table may not be on page 1.
    - **Order**: `onReset(context)` → `goToFirst()` if available → clear header map + reset `currentPageIndex`.
    - **Benefit**: Removes the footgun where users must manually navigate to page 1 inside `onReset` even though they've already declared a `first:` selector in their pagination strategy.

### 🔌 Ecosystem
- [ ] **Community Presets**:
    - **Goal**: `useTable(loc, { preset: MUI })`
    - **Repository**: Create a separate repo (or monorepo workspace) for `@playwright-smart-table/presets`.
    - **Targets**: Material UI, AgGrid, Ant Design, TanStack Table.
    - **Vision**: Enable community contributions for specific library support, removing the burden of manual configuration for popular libraries.

## Non-Goals

To maintain focus, the following are **explicitly out of scope**:

- **Visual Regression Testing**: Use Playwright's screenshot APIs. We handle data, not pixels.
- **Pure Canvas Tables (No DOM)**: No DOM = out of scope. Canvas with DOM fallbacks is supported. (Possibly explore pure canvas tables in the future and see if we're remotely able to support them)
- **Complex Merged Cell Logic**: Basic support exists. Not a current priority.
