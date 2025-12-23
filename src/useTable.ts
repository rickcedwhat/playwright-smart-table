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
    debug: false,
    onReset: async () => { console.warn("⚠️ .reset() called but no 'onReset' strategy defined in config."); },
    ...configOptions,
  };

  const resolve = (item: Selector, parent: Locator | Page): Locator => {
    if (typeof item === 'string') return parent.locator(item);
    if (typeof item === 'function') return item(parent);
    return item;
  };

  // Internal State
  let _headerMap: Map<string, number> | null = null;
  let _hasPaginated = false;

  const logDebug = (msg: string) => {
    if (config.debug) console.log(`🔎 [SmartTable Debug] ${msg}`);
  };

  const _getMap = async () => {
    if (_headerMap) return _headerMap;

    logDebug('Mapping headers...');

    if (config.autoScroll) {
      try { await rootLocator.scrollIntoViewIfNeeded({ timeout: 1000 }); } catch (e) { }
    }

    const headerLoc = resolve(config.headerSelector, rootLocator);
    try {
      await headerLoc.first().waitFor({ state: 'visible', timeout: 3000 });
    } catch (e) { /* Ignore hydration */ }

    // 1. Fetch data efficiently
    const texts = await headerLoc.allInnerTexts();
    const locators = await headerLoc.all(); 

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
    logDebug(`Mapped ${entries.length} columns: ${JSON.stringify(entries.map(e => e[0]))}`);
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

    logDebug(`Looking for row: ${JSON.stringify(filters)} (MaxPages: ${effectiveMaxPages})`);

    while (true) {
      const allRows = resolve(config.rowSelector, rootLocator);
      const matchedRows = _applyFilters(allRows, filters, map, options.exact || false);

      const count = await matchedRows.count();
      logDebug(`Page ${currentPage}: Found ${count} matches.`);

      if (count > 1) throw new Error(`Strict Mode Violation: Found ${count} rows matching ${JSON.stringify(filters)}.`);
      if (count === 1) return matchedRows.first();

      if (currentPage < effectiveMaxPages) {
        logDebug(`Page ${currentPage}: Not found. Attempting pagination...`);
        const context: TableContext = {
          root: rootLocator,
          config: config,
          page: rootLocator.page(),
          resolve: resolve
        };

        const didLoadMore = await config.pagination(context);
        if (didLoadMore) {
          _hasPaginated = true;
          currentPage++;
          continue;
        } else {
          logDebug(`Page ${currentPage}: Pagination failed (end of data).`);
        }
      }
      
      if (_hasPaginated) {
        console.warn(`⚠️ [SmartTable] Row not found. The table has been paginated (Current Page: ${currentPage}). You may need to call 'await table.reset()' if the target row is on a previous page.`);
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

  // Helper to extract clean HTML for prompts
  const _getCleanHtml = async (loc: Locator): Promise<string> => {
    return loc.evaluate((el) => {
      const clone = el.cloneNode(true) as Element;
      
      // 1. Remove Heavy/Useless Elements
      const removeSelectors = 'script, style, svg, path, circle, rect, noscript, [hidden]';
      clone.querySelectorAll(removeSelectors).forEach(n => n.remove());

      // 2. Clean Attributes
      const walker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
      let currentNode = walker.currentNode as Element;
      while(currentNode) {
        currentNode.removeAttribute('style'); // Inline styles are noise
        currentNode.removeAttribute('data-reactid');
        
        // 3. Condense Tailwind Classes (Heuristic)
        // If class string is very long (>50 chars), keep the first few tokens and truncate.
        // This preserves "MuiRow" but cuts "text-sm p-4 hover:bg-gray-50 ..."
        const cls = currentNode.getAttribute('class');
        if (cls && cls.length > 80) {
          const tokens = cls.split(' ');
          if (tokens.length > 5) {
             currentNode.setAttribute('class', tokens.slice(0, 4).join(' ') + ' ...');
          }
        }
        currentNode = walker.nextNode() as Element;
      }
      
      return clone.outerHTML;
    });
  };

  return {
    getHeaders: async () => Array.from((await _getMap()).keys()),

    getHeaderCell: async (columnName: string) => {
      const map = await _getMap();
      const idx = map.get(columnName);
      if (idx === undefined) throw new Error(`Column '${columnName}' not found.`);
      return resolve(config.headerSelector, rootLocator).nth(idx);
    },

    reset: async () => {
      logDebug("Resetting table...");
      const context: TableContext = {
        root: rootLocator,
        config: config,
        page: rootLocator.page(),
        resolve: resolve
      };
      await config.onReset(context);
      _hasPaginated = false;
      _headerMap = null; 
      logDebug("Table reset complete.");
    },

    getColumnValues: async <V = string>(column: string, options?: { mapper?: (cell: Locator) => Promise<V> | V, maxPages?: number }) => {
      const map = await _getMap();
      const colIdx = map.get(column);
      if (colIdx === undefined) throw new Error(`Column '${column}' not found.`);
      
      const mapper = options?.mapper ?? ((c: Locator) => c.innerText() as any as V);
      const effectiveMaxPages = options?.maxPages ?? config.maxPages; 
      
      let currentPage = 1;
      const results: V[] = [];

      logDebug(`Getting column values for '${column}' (Pages: ${effectiveMaxPages})`);

      while (true) {
        const rows = await resolve(config.rowSelector, rootLocator).all();
        
        for (const row of rows) {
          const cell = typeof config.cellSelector === 'string'
            ? row.locator(config.cellSelector).nth(colIdx)
            : resolve(config.cellSelector, row).nth(colIdx);
          
          results.push(await mapper(cell));
        }

        if (currentPage < effectiveMaxPages) {
          const context: TableContext = {
             root: rootLocator, config, page: rootLocator.page(), resolve
          };
          if (await config.pagination(context)) {
            _hasPaginated = true;
            currentPage++;
            continue;
          }
        }
        break;
      }
      return results;
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
      const html = await _getCleanHtml(rootLocator);
      const separator = "=".repeat(50);
      const content = `\n${separator}\n🤖 COPY INTO GEMINI/ChatGPT 🤖\n${separator}\nI am using 'playwright-smart-table'. Generate config for:\n\`\`\`html\n${html.substring(0, 10000)} ...\n\`\`\`\n${separator}\n`;
      await _handlePrompt('Smart Table Config', content, options);
    },

    generateStrategyPrompt: async (options?: PromptOptions) => {
      const container = rootLocator.locator('xpath=..');
      const html = await _getCleanHtml(container);
      const content = `\n==================================================\n🤖 COPY INTO GEMINI/ChatGPT TO WRITE A STRATEGY 🤖\n==================================================\nI need a custom Pagination Strategy for 'playwright-smart-table'.\nContainer HTML:\n\`\`\`html\n${html.substring(0, 10000)} ...\n\`\`\`\n`;
      await _handlePrompt('Smart Table Strategy', content, options);
    },
  };
};