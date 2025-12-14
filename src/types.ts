import { Locator, Page, TestInfo } from '@playwright/test';

export type Selector = string | ((root: Locator | Page) => Locator);

export type SmartRow = Locator & {
  getCell(column: string): Locator;
  toJSON(): Promise<Record<string, string>>;
};

export interface TableContext {
  root: Locator;
  config: Required<TableConfig>;
  page: Page;
  resolve: (selector: Selector, parent: Locator | Page) => Locator;
}

export type PaginationStrategy = (context: TableContext) => Promise<boolean>;

export interface PromptOptions {
  /**
   * Output Strategy:
   * - 'error': Throws an error with the prompt (Best for Cloud/QA Wolf to get clean text).
   * - 'console': Standard console logs (Default).
   * - 'report': Attaches to Playwright Report (Requires testInfo).
   */
  output?: 'console' | 'report' | 'error';
  includeTypes?: boolean;
  testInfo?: TestInfo;
}

export interface TableConfig {
  rowSelector?: Selector;
  headerSelector?: Selector;
  cellSelector?: Selector;
  pagination?: PaginationStrategy;
  maxPages?: number;
  headerTransformer?: (text: string, index: number) => string;
  autoScroll?: boolean;
}

export interface TableResult {
  getHeaders: () => Promise<string[]>;
  getHeaderCell: (columnName: string) => Promise<Locator>;

  getByRow: <T extends { asJSON?: boolean }>(
    filters: Record<string, string | RegExp | number>, 
    options?: { exact?: boolean, maxPages?: number } & T
  ) => Promise<T['asJSON'] extends true ? Record<string, string> : SmartRow>;

  getAllRows: <T extends { asJSON?: boolean }>(
    options?: { filter?: Record<string, any>, exact?: boolean } & T
  ) => Promise<T['asJSON'] extends true ? Record<string, string>[] : SmartRow[]>;

  generateConfigPrompt: (options?: PromptOptions) => Promise<void>;
  generateStrategyPrompt: (options?: PromptOptions) => Promise<void>;
}