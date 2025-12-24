import type { Locator, Page } from '@playwright/test';
import { TableConfig, TableContext, Selector, TableResult, SmartRow, PromptOptions, FillOptions, StrategyContext, FinalTableConfig } from './types';
import { TYPE_CONTEXT } from './typeContext';
import { SortingStrategies as ImportedSortingStrategies } from './strategies/sorting';
import { PaginationStrategies as ImportedPaginationStrategies, TableStrategies as DeprecatedTableStrategies } from './strategies/pagination';

/**
 * A collection of pre-built pagination strategies.
 */
export const PaginationStrategies = ImportedPaginationStrategies;

/**
 * @deprecated Use `PaginationStrategies` instead. This alias will be removed in a future major version.
 */
export const TableStrategies = DeprecatedTableStrategies;

/**
 * A collection of pre-built sorting strategies.
 */
export const SortingStrategies = ImportedSortingStrategies;

export const useTable = (rootLocator: Locator, configOptions: TableConfig = {}): TableResult => {
  const config: FinalTableConfig = {
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

  const _suggestColumnName = (colName: string, availableColumns: string[]): string => {
    // Simple fuzzy matching - find columns with similar names
    const lowerCol = colName.toLowerCase();
    const suggestions = availableColumns.filter(col => 
      col.toLowerCase().includes(lowerCol) || 
      lowerCol.includes(col.toLowerCase()) ||
      col.toLowerCase().replace(/\s+/g, '') === lowerCol.replace(/\s+/g, '')
    );
    
    if (suggestions.length > 0 && suggestions[0] !== colName) {
      return `. Did you mean "${suggestions[0]}"?`;
    }
    
    // Show similar column names (first 3)
    if (availableColumns.length > 0 && availableColumns.length <= 10) {
      return `. Available columns: ${availableColumns.map(c => `"${c}"`).join(', ')}`;
    } else if (availableColumns.length > 0) {
      return `. Available columns (first 5): ${availableColumns.slice(0, 5).map(c => `"${c}"`).join(', ')}, ...`;
    }
    
    return '.';
  };

  const _createColumnError = (colName: string, map: Map<string, number>, context?: string): Error => {
    const availableColumns = Array.from(map.keys());
    const suggestion = _suggestColumnName(colName, availableColumns);
    const contextMsg = context ? ` (${context})` : '';
    return new Error(`Column "${colName}" not found${contextMsg}${suggestion}`);
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
    const smart = rowLocator as unknown as SmartRow;

    smart.getCell = (colName: string) => {
      const idx = map.get(colName);
      if (idx === undefined) {
        const availableColumns = Array.from(map.keys());
        const suggestion = _suggestColumnName(colName, availableColumns);
        throw new Error(`Column "${colName}" not found${suggestion}`);
      }

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

    smart.fill = async (data: Record<string, any>, fillOptions?: FillOptions) => {
      logDebug(`Filling row with data: ${JSON.stringify(data)}`);
      
      // Fill each column
      for (const [colName, value] of Object.entries(data)) {
        const colIdx = map.get(colName);
        if (colIdx === undefined) {
          throw _createColumnError(colName, map, 'in fill data');
        }
        
        const cell = smart.getCell(colName);
        
        // Use custom input mapper for this column if provided, otherwise auto-detect
        let inputLocator: Locator;
        if (fillOptions?.inputMappers?.[colName]) {
          inputLocator = fillOptions.inputMappers[colName](cell);
        } else {
          // Auto-detect input type
          // Try different input types in order of commonality
          
          // Check for text input
          const textInput = cell.locator('input[type="text"], input:not([type]), textarea').first();
          const textInputCount = await textInput.count().catch(() => 0);
          
          // Check for select
          const select = cell.locator('select').first();
          const selectCount = await select.count().catch(() => 0);
          
          // Check for checkbox/radio
          const checkbox = cell.locator('input[type="checkbox"], input[type="radio"], [role="checkbox"]').first();
          const checkboxCount = await checkbox.count().catch(() => 0);
          
          // Check for contenteditable or div-based inputs
          const contentEditable = cell.locator('[contenteditable="true"]').first();
          const contentEditableCount = await contentEditable.count().catch(() => 0);
          
          // Determine which input to use (prioritize by commonality)
          if (textInputCount > 0 && selectCount === 0 && checkboxCount === 0) {
            inputLocator = textInput;
          } else if (selectCount > 0) {
            inputLocator = select;
          } else if (checkboxCount > 0) {
            inputLocator = checkbox;
          } else if (contentEditableCount > 0) {
            inputLocator = contentEditable;
          } else if (textInputCount > 0) {
            // Fallback to text input even if others exist
            inputLocator = textInput;
          } else {
            // No input found - try to click the cell itself (might trigger an editor)
            inputLocator = cell;
          }
          
          // Warn if multiple inputs found (ambiguous)
          const totalInputs = textInputCount + selectCount + checkboxCount + contentEditableCount;
          if (totalInputs > 1 && config.debug) {
            logDebug(`⚠️ Multiple inputs found in cell "${colName}" (${totalInputs} total). Using first match. Consider using inputMapper option for explicit control.`);
          }
        }
        
        // Fill based on value type and input type
        const inputTag = await inputLocator.evaluate((el: Element) => el.tagName.toLowerCase()).catch(() => 'unknown');
        const inputType = await inputLocator.getAttribute('type').catch(() => null);
        const isContentEditable = await inputLocator.getAttribute('contenteditable').catch(() => null);
        
        logDebug(`Filling "${colName}" with value "${value}" (input: ${inputTag}, type: ${inputType})`);
        
        if (inputType === 'checkbox' || inputType === 'radio') {
          // Boolean value for checkbox/radio
          const shouldBeChecked = Boolean(value);
          const isChecked = await inputLocator.isChecked().catch(() => false);
          if (isChecked !== shouldBeChecked) {
            await inputLocator.click();
          }
        } else if (inputTag === 'select') {
          // Select dropdown
          await inputLocator.selectOption(String(value));
        } else if (isContentEditable === 'true') {
          // Contenteditable div
          await inputLocator.click();
          await inputLocator.fill(String(value));
        } else {
          // Text input, textarea, or generic
          await inputLocator.fill(String(value));
        }
      }
      
      logDebug('Fill operation completed');
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
      if (colIndex === undefined) {
        throw _createColumnError(colName, map, 'in filter');
      }

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

      if (count > 1) {
        // Try to get sample row data to help user identify the issue
        const sampleData: string[] = [];
        
        try {
          const firstFewRows = await matchedRows.all();
          const sampleCount = Math.min(firstFewRows.length, 3);
          
          for (let i = 0; i < sampleCount; i++) {
            const rowData = await _makeSmart(firstFewRows[i], map).toJSON();
            sampleData.push(JSON.stringify(rowData));
          }
        } catch (e) {
          // If we can't extract sample data, that's okay - continue without it
        }
        
        const sampleMsg = sampleData.length > 0 
          ? `\nSample matching rows:\n${sampleData.map((d, i) => `  ${i + 1}. ${d}`).join('\n')}`
          : '';
        
        throw new Error(
          `Strict Mode Violation: Found ${count} rows matching ${JSON.stringify(filters)} on page ${currentPage}. ` +
          `Expected exactly one match. Try adding more filters to make your query unique.${sampleMsg}`
        );
      }
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

  const sortingNamespace = {
    apply: async (columnName: string, direction: 'asc' | 'desc'): Promise<void> => {
      if (!config.sorting) {
        throw new Error('No sorting strategy has been configured. Please add a `sorting` strategy to your useTable config.');
      }
      logDebug(`Applying sort for column "${columnName}" (${direction})`);
      const context: StrategyContext = {
        root: rootLocator,
        config: config,
        page: rootLocator.page(),
        resolve: resolve
      };
      await config.sorting.doSort({ columnName, direction, context });
    },
    getState: async (columnName: string): Promise<'asc' | 'desc' | 'none'> => {
      if (!config.sorting) {
        throw new Error('No sorting strategy has been configured. Please add a `sorting` strategy to your useTable config.');
      }
      logDebug(`Getting sort state for column "${columnName}"`);
      const context: StrategyContext = {
        root: rootLocator,
        config: config,
        page: rootLocator.page(),
        resolve: resolve
      };
      return config.sorting.getSortState({ columnName, context });
    }
  };

  return {
    getHeaders: async () => Array.from((await _getMap()).keys()),

    getHeaderCell: async (columnName: string) => {
      const map = await _getMap();
      const idx = map.get(columnName);
      if (idx === undefined) throw _createColumnError(columnName, map, 'header cell');
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
      if (colIdx === undefined) throw _createColumnError(column, map);
      
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

    sorting: sortingNamespace,
  };
};