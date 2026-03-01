import type { PaginationPrimitives, TableContext } from '../types';

/** A single step in a navigation plan (e.g. "goNextBulk 3 times"). */
export type NavigationStep =
  | { type: 'goToPage'; pageIndex: number }
  | { type: 'goNextBulk'; count: number }
  | { type: 'goNext'; count: number }
  | { type: 'goPreviousBulk'; count: number }
  | { type: 'goPrevious'; count: number };

/**
 * Plans an optimal path from currentPageIndex to targetPageIndex using available primitives.
 * Prefers goToPage when present; otherwise uses bulk steps (goNextBulk / goPreviousBulk) then
 * single steps (goNext / goPrevious). May choose to overshoot with bulk then step back when
 * that reduces total primitive calls (e.g. page 3 → 12 with bulk 10: goNextBulk once, goPrevious once).
 */
export function planNavigationPath(
  currentPageIndex: number,
  targetPageIndex: number,
  primitives: PaginationPrimitives
): NavigationStep[] {
  if (currentPageIndex === targetPageIndex) return [];

  if (primitives.goToPage) {
    return [{ type: 'goToPage', pageIndex: targetPageIndex }];
  }

  const nextBulkSize = primitives.nextBulkPages ?? 1;
  const prevBulkSize = primitives.previousBulkPages ?? 1;

  if (targetPageIndex > currentPageIndex) {
    // Forward: current → target
    const stepsForward = targetPageIndex - currentPageIndex;
    const hasBulk = !!(primitives.goNextBulk && nextBulkSize > 0);
    const hasPrev = !!primitives.goPrevious;

    if (!hasBulk || nextBulkSize <= 0) {
      if (primitives.goNext) {
        return [{ type: 'goNext', count: stepsForward }];
      }
      return [];
    }

    const bulkCountA = Math.floor(stepsForward / nextBulkSize);
    const remA = stepsForward % nextBulkSize;
    const totalA = bulkCountA + remA;

    let totalB = Infinity;
    let bulkCountB = 0;
    let overB = 0;
    if (hasPrev && primitives.goPreviousBulk && prevBulkSize > 0) {
      bulkCountB = Math.ceil(stepsForward / nextBulkSize);
      overB = bulkCountB * nextBulkSize - stepsForward;
      totalB = bulkCountB + overB;
    }

    if (totalB < totalA) {
      const path: NavigationStep[] = [];
      if (bulkCountB > 0) path.push({ type: 'goNextBulk', count: bulkCountB });
      if (overB > 0) path.push({ type: 'goPrevious', count: overB });
      return path;
    }

    const path: NavigationStep[] = [];
    if (bulkCountA > 0) path.push({ type: 'goNextBulk', count: bulkCountA });
    if (remA > 0) path.push({ type: 'goNext', count: remA });
    return path;
  }

  // Backward: current → target
  const stepsBack = currentPageIndex - targetPageIndex;
  const hasPrevBulk = !!(primitives.goPreviousBulk && prevBulkSize > 0);
  const hasNext = !!primitives.goNext;

  if (!hasPrevBulk || prevBulkSize <= 0) {
    if (primitives.goPrevious) {
      return [{ type: 'goPrevious', count: stepsBack }];
    }
    // goToFirst + goNext loop is handled by caller (bringIntoView) when path is empty
    return [];
  }

  const bulkCountA = Math.floor(stepsBack / prevBulkSize);
  const remA = stepsBack % prevBulkSize;
  const totalA = bulkCountA + remA;

  let totalB = Infinity;
  let bulkCountB = 0;
  let overB = 0;
  if (hasNext) {
    bulkCountB = Math.ceil(stepsBack / prevBulkSize);
    overB = bulkCountB * prevBulkSize - stepsBack;
    totalB = bulkCountB + overB;
  }

  if (totalB < totalA) {
    const path: NavigationStep[] = [];
    if (bulkCountB > 0) path.push({ type: 'goPreviousBulk', count: bulkCountB });
    if (overB > 0) path.push({ type: 'goNext', count: overB });
    return path;
  }

  const path: NavigationStep[] = [];
  if (bulkCountA > 0) path.push({ type: 'goPreviousBulk', count: bulkCountA });
  if (remA > 0) path.push({ type: 'goPrevious', count: remA });
  return path;
}

const MAX_GO_TO_PAGE_RETRIES = 200;

/**
 * Navigate to targetPageIndex when goToPage is available but may be "windowed"
 * (e.g. only works for visible page links 6–14). Tries goToPage(target); on false,
 * steps once toward target (goNextBulk/goNext or goPreviousBulk/goPrevious), then retries.
 * Example: from 3 to 38 with windowed goToPage → goToPage(38) false, goNextBulk(), goToPage(38) false, … goToPage(38) true.
 */
