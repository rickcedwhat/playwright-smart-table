"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MUI = exports.MUIStrategies = void 0;
const pagination_1 = require("./pagination");
/** Default strategies for the MUI preset (used when you spread Plugins.MUI). */
const MUIDefaultStrategies = {
    pagination: pagination_1.PaginationStrategies.click({
        next: (root) => root.getByRole('button', { name: 'Go to next page' }),
    }),
};
/** Full strategies for MUI Data Grid. Use when you want to supply your own selectors: strategies: Plugins.MUI.Strategies */
exports.MUIStrategies = MUIDefaultStrategies;
/**
 * Full preset for MUI Data Grid (selectors + headerTransformer + default strategies).
 * Spread: useTable(loc, { ...Plugins.MUI, maxPages: 5 }).
 * Strategies only: useTable(loc, { rowSelector: '...', strategies: Plugins.MUI.Strategies }).
 */
const MUIPreset = {
    rowSelector: '.MuiDataGrid-row',
    headerSelector: '.MuiDataGrid-columnHeader',
    cellSelector: '.MuiDataGrid-cell',
    headerTransformer: ({ text }) => (text.includes('__col_') ? 'Actions' : text),
    strategies: MUIDefaultStrategies,
};
exports.MUI = Object.defineProperty(MUIPreset, 'Strategies', { get: () => exports.MUIStrategies, enumerable: false });
