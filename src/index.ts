export { PLAYWRIGHT_SMART_TABLE_VERSION } from './packageVersion';

export { useTable } from './useTable';

export type {
    TableConfig,
    TableResult,
    SmartRow,
    SmartCell,
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
    SyntheticColumnDef,
    ColumnOverride,
    ColumnOverrideReadContext,
    TableStrategies,
    LoadingStrategy,
    ViewportStrategy,
    FilterStrategy,
    NavigationPrimitives,
    DedupeStrategy,
    ContentReadyStrategy,
    FillStrategy,
    PaginationStrategy,
    HeaderStrategy,
} from './types';

// Export namespace-like strategy collections
export { Strategies } from './strategies';
export * as presets from './presets';

/**
 * @deprecated Use `presets` instead (`presets.muiDataGrid`, `presets.rdg`, `presets.glide`, …).
 * `Plugins` will be removed in v7.0.0.
 * Note: `Plugins.MUI` is the **DataGrid** preset only — for MUI Table use `presets.muiTable`.
 */
export { Plugins } from './plugins';

export { mergeTableConfig } from './utils/mergeTableConfig';
