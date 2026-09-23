import { PaginationStrategies } from './pagination';
import { SortingStrategies } from './sorting';
import { HeaderStrategies } from './headers';
import { FillStrategies } from './fill';
import { DedupeStrategies } from './dedupe';
import { LoadingStrategies } from './loading';
import { StabilizationStrategies } from './stabilization';
import { FilterStrategies } from './filter';
import { ViewportStrategies } from './viewport';
import { ContentReadyStrategies } from './contentReady';

export * from './pagination';
export * from './sorting';
export * from './columns';
export * from './headers';
export * from './fill';
// ColumnResolutionStrategy type only — ResolutionStrategies factory is unused in core (#428)
export type { ColumnResolutionStrategy } from './resolution';
export * from './dedupe';
export * from './loading';
export * from './stabilization';
export * from './filter';
export * from './viewport';
export * from './contentReady';

/**
 * Built-in strategy factories.
 * @note `CellNavigation` / `Resolution` removed from this namespace in #428 (dead/no-op).
 * Use `strategies.navigation` (NavigationPrimitives) and header maps instead.
 * `Filter.spy` was test-only and is no longer shipped.
 */
export const Strategies = {
    Pagination: PaginationStrategies,
    Sorting: SortingStrategies,
    Header: HeaderStrategies,
    Fill: FillStrategies,
    Dedupe: DedupeStrategies,
    Loading: LoadingStrategies,
    Stabilization: StabilizationStrategies,
    Filter: FilterStrategies,
    Viewport: ViewportStrategies,
    ContentReady: ContentReadyStrategies,
};
