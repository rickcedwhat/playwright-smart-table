# v6 Roadmap: Loading States & Advanced Strategies

## Status Overview
- **Core Strategy Engine**: ✅ Complete (Unified Pagination, Stabilization, Deduplication)
- **Infrastructure**: ✅ Complete (Interactive Playground, V2 Config)
- **Verification**: ✅ Complete (97/97 Tests Passing)
- **Documentation**: 🚧 In Progress

## Completed Phases

### ✅ Phase 1: Interactive Test Playground (Infrastructure)
Created a controlled React+Vite environment to reproduce "loading", "flakiness", and "virtualization" issues reliably.
- **Features**: Control Panel, Virtualized Table (react-window/virtuoso), "Chaos" Mode.

### ✅ Phase 2: Ease of Use Improvements
- **Header Transformer**: Introduced `seenHeaders` set.
- **Auto-Initialization**: `getHeaders` etc. now auto-init.
- **Strict Mode**: Configurable strictness for `findRow`.

### ✅ Phase 3: Core Strategy Engine
- **Loading Strategies**: Implemented `isTableLoading` interfaces.
- **Dedupe Strategies**: Implemented `topPosition` and content-based dedupe.
- **Core Integration**: Strategies integrated into `useTable` loop.

### ✅ Phase 5: Playground V2 (Advanced Config)
- **JSON Config**: Full control over table parameters via JSON.
- **Generators**: "Simple", "Users", and "Chaos" data generators.
- **Granular Control**: Row delays, cell delays, skeleton states.

### ✅ Phase 6: Library Verification
- **Test Suite**: `tests/playground-virtualization.spec.ts` covers:
    - Infinite Scroll (Action + Stabilization)
    - Random Delays & Stutter
    - Deep Scroll & Caching

### ✅ Phase 7: Architecture Refactor (Pagination & Stabilization)
- **Unified Pagination**: Merged "virtualized" logic into `infiniteScroll`.
- **Stabilization Module**: Introduced `StabilizationStrategies` (`contentChanged`, `rowCountIncreased`) that wrap actions to prevent race conditions.
- **Third-Party Support**: Verified against Glide Data Grid and React Data Grid.

## Upcoming Phases

### 🚧 Phase 4: Documentation & Recipes
**Goal:** Provide copy-paste solutions for complex scenarios.
- [ ] Create `docs/recipes/virtualized-tables.md`
- [ ] Create `docs/recipes/loading-states.md`
- [ ] Create `docs/recipes/complex-filtering.md`
