import type { Page } from '@playwright/test';
import type { FinalTableConfig, TableContext } from '../types';
import { logDebug } from './debugUtils';

/**
 * Poll `loading.isTableLoading` until false or timeout.
 * Shared by countRows, findRow(s), and sort stabilization (#434).
 *
 * Timeout resolution (first defined wins):
 * 1. `loadingTimeout` — general gate for any isTableLoading poll
 * 2. `sortStabilizationTimeout` — sort-specific override (legacy)
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
    loading.sortStabilizationTimeout ??
    10_000;
  const poll =
    options?.pollInterval ??
    loading.sortStabilizationPollInterval ??
    200;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline && (await isTableLoading(context))) {
    logDebug(config, 'verbose', `${label}: table is loading... waiting`);
    await page.waitForTimeout(poll);
  }
}
