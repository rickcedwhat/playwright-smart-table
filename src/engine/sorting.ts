import type { Page } from '@playwright/test';
import type { FinalTableConfig, SortingStrategy, StrategyContext } from '../types';
import { debugDelay, logDebug } from '../utils/debugUtils';
import { waitWhileTableLoading } from '../utils/loadingWait';

export interface SortingEnv<T = any> {
  config: FinalTableConfig<T>;
  getPage: () => Page;
  /** Strategy context including `getHeaderCell`. */
  getContext: () => StrategyContext;
}

const MAX_SORT_ATTEMPTS = 3;

function requireSorting(config: FinalTableConfig): SortingStrategy {
  if (!config.strategies.sorting) throw new Error('No sorting strategy has been configured.');
  return config.strategies.sorting;
}

/** Waits for the table to settle after `doSort`: `isTableLoading` when configured, otherwise a fixed delay. */
async function waitForSortToSettle<T>(env: SortingEnv<T>, context: StrategyContext): Promise<void> {
  const loading = env.config.strategies.loading;
  if (loading?.isTableLoading) {
    const timeout = loading.sortStabilizationTimeout ?? loading.loadingTimeout ?? 10_000;
    const pollInterval = loading.sortStabilizationPollInterval ?? 100;
    await waitWhileTableLoading(env.config, context, env.getPage(), 'sorting.apply', { timeout, pollInterval });
  } else {
    await env.getPage().waitForTimeout(loading?.sortStabilizationFallbackDelay ?? 200);
  }
}

/** Drives the sorting strategy until `columnName` reports `direction`, retrying up to 3 times. */
export async function applySort<T>(env: SortingEnv<T>, columnName: string, direction: 'asc' | 'desc'): Promise<void> {
  const sorting = requireSorting(env.config);
  logDebug(env.config, 'verbose', `Applying sort for column "${columnName}" (${direction})`);
  const context = env.getContext();

  for (let i = 0; i < MAX_SORT_ATTEMPTS; i++) {
    const currentState = await sorting.getSortState({ columnName, context });
    if (currentState === direction) {
      logDebug(env.config, 'verbose', `Sort for "${columnName}" is already "${direction}".`);
      return;
    }
    await sorting.doSort({ columnName, direction, context });
    await waitForSortToSettle(env, context);
    await debugDelay(env.config, 'default');

    const newState = await sorting.getSortState({ columnName, context });
    if (newState === direction) {
      logDebug(env.config, 'verbose', `Successfully sorted "${columnName}" to "${direction}".`);
      return;
    }
  }
  throw new Error(`Failed to sort column "${columnName}" to "${direction}" after ${MAX_SORT_ATTEMPTS} attempts.`);
}

export async function getSortState<T>(env: SortingEnv<T>, columnName: string): Promise<'asc' | 'desc' | 'none'> {
  const sorting = requireSorting(env.config);
  return sorting.getSortState({ columnName, context: env.getContext() });
}
