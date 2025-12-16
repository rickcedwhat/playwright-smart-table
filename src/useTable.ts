import type { Locator, Page } from '@playwright/test';
import { TableConfig, TableContext, Selector, TableResult, SmartRow, PromptOptions } from './types';
import { TYPE_CONTEXT } from './typeContext';

export const useTable = (rootLocator: Locator, configOptions: TableConfig = {}): TableResult => {
  const config: Required<TableConfig> = {
    rowSelector: "tbody tr",
    headerSelector: "th",
    cellSelector: "td",
    pagination: async () => false,
    maxPages: 1,
    headerTransformer: ({ text, index, locator }) => text,
    autoScroll: true,
    ...configOptions,
  };

  const resolve = (item: Selector, parent: Locator | Page): Locator => {
    if (typeof item === 'string') return parent.locator(item);
    if (typeof item === 'function') return item(parent);
    return item;
  };

  let _headerMap: Map<string, number> | null = null;

  const _getMap = async () => {
    if (_headerMap) return _headerMap;

    if (config.autoScroll) {
      try { await rootLocator.scrollIntoViewIfNeeded({ timeout: 1000 }); } catch (e) { }
    }

    const headerLoc = resolve(config.headerSelector, rootLocator);
    try {
      await headerLoc.first().waitFor({ state: 'visible', timeout: 3000 });
    } catch (e) { /* Ignore hydration */ }

    // 1. Fetch data efficiently
    const texts = await headerLoc.allInnerTexts();
    const locators = await headerLoc.all(); // Need specific locators for the transformer

    // 2. Map Headers (Async)
    const entries = await Promise.all(texts.map(async (t, i) => {
      let text = t.trim() || `__col_${i}`;

      if (config.headerTransformer) {
        text = await config.headerTransformer({
          text,
          index: i,
          locator: locators[i]
        });
      }
      return [text, i] as [string, number];
    }));

    _headerMap = new Map(entries);
    return _headerMap;
  };

  const _makeSmart = (rowLocator: Locator, map: Map<string, number>): SmartRow => {
    const smart = rowLocator as SmartRow;

    smart.getCell = (colName: string) => {
      const idx = map.get(colName);
      if (idx === undefined) throw new Error(`Column '${colName}' not found.`);

      if (typeof config.cellSelector === 'string') {
        return rowLocator.locator(config.cellSelector).nth(idx);
      } else {
        return resolve(config.cellSelector, rowLocator).nth(idx);
      }
    };

    smart.toJSON = async () => {
      const result: Record<string, string> = {};
      const cells = typeof config.cellSelector === 'string'
        ? rowLocator.locator(config.cellSelector)
        : resolve(config.cellSelector, rowLocator);

      const texts = await cells.allInnerTexts();
      for (const [col, idx] of map.entries()) {
        result[col] = (texts[idx] || '').trim();
      }
      return result;
    };

    return smart;
  };

  const _applyFilters = (
    baseRows: Locator,
    filters: Record<string, string | RegExp | number>,
    map: Map<string, number>,
    exact: boolean
  ) => {
    let filtered = baseRows;
    const page = rootLocator.page();

    for (const [colName, value] of Object.entries(filters)) {
      const colIndex = map.get(colName);
      if (colIndex === undefined) throw new Error(`Column '${colName}' not found.`);

      const filterVal = typeof value === 'number' ? String(value) : value;
      const cellTemplate = resolve(config.cellSelector, page);

      filtered = filtered.filter({
        has: cellTemplate.nth(colIndex).getByText(filterVal, { exact }),
      });
    }
    return filtered;
  };

  const _findRowLocator = async (filters: Record<string, string | RegExp | number>, options: { exact?: boolean, maxPages?: number } = {}) => {
    const map = await _getMap();
    const effectiveMaxPages = options.maxPages ?? config.maxPages;
    let currentPage = 1;

    while (true) {
      const allRows = resolve(config.rowSelector, rootLocator);
      const matchedRows = _applyFilters(allRows, filters, map, options.exact || false);

      const count = await matchedRows.count();
      if (count > 1) throw new Error(`Strict Mode Violation: Found ${count} rows matching ${JSON.stringify(filters)}.`);
      if (count === 1) return matchedRows.first();

      if (currentPage < effectiveMaxPages) {
        const context: TableContext = {
          root: rootLocator,
          config: config,
          page: rootLocator.page(),
          resolve: resolve
        };

        const didLoadMore = await config.pagination(context);
        if (didLoadMore) {
          currentPage++;
          continue;
        }
      }
      return null;
    }
  };

  const _handlePrompt = async (promptName: string, content: string, options: PromptOptions = {}) => {
    const { output = 'console', includeTypes = true } = options;

    let finalPrompt = content;

    if (includeTypes) {
      finalPrompt += `\n\n👇 Useful TypeScript Definitions 👇\n\`\`\`typescript\n${TYPE_CONTEXT}\n\`\`\`\n`;
    }

    if (output === 'error') {
      console.log(`⚠️ Throwing error to display [${promptName}] cleanly...`);
      throw new Error(finalPrompt);
    }

    console.log(finalPrompt);
  };

  return {
    getHeaders: async () => Array.from((await _getMap()).keys()),

    getHeaderCell: async (columnName: string) => {
      const map = await _getMap();
      const idx = map.get(columnName);
      if (idx === undefined) throw new Error(`Column '${columnName}' not found.`);
      return resolve(config.headerSelector, rootLocator).nth(idx);
    },

    getByRow: async <T extends { asJSON?: boolean }>(
      filters: Record<string, string | RegExp | number>,
      options?: { exact?: boolean, maxPages?: number } & T
    ): Promise<T['asJSON'] extends true ? Record<string, string> : SmartRow> => {
      let row = await _findRowLocator(filters, options);

      if (!row) {
        row = resolve(config.rowSelector, rootLocator).filter({ hasText: "___SENTINEL_ROW_NOT_FOUND___" + Date.now() });
      }

      const smartRow = _makeSmart(row, await _getMap());

      if (options?.asJSON) {
        return smartRow.toJSON() as any;
      }
      return smartRow as any;
    },

    getAllRows: async <T extends { asJSON?: boolean }>(options?: { filter?: Record<string, any>, exact?: boolean } & T): Promise<any> => {
      const map = await _getMap();
      let rowLocators = resolve(config.rowSelector, rootLocator);

      if (options?.filter) {
        rowLocators = _applyFilters(rowLocators, options.filter, map, options.exact || false);
      }

      const rows = await rowLocators.all();
      const smartRows = rows.map(loc => _makeSmart(loc, map));

      if (options?.asJSON) {
        return Promise.all(smartRows.map(r => r.toJSON()));
      }
      return smartRows;
    },

    generateConfigPrompt: async (options?: PromptOptions) => {
      const html = await rootLocator.evaluate((el) => el.outerHTML);
      const separator = "=".repeat(50);
      const content = `\n${separator}\n🤖 COPY INTO GEMINI/ChatGPT 🤖\n${separator}\nI am using 'playwright-smart-table'. Generate config for:\n\`\`\`html\n${html.substring(0, 5000)} ...\n\`\`\`\n${separator}\n`;

      await _handlePrompt('Smart Table Config', content, options);
    },

    generateStrategyPrompt: async (options?: PromptOptions) => {
      const container = rootLocator.locator('xpath=..');
      const html = await container.evaluate((el) => el.outerHTML);
      const content = `\n==================================================\n🤖 COPY INTO GEMINI/ChatGPT TO WRITE A STRATEGY 🤖\n==================================================\nI need a custom Pagination Strategy for 'playwright-smart-table'.\nContainer HTML:\n\`\`\`html\n${html.substring(0, 5000)} ...\n\`\`\`\n`;

      await _handlePrompt('Smart Table Strategy', content, options);
    }
  };
};