/**
 * Internal setter for `table.currentPageIndex` used by library navigation
 * (bringIntoView path planner, etc.) so the public setter can warn on
 * external writes without spamming on every library update (#434).
 */
export const SET_CURRENT_PAGE_INDEX = Symbol.for(
  'playwright-smart-table.setCurrentPageIndex'
);

export type PageIndexWritable = {
  currentPageIndex: number;
  [SET_CURRENT_PAGE_INDEX]?: (n: number) => void;
};

/** Prefer the internal setter when present; fall back to the public property. */
export function setCurrentPageIndex(table: PageIndexWritable, n: number): void {
  const internal = table[SET_CURRENT_PAGE_INDEX];
  if (typeof internal === 'function') {
    internal(n);
    return;
  }
  table.currentPageIndex = n;
}
