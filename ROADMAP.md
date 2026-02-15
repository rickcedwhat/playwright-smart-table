# Roadmap

## 1. Short Term (v6.4.x) - Quality of Life & Safety

### 🛡️ Safety & Stability
- [ ] **Limit Config Prompt Dump**: Restrict `generateConfigPrompt` to the first 5-10 rows preventing browser crashes on large tables.
- [ ] **Harden Filter Logic**: Explicitly enforce relative locators in `FilterEngine` to prevent future Playwright regressions.

### 👩‍💻 Developer Experience
- [ ] **`inputMapper`**: Introduce `inputMapper` to `TableConfig`.
    - **Purpose**: Allow explicit override of `smartFill` logic per column (similar to `dataMapper`).
    - **Benefit**: Fixes "magic" issues where custom components (like `div` checkboxes) are misidentified.

## 2. Medium Term (v7.0.0) - Core Architecture & Performance

### ⚡ Performance
- [ ] **Refactor `iterateThroughTable`**:
    - **Problem**: Re-scans entire DOM on every infinite scroll iteration (O(N^2)).
    - **Solution**: Implement a "cursor" or "incremental scan" strategy that only processes new rows.
    - **Impact**: Critical for enterprise-scale tests (10k+ rows).

## 3. Long Term (v8.0+) - Ecosystem & Plugins

### 🔌 Plugin Architecture
- [ ] **Extract Strategies**: Decouple strategies further to allow external packages to provide them.
- [ ] **Community Presets**:
    - **Goal**: `useTable(loc, { preset: MUI })`
    - **Repository**: Create a separate repo (or monorepo workspace) for `@playwright-smart-table/presets`.
    - **Targets**: Material UI, AgGrid, Ant Design, TanStack Table.
    - **Vision**: Enable community contributions for specific library support, removing the burden of manual configuration for popular libraries.
