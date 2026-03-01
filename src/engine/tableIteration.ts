import type { Locator, Page } from '@playwright/test';
import type { SmartRow, RowIterationContext, RowIterationOptions } from '../types';
import type { FinalTableConfig } from '../types';
import type { SmartRowArray } from '../utils/smartRowArray';
import { ElementTracker } from '../utils/elementTracker';

export interface TableIterationEnv<T = any> {
  getRowLocators: () => Locator;
  getMap: () => Map<string, number>;
  advancePage: (useBulk: boolean) => Promise<boolean>;
  makeSmartRow: (rowLocator: Locator, map: Map<string, number>, rowIndex: number, tablePageIndex?: number) => SmartRow<T>;
  createSmartRowArray: (rows: SmartRow<T>[]) => SmartRowArray<T>;
  config: FinalTableConfig<T>;
  getPage: () => Page;
}

/**
 * Shared row-iteration loop used by forEach, map, and filter.
 */
export async function runForEach<T>(
  env: TableIterationEnv<T>,
  callback: (ctx: RowIterationContext<T>) => void | Promise<void>,
  options: RowIterationOptions = {}
): Promise<void> {
  const map = env.getMap();
  const effectiveMaxPages = options.maxPages ?? env.config.maxPages;
  const dedupeStrategy = options.dedupe ?? env.config.strategies.dedupe;
  const dedupeKeys = dedupeStrategy ? new Set<string | number>() : null;
  const parallel = options.parallel ?? false;
  const useBulk = options.useBulkPagination ?? false;
  const tracker = new ElementTracker('forEach');

  try {
    let rowIndex = 0;
    let stopped = false;
    let pagesScanned = 1;
    const stop = () => { stopped = true; };

    while (!stopped) {
      const rowLocators = env.getRowLocators();
      const newIndices = await tracker.getUnseenIndices(rowLocators);
      const pageRows = await rowLocators.all();
      const smartRows = newIndices.map((idx, i) => env.makeSmartRow(pageRows[idx], map, rowIndex + i));

      if (parallel) {
        await Promise.all(smartRows.map(async (row) => {
          if (stopped) return;
          if (dedupeKeys && dedupeStrategy) {
            const key = await dedupeStrategy(row);
            if (dedupeKeys.has(key)) return;
            dedupeKeys.add(key);
          }
          await callback({ row, rowIndex: row.rowIndex!, stop });
        }));
      } else {
        for (const row of smartRows) {
          if (stopped) break;
          if (dedupeKeys && dedupeStrategy) {
            const key = await dedupeStrategy(row);
            if (dedupeKeys.has(key)) continue;
            dedupeKeys.add(key);
          }
          await callback({ row, rowIndex: row.rowIndex!, stop });
        }
      }
      rowIndex += smartRows.length;

      if (stopped || pagesScanned >= effectiveMaxPages) break;
      if (!await env.advancePage(useBulk)) break;
      pagesScanned++;
    }
  } finally {
    await tracker.cleanup(env.getPage());
  }
}

/**
 * Shared row-iteration loop for map.
 */
export async function runMap<T, R>(
  env: TableIterationEnv<T>,
  callback: (ctx: RowIterationContext<T>) => R | Promise<R>,
  options: RowIterationOptions = {}
): Promise<R[]> {
  const map = env.getMap();
  const effectiveMaxPages = options.maxPages ?? env.config.maxPages;
  const dedupeStrategy = options.dedupe ?? env.config.strategies.dedupe;
  const dedupeKeys = dedupeStrategy ? new Set<string | number>() : null;
  const parallel = options.parallel ?? true;
  const useBulk = options.useBulkPagination ?? false;
  const tracker = new ElementTracker('map');

  const results: R[] = [];
  const SKIP = Symbol('skip');

  try {
    let rowIndex = 0;
    let stopped = false;
    let pagesScanned = 1;
    const stop = () => { stopped = true; };

    while (!stopped) {
      const rowLocators = env.getRowLocators();
      const newIndices = await tracker.getUnseenIndices(rowLocators);
      const pageRows = await rowLocators.all();
      const smartRows = newIndices.map((idx, i) => env.makeSmartRow(pageRows[idx], map, rowIndex + i));

      if (parallel) {
        const pageResults = await Promise.all(smartRows.map(async (row) => {
          if (dedupeKeys && dedupeStrategy) {
            const key = await dedupeStrategy(row);
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
          if (dedupeKeys && dedupeStrategy) {
            const key = await dedupeStrategy(row);
            if (dedupeKeys.has(key)) continue;
            dedupeKeys.add(key);
          }
          results.push(await callback({ row, rowIndex: row.rowIndex!, stop }));
        }
      }
      rowIndex += smartRows.length;

      if (stopped || pagesScanned >= effectiveMaxPages) break;
      if (!await env.advancePage(useBulk)) break;
      pagesScanned++;
    }
  } finally {
    await tracker.cleanup(env.getPage());
  }
  return results;
}

/**
 * Shared row-iteration loop for filter.
 */
export async function runFilter<T>(
  env: TableIterationEnv<T>,
  predicate: (ctx: RowIterationContext<T>) => boolean | Promise<boolean>,
  options: RowIterationOptions = {}
): Promise<SmartRowArray<T>> {
  const map = env.getMap();
  const effectiveMaxPages = options.maxPages ?? env.config.maxPages;
  const dedupeStrategy = options.dedupe ?? env.config.strategies.dedupe;
  const dedupeKeys = dedupeStrategy ? new Set<string | number>() : null;
  const parallel = options.parallel ?? false;
  const useBulk = options.useBulkPagination ?? false;
  const tracker = new ElementTracker('filter');

  const matched: SmartRow<T>[] = [];

  try {
    let rowIndex = 0;
    let stopped = false;
    let pagesScanned = 1;
    const stop = () => { stopped = true; };

    while (!stopped) {
      const rowLocators = env.getRowLocators();
      const newIndices = await tracker.getUnseenIndices(rowLocators);
      const pageRows = await rowLocators.all();
      const smartRows = newIndices.map((idx, i) =>
        env.makeSmartRow(pageRows[idx], map, rowIndex + i, pagesScanned - 1)
      );

      if (parallel) {
        const flags = await Promise.all(smartRows.map(async (row) => {
          if (dedupeKeys && dedupeStrategy) {
            const key = await dedupeStrategy(row);
            if (dedupeKeys.has(key)) return false;
            dedupeKeys.add(key);
          }
          return predicate({ row, rowIndex: row.rowIndex!, stop });
        }));
        smartRows.forEach((row, i) => { if (flags[i]) matched.push(row); });
      } else {
        for (const row of smartRows) {
          if (stopped) break;
          if (dedupeKeys && dedupeStrategy) {
            const key = await dedupeStrategy(row);
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
      if (!await env.advancePage(useBulk)) break;
      pagesScanned++;
    }
  } finally {
    await tracker.cleanup(env.getPage());
  }
  return env.createSmartRowArray(matched);
}
