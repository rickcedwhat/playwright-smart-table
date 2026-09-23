import { rdg as RDG, glide as Glide, muiDataGrid as MUI } from '../presets';

/**
 * @deprecated Use `presets` instead. Plugins will be removed in v7.0.0.
 *
 * Compatibility shim over official presets:
 * - `Plugins.MUI` → `presets.muiDataGrid` (**DataGrid only** — not `presets.muiTable`)
 * - `Plugins.RDG` → `presets.rdg`
 * - `Plugins.Glide` → `presets.glide`
 *
 * Prefer: `useTable(loc, { ...presets.muiDataGrid, maxPages: 5 })`.
 * Strategies only: `useTable(loc, { rowSelector: '...', strategies: presets.muiDataGrid.strategies })`.
 */
export const Plugins = {
    /** @deprecated Use `presets.rdg` */
    RDG: { ...RDG, Strategies: RDG.Strategies },
    /** @deprecated Use `presets.glide` */
    Glide: { ...Glide, Strategies: Glide.Strategies },
    /**
     * @deprecated Use `presets.muiDataGrid`.
     * DataGrid only — for MUI `<Table>` use `presets.muiTable`.
     */
    MUI: { ...MUI, Strategies: MUI.strategies },
};
