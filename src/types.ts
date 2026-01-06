import type { Locator, Page } from '@playwright/test';

export type Selector = string | ((root: Locator | Page) => Locator);

export type SmartRow = Locator & {
  getCell(column: string): Locator;
  toJSON(): Promise<Record<string, string>>;
  /**
   * Fills the row with data. Automatically detects input types (text input, select, checkbox, etc.).
   */
  fill: (data: Record<string, any>, options?: FillOptions) => Promise<void>;
};

export type StrategyContext = TableContext;

/**
 * Defines the contract for a sorting strategy.
 */
export interface SortingStrategy {
  /**
   * Performs the sort action on a column.
   */
  doSort(options: {
    columnName: string;
    direction: 'asc' | 'desc';
    context: StrategyContext;
  }): Promise<void>;

  /**
   * Retrieves the current sort state of a column.
   */
  getSortState(options: {
    columnName: string;
    context: StrategyContext;
  }): Promise<'asc' | 'desc' | 'none'>;
}

export interface TableContext {
  root: Locator;
  config: FinalTableConfig;
  page: Page;
  resolve: (selector: Selector, parent: Locator | Page) => Locator;
}

export type PaginationStrategy = (context: TableContext) => Promise<boolean>;

export type DedupeStrategy = (row: SmartRow) => string | number | Promise<string | number>;

export interface PromptOptions {
  /**
   * Output Strategy:
   * - 'error': Throws an error with the prompt (useful for platforms that capture error output cleanly).
   * - 'console': Standard console logs (Default).
   */
  output?: 'console' | 'error';
  includeTypes?: boolean;
}

export type FillStrategy = (options: {
  row: SmartRow;
  columnName: string;
  value: any;
  index: number;
  page: Page;
  rootLocator: Locator;
  table: TableResult; // The parent table instance
  fillOptions?: FillOptions;
}) => Promise<void>;

export interface TableConfig {
  rowSelector?: Selector;
  headerSelector?: Selector;
  cellSelector?: Selector;
  pagination?: PaginationStrategy;
  sorting?: SortingStrategy;
  fillStrategy?: FillStrategy;
  maxPages?: number;
  /**
   * Hook to rename columns dynamically.
   * * @param args.text - The default innerText of the header.
   * @param args.index - The column index.
   * @param args.locator - The specific header cell locator.
   */
  headerTransformer?: (args: { text: string, index: number, locator: Locator }) => string | Promise<string>;
  autoScroll?: boolean;
  /**
   * Enable debug mode to log internal state to console.
   */
  debug?: boolean;
  /**
   * Strategy to reset the table to the initial page.
   * Called when table.reset() is invoked.
   */
  onReset?: (context: TableContext) => Promise<void>;
}

/**
 * Represents the final, resolved table configuration after default values have been applied.
 * All optional properties from TableConfig are now required, except for `sorting`.
 */
export type FinalTableConfig = Required<Omit<TableConfig, 'sorting' | 'fillStrategy'>> & {
  sorting?: SortingStrategy;
  fillStrategy?: FillStrategy;
};

export interface FillOptions {
  /**
   * Custom input mappers for specific columns.
   * Maps column names to functions that return the input locator for that cell.
   * Columns not specified here will use auto-detection.
   */
  inputMappers?: Record<string, (cell: Locator) => Locator>;
}

export interface TableResult {
  /**
   * Initializes the table by resolving headers. Must be called before using sync methods.
   * @param options Optional timeout for header resolution (default: 3000ms)
   */
  init(options?: { timeout?: number }): Promise<TableResult>;

  getHeaders: () => Promise<string[]>;
  getHeaderCell: (columnName: string) => Promise<Locator>;

  /**
   * Finds a row on the current page only. Returns immediately (sync).
   * Throws error if table is not initialized.
   */
  getByRow: (
    filters: Record<string, string | RegExp | number>,
    options?: { exact?: boolean }
  ) => SmartRow;

  /**
   * Searches for a row across all available data using the configured strategy (pagination, scroll, etc.).
   * Auto-initializes if needed.
   */
  searchForRow: (
    filters: Record<string, string | RegExp | number>,
    options?: { exact?: boolean, maxPages?: number }
  ) => Promise<SmartRow>;

  getAllCurrentRows: <T extends { asJSON?: boolean }>(
    options?: { filter?: Record<string, any>, exact?: boolean } & T
  ) => Promise<T['asJSON'] extends true ? Record<string, string>[] : SmartRow[]>;

  /**
   * @deprecated Use getAllCurrentRows instead. This method will be removed in a future major version.
   */
  getAllRows: <T extends { asJSON?: boolean }>(
    options?: { filter?: Record<string, any>, exact?: boolean } & T
  ) => Promise<T['asJSON'] extends true ? Record<string, string>[] : SmartRow[]>;

  generateConfigPrompt: (options?: PromptOptions) => Promise<void>;
  generateStrategyPrompt: (options?: PromptOptions) => Promise<void>;

  /**
   * Resets the table state (clears cache, flags) and invokes the onReset strategy.
   */
  reset: () => Promise<void>;

  /**
   * Scans a specific column across all pages and returns the values.
   */
  getColumnValues: <V = string>(column: string, options?: { mapper?: (cell: Locator) => Promise<V> | V, maxPages?: number }) => Promise<V[]>;

  /**
   * Provides access to sorting actions and assertions.
   */
  sorting: {
    /**
     * Applies the configured sorting strategy to the specified column.
     * @param columnName The name of the column to sort.
     * @param direction The direction to sort ('asc' or 'desc').
     */
    apply(columnName: string, direction: 'asc' | 'desc'): Promise<void>;
    /**
     * Gets the current sort state of a column using the configured sorting strategy.
     * @param columnName The name of the column to check.
     * @returns A promise that resolves to 'asc', 'desc', or 'none'.
     */
    getState(columnName: string): Promise<'asc' | 'desc' | 'none'>;
  };

  /**
   * Iterates through paginated table data, calling the callback for each iteration.
   * Callback return values are automatically appended to allData, which is returned.
   */
  iterateThroughTable: <T = any>(
    callback: (context: {
      index: number;
      isFirst: boolean;
      isLast: boolean;
      rows: SmartRow[];
      allData: T[];
      table: RestrictedTableResult;
    }) => T | Promise<T>,
    options?: {
      pagination?: PaginationStrategy;
      dedupeStrategy?: DedupeStrategy;
      maxIterations?: number;
      getIsFirst?: (context: { index: number }) => boolean;
      getIsLast?: (context: { index: number, paginationResult: boolean }) => boolean;
      onFirst?: (context: { index: number, rows: SmartRow[], allData: any[] }) => void | Promise<void>;
      onLast?: (context: { index: number, rows: SmartRow[], allData: any[] }) => void | Promise<void>;
    }
  ) => Promise<T[]>;
}

/**
 * Restricted table result that excludes methods that shouldn't be called during iteration.
 */
export type RestrictedTableResult = Omit<TableResult, 'searchForRow' | 'iterateThroughTable' | 'reset' | 'getAllRows'>;