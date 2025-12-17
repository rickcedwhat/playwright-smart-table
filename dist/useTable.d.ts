import type { Locator } from '@playwright/test';
import { TableConfig, TableResult } from './types';
export declare const useTable: (rootLocator: Locator, configOptions?: TableConfig) => TableResult;
