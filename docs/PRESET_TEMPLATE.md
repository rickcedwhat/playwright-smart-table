# Preset Template (Library Presets)

This document defines the **standard pattern** for presets shipped in `src/presets/` and exported via the public API (e.g. `muiTable`, `rdg`, `glide`). Follow this structure when adding or updating a library preset.

---

## 1. File layout

- **Location:** Each preset is either a single file `src/presets/<name>.ts` or a directory `src/presets/<name>/index.ts`. Add helper modules in the same directory as needed (e.g. `src/presets/glide/columns.ts`, `src/presets/glide/headers.ts`).
- **Registration:** Import the preset in `src/presets/index.ts` and export it.
- **Shared strategies:** From inside a preset directory, import from `../../strategies/` for pagination, stabilization, etc. (e.g. `import { PaginationStrategies } from '../../strategies/pagination'`).
- **Types:** Import from `../../types` (e.g. `import type { TableConfig, FillStrategy } from '../../types'`).

**Creating a new preset:** Add `src/presets/<name>.ts` (and directory if needed), implement configuration + strategies per sections 2–4, then register in `src/presets/index.ts`.

---

## 2. Naming

- **Default strategies (internal):** `XxxDefaultStrategies` — the strategies object used when users spread the preset. Include only the strategies you want as the default (e.g. default `fill`, not alternative `fillSimple`).
- **Full strategies (exported):** `XxxStrategies` — the full bag. Can be the same as default or add optional/alternative strategies (e.g. `fillSimple`) for power users who build config manually.
- **Preset (exported):** `xxx` — the full preset object (selectors + optional `headerTransformer` + default strategies). Users spread it: `useTable(loc, { ...xxx, maxPages: 5 })`.

---

## 3. Structure (code pattern)

```typescript
// 1. Internal strategy implementations (no export)
const myFillStrategy: FillStrategy = async ({ value, page }) => { /* ... */ };
const myFillSimple: FillStrategy = async ({ value, page }) => { /* ... */ }; // optional alternative

// 2. Default strategies — what the preset uses (no optional/alternative strategies)
const XxxDefaultStrategies = {
  fill: myFillStrategy,
  pagination: myPaginationStrategy,
  header: myHeaderStrategy,
  // ... only defaults
};

// 3. Full strategies — default + any optional/alternative strategies (exported)
export const XxxStrategies = {
  ...XxxDefaultStrategies,
  fillSimple: myFillSimple  // optional; omit if no extras
};

// 4. Preset — selectors, optional headerTransformer, and default strategies only
export const xxx: Partial<TableConfig> & { strategies: typeof XxxStrategies } = {
  rowSelector: '...',
  headerSelector: '...',
  cellSelector: '...',
  headerTransformer: ({ text }) => text,  // optional
  strategies: XxxStrategies               // preset uses the strategy bag
};
```

---

## 4. Rules

| Rule | Why |
|------|-----|
| **Preset uses `XxxStrategies`** | The preset object should include the strategy bag so users can access both defaults and alternatives. |
| **Don’t export internal strategy functions** | Only export `XxxStrategies` and the preset itself. Keep individual strategy implementations as module-private `const`s. |
| **Full strategies = default + extras** | If there are no optional strategies, `XxxStrategies` can equal `XxxDefaultStrategies`. If there are (e.g. `fillSimple`), build `XxxStrategies` as `{ ...XxxDefaultStrategies, fillSimple }`. |

---

## 5. Register in `src/presets/index.ts`

```typescript
export { xxx } from './xxx';
```

---

## 6. Usage (for users)

- **Preset (defaults only):** `useTable(loc, { ...xxx, maxPages: 5 })`
- **Strategies only (full bag, own selectors):** `useTable(loc, { rowSelector: '...', headerSelector: '...', cellSelector: '...', strategies: xxx.strategies })`
- **Override a strategy:** `useTable(loc, { ...xxx, strategies: { ...xxx.strategies, fill: xxx.strategies.fillSimple } })`

---

## 7. Reference implementations

- **MUI** (`src/presets/mui.ts`) — handles both standard tables and DataGrid.
- **RDG** (`src/presets/rdg.ts`) — clean implementation with vertical virtualization support.
- **Glide** (`src/presets/glide/index.ts` + `glide/columns.ts`, `glide/headers.ts`) — handles canvas-based data grid with DOM accessibility fallbacks.
