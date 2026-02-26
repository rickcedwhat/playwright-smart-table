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
} from './types';

// Export namespace-like strategy collections
export { Strategies } from './strategies';
export { Plugins } from './plugins';
