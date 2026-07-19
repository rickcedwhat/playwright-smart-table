import type { Locator, Page } from '@playwright/test';
import type { SmartRow, RowIterationContext, RowIterationOptions, TableContext } from '../types';
import type { FinalTableConfig } from '../types';
import type { SmartRowArray } from '../utils/smartRowArray';
import { ElementTracker } from '../utils/elementTracker';
import { logDebug } from '../utils/debugUtils';
import { NavigationBarrier } from '../utils/navigationBarrier';
import { Mutex } from '../utils/mutex';
import { resolveLogicalRowIndex, resolveRowLoading } from './rowResolution';

export interface TableIterationEnv<T = any> {
  getRowLocators: () => Locator;
  getMap: () => Map<string, number>;
  advancePage: (useBulk: boolean) => Promise<boolean>;
  makeSmartRow: (rowLocator: Locator, map: Map<string, number>, rowIndex: number, tablePageIndex?: number, barrier?: NavigationBarrier) => SmartRow<T>;
  createSmartRowArray: (rows: SmartRow<T>[]) => SmartRowArray<T>;
  config: FinalTableConfig<T>;
  getPage: () => Page;
  getCurrentPageIndex: () => number;
  /** Builds a TableContext for strategy calls (e.g. the viewport visible-row oracle). */
  getContext: () => TableContext;
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
  const concurrency =
    options.concurrency ?? env.config.concurrency ?? defaultMode;
  const useBarrier = concurrency === 'synchronized';
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
      const allIndices = await tracker.peekUnseenIndices(rowLocators);
      const pageRows = await rowLocators.all();

      // A2 (#353 part 2 / #357): when the viewport can report which rows are within the visible
      // bounds, drop overscan rows from collection. They are left uncommitted (still unseen), so
      // they're picked up on a later page once scrolled into view — preventing overscan from
      // being ingested (#353) or double-collected via node recycling (#357). No-op when no
      // viewport reports visible rows.
      let candidateIndices = allIndices;
      const getVisibleRowIndices = env.config.strategies.viewport?.getVisibleRowIndices;
      if (getVisibleRowIndices) {
        const visible = new Set(await getVisibleRowIndices(env.getContext()));
        candidateIndices = allIndices.filter(idx => visible.has(idx));
        if (candidateIndices.length !== allIndices.length) {
          log(env.config, `${label}: viewport visible filter — ${candidateIndices.length}/${allIndices.length} row(s) in view`);
        }
      }

      // In synchronized mode, overscan rows rendered beyond the visible viewport by virtual
      // scrollers can be evicted when the horizontal barrier fires snapFirstColumnIntoView.
      // Filter them out before committing so they stay unseen and are picked up on the next page.
      const newIndices = concurrency === 'synchronized'
        ? (await Promise.all(
            candidateIndices.map(async idx => ({ idx, present: pageRows[idx] != null && (await pageRows[idx].count()) > 0 }))
          )).filter(r => r.present).map(r => r.idx)
        : candidateIndices;

      await tracker.commitIndices(rowLocators, newIndices);

      const batchSize = newIndices.length;
      if (batchSize === 0) {
        log(env.config, `${label}: page ${pagesScanned} — no new row(s) found`);
      } else {
        log(env.config, `${label}: scanning page ${pagesScanned} — ${batchSize} new row(s)`);
        
        const barrier = useBarrier ? new NavigationBarrier(batchSize) : undefined;
        const actionMutex = useMutex ? new Mutex() : null;
        
        // `index` (ctx.index) is the enumeration counter — the order rows are visited,
        // contiguous and monotonic. It drives the internal stop()/ordering logic.
        const positionBase = rowIndex;
        // B-hybrid (#362): the row's rowIndex is its logical/data-model index when a
        // resolveRowIndex strategy is configured (so bringIntoView and position math are
        // correct on virtualized tables); otherwise it equals the enumeration counter.
        const smartRows = await Promise.all(newIndices.map(async (idx, i) => {
          const logicalIndex = await resolveLogicalRowIndex(pageRows[idx], env.config, () => positionBase + i) ?? (positionBase + i);
          const sr = env.makeSmartRow(pageRows[idx], map, logicalIndex, env.getCurrentPageIndex(), barrier);
          // Mark as part of an iteration batch so toJSON's #366 re-pin uses rescan-only recovery
          // (no scroll-back) — scrolling here would disrupt sibling rows' positional locators.
          (sr as any)._inBatch = true;
          return sr;
        }));

        // enumIndex = visit-order counter (ctx.index); row.rowIndex = logical (ctx.rowIndex).
        const processRow = async (row: SmartRow<T>, enumIndex: number) => {
          try {
            if (stopped && enumIndex > stoppedIndex) {
              return SKIP;
            }

            // Wait for the row to finish loading BEFORE evaluating its dedupe key (Bug #355).
            // map/forEach/filter process a still-loading row when no timeout is set (unlike
            // findRows, which skips) — see resolveRowLoading's `noTimeoutAction`.
            const loadingOutcome = await resolveRowLoading(
              row,
              env.config.strategies.loading,
              'process',
              (msg) => log(env.config, `${label}: ${msg}`),
            );
            if (loadingOutcome === 'skip') return SKIP;
            if (loadingOutcome === 'throw') {
              throw new Error(`[SmartTable] Row ${row.rowIndex} did not finish loading within ${env.config.strategies.loading?.rowLoadingTimeout}ms`);
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
              if (stopped && enumIndex > stoppedIndex) return SKIP;
              log(env.config, `${label}: processing row (index ${enumIndex}, rowIndex ${row.rowIndex})`);
              return await callback({ row, index: enumIndex, rowIndex: row.rowIndex!, pageIndex: env.getCurrentPageIndex(), stop: () => stop(enumIndex) });
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
          for (let i = 0; i < smartRows.length; i++) {
            pageResults.push(await processRow(smartRows[i], positionBase + i));
          }
        } else {
          const results = await Promise.all(smartRows.map((row, i) => processRow(row, positionBase + i)));
          pageResults.push(...results);
        }

        for (let i = 0; i < pageResults.length; i++) {
          if (positionBase + i > stoppedIndex) break;
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
