import type { FinalTableConfig } from '../types';
import { logDebug } from '../utils/debugUtils';

/**
 * Page-walk primitive (#427).
 *
 * Owns the shared pagination shell used by map/forEach/filter, findRow(s),
 * countRows, and the public async iterator:
 * - `maxPages` budget
 * - `advancePage(useBulk)` with bulk page-jump accounting
 * - EOF final scan (one more `onPage` after `advancePage` returns false)
 * - optional `waitForReady` before each page
 *
 * Per-page collection (overscan, dedupe, loading, filters) stays in the caller
 * so find vs map can keep their different row policies.
 *
 * ## Feature matrix (public APIs → this shell)
 *
 * | API | final-scan | bulk opt-in | waitForReady | overscan/dedupe/loading |
 * |-----|------------|-------------|--------------|-------------------------|
 * | map / forEach / filter | yes | options.useBulkPagination | via caller | in runMap |
 * | findRows | yes | options.useBulkPagination | yes | findRows policy (skip loading) |
 * | findRow | yes | options.useBulkPagination | yes | DOM/post filters only |
 * | countRows | yes | no (single-step) | yes | count-only / post filters |
 * | async iterator | yes | no | via runMap path | same as map |
 * | findRowByIndex | no* | no | n/a | scroll/search, not a full scan |
 * | bringIntoView | n/a | path planner | n/a | not a page scan |
 *
 * \* findRowByIndex stops when the target index is mounted; it does not collect rows.
 */

export type ScanDecision = 'continue' | 'stop';

export interface ScanPageContext {
    /** 1-based count of pages visited so far (includes the current page). */
    pagesScanned: number;
    /** `tableState.currentPageIndex` at the start of this page callback. */
    pageIndex: number;
    /** True when this is the post-EOF extra pass after `advancePage` returned false. */
    isFinalScan: boolean;
}

export interface ScanPagesEnv {
    advancePage: (useBulk: boolean) => Promise<boolean>;
    getCurrentPageIndex: () => number;
    config: FinalTableConfig;
    /** Optional gate before each page (e.g. `isTableLoading` poll). */
    waitForReady?: () => Promise<void>;
}

export interface ScanPagesOptions {
    maxPages: number;
    /** Prefer goNextBulk when the advance helper supports it. @default false */
    useBulk?: boolean;
    label?: string;
    /**
     * When `advancePage` returns false, invoke `onPage` once more before stopping.
     * Matches runMap / findRows EOF behavior. @default true
     */
    finalScanOnEof?: boolean;
}

export async function scanPages(
    env: ScanPagesEnv,
    onPage: (ctx: ScanPageContext) => Promise<ScanDecision>,
    options: ScanPagesOptions
): Promise<{ pagesScanned: number }> {
    const maxPages = options.maxPages;
    const useBulk = options.useBulk ?? false;
    const finalScanOnEof = options.finalScanOnEof !== false;
    const label = options.label ?? 'scanPages';

    let pagesScanned = 1;
    let reachedEnd = false;

    logDebug(env.config, 'verbose', `${label}: starting (maxPages=${maxPages}, useBulk=${useBulk}, finalScanOnEof=${finalScanOnEof})`);

    while (true) {
        if (env.waitForReady) {
            await env.waitForReady();
        }

        const decision = await onPage({
            pagesScanned,
            pageIndex: env.getCurrentPageIndex(),
            isFinalScan: reachedEnd,
        });

        if (decision === 'stop') {
            logDebug(env.config, 'verbose', `${label}: onPage returned stop at page ${env.getCurrentPageIndex()}`);
            break;
        }

        if (pagesScanned >= maxPages || reachedEnd) {
            break;
        }

        const prevPage = env.getCurrentPageIndex();
        const didAdvance = await env.advancePage(useBulk);
        if (!didAdvance) {
            if (finalScanOnEof) {
                logDebug(env.config, 'verbose', `${label}: pagination returned false — final scan`);
                reachedEnd = true;
                continue;
            }
            break;
        }

        const pagesJumped = env.getCurrentPageIndex() - prevPage;
        pagesScanned += pagesJumped > 0 ? pagesJumped : 1;
        logDebug(env.config, 'verbose', `${label}: advanced ${pagesJumped > 0 ? pagesJumped : 1} page(s), now at page ${env.getCurrentPageIndex()} (scanned=${pagesScanned})`);
    }

    logDebug(env.config, 'verbose', `${label}: done — ${pagesScanned} page(s) scanned`);
    return { pagesScanned };
}
