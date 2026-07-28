import type { Locator } from '@playwright/test';
import type { FinalTableConfig, LoadingStrategy, RowIndexResult, SmartRow } from '../types';

/** Normalized result from resolveRowIndex — always has `.index`, optionally `.selector`. */
export interface ResolvedRowIndex {
  index: number;
  selector?: string;
}

/** Extract the numeric index from a {@link RowIndexResult}. */
export function normalizeRowIndexResult(result: RowIndexResult): ResolvedRowIndex {
  return typeof result === 'number' ? { index: result } : result;
}

/**
 * Single source of truth for "what is this row's logical index?" (#362 consolidation).
 *
 * Uses the configured `resolveRowIndex` strategy when present (e.g. MUI's `data-rowindex`);
 * otherwise, and when the strategy returns `undefined`, defers to the caller-provided
 * `fallback` — a running counter for iteration/`findRows`, or a DOM-position scan for `findRow`.
 *
 * Returns a {@link ResolvedRowIndex} with the numeric index and, when the strategy provides
 * one, a CSS selector for building a self-healing row locator.
 */
export async function resolveLogicalRowIndex(
  row: Locator,
  config: Pick<FinalTableConfig, 'strategies'>,
  fallback: () => number | undefined | Promise<number | undefined>,
): Promise<ResolvedRowIndex | undefined> {
  const strategy = config.strategies.resolveRowIndex;
  if (strategy) {
    const resolved = await strategy(row);
    if (resolved !== undefined) return normalizeRowIndexResult(resolved);
  }
  const fb = await fallback();
  return fb !== undefined ? { index: fb } : undefined;
}

/** What the caller should do with a row after checking its loading state. */
export type RowLoadingOutcome = 'process' | 'skip' | 'throw';

/**
 * Single source of truth for the per-row loading wait (#362 consolidation).
 *
 * Collapses the two near-identical blocks in `findRows` (RowFinder) and `runMap`
 * (tableIteration). The only real difference between the callers is the behavior when no
 * `rowLoadingTimeout` is configured: `findRows` skips a still-loading row (`noTimeoutAction:
 * 'skip'`), while `map`/`forEach`/`filter` process it as-is (`'process'`) — and map, in that
 * case, never even probes `isRowLoading`. Both are preserved exactly.
 *
 * The helper never throws and never touches the navigation barrier; it returns a decision so
 * each caller keeps its own barrier bookkeeping and error message.
 */
export async function resolveRowLoading(
  row: SmartRow,
  loading: LoadingStrategy | undefined,
  noTimeoutAction: 'skip' | 'process',
  log?: (msg: string) => void,
): Promise<RowLoadingOutcome> {
  const isRowLoading = loading?.isRowLoading;
  if (!isRowLoading) return 'process';

  const rawTimeout = loading?.rowLoadingTimeout;
  // undefined = unset (legacy skip / process-as-is); 0 = one immediate re-check; >0 = poll up to N ms.
  // Non-finite values are treated as unset (defensive guard against Infinity/NaN).
  const timeout = rawTimeout !== undefined && Number.isFinite(rawTimeout) && rawTimeout >= 0
    ? rawTimeout
    : undefined;

  // map's fast path: with no timeout and a process-default, it never probes isRowLoading.
  if (timeout === undefined && noTimeoutAction === 'process') return 'process';

  if (!(await isRowLoading(row))) return 'process';

  // Row is loading with no timeout configured → legacy skip (findRows).
  if (timeout === undefined) return 'skip';

  log?.(`row ${row.rowIndex} — waiting up to ${timeout}ms for row to load`);
  const deadline = Date.now() + timeout;
  let resolved = !(await isRowLoading(row)); // immediate check (handles timeout=0)
  while (!resolved && Date.now() < deadline) {
    // Page accessed lazily (only while actually polling), matching the pre-refactor code.
    await row.page().waitForTimeout(100);
    resolved = !(await isRowLoading(row));
  }
  if (resolved) return 'process';

  const onTimeout = loading?.onRowLoadingTimeout ?? 'read-as-is';
  log?.(`row ${row.rowIndex} — still loading after ${timeout}ms, action: ${onTimeout}`);
  if (onTimeout === 'skip') return 'skip';
  if (onTimeout === 'throw') return 'throw';
  return 'process'; // 'read-as-is'
}
