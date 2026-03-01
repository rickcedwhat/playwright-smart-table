import { RDG } from './rdg';
import { Glide } from './glide';
import { MUI } from './mui';

/**
 * Presets for specific table/grid libraries. Each plugin exposes:
 * - Plugins.X — full preset (selectors + headerTransformer if any + strategies). Spread: useTable(loc, { ...Plugins.MUI, maxPages: 5 }).
 * - Plugins.X.Strategies — strategies only. Use with your own selectors: useTable(loc, { rowSelector: '...', strategies: Plugins.MUI.Strategies }).
 */
export const Plugins = {
    RDG,
    Glide,
    MUI,
};
