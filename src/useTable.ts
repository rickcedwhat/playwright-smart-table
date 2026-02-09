import type { Locator, Page } from '@playwright/test';
import { TableConfig, TableContext, Selector, TableResult, SmartRow as SmartRowType, PromptOptions, FinalTableConfig, DedupeStrategy, RestrictedTableResult, PaginationStrategy, StrategyContext, TableStrategies as ITableStrategies } from './types';
import { TYPE_CONTEXT } from './typeContext';
import { SortingStrategies as ImportedSortingStrategies } from './strategies/sorting';
import { PaginationStrategies as ImportedPaginationStrategies } from './strategies/pagination';

import { DedupeStrategies as ImportedDedupeStrategies } from './strategies/dedupe';
import { LoadingStrategies as ImportedLoadingStrategies } from './strategies/loading';
import { FillStrategies } from './strategies/fill';
import { HeaderStrategies } from './strategies/headers';
import { CellNavigationStrategies } from './strategies/columns';
import { createSmartRow } from './smartRow';
import { FilterEngine } from './filterEngine';
import { ResolutionStrategies } from './strategies/resolution';
import { Strategies } from './strategies';
import { validatePaginationResult, validatePaginationStrategy, validateSortingStrategy } from './strategies/validation';
import { debugDelay, logDebug, warnIfDebugInCI } from './utils/debugUtils';
import { createSmartRowArray, SmartRowArray } from './utils/smartRowArray';

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
    headerTransformer: ({ text }) => text,
    autoScroll: true,
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
  const log = (msg: string) => {
    logDebug(config, 'verbose', msg); // Legacy(`🔎 [SmartTable Debug] ${msg}`);
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
      suggestion = `. Available columns (first 10 of ${availableColumns.length}): ${availableColumns.slice(0, 10).map(c => `"${c}"`).join(', ')}, ...`;
    }

    const contextMsg = context ? ` (${context})` : '';
    return new Error(`Column "${colName}" not found${contextMsg}${suggestion}`);
  };

  const _getMap = async (timeout?: number) => {
    if (_headerMap) return _headerMap;
    log('Mapping headers...');
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

    const seenHeaders = new Set<string>();
    const entries: [string, number][] = [];

    for (let i = 0; i < rawHeaders.length; i++) {
      let text = rawHeaders[i].trim() || `__col_${i}`;
      if (config.headerTransformer) {
        text = await config.headerTransformer({
          text,
          index: i,
          locator: rootLocator.locator(config.headerSelector as string).nth(i),
          seenHeaders
        });
      }
      entries.push([text, i]);
      seenHeaders.add(text);
    }

    // Validation: Check for empty table
    if (entries.length === 0) {
      throw new Error(`Initialization Error: No columns found using selector "${config.headerSelector}". Check your selector or ensure the table is visible.`);
    }

    // Validation: Check for duplicates
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const [name] of entries) {
      if (seen.has(name)) {
        duplicates.add(name);
      }
      seen.add(name);
    }

    if (duplicates.size > 0) {
      const dupList = Array.from(duplicates).map(d => `"${d}"`).join(', ');
      throw new Error(`Initialization Error: Duplicate column names found: ${dupList}. Use 'headerTransformer' to rename duplicate columns.`);
    }

    _headerMap = new Map(entries);
    log(`Mapped ${entries.length} columns: ${JSON.stringify(entries.map(e => e[0]))}`);
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

    log(`Looking for row: ${JSON.stringify(filters)} (MaxPages: ${effectiveMaxPages})`);

    while (true) {
      // Check for table loading
      if (config.strategies.loading?.isTableLoading) {
        const isLoading = await config.strategies.loading.isTableLoading({ root: rootLocator, config, page: rootLocator.page(), resolve });
        if (isLoading) {
          log('Table is loading... waiting');
          await rootLocator.page().waitForTimeout(200);
          continue;
        }
      }

      const allRows = resolve(config.rowSelector, rootLocator);
      // Use FilterEngine
      const matchedRows = filterEngine.applyFilters(allRows, filters, map, options.exact || false, rootLocator.page());

      const count = await matchedRows.count();
      log(`Page ${currentPage}: Found ${count} matches.`);

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
          `Ambiguous Row: Found ${count} rows matching ${JSON.stringify(filters)} on page ${currentPage}. ` +
          `Expected exactly one match. Try adding more filters to make your query unique.${sampleMsg}`
        );
      }
      if (count === 1) return matchedRows.first();

      if (currentPage < effectiveMaxPages) {
        log(`Page ${currentPage}: Not found. Attempting pagination...`);
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
          log(`Page ${currentPage}: Pagination failed (end of data).`);
        }
      }

      if (_hasPaginated) {
        console.warn(`⚠️ [SmartTable] Row not found. The table has been paginated (Current Page: ${currentPage}). You may need to call 'await table.reset()' if the target row is on a previous page.`);
      }

      return null;
    }
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

  const _ensureInitialized = async () => {
    if (!_isInitialized) {
      await _getMap();
      _isInitialized = true;
    }
  };

  const result: TableResult<T> = {
    init: async (options?: { timeout?: number }): Promise<TableResult<T>> => {
      if (_isInitialized && _headerMap) return result;

      warnIfDebugInCI(config);
      logDebug(config, 'info', 'Initializing table');

      await _getMap(options?.timeout);
      _isInitialized = true;

      if (_headerMap) {
        logDebug(config, 'info', `Table initialized with ${_headerMap.size} columns`, Array.from(_headerMap.keys()));
        // Trace event removed - redundant with debug logging
      }

      await debugDelay(config, 'default');
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
      await _ensureInitialized();
      return Array.from(_headerMap!.keys());
    },

    getHeaderCell: async (columnName: string) => {
      await _ensureInitialized();
      const idx = _headerMap!.get(columnName);
      if (idx === undefined) throw _createColumnError(columnName, _headerMap!, 'header cell');
      return resolve(config.headerSelector, rootLocator).nth(idx);
    },

    reset: async () => {
      log("Resetting table...");
      const context: TableContext = { root: rootLocator, config, page: rootLocator.page(), resolve };
      await config.onReset(context);
      _hasPaginated = false;
      _headerMap = null;
      _isInitialized = false;
      log("Table reset complete.");
    },

    revalidate: async () => {
      log("Revalidating table structure...");
      _headerMap = null; // Clear the map to force re-scanning
      await _getMap(); // Re-scan headers
      log("Table revalidated.");
    },

    getColumnValues: async <V = string>(column: string, options?: { mapper?: (cell: Locator) => Promise<V> | V, maxPages?: number }) => {
      await _ensureInitialized();
      const colIdx = _headerMap!.get(column);
      if (colIdx === undefined) throw _createColumnError(column, _headerMap!);

      const mapper = options?.mapper ?? ((c: Locator) => c.innerText() as any as V);
      const effectiveMaxPages = options?.maxPages ?? config.maxPages;
      let currentPage = 1;
      const results: V[] = [];
      log(`Getting column values for '${column}' (Pages: ${effectiveMaxPages})`);

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
      logDebug(config, 'info', 'Searching for row', filters);
      await _ensureInitialized();

      let row = await _findRowLocator(filters as Record<string, string | RegExp | number>, options);

      if (row) {
        logDebug(config, 'info', 'Row found');
        await debugDelay(config, 'findRow');
        return _makeSmart(row, _headerMap!, 0);
      }

      logDebug(config, 'error', 'Row not found', filters);
      await debugDelay(config, 'findRow');

      // Return sentinel row
      row = resolve(config.rowSelector, rootLocator).filter({ hasText: "___SENTINEL_ROW_NOT_FOUND___" + Date.now() });
      return _makeSmart(row, _headerMap!, 0);
    },

    getRows: async (options?: { filter?: Partial<T> | Record<string, any>, exact?: boolean }): Promise<SmartRowArray<T>> => {
      await _ensureInitialized();
      let rowLocators = resolve(config.rowSelector, rootLocator);
      if (options?.filter) {
        rowLocators = filterEngine.applyFilters(rowLocators, options.filter as Record<string, any>, _headerMap!, options.exact || false, rootLocator.page());
      }
      const allRowLocs = await rowLocators.all();

      const smartRows: SmartRowType<T>[] = [];
      const isRowLoading = config.strategies.loading?.isRowLoading;

      for (let i = 0; i < allRowLocs.length; i++) {
        const smartRow = _makeSmart(allRowLocs[i], _headerMap!, i);
        if (isRowLoading) {
          const loading = await isRowLoading(smartRow);
          if (loading) continue;
        }
        smartRows.push(smartRow);
      }
      return createSmartRowArray(smartRows);
    },

    findRows: async <R extends { asJSON?: boolean }>(filters: Partial<T> | Record<string, string | RegExp | number>, options?: { exact?: boolean, maxPages?: number } & R): Promise<any> => {
      await _ensureInitialized();
      const allRows: SmartRowType<T>[] = [];
      const effectiveMaxPages = options?.maxPages ?? config.maxPages ?? Infinity;
      let pageCount = 0;

      // Collect rows from current page
      let rowLocators = resolve(config.rowSelector, rootLocator);
      rowLocators = filterEngine.applyFilters(rowLocators, filters as Record<string, any>, _headerMap!, options?.exact ?? false, rootLocator.page());
      let currentRows = await rowLocators.all();
      const isRowLoading = config.strategies.loading?.isRowLoading;

      for (let i = 0; i < currentRows.length; i++) {
        const smartRow = _makeSmart(currentRows[i], _headerMap!, i);
        if (isRowLoading && await isRowLoading(smartRow)) continue;
        allRows.push(smartRow);
      }

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
        const newRows = await rowLocators.all();

        for (let i = 0; i < newRows.length; i++) {
          const smartRow = _makeSmart(newRows[i], _headerMap!, i);
          if (isRowLoading && await isRowLoading(smartRow)) continue;
          allRows.push(smartRow);
        }
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
        log(`Applying sort for column "${columnName}" (${direction})`);
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
        rows: SmartRowArray;
        allData: T[];
        table: RestrictedTableResult;
        batchInfo?: {
          startIndex: number;
          endIndex: number;
          size: number;
        };
      }) => T | T[] | Promise<T | T[]>,
      options?: {
        pagination?: PaginationStrategy;
        dedupeStrategy?: DedupeStrategy;
        maxIterations?: number;
        batchSize?: number;
        getIsFirst?: (context: { index: number }) => boolean;
        getIsLast?: (context: { index: number, paginationResult: boolean }) => boolean;
        beforeFirst?: (context: { index: number, rows: SmartRowType[], allData: any[] }) => void | Promise<void>;
        afterLast?: (context: { index: number, rows: SmartRowType[], allData: any[] }) => void | Promise<void>;
        /**
       * If true, flattens array results from callback into the main data array.
       * If false (default), pushes the return value as-is (preserves batching/arrays).
       */
        autoFlatten?: boolean;
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
        generateConfigPrompt: result.generateConfigPrompt,
      };

      const getIsFirst = options?.getIsFirst ?? (({ index }) => index === 0);
      const getIsLast = options?.getIsLast ?? (() => false);
      const allData: T[] = [];
      const effectiveMaxIterations = options?.maxIterations ?? config.maxPages;
      const batchSize = options?.batchSize;
      const isBatching = batchSize !== undefined && batchSize > 1;
      const autoFlatten = options?.autoFlatten ?? false;

      let index = 0;
      let paginationResult = true;
      let seenKeys: Set<string | number> | null = null;
      let batchRows: SmartRowType[] = [];
      let batchStartIndex = 0;

      log(`Starting iterateThroughTable (maxIterations: ${effectiveMaxIterations}, batchSize: ${batchSize ?? 'none'})`);

      while (index < effectiveMaxIterations) {
        const rowLocators = await resolve(config.rowSelector, rootLocator).all();
        const smartRowsArray: SmartRowType[] = [];
        const isRowLoading = config.strategies.loading?.isRowLoading;

        for (let i = 0; i < rowLocators.length; i++) {
          const smartRow = _makeSmart(rowLocators[i], _headerMap!, i);
          if (isRowLoading && await isRowLoading(smartRow)) continue;
          smartRowsArray.push(smartRow);
        }
        let rows = createSmartRowArray(smartRowsArray);

        const dedupeStrategy = options?.dedupeStrategy ?? config.strategies.dedupe;
        if (dedupeStrategy && rows.length > 0) {
          if (!seenKeys) seenKeys = new Set<string | number>();
          const deduplicated: SmartRowType[] = [];
          for (const row of rows) {
            const key = await dedupeStrategy(row);

            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              deduplicated.push(row);
            }
          }
          rows = createSmartRowArray(deduplicated);
          log(`Deduplicated ${rowLocators.length} rows to ${rows.length} unique rows (total seen: ${seenKeys.size})`);
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
            rows: createSmartRowArray(callbackRows),
            allData,
            table: restrictedTable,
            batchInfo
          });

          if (autoFlatten && Array.isArray(returnValue)) {
            allData.push(...returnValue);
          } else {
            allData.push(returnValue as T);
          }

          // Determine if this is truly the last iteration
          let finalIsLast = isLastDueToMax;
          if (!isLastIteration) {
            const context: TableContext = { root: rootLocator, config, page: rootLocator.page(), resolve };
            paginationResult = await paginationStrategy(context);
            logDebug(config, 'info', `Pagination ${paginationResult ? 'succeeded' : 'failed'}`);
            await debugDelay(config, 'pagination');
            finalIsLast = getIsLast({ index: callbackIndex, paginationResult }) || !paginationResult;
          }

          if (finalIsLast && options?.afterLast) {
            await options.afterLast({ index: callbackIndex, rows: callbackRows, allData });
          }

          if (finalIsLast || !paginationResult) {
            log(`Reached last iteration (index: ${index}, paginationResult: ${paginationResult})`);
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
          logDebug(config, 'info', `Pagination ${paginationResult ? 'succeeded' : 'failed'} (batching mode)`);
          await debugDelay(config, 'pagination');

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
              rows: createSmartRowArray(batchRows),
              allData,
              table: restrictedTable,
              batchInfo
            });
            if (autoFlatten && Array.isArray(returnValue)) {
              allData.push(...returnValue);
            } else {
              allData.push(returnValue as T);
            }

            if (options?.afterLast) {
              await options.afterLast({ index: callbackIndex, rows: batchRows, allData });
            }

            log(`Pagination failed mid-batch (index: ${index})`);
            break;
          }
        }

        index++;
        log(`Iteration ${index} completed, continuing...`);
      }
      log(`iterateThroughTable completed after ${index + 1
        } iterations, collected ${allData.length} items`);
      return allData;
    },

    generateConfigPrompt: async (options?: PromptOptions) => {
      const html = await _getCleanHtml(rootLocator);
      const separator = "=".repeat(50);
      const content = `\n${separator} \n🤖 COPY INTO GEMINI / ChatGPT 🤖\n${separator} \nI am using 'playwright-smart-table'.\nTarget Table Locator: ${rootLocator.toString()} \nGenerate config for: \n\`\`\`html\n${html.substring(0, 10000)} ...\n\`\`\`\n${separator}\n`;
      await _handlePrompt('Smart Table Config', content, options);
    },
  };

  finalTable = result;
  return result;
};

export const PaginationStrategies = {
  ...ImportedPaginationStrategies
};
export const LoadingStrategies = ImportedLoadingStrategies;
export const SortingStrategies = ImportedSortingStrategies;
export const DedupeStrategies = ImportedDedupeStrategies;
export { FillStrategies, HeaderStrategies, CellNavigationStrategies, ResolutionStrategies, Strategies };