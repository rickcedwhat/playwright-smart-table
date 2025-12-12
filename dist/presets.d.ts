import { Locator } from '@playwright/test';
import { TableConfig } from './types';
/**
 * Preset for Key-Value Forms.
 * * Default Structure:
 * - Row: div.form-group
 * - Cell: Direct children (> *)
 * - Columns: ['Label', 'Input']
 */
export declare const useForm: (rootLocator: Locator, options?: TableConfig) => {
    getHeaders: () => Promise<string[]>;
    getByRow: (filters: Record<string, string | RegExp | number>, options?: {
        exact?: boolean;
        maxPages?: number;
    }) => Promise<Locator>;
    getByCell: (rowFilters: Record<string, string | RegExp | number>, targetColumn: string) => Promise<Locator>;
    getRows: () => Promise<Record<string, string>[]>;
    getRowAsJSON: (filters: Record<string, string | RegExp | number>) => Promise<Record<string, string>>;
    setColumnName: (colIndex: number, newNameOrFn: string | ((current: string) => string)) => Promise<void>;
    generateConfigPrompt: () => Promise<void>;
    generateStrategyPrompt: () => Promise<void>;
};
/**
 * Preset for Navigation Menus.
 * * Default Structure:
 * - Row: li
 * - Cell: null (The row IS the cell)
 * - Columns: ['Item']
 */
export declare const useMenu: (menuLocator: Locator, options?: TableConfig) => {
    getHeaders: () => Promise<string[]>;
    getByRow: (filters: Record<string, string | RegExp | number>, options?: {
        exact?: boolean;
        maxPages?: number;
    }) => Promise<Locator>;
    getByCell: (rowFilters: Record<string, string | RegExp | number>, targetColumn: string) => Promise<Locator>;
    getRows: () => Promise<Record<string, string>[]>;
    getRowAsJSON: (filters: Record<string, string | RegExp | number>) => Promise<Record<string, string>>;
    setColumnName: (colIndex: number, newNameOrFn: string | ((current: string) => string)) => Promise<void>;
    generateConfigPrompt: () => Promise<void>;
    generateStrategyPrompt: () => Promise<void>;
};
