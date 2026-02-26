import type { Locator, Page } from '@playwright/test';
import type { SmartRowArray } from './utils/smartRowArray';

/**
 * Flexible selector type - can be a CSS string, function returning a Locator, or Locator itself.
 * @example
 * // String selector
 * rowSelector: 'tbody tr'
 * 
 * // Function selector
 * rowSelector: (root) => root.locator('[role="row"]')
 */
export type Selector = string | ((root: Locator | Page) => Locator) | ((root: Locator) => Locator);

/**
 * Value used to filter rows.
 * - string/number/RegExp: filter by text content of the cell.
 * - function: filter by custom locator logic within the cell.
 * @example
 * // Text filter
 * { Name: 'John' }
 * 
 * // Custom locator filter (e.g. checkbox is checked)
 * { Status: (cell) => cell.locator('input:checked') }
 */
export type FilterValue = string | RegExp | number | ((cell: Locator) => Locator);

/**
 * Function to get a cell locator given row, column info.
 * Replaces the old cellResolver.
 */
export type GetCellLocatorFn = (args: {
  row: Locator;
  columnName: string;
  columnIndex: number;
  rowIndex?: number;
  page: Page;
}) => Locator;

/**
 * Hook called before each cell value is read in toJSON (and columnOverrides.read).
 * Use this to scroll off-screen columns into view in horizontally virtualized tables,
 * wait for lazy-rendered content, or perform any pre-read setup.
 *
 * @example
 * // Scroll the column header into view to trigger horizontal virtualization render
 * strategies: {
 *   beforeCellRead: async ({ columnName, getHeaderCell }) => {
 *     const header = await getHeaderCell(columnName);
 *     await header.scrollIntoViewIfNeeded();
 *   }
 * }
 */
export type BeforeCellReadFn = (args: {
  /** The resolved cell locator */
  cell: Locator;
  columnName: string;
  columnIndex: number;
  row: Locator;
  page: Page;
  root: Locator;
  /** Resolves a column name to its header cell locator */
  getHeaderCell: (columnName: string) => Promise<Locator>;
}) => Promise<void>;

/**
 * Function to get the currently active/focused cell.
 * Returns null if no cell is active.
 */
export type GetActiveCellFn = (args: TableContext) => Promise<{
  rowIndex: number;
  columnIndex: number;
  columnName?: string;
  locator: Locator;
} | null>;


/**
 * SmartRow - A Playwright Locator with table-aware methods.
 * 
 * Extends all standard Locator methods (click, isVisible, etc.) with table-specific functionality.
 * 
 * @example
 * const row = table.getRow({ Name: 'John Doe' });
 * await row.click(); // Standard Locator method
 * const email = row.getCell('Email'); // Table-aware method
 * const data = await row.toJSON(); // Extract all row data
 * await row.smartFill({ Name: 'Jane', Status: 'Active' }); // Fill form fields
 */
export type SmartRow<T = any> = Locator & {
  /** Optional row index (0-based) if known */
  rowIndex?: number;

  /** Optional page index this row was found on (0-based) */
  tablePageIndex?: number;

  /** Reference to the parent TableResult */
  table: TableResult<T>;

  /**
   * Get a cell locator by column name.
   * @param column - Column name (case-sensitive)
   * @returns Locator for the cell
   * @example
   * const emailCell = row.getCell('Email');
   * await expect(emailCell).toHaveText('john@example.com');
   */
  getCell(column: string): Locator;

  /**
   * Extract all cell data as a key-value object.
   * @param options - Optional configuration
   * @param options.columns - Specific columns to extract (extracts all if not specified)
   * @returns Promise resolving to row data
   * @example
   * const data = await row.toJSON();
   * // { Name: 'John', Email: 'john@example.com', ... }
   * 
   * const partial = await row.toJSON({ columns: ['Name', 'Email'] });
   * // { Name: 'John', Email: 'john@example.com' }
   */
  toJSON(options?: { columns?: string[] }): Promise<T>;

  /**
   * Scrolls/paginates to bring this row into view.
   * Only works if rowIndex is known (e.g., from getRowByIndex).
   * @throws Error if rowIndex is unknown
   */
  bringIntoView(): Promise<void>;

  /**
   * Intelligently fills form fields in the row.
   * Automatically detects input types (text, select, checkbox, contenteditable).
   * 
   * @param data - Column-value pairs to fill
   * @param options - Optional configuration
   * @param options.inputMappers - Custom input selectors per column
   * @example
   * // Auto-detection
   * await row.smartFill({ Name: 'John', Status: 'Active', Subscribe: true });
   * 
   * // Custom input mappers
   * await row.smartFill(
   *   { Name: 'John' },
   *   { inputMappers: { Name: (cell) => cell.locator('.custom-input') } }
   * );
   */
  smartFill: (data: Partial<T> | Record<string, any>, options?: FillOptions) => Promise<void>;

  /**
   * Returns whether the row exists in the DOM (i.e. is not a sentinel row).
   */
  wasFound(): boolean;
};

