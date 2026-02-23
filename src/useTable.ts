import type { Locator, Page } from '@playwright/test';
import { TableConfig, TableContext, Selector, TableResult, SmartRow as SmartRowType, PromptOptions, FinalTableConfig, DedupeStrategy, RestrictedTableResult, PaginationStrategy, StrategyContext, TableStrategies as ITableStrategies, FilterValue } from './types';
import { TYPE_CONTEXT } from './typeContext';
import { MINIMAL_CONFIG_CONTEXT } from './minimalConfigContext';
import { SortingStrategies as ImportedSortingStrategies } from './strategies/sorting';
import { PaginationStrategies as ImportedPaginationStrategies } from './strategies/pagination';
import { validatePaginationResult } from './strategies/validation';

import { DedupeStrategies as ImportedDedupeStrategies } from './strategies/dedupe';
import { LoadingStrategies as ImportedLoadingStrategies } from './strategies/loading';
import { FillStrategies } from './strategies/fill';
import { HeaderStrategies } from './strategies/headers';

import { createSmartRow } from './smartRow';
import { FilterEngine } from './filterEngine';
import { TableMapper } from './engine/tableMapper';
import { RowFinder } from './engine/rowFinder';
import { ResolutionStrategies } from './strategies/resolution';
import { Strategies } from './strategies';
import { debugDelay, logDebug, warnIfDebugInCI } from './utils/debugUtils';
import { createSmartRowArray, SmartRowArray } from './utils/smartRowArray';

/**
 * Main hook to interact with a table.
 */
