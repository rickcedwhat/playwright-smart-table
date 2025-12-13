import { Locator, Page, expect, test } from '@playwright/test';
import { TableConfig, TableContext, Selector, TableResult, SmartRow, PromptOptions } from './types';
import { TYPE_CONTEXT } from './typeContext';

export const useTable = (rootLocator: Locator, configOptions: TableConfig = {}): TableResult => {
  const config: Required<TableConfig> = {
    rowSelector: "tbody tr",
    headerSelector: "th",
    cellSelector: "td",
    pagination: undefined as any,
    maxPages: 1,
    headerTransformer: undefined as any,
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

    // ✅ New Feature: Auto-Scroll on first interaction
    if (config.autoScroll) {
      await rootLocator.scrollIntoViewIfNeeded();
    }

    const headerLoc = resolve(config.headerSelector, rootLocator);
    try {
      await headerLoc.first().waitFor({ state: 'visible', timeout: 3000 });
    } catch (e) { /* Ignore hydration */ }

    const texts = await headerLoc.allInnerTexts();
    _headerMap = new Map(texts.map((t, i) => {
      let text = t.trim() || `__col_${i}`;
      if (config.headerTransformer) text = config.headerTransformer(text, i);
      return [text, i];
    }));
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

  // ♻️ HELPER: Centralized logic to filter a row locator
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

      // Filter the TRs that contain the matching cell at the specific index
      filtered = filtered.filter({
        has: cellTemplate.nth(colIndex).getByText(filterVal, { exact }),
      });
    }
    return filtered;
  };

  const _handlePrompt = async (promptName: string, content: string, options: PromptOptions = {}) => {
    const { output = 'console', includeTypes = true } = options; // Default includeTypes to true

    let finalPrompt = content;

    if (includeTypes) {
      // ✅ Inject the dynamic TYPE_CONTEXT
      finalPrompt += `\n\n👇 Useful TypeScript Definitions 👇\n\`\`\`typescript\n${TYPE_CONTEXT}\n\`\`\`\n`;
    }

    if (output === 'console') {
      console.log(finalPrompt);
    }
    else if (output === 'report') {
      if (test.info()) {
        await test.info().attach(promptName, {
          body: finalPrompt,
          contentType: 'text/markdown'
        });
        console.log(`✅ Attached '${promptName}' to Playwright Report.`);
      } else {
        console.warn('⚠️ Cannot attach to report: No active test info found.');
        console.log(finalPrompt);
      }
    }
    // ... (file output logic) ...
  };

  const _findRowLocator = async (filters: Record<string, string | RegExp | number>, options: { exact?: boolean, maxPages?: number } = {}) => {
    const map = await _getMap();
    const effectiveMaxPages = options.maxPages ?? config.maxPages;
    let currentPage = 1;

    while (true) {
      // 1. Get all rows
      const allRows = resolve(config.rowSelector, rootLocator);

      // 2. Apply filters using helper
      const matchedRows = _applyFilters(allRows, filters, map, options.exact || false);

      // 3. Check Count
      const count = await matchedRows.count();
      if (count > 1) throw new Error(`Strict Mode Violation: Found ${count} rows matching ${JSON.stringify(filters)}.`);
      if (count === 1) return matchedRows.first();

      // 4. Pagination Logic (unchanged)
      if (config.pagination && currentPage < effectiveMaxPages) {
        // ... (pagination code same as before)
        const context: TableContext = { root: rootLocator, config, page: rootLocator.page(), resolve };
        if (await config.pagination(context)) {
          currentPage++;
          continue;
        }
      }
      return null;
    }
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

      // ✅ FIX: Sentinel Logic for negative assertions (expect(row).not.toBeVisible())
      if (!row) {
        row = resolve(config.rowSelector, rootLocator).filter({ hasText: "___SENTINEL_ROW_NOT_FOUND___" + Date.now() });
      }

      const smartRow = _makeSmart(row, await _getMap());

      if (options?.asJSON) {
        // If row doesn't exist, toJSON() returns empty object or throws? 
        // For safety, let's let it run naturally (it will likely return empty strings)
        return smartRow.toJSON() as any;
      }
      return smartRow as any;
    },

    getAllRows: async <T extends { asJSON?: boolean }>(options?: { filter?: Record<string, any>, exact?: boolean } & T): Promise<any> => {
      const map = await _getMap();
      let rowLocators = resolve(config.rowSelector, rootLocator);

      // ✅ NEW: Apply filters if they exist
      if (options?.filter) {
        rowLocators = _applyFilters(rowLocators, options.filter, map, options.exact || false);
      }

      // Convert Locator to array of Locators
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
  }
};