export type StrategyContext = TableContext & {
  rowLocator?: Locator;
  rowIndex?: number;
};

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

/**
 * Debug configuration for development and troubleshooting
 */
export type DebugConfig = {
  /**
   * Slow down operations for debugging
   * - number: Apply same delay to all operations (ms)
   * - object: Granular delays per operation type
   */
  slow?: number | {
    pagination?: number;
    getCell?: number;
    findRow?: number;
    default?: number;
  };
  /**
   * Log level for debug output
   * - 'verbose': All logs (verbose, info, error)
   * - 'info': Info and error logs only
   * - 'error': Error logs only
   * - 'none': No logs
   */
  logLevel?: 'verbose' | 'info' | 'error' | 'none';
};

export interface TableContext<T = any> {
  root: Locator;
  config: FinalTableConfig<T>;
  page: Page;
  resolve: (selector: Selector, parent: Locator | Page) => Locator;
  /** Resolves a column name to its header cell locator. Available after table is initialized. */
  getHeaderCell?: (columnName: string) => Promise<Locator>;
  /** Returns all column names in order. Available after table is initialized. */
  getHeaders?: () => Promise<string[]>;
  /** Scrolls the table horizontally to bring the given column's header into view. */
  scrollToColumn?: (columnName: string) => Promise<void>;
}

export interface PaginationPrimitives {
  /** Classic "Next Page" or "Scroll Down" */
  goNext?: (context: TableContext) => Promise<boolean>;

  /** Classic "Previous Page" or "Scroll Up" */
  goPrevious?: (context: TableContext) => Promise<boolean>;

  /** Bulk skip forward multiple pages at once */
  goNextBulk?: (context: TableContext) => Promise<boolean>;

  /** Bulk skip backward multiple pages at once */
  goPreviousBulk?: (context: TableContext) => Promise<boolean>;

  /** Jump to first page / scroll to top */
  goToFirst?: (context: TableContext) => Promise<boolean>;

  /** Jump to specific page index (0-indexed) */
  goToPage?: (pageIndex: number, context: TableContext) => Promise<boolean>;
}

export type PaginationStrategy = ((context: TableContext) => Promise<boolean>) | PaginationPrimitives;

export type DedupeStrategy = (row: SmartRow) => string | number | Promise<string | number>;



export type FillStrategy = (options: {
  row: SmartRow;
  columnName: string;
  value: any;
  index: number;
  page: Page;
  rootLocator: Locator;
  config: FinalTableConfig<any>;
  table: TableResult; // The parent table instance
  fillOptions?: FillOptions;
}) => Promise<void>;

export interface ColumnOverride<TValue = any> {
  /** 
   * How to extract the value from the cell.
   */
  read?: (cell: Locator) => Promise<TValue> | TValue;

  /** 
   * How to fill the cell with a new value. (Replaces smartFill default logic)
   * Provides the current value (via `read`) if a `write` wants to check state first.
   */
  write?: (params: {
    cell: Locator;
    targetValue: TValue;
    currentValue?: TValue;
    row: SmartRow<any>;
  }) => Promise<void>;
}

import { HeaderStrategy } from './strategies/headers';
export type { HeaderStrategy } from './strategies/headers';
import { CellNavigationStrategy, NavigationPrimitives } from './strategies/columns';
import { ColumnResolutionStrategy } from './strategies/resolution';

/**
 * Strategy to resolve column names (string or regex) to their index.
 */
export type { ColumnResolutionStrategy } from './strategies/resolution';

/**
 * Strategy to filter rows based on criteria.
 */
export interface FilterStrategy {
  apply(options: {
    rows: Locator;
    filter: { column: string, value: FilterValue };
    colIndex: number;
    tableContext: TableContext;
  }): Locator;
}

/**
 * Strategy to check if the table or rows are loading.
 */
export interface LoadingStrategy {
  isTableLoading?: (context: TableContext) => Promise<boolean>;
  isRowLoading?: (row: SmartRow) => Promise<boolean>;
  isHeaderLoading?: (context: TableContext) => Promise<boolean>;
}

