# Plugin Template (Library Plugins)

This document defines the **standard pattern** for plugins shipped in `src/plugins/` and exported via `Plugins` (e.g. MUI, RDG, Glide). Follow this structure when adding or updating a library plugin.

---

## 1. File layout

- **Location:** Each plugin is a directory with an entry file: `src/plugins/<name>/index.ts` (e.g. `src/plugins/mui/index.ts`, `src/plugins/rdg/index.ts`, `src/plugins/glide/index.ts`). Add helper modules in the same directory as needed (e.g. `src/plugins/glide/columns.ts`, `src/plugins/glide/headers.ts`).
- **Registration:** Import the preset in `src/plugins/index.ts` and add it to the `Plugins` object (e.g. `import { Glide } from './glide'` — resolves to `glide/index.ts`).
- **Shared strategies:** From inside a plugin directory, import from `../../strategies/` for pagination, stabilization, etc. (e.g. `import { PaginationStrategies } from '../../strategies/pagination'`).
- **Types:** Import from `../../types` (e.g. `import type { TableConfig, FillStrategy } from '../../types'`).

**Creating a new plugin:** Add `src/plugins/<name>/index.ts`, implement preset + strategies per sections 2–4, then register in `src/plugins/index.ts`.

---

## 2. Naming

- **Default strategies (internal):** `XxxDefaultStrategies` — the strategies object used when users spread the preset (`...Plugins.Xxx`). Include only the strategies you want as the default (e.g. default `fill`, not alternative `fillSimple`).
- **Full strategies (exported):** `XxxStrategies` — the full bag exposed as `Plugins.Xxx.Strategies`. Can be the same as default or add optional/alternative strategies (e.g. `fillSimple`) for power users who build config manually.
- **Preset (exported):** `Xxx` — the full preset object (selectors + optional `headerTransformer` + default strategies). Users spread it: `useTable(loc, { ...Plugins.Xxx, maxPages: 5 })`.

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
const XxxPreset: Partial<TableConfig> = {
  rowSelector: '...',
  headerSelector: '...',
  cellSelector: '...',
  headerTransformer: ({ text }) => text,  // optional
  strategies: XxxDefaultStrategies        // preset uses default only
};

// 5. Export preset with non-enumerable .Strategies getter (so spread doesn't copy it)
export const Xxx: Partial<TableConfig> & { Strategies: typeof XxxStrategies } = Object.defineProperty(
  XxxPreset,
  'Strategies',
  { get: () => XxxStrategies, enumerable: false }
) as Partial<TableConfig> & { Strategies: typeof XxxStrategies };
```

---

## 4. Rules

| Rule | Why |
|------|-----|
| **Preset uses `XxxDefaultStrategies`** | The spread `...Plugins.Xxx` should only include strategies that are actually used by default. Optional alternatives (e.g. `fillSimple`) live only on `Plugins.Xxx.Strategies`. |
| **`Strategies` is a non-enumerable getter** | So `Object.keys(Plugins.Xxx)` and spread don’t include `Strategies`. Inspecting or spreading the preset stays clean; users access strategies via `Plugins.Xxx.Strategies`. |
| **Don’t export internal strategy functions** | Only export `XxxStrategies` and `Xxx`. Keep individual strategy implementations (e.g. `myFillStrategy`) as module-private `const`s so the public API is just the two exports. |
| **Full strategies = default + extras** | If there are no optional strategies, `XxxStrategies` can equal `XxxDefaultStrategies`. If there are (e.g. `fillSimple`), build `XxxStrategies` as `{ ...XxxDefaultStrategies, fillSimple }`. |

---

## 5. Register in `src/plugins/index.ts`

```typescript
import { Xxx } from './xxx';  // resolves to ./xxx/index.ts

export const Plugins = {
  // ...
  Xxx,
};
```

---

## 6. Usage (for users)

- **Preset (defaults only):** `useTable(loc, { ...Plugins.Xxx, maxPages: 5 })`
- **Strategies only (full bag, own selectors):** `useTable(loc, { rowSelector: '...', headerSelector: '...', cellSelector: '...', strategies: Plugins.Xxx.Strategies })`
- **Override a strategy:** `useTable(loc, { ...Plugins.Xxx, strategies: { ...Plugins.Xxx.Strategies, fill: Plugins.Xxx.Strategies.fillSimple } })`

---

## 7. Reference implementations

- **MUI** (`src/plugins/mui/index.ts`) — minimal: default and full strategies are the same; no optional strategies.
- **RDG** (`src/plugins/rdg/index.ts`) — same as MUI; default and full are the same.
- **Glide** (`src/plugins/glide/index.ts` + `glide/columns.ts`, `glide/headers.ts`) — default vs full: preset uses `GlideDefaultStrategies` (no `fillSimple`); `GlideStrategies` adds `fillSimple` for manual configs.
