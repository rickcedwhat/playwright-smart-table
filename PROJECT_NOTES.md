# Project Notes

## Table Loading Behavior & Init Timing

### What Happens When `init()` is Called on a Loading Table?

**Last Updated:** 2026-02-11

#### Current Behavior

When `init()` is called, the library attempts to map table headers through the `_getMap()` function. Here's what happens:

1. **Header Detection Wait** (Line 99 of `useTable.ts`):
   ```typescript
   await headerLoc.first().waitFor({ state: 'visible', timeout: headerTimeout });
   ```
   - Default timeout: **3000ms** (can be overridden via `init({ timeout: number })`)
   - Waits for the **first header** to become visible
   - Ignores hydration errors (wrapped in try-catch)

2. **Snapshot Approach**:
   - `init()` takes a **snapshot** of headers at the moment it runs
   - If table loads progressively (e.g., headers appear in pieces), `init()` will only capture **what's visible at that moment**
   - No built-in retry or progressive header detection

3. **Validation**:
   - Throws error if **zero columns** found
   - Throws error if **duplicate column names** detected (unless `headerTransformer` handles it)

#### Progressive/Chunked Loading Scenarios

**Scenario 1: Headers Load in Pieces**
- If headers render progressively (e.g., first 3 columns, then 3 more), calling `init()` too early will only capture the first batch
- **Risk**: Missing columns that haven't rendered yet
- **Current Mitigation**: None built-in; user must wait for full header render

**Scenario 2: Rows Load Progressively (Virtualization/Infinite Scroll)**
- Headers typically load first, so `init()` is generally safe
- Row loading is handled separately via:
  - `LoadingStrategies.Row.*` (skeleton detection, loading text, etc.)
  - `StabilizationStrategies.*` (wait for content changes, row count increases)
  - Pagination strategies handle progressive row loading

**Scenario 3: Entire Table Has Loading State**
- `LoadingStrategies.Table.*` can detect table-level loading (spinners, overlays)
- However, these strategies are **NOT** used during `init()` itself
- They're only used in methods like `_findRowLocator()` (line 173-176)

#### Key Findings

1. **No Loading Detection During Init**:
   - `init()` does NOT check `config.strategies.loading?.isTableLoading`
   - It only waits for first header visibility with a timeout
   - If table is still loading when `init()` runs, it may capture incomplete state

2. **Idempotency**:
   - `init()` has early return if already initialized: `if (_isInitialized && _headerMap) return result;`
   - Calling `init()` multiple times is safe but won't re-scan headers
   - Use `reset()` + `init()` to force re-initialization

3. **Auto-Initialization**:
   - Many methods auto-call `init()` if not already initialized (via `_ensureInitialized()`)
   - This means if you call `getRows()` without explicit `init()`, it will initialize at that moment

#### Recommendations

**For Users:**
1. **Wait for Full Table Render** before calling `init()`:
   ```typescript
   await page.waitForSelector('.table-fully-loaded-indicator');
   const table = await useTable(locator).init();
   ```

2. **Use Custom Timeout** for slow-loading tables:
   ```typescript
   await table.init({ timeout: 10000 }); // 10s instead of default 3s
   ```

3. **Leverage Auto-Init** for simple cases:
   ```typescript
   // Skip explicit init() - let getRows() handle it
   const rows = await table.getRows();
   ```

**Potential Enhancements** (Future Consideration):
1. Add `isTableLoading` check to `init()` flow
2. Support progressive header detection with retries
3. Add `waitForReady` option to `init()` that polls until loading strategies confirm table is ready
4. Document best practices for different loading patterns

#### Related Code Locations

- `useTable.init()`: Lines 281-297
- `useTable._getMap()`: Lines 88-152
- Loading strategies: `src/strategies/loading.ts`
- Stabilization strategies: `src/strategies/stabilization.ts`
- Loading detection in `_findRowLocator()`: Lines 172-177

#### Test Coverage

- **Covered**: Basic init with visible tables (`tests/init-errors.spec.ts`)
- **Covered**: Virtualized tables with progressive row loading (`tests/playground-virtualization.spec.ts`)
- **NOT Covered**: Progressive header loading scenarios
- **NOT Covered**: Init timing with table-level loading states
