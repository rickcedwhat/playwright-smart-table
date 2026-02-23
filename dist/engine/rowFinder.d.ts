import type { Locator, Page } from '@playwright/test';
import { FinalTableConfig, Selector, SmartRow, FilterValue } from '../types';
import { FilterEngine } from '../filterEngine';
import { TableMapper } from './tableMapper';
import { SmartRowArray } from '../utils/smartRowArray';
export declare class RowFinder<T = any> {
    private rootLocator;
    private config;
    private filterEngine;
    private tableMapper;
    private makeSmartRow;
    private tableState;
    private resolve;
    constructor(rootLocator: Locator, config: FinalTableConfig, resolve: (item: Selector, parent: Locator | Page) => Locator, filterEngine: FilterEngine, tableMapper: TableMapper, makeSmartRow: (loc: Locator, map: Map<string, number>, index: number, tablePageIndex?: number) => SmartRow<T>, tableState?: {
        currentPageIndex: number;
    });
    private log;
    findRow(filters: Record<string, FilterValue>, options?: {
        exact?: boolean;
        maxPages?: number;
    }): Promise<SmartRow<T>>;
    findRows(filtersOrOptions?: (Partial<T> | Record<string, FilterValue>) & ({
        exact?: boolean;
        maxPages?: number;
    }), legacyOptions?: {
        exact?: boolean;
        maxPages?: number;
    }): Promise<SmartRowArray<T>>;
    private findRowLocator;
}
