import type { Locator, Page } from '@playwright/test';
import type { SmartRow, RowIterationContext, RowIterationOptions } from '../types';
import type { FinalTableConfig } from '../types';
import type { SmartRowArray } from '../utils/smartRowArray';
import { ElementTracker } from '../utils/elementTracker';
import { logDebug } from '../utils/debugUtils';

export interface TableIterationEnv<T = any> {
  getRowLocators: () => Locator;
  getMap: () => Map<string, number>;
  advancePage: (useBulk: boolean) => Promise<boolean>;
  makeSmartRow: (rowLocator: Locator, map: Map<string, number>, rowIndex: number, tablePageIndex?: number) => SmartRow<T>;
  createSmartRowArray: (rows: SmartRow<T>[]) => SmartRowArray<T>;
  config: FinalTableConfig<T>;
  getPage: () => Page;
}

function log(config: FinalTableConfig, msg: string) {
  logDebug(config, 'verbose', msg);
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

  log(env.config, `forEach: starting (maxPages=${effectiveMaxPages}, parallel=${parallel}, dedupe=${!!dedupeStrategy})`);

  try {
    let rowIndex = 0;
    let stopped = false;
    let pagesScanned = 1;
    let totalProcessed = 0;
    const stop = () => {
      log(env.config, `forEach: stop() called — halting after current page`);
      stopped = true;
    };

    while (!stopped) {
      const rowLocators = env.getRowLocators();
      const newIndices = await tracker.getUnseenIndices(rowLocators);
      const pageRows = await rowLocators.all();
      const smartRows = newIndices.map((idx, i) => env.makeSmartRow(pageRows[idx], map, rowIndex + i));

      log(env.config, `forEach: page ${pagesScanned} — ${newIndices.length} new row(s) found`);

      if (parallel) {
        await Promise.all(smartRows.map(async (row) => {
          if (stopped) return;
          if (dedupeKeys && dedupeStrategy) {
            const key = await dedupeStrategy(row);
            if (dedupeKeys.has(key)) {
              log(env.config, `forEach: dedupe skip key="${key}"`);
              return;
            }
            dedupeKeys.add(key);
          }
          log(env.config, `forEach: processing row ${row.rowIndex}`);
          await callback({ row, rowIndex: row.rowIndex!, stop });
          totalProcessed++;
        }));
      } else {
        for (const row of smartRows) {
          if (stopped) break;
          if (dedupeKeys && dedupeStrategy) {
            const key = await dedupeStrategy(row);
            if (dedupeKeys.has(key)) {
              log(env.config, `forEach: dedupe skip key="${key}"`);
              continue;
            }
            dedupeKeys.add(key);
          }
          log(env.config, `forEach: processing row ${row.rowIndex}`);
          await callback({ row, rowIndex: row.rowIndex!, stop });
          totalProcessed++;
        }
      }
      rowIndex += smartRows.length;

      if (stopped || pagesScanned >= effectiveMaxPages) break;
      log(env.config, `forEach: advancing to next page (${pagesScanned} → ${pagesScanned + 1})`);
      if (!await env.advancePage(useBulk)) {
        log(env.config, `forEach: no more pages — done`);
        break;
      }
      pagesScanned++;
    }
    log(env.config, `forEach: complete — ${totalProcessed} row(s) processed across ${pagesScanned} page(s)`);
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

  log(env.config, `map: starting (maxPages=${effectiveMaxPages}, parallel=${parallel}, dedupe=${!!dedupeStrategy})`);

  const results: R[] = [];
  const SKIP = Symbol('skip');

  try {
    let rowIndex = 0;
    let stopped = false;
    let pagesScanned = 1;
    const stop = () => {
      log(env.config, `map: stop() called — halting after current page`);
      stopped = true;
    };

    while (!stopped) {
      const rowLocators = env.getRowLocators();
      const newIndices = await tracker.getUnseenIndices(rowLocators);
      const pageRows = await rowLocators.all();
      const smartRows = newIndices.map((idx, i) => env.makeSmartRow(pageRows[idx], map, rowIndex + i));

      log(env.config, `map: scanning page ${pagesScanned} — ${newIndices.length} new row(s)`);

      if (parallel) {
        const pageResults = await Promise.all(smartRows.map(async (row) => {
          if (dedupeKeys && dedupeStrategy) {
            const key = await dedupeStrategy(row);
            if (dedupeKeys.has(key)) {
              log(env.config, `map: dedupe skip key="${key}"`);
              return SKIP;
            }
            dedupeKeys.add(key);
          }
          log(env.config, `map: processing row ${row.rowIndex}`);
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
            if (dedupeKeys.has(key)) {
              log(env.config, `map: dedupe skip key="${key}"`);
              continue;
            }
            dedupeKeys.add(key);
          }
          log(env.config, `map: processing row ${row.rowIndex}`);
          results.push(await callback({ row, rowIndex: row.rowIndex!, stop }));
        }
      }
      rowIndex += smartRows.length;

      if (stopped || pagesScanned >= effectiveMaxPages) break;
      log(env.config, `map: advancing to next page (${pagesScanned} → ${pagesScanned + 1})`);
      if (!await env.advancePage(useBulk)) {
        log(env.config, `map: no more pages — done`);
        break;
      }
      pagesScanned++;
    }
    log(env.config, `map: complete — ${results.length} result(s) across ${pagesScanned} page(s)`);
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

  log(env.config, `filter: starting (maxPages=${effectiveMaxPages}, parallel=${parallel}, dedupe=${!!dedupeStrategy})`);

  const matched: SmartRow<T>[] = [];

  try {
    let rowIndex = 0;
    let stopped = false;
    let pagesScanned = 1;
    const stop = () => {
      log(env.config, `filter: stop() called — halting after current page`);
      stopped = true;
    };

    while (!stopped) {
      const rowLocators = env.getRowLocators();
      const newIndices = await tracker.getUnseenIndices(rowLocators);
      const pageRows = await rowLocators.all();
      const smartRows = newIndices.map((idx, i) =>
        env.makeSmartRow(pageRows[idx], map, rowIndex + i, pagesScanned - 1)
      );

      log(env.config, `filter: scanning page ${pagesScanned} — ${newIndices.length} new row(s)`);

      if (parallel) {
        const flags = await Promise.all(smartRows.map(async (row) => {
          if (dedupeKeys && dedupeStrategy) {
            const key = await dedupeStrategy(row);
            if (dedupeKeys.has(key)) {
              log(env.config, `filter: dedupe skip key="${key}"`);
              return false;
            }
            dedupeKeys.add(key);
          }
          log(env.config, `filter: processing row ${row.rowIndex}`);
          return predicate({ row, rowIndex: row.rowIndex!, stop });
        }));
        smartRows.forEach((row, i) => { if (flags[i]) matched.push(row); });
      } else {
        for (const row of smartRows) {
          if (stopped) break;
          if (dedupeKeys && dedupeStrategy) {
            const key = await dedupeStrategy(row);
            if (dedupeKeys.has(key)) {
              log(env.config, `filter: dedupe skip key="${key}"`);
              continue;
            }
            dedupeKeys.add(key);
          }
          log(env.config, `filter: processing row ${row.rowIndex}`);
          if (await predicate({ row, rowIndex: row.rowIndex!, stop })) {
            matched.push(row);
          }
        }
      }
      rowIndex += smartRows.length;

      if (stopped || pagesScanned >= effectiveMaxPages) break;
      log(env.config, `filter: advancing to next page (${pagesScanned} → ${pagesScanned + 1})`);
      if (!await env.advancePage(useBulk)) {
        log(env.config, `filter: no more pages — done`);
        break;
      }
      pagesScanned++;
    }
    log(env.config, `filter: complete — ${matched.length} match(es) across ${pagesScanned} page(s)`);
  } finally {
    await tracker.cleanup(env.getPage());
  }
  return env.createSmartRowArray(matched);
}
