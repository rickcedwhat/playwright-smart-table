export { PLAYWRIGHT_SMART_TABLE_VERSION } from './packageVersion';

export { useTable } from './useTable';

export type {
    TableConfig,
    TableResult,
    SmartRow,
    Selector,
    FilterValue,
    PaginationPrimitives,
    SortingStrategy,
    FillOptions,
    RowIterationContext,
    RowIterationOptions,
    TableContext,
    StrategyContext,
    BeforeCellReadFn,
    GetCellLocatorFn,
    GetActiveCellFn,
    DebugConfig,
} from './types';

// Export namespace-like strategy collections
export { Strategies } from './strategies';
export * as presets from './presets';

/** @deprecated Use `presets` instead. Plugins will be removed in v7.0.0. */
export { Plugins } from './plugins';
