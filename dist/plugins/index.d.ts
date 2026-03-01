/**
 * Presets for specific table/grid libraries. Each plugin exposes:
 * - Plugins.X — full preset (selectors + headerTransformer if any + strategies). Spread: useTable(loc, { ...Plugins.MUI, maxPages: 5 }).
 * - Plugins.X.Strategies — strategies only. Use with your own selectors: useTable(loc, { rowSelector: '...', strategies: Plugins.MUI.Strategies }).
 */
export declare const Plugins: {
    RDG: Partial<import("..").TableConfig<any>> & {
        Strategies: typeof import("./rdg").RDGStrategies;
    };
    Glide: Partial<import("..").TableConfig<any>> & {
        Strategies: typeof import("./glide").GlideStrategies;
    };
    MUI: Partial<import("..").TableConfig<any>> & {
        Strategies: typeof import("./mui").MUIStrategies;
    };
};
