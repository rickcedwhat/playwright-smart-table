import type { Locator, Page } from '@playwright/test';
import { FinalTableConfig, Selector } from '../types';
export declare class TableMapper {
    private _headerMap;
    private config;
    private rootLocator;
    private resolve;
    constructor(rootLocator: Locator, config: FinalTableConfig, resolve: (item: Selector, parent: Locator | Page) => Locator);
    private log;
    getMap(timeout?: number): Promise<Map<string, number>>;
    remapHeaders(): Promise<void>;
    getMapSync(): Map<string, number> | null;
    isInitialized(): boolean;
    clear(): void;
    private processHeaders;
}
