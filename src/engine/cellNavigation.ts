import type { Locator, Page } from '@playwright/test';
import type { FinalTableConfig, GetActiveCellFn, NavigationPrimitives, ViewportStrategy } from '../types';
import { resolveLogicalRowIndex } from './rowResolution';
import { logDebug } from '../utils/debugUtils';
import type { NavigationBarrier } from '../utils/navigationBarrier';
import { memoizeViewport } from '../utils/memoizeViewport';

type StrategyContext = {
    config: FinalTableConfig<any>;
    root: Locator;
    page: Page;
    resolve: (item: any, parent: Locator | Page) => Locator;
    getHeaders?: () => Promise<string[]>;
};

type ActiveCell = Awaited<ReturnType<GetActiveCellFn>>;

export interface NavigateToCellParams {
    config: FinalTableConfig<any>;
    rootLocator: Locator;
    page: Page;
    resolve: (item: any, parent: Locator | Page) => Locator;
    getHeaders?: () => Promise<string[]>;
    column: string;
    index: number;
    rowLocator: Locator;
    rowIndex?: number;
    renderWindowPosition?: boolean;
    barrier?: NavigationBarrier;
    allowMissingCell?: boolean;
}

/** Shared state for one navigation, built once and passed to each phase. */
interface CellNav {
    config: FinalTableConfig<any>;
    page: Page;
    context: StrategyContext;
    column: string;
    index: number;
    rowLocator: Locator;
    rowIndex: number | undefined;
    barrier?: NavigationBarrier;
    allowMissingCell?: boolean;
    resolve: (item: any, parent: Locator | Page) => Locator;
    /** `strategies.getActiveCell`, or null when not configured. */
    readActiveCell: () => Promise<ActiveCell>;
    isActiveTarget: (ac: ActiveCell) => boolean;
    /** Is the target cell currently in the DOM (or focused)? */
    targetReached: () => Promise<boolean>;
    getCellLocator: () => Locator;
}

const log = (config: FinalTableConfig<any>, msg: string) => logDebug(config, 'verbose', msg);

/**
 * Navigates to a cell with active cell optimization.
 * Uses `strategies.viewport` first (2D virtualized tables), then `strategies.navigation`
 * primitives (goUp/goDown/goLeft/goRight, optional snap/seek/goHome).
 * Returns the target cell locator after navigation.
 */
export const navigateToCell = async (params: NavigateToCellParams): Promise<Locator> => {
    const { config, rootLocator, page, resolve, getHeaders, column, index, rowLocator, barrier, allowMissingCell } = params;
    // getRowByIndex supplies a position in the mounted row set. Resolve it while the
    // selected row is still mounted, before horizontal scrolling can evict it.
    const rowIndex = params.renderWindowPosition && config.strategies.viewport && config.strategies.resolveRowIndex
        ? (await resolveLogicalRowIndex(rowLocator, config, () => undefined))?.index
        : params.rowIndex;
    const rowLabel = typeof rowIndex === 'number' ? `row ${rowIndex}` : 'row ?';
    log(config, `_navigateToCell: resolving column "${column}" (colIndex ${index}), ${rowLabel}`);

    const getActiveCell = config.strategies.getActiveCell;
    const readActiveCell = async (): Promise<ActiveCell> =>
        getActiveCell ? getActiveCell({ config, root: rootLocator, page, resolve }) : null;
    const isActiveTarget = (ac: ActiveCell) => !!ac && ac.rowIndex === rowIndex && ac.columnIndex === index;

    // Optimization: Check if we are ALREADY at the target cell
    if (getActiveCell) {
        const activeCell = await readActiveCell();
        if (activeCell && isActiveTarget(activeCell)) {
            log(config, `_navigateToCell: Already at target cell {row: ${rowIndex}, col: ${index}}`);
            // Still participate in the barrier (no-op) so peers are not left waiting.
            if (barrier) await barrier.sync(index);
            return activeCell.locator;
        }
    }

    const getCellLocator = () => config.strategies.getCellLocator
        ? config.strategies.getCellLocator({ row: rowLocator, root: rootLocator, columnName: column, columnIndex: index, rowIndex, page, config })
        : resolve(config.cellSelector, rowLocator).nth(index);

    const nav: CellNav = {
        config, page, column, index, rowLocator, rowIndex, barrier, allowMissingCell, resolve,
        context: { config, root: rootLocator, page, resolve, getHeaders },
        readActiveCell,
        isActiveTarget,
        // Locator presence: virtualized grids (e.g. Glide) often attach the target `td` after scroll
        // while focus id lags; do not require getActiveCell to match for this to count as reached.
        targetReached: async () => isActiveTarget(await readActiveCell()) || (await getCellLocator().count() > 0),
        getCellLocator,
    };

    // Viewport-oracle phase: direct positioning for 2D virtualized tables.
    // Runs before navigation primitives; falls through to them if cell still not accessible.
    const cache = config.strategies.viewport && memoizeViewport(config.strategies.viewport);
    if (cache && typeof rowIndex === 'number') {
        const viaViewport = await navigateViaViewport(nav, cache.viewport, rowIndex, cache.clear);
        if (viaViewport) return viaViewport;
    }

    if (config.strategies.navigation) {
        return navigateViaPrimitives(nav, config.strategies.navigation);
    }

    // No horizontal strategies configured; assume table is 1D or fully rendered,
    // and let standard Playwright auto-waiting handle any lazy-loading delays.
    return getCellLocator();
};

