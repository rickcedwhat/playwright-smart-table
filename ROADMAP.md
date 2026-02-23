# Roadmap

## 1. Short Term (v6.4.x) - Quality of Life & Safety

### 🛡️ Safety & Stability
<!-- No items currently in this section -->

### 👩‍💻 Developer Experience
- [x] **`columnOverrides`**: Introduce `columnOverrides` to `TableConfig`.
    - **Purpose**: Unified interface for two-way data binding per column, overriding `smartFill` and `toJSON`.
    - **Benefit**: Fixes "magic" issues and deprecates separate `dataMapper` config.
    - **Note**: `dataMapper` is now deprecated and will be removed in v7.0.0.
- [x] **Test Coverage for `bringIntoView` with `findRows`**:
    - **Purpose**: Ensure `row.bringIntoView()` works reliably for rows found across multiple pages via `findRows`.
- [ ] **Array-like Iteration Methods (`map`, `forEach`, `filter`)**:
    - **Purpose**: Introduce familiar, high-level array methods on the `TableResult` interface to wrap the powerful but complex `iterateThroughTable` engine.
    - **Benefit**: Vastly improves Developer Experience by providing safe, sequential execution for interactions (`forEach`), and fast concurrent execution for data extraction (`map`).

## 2. Medium Term (v7.0.0) - Core Architecture & Performance

### ⚡ Performance
- [ ] **Refactor `iterateThroughTable`**:
    - **Problem**: Re-scans entire DOM on every infinite scroll iteration (O(N^2)).
    - **Solution**: Implement a "cursor" or "incremental scan" strategy that only processes new rows.
    - **Impact**: Critical for enterprise-scale tests (10k+ rows).

### 🛠️ Implementation Improvements
- [ ] **Expose `getHeaderCell` in `StrategyContext`**: Allow custom strategies to easily resolve header cells without manual locators.
- [ ] **Simplify Sorting Strategy API**: Refactor `doSort` so that strategies only define the *trigger* (e.g., "click this"), while the library handles the loop, state verification, and retries.

## 3. Long Term (v8.0+) - Ecosystem & Plugins

### 🔌 Plugin Architecture
- [ ] **Extract Strategies**: Decouple strategies further to allow external packages to provide them.
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