export const useTable = <T = any>(rootLocator: Locator, configOptions: TableConfig<T> = {}): TableResult<T> => {
  // Store whether pagination was explicitly provided in config
  const hasPaginationInConfig = configOptions.strategies?.pagination !== undefined;

  // Default strategies
  const defaultStrategies: ITableStrategies = {
    fill: FillStrategies.default,
    header: HeaderStrategies.visible,

    pagination: async () => false,
    loading: {
      isHeaderLoading: ImportedLoadingStrategies.Headers.stable(200)
    }
  };

  const config: FinalTableConfig<T> = {
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
    if (typeof item === 'function') return (item as any)(parent);
    return item;
  };

  // Internal State
  let _hasPaginated = false;

  // Helpers
  const log = (msg: string) => {
    logDebug(config, 'verbose', msg);
  };

  const _createColumnError = (colName: string, map: Map<string, number>, context?: string): Error => {
    const availableColumns = Array.from(map.keys());
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

  // Engines
  const filterEngine = new FilterEngine(config, resolve);
  const tableMapper = new TableMapper(rootLocator, config, resolve);

  // Placeholder for the final table object
  let finalTable: TableResult<T> = null as unknown as TableResult<T>;

  // Helper factory
  const _makeSmart = (rowLocator: Locator, map: Map<string, number>, rowIndex?: number, tablePageIndex?: number): SmartRowType => {
    return createSmartRow<T>(rowLocator, map, rowIndex, config, rootLocator, resolve, finalTable, tablePageIndex);
  };

  const tableState = { currentPageIndex: 0 };
  const rowFinder = new RowFinder<T>(rootLocator, config, resolve, filterEngine, tableMapper, _makeSmart, tableState);

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
      finalPrompt += `\n\n👇 Useful TypeScript Definitions 👇\n\`\`\`typescript\n${MINIMAL_CONFIG_CONTEXT}\n\`\`\`\n`;
    }
    if (output === 'error') {
      console.log(`⚠️ Throwing error to display [${promptName}] cleanly...`);
      throw new Error(finalPrompt);
    }
    console.log(finalPrompt);
  };

  const _ensureInitialized = async () => {
    await tableMapper.getMap();
  };

  const result: TableResult<T> = {
    get currentPageIndex() { return tableState.currentPageIndex; },
    set currentPageIndex(v: number) { tableState.currentPageIndex = v; },
    init: async (options?: { timeout?: number }): Promise<TableResult<T>> => {
      if (tableMapper.isInitialized()) return result;

      warnIfDebugInCI(config);
      logDebug(config, 'info', 'Initializing table');

      const map = await tableMapper.getMap(options?.timeout);

      logDebug(config, 'info', `Table initialized with ${map.size} columns`, Array.from(map.keys()));
      await debugDelay(config, 'default');
      return result;
    },

    scrollToColumn: async (columnName: string) => {
      const map = await tableMapper.getMap();
      const idx = map.get(columnName);
      if (idx === undefined) throw _createColumnError(columnName, map);

      // Use header cell for scrolling
      const headerCell = resolve(config.headerSelector as Selector, rootLocator).nth(idx);
      await headerCell.scrollIntoViewIfNeeded();
    },

    getHeaders: async () => {
      const map = await tableMapper.getMap();
      return Array.from(map.keys());
    },

    getHeaderCell: async (columnName: string) => {
      const map = await tableMapper.getMap();
      const idx = map.get(columnName);
      if (idx === undefined) throw _createColumnError(columnName, map, 'header cell');
      return resolve(config.headerSelector as Selector, rootLocator).nth(idx);
    },

    reset: async () => {
      log("Resetting table...");
      const context: TableContext = { root: rootLocator, config, page: rootLocator.page(), resolve };
      await config.onReset(context);
      _hasPaginated = false;
      tableMapper.clear();
      log("Table reset complete.");
    },

    revalidate: async () => {
      log("Revalidating table structure...");
      await tableMapper.remapHeaders();
      log("Table revalidated.");
    },

    getColumnValues: async <V = string>(column: string, options?: { mapper?: (cell: Locator) => Promise<V> | V, maxPages?: number }) => {
      const map = await tableMapper.getMap();
      const colIdx = map.get(column);
      if (colIdx === undefined) throw _createColumnError(column, map);

      const mapper = options?.mapper ?? ((c: Locator) => c.innerText() as any as V);
      const effectiveMaxPages = options?.maxPages ?? config.maxPages;
      let pagesScanned = 1;
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
        if (pagesScanned < effectiveMaxPages) {
          const context: TableContext = { root: rootLocator, config, page: rootLocator.page(), resolve };

          let pageRes: boolean | import('./types').PaginationPrimitives;
          if (typeof config.strategies.pagination === 'function') {
            pageRes = await config.strategies.pagination(context);
          } else {
            if (!config.strategies.pagination!.goNext) {
              log('Cannot paginate: no goNext primitive found.');
              break;
            }
            pageRes = await config.strategies.pagination!.goNext(context);
          }

          if (await validatePaginationResult(pageRes, 'Pagination Strategy')) {
            _hasPaginated = true;
            tableState.currentPageIndex++;
            pagesScanned++;
            continue;
          }
        }
        break;
      }
      return results;
    },

    getRow: (filters: Partial<T> | Record<string, FilterValue>, options: { exact?: boolean } = { exact: false }): SmartRowType<T> => {
      const map = tableMapper.getMapSync();
      if (!map) throw new Error('Table not initialized. Call await table.init() first, or use async methods like table.findRow() or table.getRows() which auto-initialize.');

      const allRows = resolve(config.rowSelector, rootLocator);
      const matchedRows = filterEngine.applyFilters(allRows, filters as Record<string, FilterValue>, map, options.exact || false, rootLocator.page());
      const rowLocator = matchedRows.first();
      return _makeSmart(rowLocator, map, 0); // fallback index 0
    },

    getRowByIndex: (index: number, options: { bringIntoView?: boolean } = {}): SmartRowType<T> => {
      const map = tableMapper.getMapSync();
      if (!map) throw new Error('Table not initialized. Call await table.init() first, or use async methods like table.findRow() or table.getRows() which auto-initialize.');

      const rowLocator = resolve(config.rowSelector, rootLocator).nth(index);
      return _makeSmart(rowLocator, map, index);
    },

    findRow: async (filters: Partial<T> | Record<string, FilterValue>, options?: { exact?: boolean, maxPages?: number }): Promise<SmartRowType<T>> => {
      // @ts-ignore
      return rowFinder.findRow(filters as Record<string, FilterValue>, options);
    },



    findRows: async (filters: Partial<T> | Record<string, any>, options?: { exact?: boolean, maxPages?: number }): Promise<SmartRowArray<T>> => {
      return rowFinder.findRows(filters, options);
    },

    isInitialized: (): boolean => {
      return tableMapper.isInitialized();
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

    // ─── Shared async row iterator ───────────────────────────────────────────

    async *[Symbol.asyncIterator](): AsyncIterableIterator<{ row: SmartRowType<T>; rowIndex: number }> {
      await _ensureInitialized();
      const map = tableMapper.getMapSync()!;
      const effectiveMaxPages = config.maxPages;
      let rowIndex = 0;
      let pagesScanned = 1;

      while (true) {
        const pageRows = await resolve(config.rowSelector, rootLocator).all();
        for (const rowLocator of pageRows) {
          yield { row: _makeSmart(rowLocator, map, rowIndex), rowIndex };
          rowIndex++;
        }

        if (pagesScanned >= effectiveMaxPages) break;

        const context: TableContext = { root: rootLocator, config, page: rootLocator.page(), resolve };
        let advanced: boolean;
        if (typeof config.strategies.pagination === 'function') {
          advanced = !!(await config.strategies.pagination(context));
        } else {
          advanced = !!(config.strategies.pagination?.goNext && await config.strategies.pagination.goNext(context));
        }

        if (!advanced) break;
        tableState.currentPageIndex++;
        pagesScanned++;
      }
    },

    // ─── Private row-iteration engine ────────────────────────────────────────

    forEach: async (callback, options = {}) => {
      await _ensureInitialized();
      const map = tableMapper.getMapSync()!;
      const effectiveMaxPages = options.maxPages ?? config.maxPages;
      const dedupeKeys = options.dedupe ? new Set<string | number>() : null;
      const parallel = options.parallel ?? false;

      let rowIndex = 0;
      let stopped = false;
      let pagesScanned = 1;
      const stop = () => { stopped = true; };

      while (!stopped) {
        const pageRows = await resolve(config.rowSelector, rootLocator).all();
        const smartRows = pageRows.map((r, i) => _makeSmart(r, map, rowIndex + i));

        if (parallel) {
          await Promise.all(smartRows.map(async (row) => {
            if (stopped) return;
            if (dedupeKeys) {
              const key = await options.dedupe!(row);
              if (dedupeKeys.has(key)) return;
              dedupeKeys.add(key);
            }
            await callback({ row, rowIndex: row.rowIndex!, stop });
          }));
        } else {
          for (const row of smartRows) {
            if (stopped) break;
            if (dedupeKeys) {
              const key = await options.dedupe!(row);
              if (dedupeKeys.has(key)) continue;
              dedupeKeys.add(key);
            }
            await callback({ row, rowIndex: row.rowIndex!, stop });
          }
        }
        rowIndex += smartRows.length;

        if (stopped || pagesScanned >= effectiveMaxPages) break;

        const context: TableContext = { root: rootLocator, config, page: rootLocator.page(), resolve };
        let advanced: boolean;
        if (typeof config.strategies.pagination === 'function') {
          advanced = !!(await config.strategies.pagination(context));
        } else {
          advanced = !!(config.strategies.pagination?.goNext && await config.strategies.pagination.goNext(context));
        }

        if (!advanced) break;
        tableState.currentPageIndex++;
        pagesScanned++;
      }
    },

    map: async <R>(callback: (ctx: import('./types').RowIterationContext<T>) => R | Promise<R>, options: import('./types').RowIterationOptions = {}): Promise<R[]> => {
      await _ensureInitialized();
      const map = tableMapper.getMapSync()!;
      const effectiveMaxPages = options.maxPages ?? config.maxPages;
      const dedupeKeys = options.dedupe ? new Set<string | number>() : null;
      const parallel = options.parallel ?? true;

      const results: R[] = [];
      let rowIndex = 0;
      let stopped = false;
      let pagesScanned = 1;
      const stop = () => { stopped = true; };

      while (!stopped) {
        const pageRows = await resolve(config.rowSelector, rootLocator).all();
        const smartRows = pageRows.map((r, i) => _makeSmart(r, map, rowIndex + i));

        if (parallel) {
          const SKIP = Symbol('skip');
          const pageResults = await Promise.all(smartRows.map(async (row) => {
            if (dedupeKeys) {
              const key = await options.dedupe!(row);
              if (dedupeKeys.has(key)) return SKIP;
              dedupeKeys.add(key);
            }
            return callback({ row, rowIndex: row.rowIndex!, stop });
          }));
          for (const r of pageResults) {
            if (r !== SKIP) results.push(r as R);
          }
        } else {
          for (const row of smartRows) {
            if (stopped) break;
            if (dedupeKeys) {
              const key = await options.dedupe!(row);
              if (dedupeKeys.has(key)) continue;
              dedupeKeys.add(key);
            }
            results.push(await callback({ row, rowIndex: row.rowIndex!, stop }));
          }
        }
        rowIndex += smartRows.length;

        if (stopped || pagesScanned >= effectiveMaxPages) break;

        const context: TableContext = { root: rootLocator, config, page: rootLocator.page(), resolve };
        let advanced: boolean;
        if (typeof config.strategies.pagination === 'function') {
          advanced = !!(await config.strategies.pagination(context));
        } else {
          advanced = !!(config.strategies.pagination?.goNext && await config.strategies.pagination.goNext(context));
        }

        if (!advanced) break;
        tableState.currentPageIndex++;
        pagesScanned++;
      }

      return results;
    },

    filter: async (predicate, options = {}) => {
      await _ensureInitialized();
      const map = tableMapper.getMapSync()!;
      const effectiveMaxPages = options.maxPages ?? config.maxPages;
      const dedupeKeys = options.dedupe ? new Set<string | number>() : null;
      const parallel = options.parallel ?? false;

      const matched: SmartRowType<T>[] = [];
      let rowIndex = 0;
      let stopped = false;
      let pagesScanned = 1;
      const stop = () => { stopped = true; };

      while (!stopped) {
        const pageRows = await resolve(config.rowSelector, rootLocator).all();
        const smartRows = pageRows.map((r, i) => _makeSmart(r, map, rowIndex + i, pagesScanned - 1));

        if (parallel) {
          const flags = await Promise.all(smartRows.map(async (row) => {
            if (dedupeKeys) {
              const key = await options.dedupe!(row);
              if (dedupeKeys.has(key)) return false;
              dedupeKeys.add(key);
            }
            return predicate({ row, rowIndex: row.rowIndex!, stop });
          }));
          smartRows.forEach((row, i) => { if (flags[i]) matched.push(row); });
        } else {
          for (const row of smartRows) {
            if (stopped) break;
            if (dedupeKeys) {
              const key = await options.dedupe!(row);
              if (dedupeKeys.has(key)) continue;
              dedupeKeys.add(key);
            }
            if (await predicate({ row, rowIndex: row.rowIndex!, stop })) {
              matched.push(row);
            }
          }
        }
        rowIndex += smartRows.length;

        if (stopped || pagesScanned >= effectiveMaxPages) break;

        const context: TableContext = { root: rootLocator, config, page: rootLocator.page(), resolve };
        let advanced: boolean;
        if (typeof config.strategies.pagination === 'function') {
          advanced = !!(await config.strategies.pagination(context));
        } else {
          advanced = !!(config.strategies.pagination?.goNext && await config.strategies.pagination.goNext(context));
        }

        if (!advanced) break;
        tableState.currentPageIndex++;
        pagesScanned++;
      }

      return createSmartRowArray<T>(matched);
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
        beforeFirst?: (context: { index: number, rows: SmartRowArray, allData: any[] }) => void | Promise<void>;
        afterLast?: (context: { index: number, rows: SmartRowArray, allData: any[] }) => void | Promise<void>;
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

      const map = tableMapper.getMapSync()!;

      const restrictedTable: RestrictedTableResult = {
        get currentPageIndex() { return tableState.currentPageIndex; },
        init: result.init,
        getHeaders: result.getHeaders,
        getHeaderCell: result.getHeaderCell,
        getRow: result.getRow,
        getRowByIndex: result.getRowByIndex,
        findRow: result.findRow,
        findRows: result.findRows,
        getColumnValues: result.getColumnValues,
        isInitialized: result.isInitialized,
        sorting: result.sorting,
        scrollToColumn: result.scrollToColumn,
        revalidate: result.revalidate,
        generateConfigPrompt: result.generateConfigPrompt,
        forEach: result.forEach,
        map: result.map,
        filter: result.filter,
        [Symbol.asyncIterator]: result[Symbol.asyncIterator].bind(result),
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
          const smartRow = _makeSmart(rowLocators[i], map, i);
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
            await options.beforeFirst({ index: callbackIndex, rows: createSmartRowArray(callbackRows), allData });
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
            if (typeof paginationStrategy === 'function') {
              paginationResult = await paginationStrategy(context);
            } else {
              const pageObj = paginationStrategy as import('./types').PaginationPrimitives;
              if (!pageObj.goNext) break;
              paginationResult = await pageObj.goNext(context);
            }
            logDebug(config, 'info', `Pagination ${paginationResult ? 'succeeded' : 'failed'}`);
            await debugDelay(config, 'pagination');
            finalIsLast = getIsLast({ index: callbackIndex, paginationResult }) || !paginationResult;
            if (paginationResult) tableState.currentPageIndex++;
          }

          if (finalIsLast && options?.afterLast) {
            await options.afterLast({ index: callbackIndex, rows: createSmartRowArray(callbackRows), allData });
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

          if (typeof paginationStrategy === 'function') {
            paginationResult = await paginationStrategy(context);
          } else {
            const pageObj = paginationStrategy as import('./types').PaginationPrimitives;
            if (!pageObj.goNext) {
              log(`Cannot paginate: no goNext primitive found.`);
              break;
            }
            paginationResult = await pageObj.goNext(context);
          }

          logDebug(config, 'info', `Pagination ${paginationResult ? 'succeeded' : 'failed'} (batching mode)`);
          await debugDelay(config, 'pagination');

          if (paginationResult) tableState.currentPageIndex++;

          if (!paginationResult) {
            // Pagination failed, invoke callback with current batch
            const callbackIndex = batchStartIndex;
            const isFirst = getIsFirst({ index: callbackIndex });
            const isLast = true;

            if (isFirst && options?.beforeFirst) {
              await options.beforeFirst({ index: callbackIndex, rows: createSmartRowArray(batchRows), allData });
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
              await options.afterLast({ index: callbackIndex, rows: createSmartRowArray(batchRows), allData });
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
