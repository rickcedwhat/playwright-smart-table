"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Plugins = void 0;
const rdg_1 = require("./rdg");
const glide_1 = require("./glide");
const mui_1 = require("./mui");
/**
 * Presets for specific table/grid libraries. Each plugin exposes:
 * - Plugins.X — full preset (selectors + headerTransformer if any + strategies). Spread: useTable(loc, { ...Plugins.MUI, maxPages: 5 }).
 * - Plugins.X.Strategies — strategies only. Use with your own selectors: useTable(loc, { rowSelector: '...', strategies: Plugins.MUI.Strategies }).
 */
exports.Plugins = {
    RDG: rdg_1.RDG,
    Glide: glide_1.Glide,
    MUI: mui_1.MUI,
};
