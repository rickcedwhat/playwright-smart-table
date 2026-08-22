# GBU Report - playwright-smart-table v6.20.1

Generated: 2026-08-22

> Guiding light: [`PHILOSOPHY.md`](./PHILOSOPHY.md)
> Review this file in the PR, leave comments on items you want addressed, then tell the agent which Bad/Ugly/test items to act on.

---

## PHILOSOPHY ALIGNMENT 🧭

(Reference: PHILOSOPHY.md)

- **Mission fit:** Architecture still matches “describe your table” — `TableConfig` + `TableStrategies` + `src/presets/` packs. Consumers can compose strategies without a release. Drift is in *where* hard virtualization behavior lives: too much of it is fused into `smartRow._navigateToCell` / `useTable`, not only presets.
- **Strategy-first:** Rich, real hook surface (`pagination`, `loading`, `viewport`, `contentReady`, `resolveRowIndex`, …). Presets hold MUI/RDG/Glide knowledge. Soft/hard drift: Glide canvas/`Home` in core; generic strategy defaults that smuggle `.dvn-scroller` / `.rdg-viewport` / Tailwind overflow class names; dead `Resolution` / no-op `CellNavigation` still on `Strategies`.
- **Core thinness:** No `if (isMui)` in the engine (good). But `useTable.ts` (~797) and `smartRow.ts` (~993) are heavy; ~7 pagination/scan loops share `_advancePage` with inconsistent features (e.g. async iterator vs `runMap`). Center of gravity has shifted toward a virtualization special-case machine in core.
- **Decision-checklist failures:** Recent 6.18–6.20 work is production-driven (Principle 6 ✅) but often landed as core growth rather than new strategy hooks (Principle 2 ⚠️). `Plugins` still exported; `getColumnValues` claimed removed in ROADMAP but still public.
- **Score: 7/10 alignment** — shape is right; core weight and a few framework-shaped defaults are the drift to watch.

---

## THE GOOD ✅

- **Describe / strategy / preset layering is real** — not aspirational docs. Official packs are `Partial<TableConfig>`, not forked engines (`src/presets/mui.ts`, `rdg.ts`, `glide/`).
- **`TableStrategies` is a genuine plug surface** — pagination, sorting, viewport, loading, headers, fill, dedupe, filter, `resolveRowIndex`, `contentReady`, `beforeCellRead`, navigation primitives.
- **Playwright-native SmartRow** — Locator intersection types, sentinel rows for negative asserts, `get*` vs `find*` mental model, optional `@playwright/test` peer (6.20.1).
- **`resolveRowIndex` + self-healing `{ index, selector }`** — correct abstraction for virtual identity; `findRowByIndex` refuses to guess without it.
- **`mergeTableConfig`** — correct composition primitive for presets + user overrides.
- **Fail-helpful paths** — column typo suggestions, ambiguous `findRow`, missing strategy validation.
- **Recent changelog motivation matches philosophy** — virtualization correctness, no silent bulk-skipped pages, atomic/`contentReady` for recycling virtualizers.
- **Test suite is substantial** — ~74 files; unit-heavy on engine internals, E2E-heavy on public API; integration coverage for MUI / RDG / Glide.

---

## THE BAD ⚠️

1. **Deprecated `Plugins` still exported** (`src/index.ts` → `src/plugins/`). Preset JSDoc still teaches `Plugins.*`. Removal promised for v7.
   - *Fix:* Stop documenting Plugins now; keep shim until v7. Clarify `Plugins.MUI` = DataGrid only (not `muiTable`).

2. **`getColumnValues` is undead** — ROADMAP/CHANGELOG say removed in v6.7.0; still on `TableResult` with no `@deprecated`; still documented.
   - *Fix:* Mark `@deprecated` → `map` / `mapColumn`, or correct ROADMAP.

3. **Inconsistent public type exports** — `index.ts` exports some strategy types but not `TableStrategies` / `LoadingStrategy` / `ViewportStrategy` / etc.; `./types` dumps everything including `FinalTableConfig`.
   - *Fix:* Export strategy contracts from main entry; mark internals `@internal`.

4. **Dead / test-only strategy surface** — unused `Strategies.Resolution` (+ leftover import in `useTable`); no-op `Strategies.CellNavigation`; public `Strategies.Filter.spy`.
   - *Fix:* Delete or unexport; fix `scrollToColumn` JSDoc that still mentions CellNavigationStrategy.

