import type { Page } from '@playwright/test';
import type { FinalTableConfig, TableContext } from '../types';
import { logDebug } from './debugUtils';

/**
 * Poll `loading.isTableLoading` until false or timeout.
 * Shared by countRows, findRow(s), and sort stabilization (#434).
 *
 * Timeout resolution (first defined wins):
 * 1. Explicit `options.timeout` — e.g. the sort caller's stabilization timeout
 * 2. `loadingTimeout` — general gate for any isTableLoading poll
 * 3. 10_000 ms default
 */
export async function waitWhileTableLoading(
  config: FinalTableConfig,
  context: TableContext,
  page: Page,
  label: string,
  options?: { timeout?: number; pollInterval?: number }
): Promise<void> {
  const isTableLoading = config.strategies.loading?.isTableLoading;
  if (!isTableLoading) return;

  const loading = config.strategies.loading!;
  const timeout =
    options?.timeout ??
    loading.loadingTimeout ??
    10_000;
  const poll =
    options?.pollInterval ??
    loading.sortStabilizationPollInterval ??
    200;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // A custom predicate may never settle. Stop waiting when the budget expires;
      // Promise.race also handles any later rejection from that predicate.
      const expired = new Promise<false>(resolve => {
        timer = setTimeout(() => resolve(false), Math.max(0, deadline - Date.now()));
      });
      if (!(await Promise.race([isTableLoading(context), expired]))) return;
    } finally {
      clearTimeout(timer);
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) return;
    logDebug(config, 'verbose', `${label}: table is loading... waiting`);
    await page.waitForTimeout(Math.min(poll, remaining));
  }
}