/** Checks in to the barrier without a move action so peers aren't left waiting. */
async function checkIn(nav: CellNav): Promise<void> {
    if (nav.barrier) await nav.barrier.sync(nav.index);
}

/** Runs `action` once for the whole batch when a barrier is present, otherwise directly. */
async function coordinated<R>(nav: CellNav, action: () => Promise<R>): Promise<R | void> {
    return nav.barrier ? nav.barrier.sync(nav.index, action) : action();
}

const inRange = (value: number, range: { first: number; last: number }) => value >= range.first && value <= range.last;

/** True when the row is in the visible row range and the target cell is (or soon becomes) attached. */
async function isCellAttachedInView(nav: CellNav, viewport: ViewportStrategy, rowIndex: number): Promise<boolean> {
    const rowRange = viewport.getVisibleRowRange ? await viewport.getVisibleRowRange(nav.context) : null;
    if (rowRange && !inRange(rowIndex, rowRange)) return false;
    if (await nav.targetReached()) return true;
    try {
        await nav.getCellLocator().waitFor({ state: 'attached', timeout: 500 });
        return true;
    } catch (error) {
        if ((error as Error | undefined)?.name !== 'TimeoutError') throw error;
        return false;
    }
}

/**
 * Fast path: is the cell already readable without scrolling? Uses the column range oracle
 * when available, else DOM presence. Rows do NOT sync at the barrier with a move action
 * here — only scroll boundaries need coordination.
 */
async function readIfInView(nav: CellNav, viewport: ViewportStrategy, rowIndex: number): Promise<Locator | null> {
    const { config, context, index } = nav;
    if (!viewport.getVisibleColumnRange) {
        // No range oracle — fall back to DOM count() check.
        if (!await nav.targetReached()) return null;
        await checkIn(nav);
        return nav.getCellLocator();
    }
    const knownColRange = await viewport.getVisibleColumnRange(context);
    if (!knownColRange || !inRange(index, knownColRange)) return null;
    if (!await isCellAttachedInView(nav, viewport, rowIndex)) return null;
    log(config, `_navigateToCell: col ${index} in visible range [${knownColRange.first}-${knownColRange.last}], reading directly`);
    // Check in to the barrier without a moveAction — peers that need the scroll
    // still supply their own action and will trigger it when all rows arrive.
    await checkIn(nav);
    return nav.getCellLocator();
}

/**
 * Viewport phase. Returns the cell locator, or null to fall through to navigation primitives
 * (only when `strategies.navigation` is configured; otherwise throws on a miss).
 */
async function navigateViaViewport(nav: CellNav, viewport: ViewportStrategy, rowIndex: number, clearCache: () => void): Promise<Locator | null> {
    const { config, context, index } = nav;

    const inView = await readIfInView(nav, viewport, rowIndex);
    if (inView) return inView;

    // Column is out of view. Scroll to bring it in.
    // In synchronized mode, the last row to arrive triggers the scroll once for all rows.
    await coordinated(nav, async () => {
        // Always scroll — scrollToColumn is idempotent (bounds-checks before acting).
        // The trigger row may already have the cell via overscan, but other rows in the
        // batch might not; skipping the scroll here would silently starve them.
        log(config, `_navigateToCell: col ${index} out of view, scrolling`);
        if (viewport.scrollToColumn) {
            await viewport.scrollToColumn(context, index);
        }
    });

    // A peer may have performed the coordinated scroll. Drop this row's pre-scroll geometry too.
    clearCache();

    await recoverEvictedRow(nav, viewport, rowIndex);

    if (await nav.targetReached()) {
        return nav.getCellLocator();
    }

    // Cell still not accessible — fall through to navigation primitives if configured.
    if (config.strategies.navigation) return null;
    if (nav.allowMissingCell) return nav.getCellLocator();
    throw new Error(await describeViewportMiss(nav, viewport, rowIndex));
}