5. **`FilterEngine` ignores `getCellLocator`** — uses `cellSelector` + `.nth(colIndex)`. Column-virtualized presets (aria-colindex) can filter the wrong cell on `getRow` / DOM half of find.
   - *Fix:* Resolve cells through `strategies.getCellLocator` (shared helper).

6. **`getRow` vs `findRow` filter semantics diverge** — overrides post-evaluated in `RowFinder.splitFilters` but not in sync `getRow`.
   - *Fix:* Reject override filters in `getRow` (like synthetics) or share split logic + document.

7. **`getValue` does not navigate** — `toJSON` / `getCell().bringIntoView()` do. Silent stale/empty reads on virtualized columns.
   - *Fix:* Same nav pipeline as `toJSON`, or throw when viewport/nav is configured and cell is unmounted.

8. **`table.scrollToColumn` / `bringIntoView` bypass viewport strategy** — fall through to `scrollIntoViewIfNeeded()` (Y-scroll footgun docs already warn about).
   - *Fix:* Delegate to `viewport.scrollToColumn` / `scrollToRow` when present.

9. **Soft-drift config / defaults** — `map` defaults to `concurrency: 'parallel'`; `maxPages: 1` surprises when presets are half-applied; writable `currentPageIndex`; `autoScroll: true` default; empty `pagination: {}` semantics.
   - *Fix:* Prefer safer defaults or louder docs; make `currentPageIndex` read-only (or warn).

10. **Double sort retry** — core `sorting.apply` retries ×3; MUI `doSort` also loops — up to 9 clicks.
    - *Fix:* Presets trigger-only; retries stay in core (stated design).

11. **Unbounded `isTableLoading` polls** in `countRows` / `waitForTableReady` (sort wait is bounded).
    - *Fix:* Shared timeout.

12. **`console.log` / `console.warn` in `generateConfig*`** — violates “use `logDebug`” / PHILOSOPHY logging rule.
    - *Fix:* Route through debug utils or dedicated channel.

13. **Stale CONTRIBUTING** still says `npm install` / `npm test` while the project is pnpm-first.

---

## THE UGLY 🚨

1. **Hard philosophy smell: Glide canvas / `Home` / settle magic in `_navigateToCell`** (`src/smartRow.ts`).
   - Comment even names Glide (“Midas Touch”). Preset that only works because core special-cases DOM shape — PHILOSOPHY’s last-line test.
   - *Action:* Move into Glide preset / navigation primitives (e.g. after-vertical-nav hook). Core calls primitives only.

2. **Generic strategies ship framework CSS defaults** — `HeaderStrategies.horizontalScroll` (`.dvn-scroller, .rdg-viewport, …`); `Viewport.dataAttribute` default `div[class*="overflow-auto"]`.
   - *Action:* Require explicit selectors; put library defaults in presets only.

3. **`_navigateToCell` is a fused 2D virtualization engine** (~320 lines) with poor removability — deleting the Glide preset would not delete this code.
   - *Action:* Extract to `src/engine/cellNavigation.ts`; no framework branches; freeze further growth in `useTable`/`smartRow` unless it is a new strategy hook.

4. **Pagination / scan loop fan-out** — findRow, findRows, runMap, countRows, findRowByIndex, async iterator, bringIntoView path planner. `runMap` got overscan/loading-before-dedupe/final-scan; `Symbol.asyncIterator` did not.
   - *Action:* One `scanPages` primitive; iterator should reuse `runMap` or be documented as thin/unsafe.

5. **ROADMAP is all `[x]`** — no scheduled work for v7 Plugin removal, cell-nav extraction, or “do not grow core.” Production bugfixes keep winning over Principle 2 (thin core).
   - *Action:* Add a short “philosophy debt” short-term section so GBU items have a home.

---

## TEST AUDIT

**Balance:** ~35 Vitest unit files vs ~39 Playwright specs. Engine internals are unit-heavy; public API is E2E-heavy. Integration covers MUI DataGrid/Table, RDG, RDG2D, Glide. Live DataGrid canaries exist outside CI A/B.

**Named feature coverage:** `contentReady` / `mutationSettled` covered in Grafana-style E2E (no units). Presets well covered via integration. **`Plugins` deprecation has zero tests.**

### Redundant Tests

