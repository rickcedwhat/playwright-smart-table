import type { Locator } from '@playwright/test';
import { TableConfig, TableResult } from './types';
/**
 * Main hook to interact with a table.
 */
export declare const useTable: <T = any>(rootLocator: Locator, configOptions?: TableConfig<T>) => TableResult<T>;
