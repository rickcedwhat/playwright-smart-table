import type { Locator } from '@playwright/test';
import type { TableConfig } from '../../types';
import { PaginationStrategies } from '../../strategies/pagination';

/** Default strategies for the MUI preset (used when you spread Plugins.MUI). */
const MUIDefaultStrategies = {
  pagination: PaginationStrategies.click({
    next: (root: Locator) => root.getByRole('button', { name: 'Go to next page' }),
  }),
};

/** Full strategies for MUI Data Grid. Use when you want to supply your own selectors: strategies: Plugins.MUI.Strategies */
export const MUIStrategies = MUIDefaultStrategies;

/**
 * Full preset for MUI Data Grid (selectors + headerTransformer + default strategies).
 * Spread: useTable(loc, { ...Plugins.MUI, maxPages: 5 }).
 * Strategies only: useTable(loc, { rowSelector: '...', strategies: Plugins.MUI.Strategies }).
 */
const MUIPreset: Partial<TableConfig> = {
  rowSelector: '.MuiDataGrid-row',
  headerSelector: '.MuiDataGrid-columnHeader',
  cellSelector: '.MuiDataGrid-cell',
  headerTransformer: ({ text }) => (text.includes('__col_') ? 'Actions' : text),
  strategies: MUIDefaultStrategies,
};
export const MUI: Partial<TableConfig> & { Strategies: typeof MUIStrategies } = Object.defineProperty(
  MUIPreset,
  'Strategies',
  { get: () => MUIStrategies, enumerable: false }
) as Partial<TableConfig> & { Strategies: typeof MUIStrategies };
