import type { PaginationPrimitives, TableContext } from '../types';
/** A single step in a navigation plan (e.g. "goNextBulk 3 times"). */
export type NavigationStep = {
    type: 'goToPage';
    pageIndex: number;
} | {
    type: 'goNextBulk';
    count: number;
} | {
    type: 'goNext';
    count: number;
} | {
    type: 'goPreviousBulk';
    count: number;
} | {
    type: 'goPrevious';
    count: number;
};
/**
 * Plans an optimal path from currentPageIndex to targetPageIndex using available primitives.
 * Prefers goToPage when present; otherwise uses bulk steps (goNextBulk / goPreviousBulk) then
 * single steps (goNext / goPrevious). May choose to overshoot with bulk then step back when
 * that reduces total primitive calls (e.g. page 3 → 12 with bulk 10: goNextBulk once, goPrevious once).
 */
export declare function planNavigationPath(currentPageIndex: number, targetPageIndex: number, primitives: PaginationPrimitives): NavigationStep[];
/**
 * Navigate to targetPageIndex when goToPage is available but may be "windowed"
 * (e.g. only works for visible page links 6–14). Tries goToPage(target); on false,
 * steps once toward target (goNextBulk/goNext or goPreviousBulk/goPrevious), then retries.
 * Example: from 3 to 38 with windowed goToPage → goToPage(38) false, goNextBulk(), goToPage(38) false, … goToPage(38) true.
 */
export declare function executeNavigationWithGoToPageRetry(targetPageIndex: number, primitives: PaginationPrimitives, context: TableContext, getCurrentPage: () => number, setCurrentPage: (n: number) => void): Promise<void>;
/**
 * Executes a navigation path by calling the corresponding primitives.
 * Updates currentPageIndex via the provided setter as steps run.
 */
export declare function executeNavigationPath(path: NavigationStep[], primitives: PaginationPrimitives, context: TableContext, getCurrentPage: () => number, setCurrentPage: (n: number) => void): Promise<void>;
