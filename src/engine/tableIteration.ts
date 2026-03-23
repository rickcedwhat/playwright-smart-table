import type { Locator, Page } from '@playwright/test';
import type { SmartRow, RowIterationContext, RowIterationOptions } from '../types';
import type { FinalTableConfig } from '../types';
import type { SmartRowArray } from '../utils/smartRowArray';
import { ElementTracker } from '../utils/elementTracker';
import { logDebug } from '../utils/debugUtils';
import { NavigationBarrier } from '../utils/navigationBarrier';
import { Mutex } from '../utils/mutex';

export interface TableIterationEnv<T = any> {
  getRowLocators: () => Locator;
  getMap: () => Map<string, number>;
  advancePage: (useBulk: boolean) => Promise<boolean>;
  makeSmartRow: (rowLocator: Locator, map: Map<string, number>, rowIndex: number, tablePageIndex?: number, barrier?: NavigationBarrier) => SmartRow<T>;
  createSmartRowArray: (rows: SmartRow<T>[]) => SmartRowArray<T>;
  config: FinalTableConfig<T>;
  getPage: () => Page;
}

function log(config: FinalTableConfig, msg: string) {
  logDebug(config, 'verbose', msg);
}

const SKIP = Symbol('skip');

/** Delegates to {@link runMap}; void results are discarded. */
export async function runForEach<T>(
  env: TableIterationEnv<T>,
  callback: (ctx: RowIterationContext<T>) => void | Promise<void>,
  options: RowIterationOptions = {}
): Promise<void> {
  await runMap(env, callback, options, 'forEach');
}

/**
 * Row iteration for map (and forEach/filter via label).
 * Concurrency: `parallel` | `synchronized` | `sequential` (see RowIterationOptions).
 */
export async function runMap<T, R>(
  env: TableIterationEnv<T>,
  callback: (ctx: RowIterationContext<T>) => R | Promise<R>,
  options: RowIterationOptions = {},
  label: string = 'map'
): Promise<R[]> {
  const map = env.getMap();
  const effectiveMaxPages = options.maxPages ?? env.config.maxPages;
  const dedupeStrategy = options.dedupe ?? env.config.strategies.dedupe;
  const dedupeKeys = dedupeStrategy ? new Set<string | number>() : null;
  const defaultMode = label === 'map' ? 'parallel' : 'sequential';
  const concurrency = options.concurrency || 
                     (options.parallel === true ? 'parallel' : 
                      options.parallel === false ? 'sequential' : 
                      env.config.concurrency || defaultMode);
  const useBarrier = concurrency !== 'sequential';
  // Mutex must not pair with the navigation barrier: synchronized mode needs every row
  // to enter barrier.sync concurrently; serializing callbacks here deadlocks (first row waits
  // for batchSize peers that never reach the barrier).
  const useMutex = concurrency === 'sequential';
  const useBulk = options.useBulkPagination ?? false;
  const tracker = new ElementTracker(label);

  log(env.config, `${label}: starting (maxPages=${effectiveMaxPages}, mode=${concurrency}, dedupe=${!!dedupeStrategy})`);

  const results: R[] = [];

  try {
    let rowIndex = 0;
    let stopped = false;
    let stoppedIndex = Infinity;
    let pagesScanned = 1;

    const stop = (idx: number) => {
      if (!stopped) {
        log(env.config, `${label}: stop() called at row ${idx} — halting`);
        stopped = true;
        stoppedIndex = idx;
      }
    };

    while (!stopped) {
      const rowLocators = env.getRowLocators();
      const newIndices = await tracker.getUnseenIndices(rowLocators);
      const pageRows = await rowLocators.all();
      
      const batchSize = newIndices.length;
      if (batchSize === 0) {
        log(env.config, `${label}: page ${pagesScanned} — no new row(s) found`);
      } else {
        log(env.config, `${label}: scanning page ${pagesScanned} — ${batchSize} new row(s)`);
        
        const barrier = useBarrier ? new NavigationBarrier(batchSize) : undefined;
        const actionMutex = useMutex ? new Mutex() : null;
        
        const smartRows = newIndices.map((idx, i) => 
          env.makeSmartRow(pageRows[idx], map, rowIndex + i, pagesScanned - 1, barrier)
        );

        const processRow = async (row: SmartRow<T>) => {
          try {
            if (stopped && row.rowIndex! > stoppedIndex) {
              return SKIP;
            }

            if (dedupeKeys && dedupeStrategy) {
              const key = await dedupeStrategy(row);
              if (dedupeKeys.has(key)) {
                log(env.config, `${label}: dedupe skip key="${key}"`);
                return SKIP;
              }
              dedupeKeys.add(key);
            }

            // Execute callback (optionally serialized via mutex)
            const runCallback = async () => {
              if (stopped && row.rowIndex! > stoppedIndex) return SKIP;
              log(env.config, `${label}: processing row ${row.rowIndex}`);
              return await callback({ row, rowIndex: row.rowIndex!, stop: () => stop(row.rowIndex!) });
            };

            if (actionMutex) {
              return await actionMutex.run(runCallback);
            } else {
              return await runCallback();
            }
          } finally {
            // Ensure the barrier is notified once per row, even on error or skip.
            barrier?.markFinished();
          }
        };

        const pageResults: (R | typeof SKIP)[] = [];
        if (concurrency === 'sequential') {
          for (const row of smartRows) {
            pageResults.push(await processRow(row));
          }
        } else {
          const results = await Promise.all(smartRows.map(processRow));
          pageResults.push(...results);
        }

        for (let i = 0; i < pageResults.length; i++) {
          if (smartRows[i].rowIndex! > stoppedIndex) break;
          const r = pageResults[i];
          if (r !== SKIP) results.push(r as R);
        }
        
        rowIndex += batchSize;
      }

      if (stopped || pagesScanned >= effectiveMaxPages) break;

      log(env.config, `${label}: advancing to next page (${pagesScanned} → ${pagesScanned + 1})`);
      if (!await env.advancePage(useBulk)) {
        log(env.config, `${label}: no more pages — done`);
        break;
      }
      pagesScanned++;
    }
    log(env.config, `${label}: complete — ${results.length} result(s) across ${pagesScanned} page(s)`);
  } finally {
    await tracker.cleanup(env.getPage());
  }

  return results;
}

/** Filter via map; returns matched rows as {@link SmartRowArray}. */
export async function runFilter<T>(
  env: TableIterationEnv<T>,
  predicate: (ctx: RowIterationContext<T>) => boolean | Promise<boolean>,
  options: RowIterationOptions = {}
): Promise<SmartRowArray<T>> {
  const mapCallback = async (ctx: RowIterationContext<T>) => {
    const matched = await predicate(ctx);
    return matched ? ctx.row : SKIP;
  };
  const results = await runMap(env, mapCallback, options, 'filter');
  return env.createSmartRowArray(results as SmartRow<T>[]);
}
