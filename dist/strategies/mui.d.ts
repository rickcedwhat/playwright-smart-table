import type { TableConfig } from '../types';
/** Full strategies for MUI Data Grid. Use when you want to supply your own selectors: strategies: Plugins.MUI.Strategies */
export declare const MUIStrategies: {
    pagination: import("../types").PaginationPrimitives;
};
export declare const MUI: Partial<TableConfig> & {
    Strategies: typeof MUIStrategies;
};
