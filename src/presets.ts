import { Locator } from '@playwright/test';
import { useTable } from './useTable';
import { TableConfig } from './types';

/**
 * Preset for Key-Value Forms.
 * * Default Structure:
 * - Row: div.form-group
 * - Cell: Direct children (> *)
 * - Columns: ['Label', 'Input']
 */
export const useForm = (rootLocator: Locator, options: TableConfig = {}) => {
  return useTable(rootLocator, {
    // Defaults:
    rowSelector: 'div.form-group',
    cellSelector: (row) => row.locator('> *'),
    headerSelector: null, // Forms rarely have headers
    columnNames: ['Label', 'Input'], // Virtual Headers
    
    // User Overrides (User wins):
    ...options
  });
};

/**
 * Preset for Navigation Menus.
 * * Default Structure:
 * - Row: li
 * - Cell: null (The row IS the cell)
 * - Columns: ['Item']
 */
export const useMenu = (menuLocator: Locator, options: TableConfig = {}) => {
  return useTable(menuLocator, {
    // Defaults:
    rowSelector: 'li',
    cellSelector: null,
    headerSelector: null,
    columnNames: ['Item'],
    
    // User Overrides (User wins):
    ...options
  });
};