import type { TableSelector } from '../types';

type SelectorKey = 'headerSelector' | 'rowSelector' | 'cellSelector';

/** Viewport range meaning "can't measure": callers treat everything as possibly visible and verify in the DOM. */
export const UNKNOWN_RANGE = { first: 0, last: Number.POSITIVE_INFINITY };

const warned = new WeakMap<object, Set<string>>();

/**
 * Returns the configured selector when it is a CSS string. Features that run
 * `querySelectorAll` in the browser can't use a function selector; for those this warns
 * once per config + feature and returns `null` so the caller can skip that step.
 */
export function cssSelectorOrWarn(
  config: Partial<Record<SelectorKey, TableSelector>>,
  key: SelectorKey,
  feature: string,
): string | null {
  const selector = config[key];
  if (typeof selector === 'string') return selector;
  if (selector === undefined) return null;

  let seen = warned.get(config);
  if (!seen) warned.set(config, (seen = new Set()));
  const id = `${key}:${feature}`;
  if (!seen.has(id)) {
    seen.add(id);
    console.warn(
      `[SmartTable] ${feature} needs ${key} to be a CSS string, but a function was configured — skipping it. Use a string ${key} to enable ${feature}.`
    );
  }
  return null;
}