/**
 * Organized container for all table interaction strategies.
 */
export interface TableStrategies {
  /** Strategy for discovering/scanning headers */
  header?: HeaderStrategy;
  /** Primitive navigation functions (goUp, goDown, goLeft, goRight, goHome) */
  navigation?: NavigationPrimitives;

  /** Strategy for filling form inputs */
  fill?: FillStrategy;
  /** Strategy for paginating through data */
  pagination?: PaginationStrategy;
  /** Strategy for sorting columns */
  sorting?: SortingStrategy;
  /** Strategy for deduplicating rows during iteration/scrolling */
  dedupe?: DedupeStrategy;
  /** Function to get a cell locator */
  getCellLocator?: GetCellLocatorFn;
  /** Function to get the currently active/focused cell */
  getActiveCell?: GetActiveCellFn;
  /**
   * Hook called before each cell value is read in toJSON and columnOverrides.read.
   * Fires for both the default innerText extraction and custom read mappers.
   * Useful for scrolling off-screen columns into view in horizontally virtualized tables.
   */
  beforeCellRead?: BeforeCellReadFn;
  /** Custom helper to check if a table is fully loaded/ready */
  isTableLoaded?: (args: TableContext) => Promise<boolean>;
  /** Custom helper to check if a row is fully loaded/ready */
  isRowLoaded?: (args: { row: Locator, index: number }) => Promise<boolean>;
  /** Custom helper to check if a cell is fully loaded/ready (e.g. for editing) */
  isCellLoaded?: (args: { cell: Locator, column: string, row: Locator }) => Promise<boolean>;
  /** Strategy for detecting loading states */
  loading?: LoadingStrategy;
}


export interface TableConfig<T = any> {
  /** Selector for the table headers */
  headerSelector?: string | ((root: Locator) => Locator);
  /** Selector for the table rows */
  rowSelector?: string;
  /** Selector for the cells within a row */
  cellSelector?: string;
  /** Number of pages to scan for verification */
  maxPages?: number;
  /** Hook to rename columns dynamically */
  headerTransformer?: (args: { text: string, index: number, locator: Locator, seenHeaders: Set<string> }) => string | Promise<string>;
  /** Automatically scroll to table on init */
  autoScroll?: boolean;
  /** Debug options for development and troubleshooting */
  debug?: DebugConfig;
  /** Reset hook */
  onReset?: (context: TableContext) => Promise<void>;
  /** All interaction strategies */
  strategies?: TableStrategies;

  /**
   * Unified interface for reading and writing data to specific columns.
   * Overrides both default extraction (toJSON) and filling (smartFill) logic.
   */
  columnOverrides?: Partial<Record<keyof T, ColumnOverride<T[keyof T]>>>;
}

export interface FinalTableConfig<T = any> extends TableConfig<T> {
  headerSelector: string | ((root: Locator) => Locator);
  rowSelector: string;
  cellSelector: string;
  maxPages: number;
  autoScroll: boolean;
  debug?: TableConfig['debug'];
  headerTransformer: (args: { text: string, index: number, locator: Locator, seenHeaders: Set<string> }) => string | Promise<string>;
  onReset: (context: TableContext) => Promise<void>;
  strategies: TableStrategies;
}


export interface FillOptions {
  /**
   * Custom input mappers for specific columns.
   * Maps column names to functions that return the input locator for that cell.
   */
  inputMappers?: Record<string, (cell: Locator) => Locator>;
}



/** Callback context passed to forEach, map, and filter. */
export type RowIterationContext<T = any> = {
  row: SmartRow<T>;
  rowIndex: number;
  stop: () => void;
};

/** Shared options for forEach, map, and filter. */
export type RowIterationOptions = {
  /** Maximum number of pages to iterate. Defaults to config.maxPages. */
  maxPages?: number;
  /**
   * Whether to process rows within a page concurrently.
   * @default false for forEach/filter, true for map
   */
  parallel?: boolean;
  /**
   * Deduplication strategy. Use when rows may repeat across iterations
   * (e.g. infinite scroll tables). Returns a unique key per row.
   */
  dedupe?: DedupeStrategy;
};

export interface TableResult<T = any> extends AsyncIterable<{ row: SmartRow<T>; rowIndex: number }> {
  /**
   * Represents the current page index of the table's DOM.
   * Starts at 0. Automatically maintained by the library during pagination and bringIntoView.
   */
  currentPageIndex: number;

