import type { Locator, Page } from '@playwright/test';
import { TableConfig, TableContext, Selector, TableResult, SmartRow as SmartRowType, FinalTableConfig, DedupeStrategy, PaginationStrategy, StrategyContext, TableStrategies as ITableStrategies, FilterValue } from './types';
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
import { runForEach, runMap, runFilter } from './engine/tableIteration';
import { ResolutionStrategies } from './strategies/resolution';
import { debugDelay, logDebug, warnIfDebugInCI } from './utils/debugUtils';
import { createSmartRowArray, SmartRowArray } from './utils/smartRowArray';
import { ElementTracker } from './utils/elementTracker';

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

    pagination: {},
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

  /** Builds a full TableContext/StrategyContext with getHeaderCell, getHeaders, scrollToColumn. Set after result is created. */
  let createStrategyContext: () => TableContext = () => ({ root: rootLocator, config, page: rootLocator.page(), resolve });

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

  const _handlePrompt = async (promptName: string, content: string) => {
    let finalPrompt = content;
    finalPrompt += `\n\n👇 Useful TypeScript Definitions 👇\n\`\`\`typescript\n${MINIMAL_CONFIG_CONTEXT}\n\`\`\`\n`;

    console.log(`⚠️ Throwing error to display [${promptName}] cleanly...`);
    throw new Error(finalPrompt);
  };

  const _autoInit = async () => {
    await tableMapper.getMap();
  };

  // Default: goNext (one page). Pass useBulk true to prefer goNextBulk. "How far" uses numeric return when strategy provides it.
  const _advancePage = async (useBulk: boolean = false): Promise<boolean> => {
    const context = createStrategyContext();
    const pagination = config.strategies.pagination;
    let rawResult: boolean | number | undefined;
    if (useBulk && pagination?.goNextBulk) {
      rawResult = await pagination.goNextBulk(context);
    } else if (pagination?.goNext) {
      rawResult = await pagination.goNext(context);
    } else if (pagination?.goNextBulk) {
      rawResult = await pagination.goNextBulk(context);
    }
    const didAdvance = rawResult !== undefined && validatePaginationResult(rawResult, 'Pagination Strategy');
    const pagesJumped = typeof rawResult === 'number' ? rawResult : (didAdvance ? 1 : 0);
    if (pagesJumped > 0) {
      tableState.currentPageIndex += pagesJumped;
    }
    return didAdvance;
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
      await config.onReset(createStrategyContext());

      if (config.strategies.pagination?.goToFirst) {
        log("Auto-navigating to first page...");
        await config.strategies.pagination.goToFirst(createStrategyContext());
      } else if (hasPaginationInConfig) {
        log("No goToFirst strategy configured. Table may not be on page 1.");
      }

      _hasPaginated = false;
      tableState.currentPageIndex = 0;
      tableMapper.clear();
      log("Table reset complete. Calling autoInit to restore state.");
      await _autoInit();
    },

    revalidate: async () => {
      log("Revalidating table structure...");
      await tableMapper.remapHeaders();
      log("Table revalidated.");
    },



    getRow: (filters: Partial<T> | Record<string, FilterValue>, options: { exact?: boolean } = { exact: false }): SmartRowType<T> => {
      const map = tableMapper.getMapSync();
      if (!map) throw new Error('Table not initialized. Call await table.init() first, or use async methods like table.findRow() or table.findRows() which auto-initialize.');

      const allRows = resolve(config.rowSelector, rootLocator);
      const matchedRows = filterEngine.applyFilters(allRows, filters as Record<string, FilterValue>, map, options.exact || false, rootLocator.page());
      const rowLocator = matchedRows.first();
      return _makeSmart(rowLocator, map, 0); // fallback index 0
    },

    getRowByIndex: (index: number): SmartRowType<T> => {
      const map = tableMapper.getMapSync();
      if (!map) throw new Error('Table not initialized. Call await table.init() first, or use async methods like table.findRow() or table.findRows() which auto-initialize.');

      const rowLocator = resolve(config.rowSelector, rootLocator).nth(index);
      return _makeSmart(rowLocator, map, index);
    },

    findRow: async (filters: Record<string, FilterValue>, options?: { exact?: boolean, maxPages?: number }): Promise<SmartRowType<T>> => {
      return rowFinder.findRow(filters, options);
    },



    findRows: async (filters?: Record<string, FilterValue>, options?: { exact?: boolean, maxPages?: number }): Promise<SmartRowArray<T>> => {
      return rowFinder.findRows(filters ?? {}, options);
    },

    isInitialized: (): boolean => {
      return tableMapper.isInitialized();
    },

    sorting: {
      apply: async (columnName: string, direction: 'asc' | 'desc'): Promise<void> => {
        await _autoInit();
        if (!config.strategies.sorting) throw new Error('No sorting strategy has been configured.');
        log(`Applying sort for column "${columnName}" (${direction})`);
        const context: StrategyContext = { ...createStrategyContext(), getHeaderCell: result.getHeaderCell };

        const maxRetries = 3;
        for (let i = 0; i < maxRetries; i++) {
          const currentState = await config.strategies.sorting.getSortState({ columnName, context });
          if (currentState === direction) {
            log(`Sort for "${columnName}" is already "${direction}".`);
            return;
          }
          await config.strategies.sorting.doSort({ columnName, direction, context });

          if (config.strategies.loading?.isTableLoading) {
            await config.strategies.loading.isTableLoading(context);
          } else {
            await rootLocator.page().waitForTimeout(200);
          }
          await debugDelay(config, 'default');

          const newState = await config.strategies.sorting.getSortState({ columnName, context });
          if (newState === direction) {
            log(`Successfully sorted "${columnName}" to "${direction}".`);
            return;
          }
        }
        throw new Error(`Failed to sort column "${columnName}" to "${direction}" after ${maxRetries} attempts.`);
      },
      getState: async (columnName: string): Promise<'asc' | 'desc' | 'none'> => {
        await _autoInit();
        if (!config.strategies.sorting) throw new Error('No sorting strategy has been configured.');
        const context: StrategyContext = { ...createStrategyContext(), getHeaderCell: result.getHeaderCell };
        return config.strategies.sorting.getSortState({ columnName, context });
      }
    },

    // ─── Shared async row iterator ───────────────────────────────────────────

    async *[Symbol.asyncIterator](): AsyncIterableIterator<{ row: SmartRowType<T>; rowIndex: number }> {
      await _autoInit();
      const map = tableMapper.getMapSync()!;
      const effectiveMaxPages = config.maxPages;
      const tracker = new ElementTracker('iterator');
      const useBulk = false; // iterator has no options; default goNext

      try {
        let rowIndex = 0;
        let pagesScanned = 1;

        while (true) {
          const rowLocators = resolve(config.rowSelector, rootLocator);
          const newIndices = await tracker.getUnseenIndices(rowLocators);
          const pageRows = await rowLocators.all();

          for (const idx of newIndices) {
            yield { row: _makeSmart(pageRows[idx], map, rowIndex), rowIndex };
            rowIndex++;
          }

          if (pagesScanned >= effectiveMaxPages) break;
          if (!await _advancePage(useBulk)) break;
          pagesScanned++;
        }
      } finally {
        await tracker.cleanup(rootLocator.page());
      }
    },

    // ─── Row iteration (delegated to engine/tableIteration) ──────────────────

    forEach: async (callback, options = {}) => {
      await _autoInit();
      await runForEach(
        {
          getRowLocators: () => resolve(config.rowSelector, rootLocator),
          getMap: () => tableMapper.getMapSync()!,
          advancePage: _advancePage,
          makeSmartRow: (loc, map, idx, pageIdx) => _makeSmart(loc, map, idx, pageIdx),
          createSmartRowArray,
          config,
          getPage: () => rootLocator.page(),
        },
        callback,
        options
      );
    },

    map: async <R>(callback: (ctx: import('./types').RowIterationContext<T>) => R | Promise<R>, options: import('./types').RowIterationOptions = {}): Promise<R[]> => {
      await _autoInit();
      return runMap(
        {
          getRowLocators: () => resolve(config.rowSelector, rootLocator),
          getMap: () => tableMapper.getMapSync()!,
          advancePage: _advancePage,
          makeSmartRow: (loc, map, idx, pageIdx) => _makeSmart(loc, map, idx, pageIdx),
          createSmartRowArray,
          config,
          getPage: () => rootLocator.page(),
        },
        callback,
        options
      );
    },

    filter: async (predicate, options = {}) => {
      await _autoInit();
      return runFilter(
        {
          getRowLocators: () => resolve(config.rowSelector, rootLocator),
          getMap: () => tableMapper.getMapSync()!,
          advancePage: _advancePage,
          makeSmartRow: (loc, map, idx, pageIdx) => _makeSmart(loc, map, idx, pageIdx),
          createSmartRowArray,
          config,
          getPage: () => rootLocator.page(),
        },
        predicate,
        options
      );
    },



    generateConfig: async () => {
      const html = await _getCleanHtml(rootLocator);
      const separator = "=".repeat(50);
      const content = `\n${separator} \n🤖 COPY INTO GEMINI / ChatGPT 🤖\n${separator} \nI am using 'playwright-smart-table'.\nTarget Table Locator: ${rootLocator.toString()} \nGenerate config for: \n\`\`\`html\n${html.substring(0, 10000)} ...\n\`\`\`\n${separator}\n`;
      await _handlePrompt('Smart Table Config', content);
    },

    generateConfigPrompt: async () => {
      console.warn('⚠️ [playwright-smart-table] generateConfigPrompt() is deprecated and will be removed in v7.0.0. Please use generateConfig() instead.');
      return result.generateConfig();
    },
  };

  createStrategyContext = () => ({
    root: rootLocator,
    config,
    page: rootLocator.page(),
    resolve,
    getHeaderCell: result.getHeaderCell,
    getHeaders: result.getHeaders,
    scrollToColumn: result.scrollToColumn,
  });

  finalTable = result;
  return result;
};
