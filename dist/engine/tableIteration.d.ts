import type { Locator, Page } from '@playwright/test';
import type { SmartRow, RowIterationContext, RowIterationOptions } from '../types';
import type { FinalTableConfig } from '../types';
import type { SmartRowArray } from '../utils/smartRowArray';
export interface TableIterationEnv<T = any> {
    getRowLocators: () => Locator;
    getMap: () => Map<string, number>;
    advancePage: (useBulk: boolean) => Promise<boolean>;
    makeSmartRow: (rowLocator: Locator, map: Map<string, number>, rowIndex: number, tablePageIndex?: number) => SmartRow<T>;
    createSmartRowArray: (rows: SmartRow<T>[]) => SmartRowArray<T>;
    config: FinalTableConfig<T>;
    getPage: () => Page;
}
/**
 * Shared row-iteration loop used by forEach, map, and filter.
 */
export declare function runForEach<T>(env: TableIterationEnv<T>, callback: (ctx: RowIterationContext<T>) => void | Promise<void>, options?: RowIterationOptions): Promise<void>;
/**
 * Shared row-iteration loop for map.
 */
export declare function runMap<T, R>(env: TableIterationEnv<T>, callback: (ctx: RowIterationContext<T>) => R | Promise<R>, options?: RowIterationOptions): Promise<R[]>;
/**
 * Shared row-iteration loop for filter.
 */
export declare function runFilter<T>(env: TableIterationEnv<T>, predicate: (ctx: RowIterationContext<T>) => boolean | Promise<boolean>, options?: RowIterationOptions): Promise<SmartRowArray<T>>;
