import type { Locator, Page } from '@playwright/test';
import { SmartRow as SmartRowType, FinalTableConfig, TableResult } from './types';
/**
 * Factory to create a SmartRow by extending a Playwright Locator.
 * We avoid Class/Proxy to ensure full compatibility with Playwright's expect(locator) matchers.
 */
export declare const createSmartRow: <T = any>(rowLocator: Locator, map: Map<string, number>, rowIndex: number | undefined, config: FinalTableConfig, rootLocator: Locator, resolve: (item: any, parent: Locator | Page) => Locator, table: TableResult<T> | null) => SmartRowType<T>;