/**
 * Per-row 2D recovery: horizontal scroll may evict rows from the vertical viewport
 * (scrollbar layout shift) or rows may simply be outside the virtual row window.
 * Recovery is serialized via the barrier's mutex so concurrent rows don't race on
 * scrollTop — adjacent rows often appear in view for free after the previous recovery.
 * scrollToRow must only adjust scrollTop (not scrollLeft) to preserve the column
 * position established by scrollToColumn.
 */
async function recoverEvictedRow(nav: CellNav, viewport: ViewportStrategy, rowIndex: number): Promise<void> {
    if (await nav.targetReached()) return;
    const scrollToRow = viewport.scrollToRow;
    if (!scrollToRow) return;
    const recover = async () => {
        if (!await nav.targetReached()) {
            log(nav.config, `_navigateToCell: row ${rowIndex} evicted by col scroll, recovering`);
            await scrollToRow(nav.context, rowIndex);
        }
    };
    if (nav.barrier) {
        await nav.barrier.runExclusiveRecovery(recover);
    } else {
        await recover();
    }
}

async function visibleRanges(nav: CellNav) {
    const viewport = nav.config.strategies.viewport;
    const colRange = viewport?.getVisibleColumnRange ? await viewport.getVisibleColumnRange(nav.context) : null;
    const rowRange = viewport?.getVisibleRowRange ? await viewport.getVisibleRowRange(nav.context) : null;
    return { colRange, rowRange };
}

async function describeViewportMiss(nav: CellNav, viewport: ViewportStrategy, rowIndex: number): Promise<string> {
    const colRange = viewport.getVisibleColumnRange ? await viewport.getVisibleColumnRange(nav.context) : null;
    const rowRange = viewport.getVisibleRowRange ? await viewport.getVisibleRowRange(nav.context) : null;

    let errMsg = `SmartTable: could not reach cell for column "${nav.column}" (colIndex ${nav.index}) at row ${rowIndex}.\n`;
    errMsg += colRange
        ? `  Visible column range: [${colRange.first}–${colRange.last}]. Column is out of view and no navigation fallback is configured.\n`
        : `  Column is out of view and no navigation fallback is configured.\n`;
    if (rowRange) {
        errMsg += `  Visible row range: [${rowRange.first}–${rowRange.last}]. ${inRange(rowIndex, rowRange) ? 'Row is in view.' : 'Row is out of view.'}\n`;
    }
    errMsg += `  → Add a \`strategies.navigation\` or \`strategies.viewport.scrollToColumn\` to handle off-screen columns.`;
    return errMsg;
}

/** Navigation-primitive phase (goUp/goDown/goLeft/goRight, optional snap/seek). */
async function navigateViaPrimitives(nav: CellNav, primitives: NavigationPrimitives): Promise<Locator> {
    const { rowIndex } = nav;

    if (await nav.targetReached()) {
        // Already there. If we have a barrier, check-in to stay in lock-step.
        await checkIn(nav);
        return nav.getCellLocator();
    }

    if (typeof rowIndex !== 'number') {
        if (nav.allowMissingCell) return nav.getCellLocator();
        throw new Error('Row index is required for navigation');
    }

    const focused = await focusUnfocusedCell(nav);
    if (focused) return focused;

    // Not there, perform (coordinated) navigation
    const navResult = await coordinated(nav, () => stepToCell(nav, primitives, rowIndex));
    return finishNavigation(nav, navResult, rowIndex);
}

/** Picks the cell after stepping: the one stepToCell found mid-navigation, else the final locator. */
async function finishNavigation(nav: CellNav, navResult: Locator | undefined | void, rowIndex: number): Promise<Locator> {
    if (navResult && typeof (navResult as any).count === 'function' && await navResult.count() > 0) {
        return navResult;
    }
    const finalCell = nav.getCellLocator();
    if (await finalCell.count() > 0 || nav.allowMissingCell) return finalCell;

    const { colRange, rowRange } = await visibleRanges(nav);
    let errMsg = `SmartTable: could not reach cell for column "${nav.column}" (colIndex ${nav.index}) at row ${rowIndex} after exhausting navigation strategies. Ensure navigation primitives are correctly implemented.\n`;
    if (colRange) errMsg += `  Visible column range: [${colRange.first}–${colRange.last}].\n`;
    if (rowRange) errMsg += `  Visible row range: [${rowRange.first}–${rowRange.last}].\n`;
    throw new Error(errMsg);
}

