# v6 Roadmap: Loading States & Advanced Strategies

Based on the [Grafana Usage Example], we have identified key areas to enhance `playwright-smart-table` for complex, dynamic, and virtualized tables.

## Goal
To provide first-class support for "unstable" tables (virtualized, infinite scroll, slow loading headers) by introducing explicit `loading` strategies and robust deduplication helpers.

## 1. Loading State Strategies (New)
Currently, `playwright-smart-table` assumes the table is ready when the selector matches. Real-world apps have intermediate "skeleton" or "busy" states.

### Proposal
Add `loading` to `TableStrategies`:

```typescript
interface LoadingStrategy {
  /** Check if the entire table is busy (e.g., global spinner) */
  isTableLoading?: (context: TableContext) => Promise<boolean>;
  /** Check if a specific row is a "skeleton" or loading placeholder */
  isRowLoading?: (row: SmartRow) => Promise<boolean>;
  /** Check if a cell is loading (e.g., specific cell spinner) */
  isCellLoading?: (cell: Locator) => Promise<boolean>; // used by getCellValue / SmartRow.toJSON
}
```

### Usage
```typescript
strategies: {
  loading: {
    isTableLoading: ({ root }) => root.getAttribute('aria-busy') === 'true',
    isRowLoading: (row) => row.locator('.skeleton-loader').isVisible(),
    isCellLoading: (cell) => cell.innerText().then(t => t === 'Loading...'),
    // Configuration
    timeout: 5000, // wait up to 5s for loading to finish
    onReadTimeout: 'symbol', // return <LOADING> if still loading while reading
    onWriteTimeout: 'error', // throw error if still loading while trying to click/fill
  }
}
```

### Configuration Options
- **timeout**: Global wait time for loading states (default: 5000ms).
- **onReadTimeout**: Behavior when reading (toJSON, getCellValue) fails to settle.
  - `'symbol'`: Returns `<LOADING>` (Default).
  - `'error'`: Throws exception.
  - `'ignore'`: Returns whatever text is present.
- **onWriteTimeout**: Behavior when interaction (fill, click) is blocked.
  - `'error'`: Throws exception (Default).
  - `'ignore'`: Attempts action anyway.

**Impact**: `findRow`, `getRows`, and `iterateThroughTable` will automatically wait for `isTableLoading` to be false, and filter out/wait for `isRowLoading` rows.

## 2. Advanced Deduplication (Feature)
Virtualized tables often recycle DOM elements or have "floating" rows. Content-based deduplication (default) fails if content changes or if multiple rows have identical content but different positions.

### Proposal
Export a `DedupeStrategies` collection.

```typescript
export const DedupeStrategies = {
  /** Default: Serialize row content */
  byContent: (row) => row.toJSON().then(JSON.stringify),
  
  /** For Virtualized Tables: Use absolute top position */
  byTopPosition: async (row) => {
    const top = await row.evaluate(el => el.getBoundingClientRect().top);
    return Math.round(top); // binning to nearest pixel
  },
  
  /** By specific unique ID attribute */
  byAttribute: (attr: string) => (row) => row.getAttribute(attr),
};
```

## 3. Smart Pagination (Enhancement)
The user's example uses a sophisticated "scroll + wait for mutation + quiet window" pattern.

### Proposal
Enhance `PaginationStrategies` with a `scrollAndWait` factory.

```typescript
strategies: {
  pagination: PaginationStrategies.scrollAndWait({
    scrollTarget: '.scroll-container', // defaults to table root
    step: 500,
    // Automatically waits for network idle or mutation stability
    stability: 'network' | 'mutation' | 'timeout', 
  })
}
```

## 4. Generic "Strategy-First" Core (Refactor)
Ensure `findRow` and `getRows` usage of strategies aligns with `iterateThroughTable`. The goal is that **configuration handles complexity**, keeping the test code simple:

```typescript
// User code remains simple:
const row = await table.findRow({ Name: 'Grafana' });
// Library handles:
// 1. Is table loading? verify...
// 2. Is this row a skeleton? skip...
// 3. Scroll & Wait for mutation? handle...
```

## Implementation Phases (Prioritized)

### Phase 1: Interactive Test Playground (Infrastructure)
**Goal:** Create a controlled environment to reproduce "loading", "flakiness", and "virtualization" issues reliably.
- **Action**: Create `/playground` (React + Vite).
- **Features**:
    - Control Panel: Inject delays, trigger errors, simulate network flakiness.
    - Virtualized Table: Use `react-window` to test deduplication.
    - "Chaos" Mode: Randomize attributes/IDs.

### Phase 2: Ease of Use & Quick Wins
**Goal:** Improve Developer Experience (DX) with high-value, low-risk changes.
1.  [x] **Header Transformer "Seen" State**: Pass `seenHeaders` Set to transformer for easy deduplication.
2.  [x] **Auto-Initialization**: `getHeaders` and `getHeaderCell` call `init()` automatically.
3.  [x] **Iteration Improvements**:
    - Pass `SmartRowArray` to callback.
    - Add `autoFlatten: boolean` option.
4.  [x] **Strict Mode Config**: Add `strict: boolean` (default `true`). If `false`, `findRow` returns the first match instead of throwing on duplicates.

### Phase 3: Core Strategy Engine (Loading & Dedupe)
**Goal:** Robustly handle unstable and virtualized tables.
1.  [x] **Loading Strategies**: Implement `isTableLoading`, `isRowLoading`.
2.  [ ] **Advanced Dedupe**: Implement `DedupeStrategies.byTopPosition` for virtualized tables.
3.  [x] **Core Integration**: Update `findRow`, `getRows`, and `iterateThroughTable` to respect these strategies.

### Phase 4: Documentation Recipes
**Goal:** Provide copy-paste solutions for complex scenarios.
- Create `docs/recipes/virtualized-tables.md`
- Create `docs/recipes/loading-states.md`
- Create `docs/recipes/complex-filtering.md`



## 6. Interactive Test Playground (Infrastructure)
To robustly test advanced features (virtualization, loading states, flakiness), we need a controlled environment. Static HTML files are insufficient for testing dynamic behaviors.

### Proposal: `playground` App
Create a small React + Vite application within the repo (`/playground`) that serves as a testbed.

**Features:**
1.  **State Controller**: A "Control Panel" to inject specific states into the test table.
    - [ ] `Inject 2s Loading Delay`
    - [ ] `Trigger Error State`
    - [ ] `Simulate Network Flakiness`
2.  **Virtualized Table**: A table implementation using `react-window` or similar to test `dedupeStrategy` and scrolling.
3.  **"Chaos" Mode**: A table that randomly changes attributes/IDs to test library robustness.

**Usage:**
- `playwright.config.ts` will launch this app via `webServer`.


