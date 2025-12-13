import { Locator } from '@playwright/test';
import { TableConfig } from './types';
/**
 * Preset for Key-Value Forms.
 * * Default Structure:
 * - Row: div.form-group
 * - Cell: Direct children (> *)
 * - Columns: ['Label', 'Input']
 */
export declare const useForm: (rootLocator: Locator, options?: TableConfig) => import("./types").TableResult;
/**
 * Preset for Navigation Menus.
 * * Default Structure:
 * - Row: li
 * - Cell: null (The row IS the cell)
 * - Columns: ['Item']
 */
export declare const useMenu: (menuLocator: Locator, options?: TableConfig) => import("./types").TableResult;