/**
 * If getActiveCell is present but returns null (no focus), and the cell is in the DOM,
 * focus it once before entering the navigation loop.
 */
async function focusUnfocusedCell(nav: CellNav): Promise<Locator | null> {
    if (!nav.config.strategies.getActiveCell) return null;
    if (await nav.readActiveCell()) return null;
    const cell = nav.resolve(nav.config.cellSelector, nav.rowLocator).nth(nav.index);
    if (await cell.count() === 0) return null;
    log(nav.config, `_navigateToCell: cell "${nav.column}" found but not focused; focusing.`);
    await cell.focus();
    // Re-check target
    if (!await nav.targetReached()) return null;
    await checkIn(nav);
    return cell;
}

/** Tracks the active cell position while stepping (stays at the last known value when focus is unknown). */
class Position {
    row = 0;
    col = 0;
    constructor(private readonly nav: CellNav) {}
    async sync(): Promise<void> {
        const ac = await this.nav.readActiveCell();
        if (ac) {
            this.row = ac.rowIndex;
            this.col = ac.columnIndex;
        }
    }
}

/** A configured non-negative wait, or the computed default. */
const waitOrDefault = (configured: number | undefined, computed: number) =>
    (Number.isFinite(configured) && configured! >= 0) ? configured! : computed;

async function repeatStep(times: number, step: (() => Promise<void>) | undefined): Promise<void> {
    if (!step) return;
    for (let i = 0; i < times; i++) await step();
}

/** Column-0 snap and long-distance seek, both owned by the navigation primitive. */
async function alignColumn(nav: CellNav, primitives: NavigationPrimitives, pos: Position): Promise<void> {
    const { config, context, index } = nav;
    // Core must not special-case canvas/Home — that was pre-viewport Glide glue.
    if (index === 0 && primitives.snapFirstColumnIntoView) {
        log(config, '_navigateToCell: snapFirstColumnIntoView for column index 0');
        await primitives.snapFirstColumnIntoView(context);
        await pos.sync();
    }
    if (Math.abs(index - pos.col) > 12 && primitives.seekColumnIndex) {
        log(config, `_navigateToCell: seekColumnIndex approx for column ${index}`);
        await primitives.seekColumnIndex(context, index);
        await pos.sync();
    }
}

/**
 * After horizontal steps, poll until getActiveCell / DOM presence confirms the target
 * (a11y trees and virtual mounts often lag the scroll). Tune via navigation.maxWaitMs.
 */
async function pollForTarget(nav: CellNav, primitives: NavigationPrimitives, horizontalSteps: number): Promise<Locator | undefined> {
    const pollIntervalMs = 10;
    const maxWaitMs = waitOrDefault(primitives.maxWaitMs, Math.min(6000, 250 + horizontalSteps * 25));
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        const ac = await nav.readActiveCell();
        if (ac && nav.isActiveTarget(ac)) return ac.locator;
        if (await nav.targetReached()) break;
        await nav.page.waitForTimeout(pollIntervalMs);
    }
    return undefined;
}

/** Steps with the navigation primitives from the active cell to the target, then waits for it. */
async function stepToCell(nav: CellNav, primitives: NavigationPrimitives, rowIndex: number): Promise<Locator | undefined> {
    const { context, index } = nav;
    const pos = new Position(nav);
    await pos.sync();

    // Navigate vertically (tight loop)
    const rDiff = rowIndex - pos.row;
    const goVertical = rDiff > 0 ? primitives.goDown : primitives.goUp;
    await repeatStep(Math.abs(rDiff), goVertical && (() => goVertical(context)));
    await pos.sync();

    await alignColumn(nav, primitives, pos);

    const cDiff = index - pos.col;
    const goHorizontal = cDiff > 0 ? primitives.goRight : primitives.goLeft;
    await repeatStep(Math.abs(cDiff), goHorizontal && (() => goHorizontal(context)));

    const horizontalSteps = Math.abs(cDiff);
    if (horizontalSteps > 0) {
        await nav.page.waitForTimeout(waitOrDefault(primitives.settleMs, Math.min(2500, 60 + horizontalSteps * 12)));
    }
    return pollForTarget(nav, primitives, horizontalSteps);
}
