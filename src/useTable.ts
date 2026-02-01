import type { Locator, Page } from '@playwright/test';
import { TableConfig, TableContext, Selector, TableResult, SmartRow as SmartRowType, PromptOptions, FinalTableConfig, DedupeStrategy, RestrictedTableResult, PaginationStrategy, StrategyContext, TableStrategies as ITableStrategies } from './types';
import { TYPE_CONTEXT } from './typeContext';
import { SortingStrategies as ImportedSortingStrategies } from './strategies/sorting';
import { PaginationStrategies as ImportedPaginationStrategies } from './strategies/pagination';
import { FillStrategies } from './strategies/fill';
import { HeaderStrategies } from './strategies/headers';
import { CellNavigationStrategies } from './strategies/columns';
import { createSmartRow } from './smartRow';
import { FilterEngine } from './filterEngine';
import { ResolutionStrategies } from './strategies/resolution';
import { Strategies } from './strategies';
import { validatePaginationResult, validatePaginationStrategy, validateSortingStrategy } from './strategies/validation';
import { addTraceEvent } from './utils/traceUtils';

/**
 * Main hook to interact with a table.
 */
export const useTable = <T = any>(rootLocator: Locator, configOptions: TableConfig = {}): TableResult<T> => {
  // Store whether pagination was explicitly provided in config
  const hasPaginationInConfig = configOptions.strategies?.pagination !== undefined;

  // Default strategies
  const defaultStrategies: ITableStrategies = {
    fill: FillStrategies.default,
    header: HeaderStrategies.visible,
    cellNavigation: CellNavigationStrategies.default,
    pagination: async () => false,
  };

  const config: FinalTableConfig = {
    rowSelector: "tbody tr",
    headerSelector: "thead th",
    cellSelector: "td",
    maxPages: 1,
    headerTransformer: ({ text, index, locator }) => text,
    autoScroll: true,
    debug: false,
    onReset: async () => { /* no-op default */ },
    ...configOptions,
    strategies: {
      ...defaultStrategies,
      ...configOptions.strategies,
    }
  };

  const resolve = (item: Selector, parent: Locator | Page): Locator => {
    if (typeof item === 'string') return parent.locator(item);
    if (typeof item === 'function') return item(parent);
    return item;
  };

  // Internal State
  let _headerMap: Map<string, number> | null = null;
  let _hasPaginated = false;
  let _isInitialized = false;

  // Helpers
  const logDebug = (msg: string) => {
    if (config.debug) console.log(`🔎 [SmartTable Debug] ${msg}`);
  };

  const _createColumnError = (colName: string, map: Map<string, number>, context?: string): Error => {
    const availableColumns = Array.from(map.keys());
    // Use Suggestion Logic from ResolutionStrategy (if we had a fuzzy one, for now manual suggest)
    const lowerCol = colName.toLowerCase();
    const suggestions = availableColumns.filter(col =>
      col.toLowerCase().includes(lowerCol) ||
      lowerCol.includes(col.toLowerCase()) ||
      col.toLowerCase().replace(/\s+/g, '') === lowerCol.replace(/\s+/g, '')
    );
    let suggestion = '.';
    if (suggestions.length > 0 && suggestions[0] !== colName) {
      suggestion = `. Did you mean "${suggestions[0]}"?`;
    } else if (availableColumns.length > 0 && availableColumns.length <= 10) {
      suggestion = `. Available columns: ${availableColumns.map(c => `"${c}"`).join(', ')}`;
    } else if (availableColumns.length > 0) {
      suggestion = `. Available columns (first 5): ${availableColumns.slice(0, 5).map(c => `"${c}"`).join(', ')}, ...`;
    }

    const contextMsg = context ? ` (${context})` : '';
    return new Error(`Column "${colName}" not found${contextMsg}${suggestion}`);
  };

  const _getMap = async (timeout?: number) => {
    if (_headerMap) return _headerMap;
    logDebug('Mapping headers...');
    const headerTimeout = timeout ?? 3000;

    if (config.autoScroll) {
      try { await rootLocator.scrollIntoViewIfNeeded({ timeout: 1000 }); } catch (e) { }
    }

    const headerLoc = resolve(config.headerSelector, rootLocator);
    try {
      await headerLoc.first().waitFor({ state: 'visible', timeout: headerTimeout });
    } catch (e) { /* Ignore hydration */ }

    const strategy = config.strategies.header || HeaderStrategies.visible;
    const context: TableContext = {
      root: rootLocator,
      config: config,
      page: rootLocator.page(),
      resolve: resolve
    };

    const rawHeaders = await strategy(context);

    const entries = await Promise.all(rawHeaders.map(async (t, i) => {
      let text = t.trim() || `__col_${i}`;
      if (config.headerTransformer) {
        text = await config.headerTransformer({
          text,
          index: i,
          locator: rootLocator.locator(config.headerSelector as string).nth(i)
        });
      }
      return [text, i] as [string, number];
    }));

    _headerMap = new Map(entries);
    logDebug(`Mapped ${entries.length} columns: ${JSON.stringify(entries.map(e => e[0]))}`);
    return _headerMap;
  };

  // Placeholder for the final table object
  let finalTable: TableResult<T> = null as unknown as TableResult<T>;
  const filterEngine = new FilterEngine(config, resolve);

  // Helper factory
  const _makeSmart = (rowLocator: Locator, map: Map<string, number>, rowIndex?: number): SmartRowType => {
    // Use the wrapped SmartRow logic
    return createSmartRow<T>(rowLocator, map, rowIndex, config, rootLocator, resolve, finalTable);
  };

  const _findRowLocator = async (filters: Record<string, string | RegExp | number>, options: { exact?: boolean, maxPages?: number } = {}) => {
    const map = await _getMap();
    const effectiveMaxPages = options.maxPages ?? config.maxPages;
    let currentPage = 1;

    logDebug(`Looking for row: ${JSON.stringify(filters)} (MaxPages: ${effectiveMaxPages})`);

    while (true) {
      const allRows = resolve(config.rowSelector, rootLocator);
      // Use FilterEngine
      const matchedRows = filterEngine.applyFilters(allRows, filters, map, options.exact || false, rootLocator.page());

      const count = await matchedRows.count();
      logDebug(`Page ${currentPage}: Found ${count} matches.`);

      if (count > 1) {
        // Sample data logic (simplified for refactor, kept inline or moved to util if needed)
        const sampleData: string[] = [];
        try {
          const firstFewRows = await matchedRows.all();
          const sampleCount = Math.min(firstFewRows.length, 3);
          for (let i = 0; i < sampleCount; i++) {
            const rowData = await _makeSmart(firstFewRows[i], map).toJSON();
            sampleData.push(JSON.stringify(rowData));
          }
        } catch (e) { }
        const sampleMsg = sampleData.length > 0 ? `\nSample matching rows:\n${sampleData.map((d, i) => `  ${i + 1}. ${d}`).join('\n')}` : '';

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

        const paginationResult = await config.strategies.pagination!(context);
        const didLoadMore = validatePaginationResult(paginationResult, 'Pagination Strategy');
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
    // ... same logic ...
    const { output = 'console', includeTypes = true } = options;
    let finalPrompt = content;
    if (includeTypes) finalPrompt += `\n\n👇 Useful TypeScript Definitions 👇\n\`\`\`typescript\n${TYPE_CONTEXT}\n\`\`\`\n`;
    if (output === 'error') {
      console.log(`⚠️ Throwing error to display [${promptName}] cleanly...`);
      throw new Error(finalPrompt);
    }
    console.log(finalPrompt);
  };

  const _getCleanHtml = async (loc: Locator): Promise<string> => {
    return loc.evaluate((el) => {
      const clone = el.cloneNode(true) as Element;
      const removeSelectors = 'script, style, svg, path, circle, rect, noscript, [hidden]';
      clone.querySelectorAll(removeSelectors).forEach(n => n.remove());
      const walker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
      let currentNode = walker.currentNode as Element;
      while (currentNode) {
        currentNode.removeAttribute('style');
        currentNode.removeAttribute('data-reactid');
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

  const _ensureInitialized = async () => {
    if (!_isInitialized) {
      await _getMap();
      _isInitialized = true;
    }
  };

  const result: TableResult<T> = {
    init: async (options?: { timeout?: number }): Promise<TableResult<T>> => {
      if (_isInitialized && _headerMap) return result;
      await _getMap(options?.timeout);
      _isInitialized = true;
      if (_headerMap) { await addTraceEvent(rootLocator.page(), 'init', { headers: Array.from(_headerMap.keys()), columnCount: _headerMap.size }); }
      return result;
    },

    scrollToColumn: async (columnName: string) => {
      const map = await _getMap();
      const idx = map.get(columnName);
      if (idx === undefined) throw _createColumnError(columnName, map);

      await config.strategies.cellNavigation!({
        config: config as FinalTableConfig,
        root: rootLocator,
        page: rootLocator.page(),
        resolve,
        column: columnName,
        index: idx
      });
    },

    getHeaders: async () => {
      if (!_isInitialized || !_headerMap) throw new Error('Table not initialized. Call await table.init() first, or use async methods like table.findRow() or table.getRows() which auto-initialize.');
      return Array.from(_headerMap.keys());
    },

    getHeaderCell: async (columnName: string) => {
      if (!_isInitialized || !_headerMap) throw new Error('Table not initialized. Call await table.init() first.');
      const idx = _headerMap.get(columnName);
      if (idx === undefined) throw _createColumnError(columnName, _headerMap, 'header cell');
      return resolve(config.headerSelector, rootLocator).nth(idx);
    },

    reset: async () => {
      logDebug("Resetting table...");
      const context: TableContext = { root: rootLocator, config, page: rootLocator.page(), resolve };
      await config.onReset(context);
      _hasPaginated = false;
      _headerMap = null;
      _isInitialized = false;
      logDebug("Table reset complete.");
    },

    revalidate: async () => {
      logDebug("Revalidating table structure...");
      _headerMap = null; // Clear the map to force re-scanning
      await _getMap(); // Re-scan headers
      logDebug("Table revalidated.");
    },

    getColumnValues: async <V = string>(column: string, options?: { mapper?: (cell: Locator) => Promise<V> | V, maxPages?: number }) => {
      await _ensureInitialized();
      const colIdx = _headerMap!.get(column);
      if (colIdx === undefined) throw _createColumnError(column, _headerMap!);

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
          const context: TableContext = { root: rootLocator, config, page: rootLocator.page(), resolve };
          if (await config.strategies.pagination!(context)) {
            _hasPaginated = true;
            currentPage++;
            continue;
          }
        }
        break;
      }
      return results;
    },

    getRow: (filters: Partial<T> | Record<string, string | RegExp | number>, options: { exact?: boolean } = { exact: false }): SmartRowType<T> => {
      if (!_isInitialized || !_headerMap) throw new Error('Table not initialized. Call await table.init() first, or use async methods like table.findRow() or table.getRows() which auto-initialize.');

      const allRows = resolve(config.rowSelector, rootLocator);
      const matchedRows = filterEngine.applyFilters(allRows, filters as Record<string, string | RegExp | number>, _headerMap, options.exact || false, rootLocator.page());
      const rowLocator = matchedRows.first();
      return _makeSmart(rowLocator, _headerMap, 0); // fallback index 0
    },

    getRowByIndex: (index: number, options: { bringIntoView?: boolean } = {}): SmartRowType<T> => {
      if (!_isInitialized || !_headerMap) throw new Error('Table not initialized. Call await table.init() first, or use async methods like table.findRow() or table.getRows() which auto-initialize.');

      const rowIndex = index - 1; // Convert 1-based to 0-based
      const rowLocator = resolve(config.rowSelector, rootLocator).nth(rowIndex);
      return _makeSmart(rowLocator, _headerMap, rowIndex);
    },

    findRow: async (filters: Partial<T> | Record<string, string | RegExp | number>, options?: { exact?: boolean, maxPages?: number }): Promise<SmartRowType<T>> => {
      await _ensureInitialized();
      let row = await _findRowLocator(filters as Record<string, string | RegExp | number>, options);
      if (!row) {
        row = resolve(config.rowSelector, rootLocator).filter({ hasText: "___SENTINEL_ROW_NOT_FOUND___" + Date.now() });
      }
      return _makeSmart(row, _headerMap!, 0);
    },

    getRows: async <R extends { asJSON?: boolean }>(options?: { filter?: Partial<T> | Record<string, any>, exact?: boolean } & R): Promise<any> => {
      await _ensureInitialized();
      let rowLocators = resolve(config.rowSelector, rootLocator);
      if (options?.filter) {
        rowLocators = filterEngine.applyFilters(rowLocators, options.filter as Record<string, any>, _headerMap!, options.exact || false, rootLocator.page());
      }
      const rows = await rowLocators.all();
      const smartRows = rows.map((loc, i) => _makeSmart(loc, _headerMap!, i));
      if (options?.asJSON) {
        return Promise.all(smartRows.map(r => r.toJSON()));
      }
      return smartRows;
    },

    findRows: async <R extends { asJSON?: boolean }>(filters: Partial<T> | Record<string, string | RegExp | number>, options?: { exact?: boolean, maxPages?: number } & R): Promise<any> => {
      await _ensureInitialized();
      const allRows: SmartRowType<T>[] = [];
      const effectiveMaxPages = options?.maxPages ?? config.maxPages ?? Infinity;
      let pageCount = 0;

      // Collect rows from current page
      let rowLocators = resolve(config.rowSelector, rootLocator);
      rowLocators = filterEngine.applyFilters(rowLocators, filters as Record<string, any>, _headerMap!, options?.exact ?? false, rootLocator.page());
      let rows = await rowLocators.all();
      allRows.push(...rows.map((loc, i) => _makeSmart(loc, _headerMap!, i)));

      // Paginate and collect more rows
      while (pageCount < effectiveMaxPages && config.strategies.pagination) {
        const paginationResult = await config.strategies.pagination({
          root: rootLocator,
          config,
          resolve,
          page: rootLocator.page()
        });

        const didPaginate = validatePaginationResult(paginationResult, 'Pagination Strategy');
        if (!didPaginate) break;
        pageCount++;
        _hasPaginated = true;

        // Collect rows from new page
        rowLocators = resolve(config.rowSelector, rootLocator);
        rowLocators = filterEngine.applyFilters(rowLocators, filters as Record<string, any>, _headerMap!, options?.exact ?? false, rootLocator.page());
        rows = await rowLocators.all();
        allRows.push(...rows.map((loc, i) => _makeSmart(loc, _headerMap!, i)));
      }

      if (options?.asJSON) {
        return Promise.all(allRows.map(r => r.toJSON()));
      }
      return allRows;
    },

    isInitialized: (): boolean => {
      return _isInitialized;
    },

    sorting: {
      apply: async (columnName: string, direction: 'asc' | 'desc'): Promise<void> => {
        await _ensureInitialized();
        if (!config.strategies.sorting) throw new Error('No sorting strategy has been configured.');
        logDebug(`Applying sort for column "${columnName}" (${direction})`);
        const context: StrategyContext = { root: rootLocator, config, page: rootLocator.page(), resolve };
        await config.strategies.sorting.doSort({ columnName, direction, context });
      },
      getState: async (columnName: string): Promise<'asc' | 'desc' | 'none'> => {
        await _ensureInitialized();
        if (!config.strategies.sorting) throw new Error('No sorting strategy has been configured.');
        const context: StrategyContext = { root: rootLocator, config, page: rootLocator.page(), resolve };
        return config.strategies.sorting.getSortState({ columnName, context });
      }
    },

    iterateThroughTable: async <T = any>(
      callback: (context: {
        index: number;
        isFirst: boolean;
        isLast: boolean;
        rows: SmartRowType[];
        allData: T[];
        table: RestrictedTableResult;
        batchInfo?: {
          startIndex: number;
          endIndex: number;
          size: number;
        };
      }) => T | Promise<T>,
      options?: {
        pagination?: PaginationStrategy;
        dedupeStrategy?: DedupeStrategy;
        maxIterations?: number;
        batchSize?: number;
        getIsFirst?: (context: { index: number }) => boolean;
        getIsLast?: (context: { index: number, paginationResult: boolean }) => boolean;
        beforeFirst?: (context: { index: number, rows: SmartRowType[], allData: any[] }) => void | Promise<void>;
        afterLast?: (context: { index: number, rows: SmartRowType[], allData: any[] }) => void | Promise<void>;
      }
    ): Promise<T[]> => {
      await _ensureInitialized();
      const paginationStrategy = options?.pagination ?? config.strategies.pagination!;
      const hasPaginationInOptions = options?.pagination !== undefined;
      if (!hasPaginationInOptions && !hasPaginationInConfig) throw new Error('No pagination strategy provided.');

      await result.reset();
      await result.init();

      const restrictedTable: RestrictedTableResult = {
        init: result.init,
        getHeaders: result.getHeaders,
        getHeaderCell: result.getHeaderCell,
        getRow: result.getRow,
        getRowByIndex: result.getRowByIndex,
        findRow: result.findRow,
        getRows: result.getRows,
        findRows: result.findRows,
        getColumnValues: result.getColumnValues,
        isInitialized: result.isInitialized,
        sorting: result.sorting,
        scrollToColumn: result.scrollToColumn,
        revalidate: result.revalidate,
      };

      const getIsFirst = options?.getIsFirst ?? (({ index }) => index === 0);
      const getIsLast = options?.getIsLast ?? (() => false);
      const allData: T[] = [];
      const effectiveMaxIterations = options?.maxIterations ?? config.maxPages;
      const batchSize = options?.batchSize;
      const isBatching = batchSize !== undefined && batchSize > 1;

      let index = 0;
      let paginationResult = true;
      let seenKeys: Set<string | number> | null = null;
      let batchRows: SmartRowType[] = [];
      let batchStartIndex = 0;

      logDebug(`Starting iterateThroughTable (maxIterations: ${effectiveMaxIterations}, batchSize: ${batchSize ?? 'none'})`);

      while (index < effectiveMaxIterations) {
        const rowLocators = await resolve(config.rowSelector, rootLocator).all();
        let rows = rowLocators.map((loc, i) => _makeSmart(loc, _headerMap!, i));

        if (options?.dedupeStrategy && rows.length > 0) {
          if (!seenKeys) seenKeys = new Set<string | number>();
          const deduplicated: SmartRowType[] = [];
          for (const row of rows) {
            const key = await options.dedupeStrategy(row);
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              deduplicated.push(row);
            }
          }
          rows = deduplicated;
          logDebug(`Deduplicated ${rowLocators.length} rows to ${rows.length} unique rows (total seen: ${seenKeys.size})`);
        }

        // Add rows to batch if batching is enabled
        if (isBatching) {
          batchRows.push(...rows);
        }

        const isLastIteration = index === effectiveMaxIterations - 1;

        // Determine if we should invoke the callback
        const batchComplete = isBatching && (index - batchStartIndex + 1) >= batchSize!;
        const shouldInvokeCallback = !isBatching || batchComplete || isLastIteration;

        if (shouldInvokeCallback) {
          const callbackRows = isBatching ? batchRows : rows;
          const callbackIndex = isBatching ? batchStartIndex : index;
          const isFirst = getIsFirst({ index: callbackIndex });
          let isLast = getIsLast({ index: callbackIndex, paginationResult });
          const isLastDueToMax = index === effectiveMaxIterations - 1;

          if (isFirst && options?.beforeFirst) {
            await options.beforeFirst({ index: callbackIndex, rows: callbackRows, allData });
          }

          const batchInfo = isBatching ? {
            startIndex: batchStartIndex,
            endIndex: index,
            size: index - batchStartIndex + 1
          } : undefined;

          const returnValue = await callback({
            index: callbackIndex,
            isFirst,
            isLast,
            rows: callbackRows,
            allData,
            table: restrictedTable,
            batchInfo
          });
          allData.push(returnValue);

          // Determine if this is truly the last iteration
          let finalIsLast = isLastDueToMax;
          if (!isLastIteration) {
            const context: TableContext = { root: rootLocator, config, page: rootLocator.page(), resolve };
            paginationResult = await paginationStrategy(context);
            finalIsLast = getIsLast({ index: callbackIndex, paginationResult }) || !paginationResult;
          }

          if (finalIsLast && options?.afterLast) {
            await options.afterLast({ index: callbackIndex, rows: callbackRows, allData });
          }

          if (finalIsLast || !paginationResult) {
            logDebug(`Reached last iteration (index: ${index}, paginationResult: ${paginationResult})`);
            break;
          }

          // Reset batch
          if (isBatching) {
            batchRows = [];
            batchStartIndex = index + 1;
          }
        } else {
          // Continue paginating even when batching
          const context: TableContext = { root: rootLocator, config, page: rootLocator.page(), resolve };
          paginationResult = await paginationStrategy(context);

          if (!paginationResult) {
            // Pagination failed, invoke callback with current batch
            const callbackIndex = batchStartIndex;
            const isFirst = getIsFirst({ index: callbackIndex });
            const isLast = true;

            if (isFirst && options?.beforeFirst) {
              await options.beforeFirst({ index: callbackIndex, rows: batchRows, allData });
            }

            const batchInfo = {
              startIndex: batchStartIndex,
              endIndex: index,
              size: index - batchStartIndex + 1
            };

            const returnValue = await callback({
              index: callbackIndex,
              isFirst,
              isLast,
              rows: batchRows,
              allData,
              table: restrictedTable,
              batchInfo
            });
            allData.push(returnValue);

            if (options?.afterLast) {
              await options.afterLast({ index: callbackIndex, rows: batchRows, allData });
            }

            logDebug(`Pagination failed mid-batch (index: ${index})`);
            break;
          }
        }

        index++;
        logDebug(`Iteration ${index} completed, continuing...`);
      }
      logDebug(`iterateThroughTable completed after ${index + 1} iterations, collected ${allData.length} items`);
      return allData;
    },
  };

  finalTable = result;
  return result;
};

export const PaginationStrategies = ImportedPaginationStrategies;
export const SortingStrategies = ImportedSortingStrategies;
export { FillStrategies, HeaderStrategies, CellNavigationStrategies, ResolutionStrategies, Strategies };