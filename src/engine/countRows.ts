import type { Locator } from '@playwright/test';
import type { FilterValue, FinalTableConfig, TableContext } from '../types';
import type { FilterEngine } from '../filterEngine';
import type { TableMapper } from './tableMapper';
import type { RowFinder } from './rowFinder';
import { scanPages } from './scanPages';
import { ElementTracker } from '../utils/elementTracker';
import { logDebug } from '../utils/debugUtils';
import { waitWhileTableLoading } from '../utils/loadingWait';
import { safeStringify } from '../utils/safeStringify';

export interface CountRowsEnv<T = any> {
  config: FinalTableConfig<T>;
  rootLocator: Locator;
  getRowLocators: () => Locator;
  tableMapper: TableMapper;
  filterEngine: FilterEngine;
  rowFinder: RowFinder<T>;
  advancePage: (useBulk: boolean) => Promise<boolean>;
  getCurrentPageIndex: () => number;
  getContext: () => TableContext;
  /** Restores page 1 after a paginated count. */
  reset: () => Promise<void>;
}

function log(config: FinalTableConfig, msg: string) {
  logDebug(config, 'verbose', msg);
}

/** Splits filters by how they're evaluated: DOM text, `columnOverrides.read`, or synthetic columns. */
function partitionFilters<T>(config: FinalTableConfig<T>, filters: Record<string, FilterValue>) {
  const domFilters: Record<string, FilterValue> = {};
  const overrideFilters: Record<string, FilterValue> = {};
  const syntheticFilters: Record<string, FilterValue> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (config.syntheticColumns?.[key]) {
      syntheticFilters[key] = value;
    } else if (config.columnOverrides?.[key as keyof T]?.read) {
      overrideFilters[key] = value;
    } else {
      domFilters[key] = value;
    }
  }
  return { domFilters, overrideFilters, syntheticFilters };
}

function requireMap(tableMapper: TableMapper): Map<string, number> {
  const map = tableMapper.getMapSync();
  if (!map) throw new Error('Initialization Error: Table map not available. Call "await table.init()" first.');
  return map;
}

/**
 * Counts matching rows on the current page, or across pages when pagination and
 * `maxPages > 1` allow it. A paginated count always resets to page 1 afterwards (#348).
 * Callers must have initialized the table.
 */
export async function countRows<T>(
  env: CountRowsEnv<T>,
  filters?: Record<string, FilterValue>,
  options?: { exact?: boolean; maxPages?: number; signal?: AbortSignal }
): Promise<number> {
  const { config, rootLocator, tableMapper, rowFinder } = env;
  const filtersRecord = filters ?? {};
  const hasFilters = Object.keys(filtersRecord).length > 0;
  const effectiveMaxPages = options?.maxPages ?? config.maxPages;
  const pag = config.strategies.pagination;
  const hasPagination = effectiveMaxPages > 1 && !!(pag?.goNext || pag?.goNextBulk);
  const exact = options?.exact ?? false;

  const { domFilters, overrideFilters, syntheticFilters } = partitionFilters(config, filtersRecord);
  const hasOverrides = Object.keys(overrideFilters).length > 0;
  const hasSynthetics = Object.keys(syntheticFilters).length > 0;
  const hasPostFilters = hasOverrides || hasSynthetics;

  const resolveRows = () => {
    const rows = env.getRowLocators();
    if (Object.keys(domFilters).length === 0) return rows;
    return env.filterEngine.applyFilters(rows, domFilters, requireMap(tableMapper), exact, rootLocator.page(), rootLocator);
  };

  const countPostFilterMatches = async (candidates: Locator[], indices: number[]): Promise<number> => {
    if (!hasPostFilters) return indices.length;
    const map = requireMap(tableMapper);
    let count = 0;
    for (const idx of indices) {
      const row = candidates[idx];
      if (hasOverrides && !await rowFinder.matchesOverrideFilters(row, overrideFilters, map, exact)) continue;
      if (hasSynthetics && !await rowFinder.matchesSyntheticFilters(row, syntheticFilters, map, exact)) continue;
      count++;
    }
    return count;
  };

  const isTableLoading = config.strategies.loading?.isTableLoading;
  const waitForReady = async () => {
    if (!isTableLoading) return;
    await waitWhileTableLoading(config, env.getContext(), rootLocator.page(), 'countRows');
  };

  await waitForReady();

  const filterSuffix = hasFilters ? ` filters=${safeStringify(filtersRecord)}` : '';
  if (!hasPagination) {
    log(config, `countRows: counting rows in current viewport (no pagination)${filterSuffix}`);
    if (!hasPostFilters) return resolveRows().count();
    const all = await resolveRows().all();
    return countPostFilterMatches(all, all.map((_, i) => i));
  }

  log(config, `countRows: paginating up to ${effectiveMaxPages} page(s)${filterSuffix}`);
  const tracker = new ElementTracker('countRows');
  let total = 0;
  let pagesScanned = 1;
  let paginationError: unknown;
  try {
    const scanned = await scanPages(
      {
        advancePage: env.advancePage,
        getCurrentPageIndex: env.getCurrentPageIndex,
        config,
        waitForReady,
      },
      async ({ pagesScanned: pageNum }) => {
        const rowLocators = resolveRows();
        const newIndices = await tracker.getUnseenIndices(rowLocators);
        const candidates = await rowLocators.all();
        const matched = await countPostFilterMatches(candidates, newIndices);
        total += matched;
        log(config, `countRows: page ${pageNum} — ${matched} row(s) (running total: ${total})`);
        return 'continue';
      },
      {
        maxPages: effectiveMaxPages,
        useBulk: false,
        label: 'countRows',
        finalScanOnEof: true,
        signal: options?.signal,
      }
    );
    pagesScanned = scanned.pagesScanned;
  } catch (e) {
    paginationError = e;
    throw e;
  } finally {
    await tracker.cleanup(rootLocator.page());
    // Always restore page 1, even if pagination threw mid-count (#348), so the table
    // stays usable for callers that catch the error. If reset() itself fails, only let
    // it surface when pagination succeeded — otherwise preserve the original error.
    log(config, `countRows: ${total} total row(s) across ${pagesScanned} page(s) — resetting`);
    try {
      await env.reset();
    } catch (resetError) {
      if (paginationError === undefined) throw resetError;
      logDebug(config, 'error', 'countRows: reset() failed after pagination error', resetError);
    }
  }
  return total;
}
