import type { Locator, Page } from '@playwright/test';
import { FinalTableConfig, Selector, SmartRow } from '../types';
import { FilterEngine } from '../filterEngine';
import { TableMapper } from './tableMapper';
import { SmartRowArray } from '../utils/smartRowArray';
export declare class RowFinder<T = any> {
    private rootLocator;
    private config;
    private filterEngine;
    private tableMapper;
    private makeSmartRow;
    private resolve;
    constructor(rootLocator: Locator, config: FinalTableConfig, resolve: (item: Selector, parent: Locator | Page) => Locator, filterEngine: FilterEngine, tableMapper: TableMapper, makeSmartRow: (loc: Locator, map: Map<string, number>, index: number) => SmartRow<T>);
    private log;
    findRow(filters: Record<string, string | RegExp | number>, options?: {
        exact?: boolean;
        maxPages?: number;
    }): Promise<SmartRow<T>>;
    findRows<R extends {
        asJSON?: boolean;
    }>(filters: Partial<T> | Record<string, string | RegExp | number>, options?: {
        exact?: boolean;
        maxPages?: number;
    } & R): Promise<R['asJSON'] extends true ? Record<string, string>[] : SmartRowArray<T>>;
    private findRowLocator;
}