  /**
   * Initializes the table by resolving headers. Must be called before using sync methods.
   * @param options Optional timeout for header resolution (default: 3000ms)
   */
  init(options?: { timeout?: number }): Promise<TableResult>;

  /**
   * SYNC: Checks if the table has been initialized.
   * @returns true if init() has been called and completed, false otherwise
   */
  isInitialized(): boolean;

  getHeaders: () => Promise<string[]>;
  getHeaderCell: (columnName: string) => Promise<Locator>;

  /**
   * Finds a row by filters on the current page only. Returns immediately (sync).
   * Throws error if table is not initialized.
   */
  getRow: (
    filters: Record<string, FilterValue>,
    options?: { exact?: boolean }
  ) => SmartRow;

  /**
   * Gets a row by 1-based index on the current page.
   * Throws error if table is not initialized.
   * @param index 1-based row index
   * @param options Optional settings including bringIntoView
   */
  getRowByIndex: (
    index: number
  ) => SmartRow;

  /**
   * ASYNC: Searches for a single row across pages using pagination.
   * Auto-initializes the table if not already initialized.
   * @param filters - The filter criteria to match
   * @param options - Search options including exact match and max pages
   */
  findRow: (
    filters: Record<string, FilterValue>,
    options?: { exact?: boolean, maxPages?: number }
  ) => Promise<SmartRow>;

  /**
   * ASYNC: Searches for all matching rows across pages using pagination.
   * Auto-initializes the table if not already initialized.
   * @param filters - The filter criteria to match
   * @param options - Search options including exact match and max pages
   */
  findRows: (
    filters: Record<string, FilterValue>,
    options?: { exact?: boolean, maxPages?: number }
  ) => Promise<SmartRowArray<T>>;

  /**
   * Navigates to a specific column using the configured CellNavigationStrategy.
   */
  scrollToColumn: (columnName: string) => Promise<void>;



  /**
   * Resets the table state (clears cache, flags) and invokes the onReset strategy.
   */
  reset: () => Promise<void>;

  /**
   * Revalidates the table's structure (headers, columns) without resetting pagination or state.
   * Useful when columns change visibility or order dynamically.
   */
  revalidate: () => Promise<void>;

  /**
   * Iterates every row across all pages, calling the callback for side effects.
   * Execution is sequential by default (safe for interactions like clicking/filling).
   * Call `stop()` in the callback to end iteration early.
   *
   * @example
   * await table.forEach(async ({ row, stop }) => {
   *   if (await row.getCell('Status').innerText() === 'Done') stop();
   *   await row.getCell('Checkbox').click();
   * });
   */
  forEach(
    callback: (ctx: RowIterationContext<T>) => void | Promise<void>,
    options?: RowIterationOptions
  ): Promise<void>;

  /**
   * Transforms every row across all pages into a value. Returns a flat array.
   * Execution is parallel within each page by default (safe for reads).
   * Call `stop()` to halt after the current page finishes.
   *
   * > **⚠️ UI Interactions:** `map` defaults to `parallel: true`. If your callback opens popovers,
   * > fills inputs, or otherwise mutates UI state, pass `{ parallel: false }` to avoid concurrent
   * > interactions interfering with each other.
   *
   * @example
   * // Data extraction — parallel is safe
   * const emails = await table.map(({ row }) => row.getCell('Email').innerText());
   *
   * @example
   * // UI interactions — must use parallel: false
   * const assignees = await table.map(async ({ row }) => {
   *   await row.getCell('Assignee').locator('button').click();
   *   const name = await page.locator('.popover .name').innerText();
   *   await page.keyboard.press('Escape');
   *   return name;
   * }, { parallel: false });
   */
  map<R>(
    callback: (ctx: RowIterationContext<T>) => R | Promise<R>,
    options?: RowIterationOptions
  ): Promise<R[]>;

  /**
   * Filters rows across all pages by an async predicate. Returns a SmartRowArray.
   * Rows are returned as-is — call `bringIntoView()` on each if needed.
   * Execution is sequential by default.
   *
   * @example
   * const active = await table.filter(async ({ row }) =>
   *   await row.getCell('Status').innerText() === 'Active'
   * );
   */
  filter(
    predicate: (ctx: RowIterationContext<T>) => boolean | Promise<boolean>,
    options?: RowIterationOptions
  ): Promise<SmartRowArray<T>>;

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
   * Generate an AI-friendly configuration prompt for debugging.
   * Outputs table HTML and TypeScript definitions to help AI assistants generate config.
   * Automatically throws an Error containing the prompt.
   */
  generateConfigPrompt: () => Promise<void>;
}