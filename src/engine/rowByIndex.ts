import type { Locator } from '@playwright/test';
import type { FinalTableConfig, SmartRow, TableContext } from '../types';
import { normalizeRowIndexResult } from './rowResolution';
import { scanPages } from './scanPages';
import { debugDelay, logDebug } from '../utils/debugUtils';
import { safeStringify } from '../utils/safeStringify';

export interface RowByIndexEnv<T = any> {
  config: FinalTableConfig<T>;
  getRowLocators: () => Locator;
  getMap: () => Map<string, number>;
  advancePage: (useBulk: boolean) => Promise<boolean>;
  getCurrentPageIndex: () => number;
  getContext: () => TableContext;
  makeSmartRow: (rowLocator: Locator, map: Map<string, number>, rowIndex: number, tablePageIndex: number, healSelector?: string) => SmartRow<T>;
}

/**
 * Finds the row whose logical index (per `strategies.resolveRowIndex`) is `index`:
 * already mounted, else via `viewport.scrollToRow`, else by advancing pages until it
 * mounts (bounded by `maxPages`). Callers must have initialized the table.
 */
export async function findRowByIndex<T>(
  env: RowByIndexEnv<T>,
  index: number,
  options?: { maxPages?: number, signal?: AbortSignal }
): Promise<SmartRow<T>> {
  options?.signal?.throwIfAborted();
  const { config } = env;
  logDebug(config, 'verbose', `findRowByIndex: index=${index} options=${safeStringify(options)}`);
  const resolveRI = config.strategies.resolveRowIndex;
  const viewport = config.strategies.viewport;

  // Identifying a row by its logical index requires a resolveRowIndex strategy. Without one
  // the library can only offer render-window-relative getRowByIndex, or filter-based findRow.
  if (!resolveRI) {
    throw new Error(
      `findRowByIndex(${index}) requires a strategies.resolveRowIndex to identify rows by their logical index. ` +
      `Configure one (e.g. read the grid's row-index attribute), or use getRowByIndex() (current render window) / findRow(filters).`
    );
  }

  let foundSelector: string | undefined;

  // The currently-mounted row whose logical index === index, if any.
  const findMounted = async (): Promise<Locator | null> => {
    const rows = await env.getRowLocators().all();
    options?.signal?.throwIfAborted();
    for (const r of rows) {
      const result = await resolveRI(r);
      options?.signal?.throwIfAborted();
      if (result === undefined) continue;
      const normalized = normalizeRowIndexResult(result);
      if (normalized.index === index) {
        foundSelector = normalized.selector;
        return r;
      }
    }
    return null;
  };

  // 1. Already mounted (no navigation needed)?
  let loc = await findMounted();
  options?.signal?.throwIfAborted();

  // 2. Fast path: jump straight to it via the viewport's random-access scroll.
  if (!loc && viewport?.scrollToRow) {
    logDebug(config, 'verbose', `findRowByIndex: scrolling to row ${index}`);
    await viewport.scrollToRow(env.getContext(), index);
    options?.signal?.throwIfAborted();
    loc = await findMounted();
    options?.signal?.throwIfAborted();
  }

  // 3. Fallback: advance pages (on infinite-scroll tables, a "page" is a scroll step) until
  //    the row is mounted. Page 1 was already searched above.
  const maxPages = options?.maxPages ?? config.maxPages;
  const scanForMounted = async (): Promise<Locator | null> => {
    let hit: Locator | null = null;
    await scanPages(
      { advancePage: env.advancePage, getCurrentPageIndex: env.getCurrentPageIndex, config },
      async ({ pagesScanned }) => {
        if (pagesScanned > 1) hit = await findMounted();
        return hit ? 'stop' : 'continue';
      },
      { maxPages, useBulk: false, label: 'findRowByIndex', finalScanOnEof: false, signal: options?.signal }
    );
    return hit;
  };
  if (!loc && config.strategies.pagination) {
    loc = await scanForMounted();
  }

  if (!loc) {
    throw new Error(
      `findRowByIndex(${index}): could not reach row ${index}. ` +
      `Ensure a viewport.scrollToRow or pagination can bring it into view (searched up to maxPages=${maxPages}).`
    );
  }

  await debugDelay(config, 'findRow');
  options?.signal?.throwIfAborted();
  return env.makeSmartRow(loc, env.getMap(), index, env.getCurrentPageIndex(), foundSelector);
}