| Test File | Scope | Duplicates | Recommendation |
|---|---|---|---|
| `tests/unit/paginationPath.test.ts` | “comprehensive” describe | First describe in same file | **Cut** comprehensive block |
| `tests/unit/tableMapper.test.ts` | Second processHeaders/getMap block | First TableMapper describe | **Merge** unique remap/clear; drop rest |
| `tests/unit/filterEngine.function.test.ts` | Function filters | `filterStrategies.more` + `locator-filtering.spec.ts` | **Cut** unit file |
| `tests/unit/filterStrategy.unit.test.ts` | Default text filter | `filterEngine` / `filterStrategies.more` | **Merge** |
| `tests/filter-strategy.spec.ts` | Spy invoked by getRow | Unit spy coverage | **Cut** E2E |
| `tests/revalidate.spec.ts` | New column after DOM change | `edge-cases.spec.ts` | **Cut** standalone |
| `tests/unit/toArray.test.ts` | Entire file | Reimplements production; never imports `useTable` | **Cut** or rewrite against real API |
| `tests/strategies.spec.ts` | Live HTMX infinite scroll | playground / grafana / live-t2 | **Cut** from CI A or demote (third-party flake risk) |
| `tests/performance.spec.ts` | 10k iterate | `playground-virtualization.spec.ts` | **Demote** to slow/optional |
| `tests/dedupe-strategy.spec.ts` | Static non-colliding Y | Real dedupe covered elsewhere | **Rewrite** with overlap or **cut** |
| `tests/a2-visible-iteration.spec.ts` | Overscan skip | `viewport-strategy` + `overscan-above` unit | **Keep reduced** one E2E |
| `tests/debug-mode.spec.ts` | Verbose map log strings | `debugUtils.coverage.test.ts` | **Keep reduced** (delays only) |
| `tests/unit/bot/bot-queue.test.ts` | GitHub bot queue | Not library | **Move** out of library unit suite or accept as tooling |

### Missing Tests

| Feature | Why Important | Suggested Test |
|---|---|---|
| `Plugins.*` alias parity | Public until v7; untested | Unit: deep-equal / shape match vs `presets.*` |
| `useTable().toArray()` | Public scrape API; current unit is tautological | E2E: equals map + reset page index |
| `Pagination.click` factory edge cases | Used everywhere; no unit for windowed goToPage / disabled next | Unit with mock locators |
| Stabilization `contentChanged` / `rowCountIncreased` | Defaults for click vs infinite scroll | Unit fingerprint/count change + timeout |
| `LoadingStrategies.Table.*` / `Row.*` | Built-ins barely covered | Unit per factory + one E2E skeleton skip |
| `contentReady` / `mutationSettled` units | Easy to regress in smartRow; only Grafana E2E | Unit: invoke with row; quietPeriod / timeout |
| Function selectors (`rowSelector`/`headerSelector`/`cellSelector`) | Documented; untested | E2E with function forms |
| `getRow` multi-match strict mode | Core contract | E2E: two matches → throw; findRows → 2 |
| Locale `buttonLabels` on MUI factories | #327 | Factory with non-English labels |
| `FillStrategies.default` input matrix | checkbox / contenteditable / click-to-edit | E2E matrix |

---

## SUMMARY

- **Overall health score: 7.5/10** — production-capable, well-tested, architecture still strategy-shaped; core virtualization weight and public-surface debt hold it back from 9+.
- **Philosophy alignment score: 7/10** — describe/strategy/preset model intact; Glide-in-core + framework CSS defaults + loop fan-out are the drift.
- **Top 3 priorities** (philosophy-restoring first):
  1. **Extract framework-shaped navigation** out of `_navigateToCell` into Glide/preset primitives; require explicit scroll containers on generic strategies.
  2. **Unify page/scan loops** (or document iterator as unsafe) so overscan/loading/dedupe behavior cannot diverge again.
  3. **Public-surface hygiene** — deprecate `getColumnValues`, stop teaching `Plugins`, prune dead `Strategies.*`, align ROADMAP with reality / add philosophy-debt items.

---

## Next (needs your call)

Per `/gbu` Step 5 — **no code changes from this audit until you reply:**

1. Which **Bad** or **Ugly** items do you want addressed first?
2. Which **redundant tests** should we cut/merge?
3. Which **missing tests** should we add?