export async function executeNavigationWithGoToPageRetry(
  targetPageIndex: number,
  primitives: PaginationPrimitives,
  context: TableContext,
  getCurrentPage: () => number,
  setCurrentPage: (n: number) => void
): Promise<void> {
  if (!primitives.goToPage) return;

  for (let i = 0; i < MAX_GO_TO_PAGE_RETRIES; i++) {
    const current = getCurrentPage();
    if (current === targetPageIndex) return;

    const ok = await primitives.goToPage(targetPageIndex, context);
    if (ok) {
      setCurrentPage(targetPageIndex);
      return;
    }

    // Step once toward target. Don't use bulk if it would overshoot and we can't step back (no goPrevious/goNext).
    if (targetPageIndex > current) {
      const nextBulkSize = primitives.nextBulkPages ?? 1;
      const wouldOvershoot = (current + nextBulkSize) > targetPageIndex;
      const canStepBack = !!primitives.goPrevious;
      const useBulk = primitives.goNextBulk && (!wouldOvershoot || canStepBack);

      if (useBulk && primitives.goNextBulk) {
        const result = await primitives.goNextBulk(context);
        if (!result) throw new Error('bringIntoView: goNextBulk failed during goToPage retry');
        const jumped = typeof result === 'number' ? result : nextBulkSize;
        setCurrentPage(getCurrentPage() + jumped);
      } else if (primitives.goNext) {
        const stepped = await primitives.goNext(context);
        if (!stepped) throw new Error('bringIntoView: goNext failed during goToPage retry');
        setCurrentPage(getCurrentPage() + 1);
      } else {
        throw new Error(`bringIntoView: goToPage(${targetPageIndex}) returned false and no goNext/goNextBulk to advance`);
      }
    } else {
      const prevBulkSize = primitives.previousBulkPages ?? 1;
      const wouldOvershoot = (current - prevBulkSize) < targetPageIndex;
      const canStepBack = !!primitives.goNext;
      const useBulk = primitives.goPreviousBulk && (!wouldOvershoot || canStepBack);

      if (useBulk && primitives.goPreviousBulk) {
        const result = await primitives.goPreviousBulk(context);
        if (!result) throw new Error('bringIntoView: goPreviousBulk failed during goToPage retry');
        const jumped = typeof result === 'number' ? result : prevBulkSize;
        setCurrentPage(getCurrentPage() - jumped);
      } else if (primitives.goPrevious) {
        const stepped = await primitives.goPrevious(context);
        if (!stepped) throw new Error('bringIntoView: goPrevious failed during goToPage retry');
        setCurrentPage(getCurrentPage() - 1);
      } else {
        throw new Error(`bringIntoView: goToPage(${targetPageIndex}) returned false and no goPrevious/goPreviousBulk to step back`);
      }
    }
  }

  throw new Error(`bringIntoView: failed to reach page ${targetPageIndex} after ${MAX_GO_TO_PAGE_RETRIES} goToPage retries`);
}

/**
 * Executes a navigation path by calling the corresponding primitives.
 * Updates currentPageIndex via the provided setter as steps run.
 */
export async function executeNavigationPath(
  path: NavigationStep[],
  primitives: PaginationPrimitives,
  context: TableContext,
  getCurrentPage: () => number,
  setCurrentPage: (n: number) => void
): Promise<void> {
  for (const step of path) {
    switch (step.type) {
      case 'goToPage':
        if (primitives.goToPage) {
          const ok = await primitives.goToPage(step.pageIndex, context);
          if (!ok) throw new Error(`goToPage(${step.pageIndex}) failed`);
          setCurrentPage(step.pageIndex);
        }
        break;
      case 'goNextBulk':
        for (let i = 0; i < step.count && primitives.goNextBulk; i++) {
          const result = await primitives.goNextBulk(context);
          if (!result) throw new Error('goNextBulk failed');
          const jumped = typeof result === 'number' ? result : 1;
          setCurrentPage(getCurrentPage() + jumped);
        }
        break;
      case 'goNext':
        for (let i = 0; i < step.count && primitives.goNext; i++) {
          const ok = await primitives.goNext(context);
          if (!ok) throw new Error('goNext failed');
          setCurrentPage(getCurrentPage() + 1);
        }
        break;
      case 'goPreviousBulk':
        for (let i = 0; i < step.count && primitives.goPreviousBulk; i++) {
          const result = await primitives.goPreviousBulk(context);
          if (!result) throw new Error('goPreviousBulk failed');
          const jumped = typeof result === 'number' ? result : 1;
          setCurrentPage(getCurrentPage() - jumped);
        }
        break;
      case 'goPrevious':
        for (let i = 0; i < step.count && primitives.goPrevious; i++) {
          const ok = await primitives.goPrevious(context);
          if (!ok) throw new Error('goPrevious failed');
          setCurrentPage(getCurrentPage() - 1);
        }
        break;
    }
  }
}
