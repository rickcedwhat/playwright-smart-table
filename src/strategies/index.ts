import { PaginationStrategies } from './pagination';
import { SortingStrategies } from './sorting';
import { CellNavigationStrategies } from './columns';
import { HeaderStrategies } from './headers';
import { FillStrategies } from './fill';
import { ResolutionStrategies } from './resolution';
import { DedupeStrategies } from './dedupe';

export * from './pagination';
export * from './sorting';
export * from './columns';
export * from './headers';
export * from './fill';
export * from './resolution';
export * from './dedupe';

export const Strategies = {
    Pagination: PaginationStrategies,
    Sorting: SortingStrategies,
    CellNavigation: CellNavigationStrategies,
    Header: HeaderStrategies,
    Fill: FillStrategies,
    Resolution: ResolutionStrategies,
    Dedupe: DedupeStrategies,
};