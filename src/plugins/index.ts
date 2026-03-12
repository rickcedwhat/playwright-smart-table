import { rdg as RDG, glide as Glide, muiDataGrid as MUI } from '../presets';

/**
 * @deprecated Use `presets` instead. Plugins will be removed in v7.0.0.
 * Presets for specific table/grid libraries. Each plugin exposes:
 * - Plugins.X — full preset (selectors + headerTransformer if any + strategies). Spread: useTable(loc, { ...Presets.MUI, maxPages: 5 }).
 * - Plugins.X.Strategies — strategies only. Use with your own selectors: useTable(loc, { rowSelector: '...', strategies: Presets.MUI.Strategies }).
 */
export const Plugins = {
    /** @deprecated Use `presets.rdg` */
    RDG: { ...RDG, Strategies: RDG.strategies },
    /** @deprecated Use `presets.glide` */
    Glide: { ...Glide, Strategies: Glide.strategies },
    /** @deprecated Use `presets.muiDataGrid` */
    MUI: { ...MUI, Strategies: MUI.strategies },
};
