import { PaginationStrategies, DeprecatedPaginationStrategies } from './pagination';
import { SortingStrategies } from './sorting';
import { ColumnStrategies, CellNavigationStrategies } from './columns';
import { HeaderStrategies } from './headers';
import { FillStrategies } from './fill';
import { ResolutionStrategies } from './resolution';

export * from './pagination';
export * from './sorting';
export * from './columns';
export * from './headers';
export * from './fill';
export * from './resolution';

export const Strategies = {
    Pagination: PaginationStrategies,
    Sorting: SortingStrategies,
    Column: ColumnStrategies,
    CellNavigation: CellNavigationStrategies,
    Header: HeaderStrategies,
    Fill: FillStrategies,
    Resolution: ResolutionStrategies,
    // Alias for backward compatibility if needed, though we are encouraging the new structure
    DeprecatedPagination: DeprecatedPaginationStrategies
};