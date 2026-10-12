import type { Locator, Page } from '@playwright/test';
import type { FinalTableConfig, SmartRow, TableResult } from '../types';
import { normalizeRowIndexResult, resolveLogicalRowIndex } from './rowResolution';
import { navigateToCell } from './cellNavigation';
import { logDebug } from '../utils/debugUtils';
import type { SmartRowInternals } from '../utils/smartRowInternals';
import { withinDeadline } from '../utils/deadline';

/** Everything `toJSON` needs from the SmartRow being read. */
export interface RowSnapshotEnv<T = any> {
    config: FinalTableConfig<T>;
    rootLocator: Locator;
    resolve: (item: any, parent: Locator | Page) => Locator;
    map: Map<string, number>;
    row: SmartRow<T> & SmartRowInternals;
    rowLocator: Locator;
    rowIndex: number | undefined;
    table: TableResult<T> | null;
    renderWindowPosition: boolean;
}

/** `getHeaderCell` for strategy hooks: the table's when available, else an index lookup. */
export function headerCellGetter<T>(env: Pick<RowSnapshotEnv<T>, 'config' | 'rootLocator' | 'resolve' | 'map' | 'table'>) {
    const { table } = env;
    return table?.getHeaderCell
        ? table.getHeaderCell.bind(table)
        : async (colName: string) => {
            const idx = env.map.get(colName);
            if (idx === undefined) throw new Error(`Column "${colName}" not found`);
            return env.resolve(env.config.headerSelector, env.rootLocator).nth(idx);
        };
}

/** Adds synthetic columns to `result`; their compute() reads already-read columns from `result`. */
async function computeSyntheticColumns<T>(env: RowSnapshotEnv<T>, result: Record<string, any>, columns?: string[]): Promise<void> {
    const smart = env.row;
    for (const [name, def] of Object.entries(env.config.syntheticColumns ?? {})) {
        if (columns && !columns.includes(name)) continue;
        const snapshotRow = Object.create(smart) as typeof smart;
        snapshotRow.getValue = async (col: string): Promise<string> => {
            if (col in result) return String(result[col]);
            return smart.getValue(col);
        };
        result[name] = String(await def.compute(snapshotRow));
    }
}

const isBatchRow = (row: SmartRowInternals) => row._inBatch === true || !!row._barrier;

/** Capture a mounted position's identity once, before readiness or navigation can recycle it. */
async function resolveSnapshotIdentity<T>(env: RowSnapshotEnv<T>): Promise<RowSnapshotEnv<T>> {
    if (!env.renderWindowPosition || !env.config.strategies.resolveRowIndex) return env;
    const identity = await resolveLogicalRowIndex(env.rowLocator, env.config, () => undefined);
    // Keep the public SmartRow's mounted position unchanged; all snapshot recovery and
    // navigation use this read's logical identity. An unknown identity is not position 0.
    return { ...env, rowIndex: identity?.index, renderWindowPosition: false };
}

// ─── Atomic snapshot ─────────────────────────────────────────────────────────

/** Mounted row whose logical index (per resolveRowIndex) is `rowIndex`; tolerates rows detaching mid-scan. */
async function rescanForRow<T>(env: RowSnapshotEnv<T>, rowIndex: number): Promise<Locator | null> {
    const resolveRI = env.config.strategies.resolveRowIndex!;
    const rows = await env.resolve(env.config.rowSelector, env.rootLocator).all();
    for (const r of rows) {
        try {
            const rResult = await resolveRI(r);
            if (rResult !== undefined && normalizeRowIndexResult(rResult).index === rowIndex) return r;
        } catch { /* element may have detached during scan */ }
    }
    return null;
}

async function logicalIndexOf<T>(env: RowSnapshotEnv<T>, loc: Locator): Promise<number | undefined> {
    try {
        const r = await env.config.strategies.resolveRowIndex!(loc);
        return r !== undefined ? normalizeRowIndexResult(r).index : undefined;
    } catch {
        return undefined;
    }
}

const recycledRowHint = (inBatch: boolean, batchNote: string, otherwise: string) => inBatch ? batchNote : otherwise;

/** Scrolls the row back into view and rescans for it for up to 500ms. */
async function scrollBackAndRescan<T>(env: RowSnapshotEnv<T>, rowIndex: number): Promise<Locator | null> {
    const { config, rootLocator, resolve } = env;
    const scrollToRow = config.strategies.viewport?.scrollToRow;
    if (!scrollToRow) return null;
    const page = rootLocator.page();
    await scrollToRow({ root: rootLocator, config, page, resolve } as any, rowIndex);
    const deadline = Date.now() + 500;
    let recovered: Locator | null = null;
    while (!recovered && Date.now() < deadline) {
        recovered = await rescanForRow(env, rowIndex);
        if (!recovered) await page.waitForTimeout(50);
    }
    return recovered;
}

/**
 * Re-pin: the row locator is a positional nth-child from the iteration loop.
 * On recycling virtualizers, elements can shift between SmartRow creation and
 * the clone — the nth element may now show a different row's content.
 * Verify via resolveRowIndex and rescan if drifted.
 */
async function recoverDriftedRow<T>(env: RowSnapshotEnv<T>, rowIndex: number): Promise<Locator> {
    const inBatch = isBatchRow(env.row);
    let recovered = await rescanForRow(env, rowIndex);
    if (!recovered && !inBatch) recovered = await scrollBackAndRescan(env, rowIndex);
    if (recovered) return recovered;
    throw new Error(
        `[SmartTable] toJSON({ atomic: true }): row ${rowIndex} recycled out of the DOM and could not be recovered. ` +
        recycledRowHint(inBatch,
            `(During a map/forEach batch, scroll-back recovery is disabled to avoid disrupting sibling rows.)`,
            `Ensure a viewport.scrollToRow strategy can restore the row.`)
    );
}

/** The element to clone: the row itself, re-pinned if it drifted, after `contentReady` settles. */
async function resolveCloneTarget<T>(env: RowSnapshotEnv<T>): Promise<Locator> {
    const { config, rowIndex } = env;
    const canRepin = !!config.strategies.resolveRowIndex && typeof rowIndex === 'number' && env.row._selfHealing !== true;

    let cloneTarget = env.rowLocator;
    if (canRepin && await logicalIndexOf(env, cloneTarget) !== rowIndex) {
        cloneTarget = await recoverDriftedRow(env, rowIndex);
    }

    // Wait for async content renders to settle before cloning.
    if (config.strategies.contentReady) {
        await config.strategies.contentReady(cloneTarget, env.rootLocator.page());
        // Revalidate: the element may have recycled during the await.
        if (canRepin && await logicalIndexOf(env, cloneTarget) !== rowIndex) {
            cloneTarget = await recoverDriftedRow(env, rowIndex);
        }
    }
    return cloneTarget;
}

/**
 * Clones the row in browser memory (NOT in the DOM) and extracts text + row HTML.
 * Uses textContent (not innerText) because the clone is detached — innerText
 * falls back to textContent on detached nodes per HTML spec, so be explicit.
 */
async function cloneRow(target: Locator, cellSel: string): Promise<{ rowHTML: string; cells: { text: string }[] }> {
    const cloneHandle = await target.evaluateHandle(el => el.cloneNode(true) as HTMLElement);
    try {
        return await cloneHandle.evaluate(
            (row: HTMLElement, sel: string) => {
                const cells = row.querySelectorAll(sel);
                return {
                    rowHTML: row.outerHTML,
                    cells: [...cells].map(c => ({
                        text: (c.textContent || '').trim(),
                    })),
                };
            }, cellSel);
    } finally {
        await cloneHandle.dispose();
    }
}

/**
 * `toJSON({ atomic: true })`: snapshot the row in a single evaluate, then apply column
 * overrides against a frozen reconstruction. Zero inter-column stagger — even in-place
 * React re-renders can't affect it because overrides read from a detached clone.
 */
export async function readRowAtomic<T>(env: RowSnapshotEnv<T>, columns?: string[]): Promise<T> {
    const { config, map, rootLocator } = env;
    const cellSel = config.cellSelector;
    if (typeof cellSel !== 'string') {
        throw new Error('[SmartTable] toJSON({ atomic: true }) requires cellSelector to be a CSS string, not a function.');
    }
    env = await resolveSnapshotIdentity(env);
    const page = rootLocator.page();
    const snapshot = await cloneRow(await resolveCloneTarget(env), cellSel);

    // Determine which columns have overrides (need lazy materialization)
    const columnsToProcess = [...map.entries()].filter(([col]) => !columns || columns.includes(col));
    const hasAnyOverride = columnsToProcess.some(([col]) => !!config.columnOverrides?.[col as keyof T]?.read);

    // Lazily materialize the row if any override needs a Locator.
    // Uses position:fixed off-screen (NOT display:none — that breaks innerText).
    const snapId = `__st_snap_${Math.random().toString(36).slice(2, 10)}`;
    const snapCell = (colIdx: number) => page.locator(`#${snapId}`).locator(cellSel).nth(colIdx);
    const getCell = (colName: string): Locator => {
        const colIdx = map.get(colName);
        if (colIdx === undefined) throw new Error(`[SmartTable] getCell: column "${colName}" not found`);
        return snapCell(colIdx);
    };

    if (hasAnyOverride) {
        await page.evaluate(([html, id]) => {
            const c = document.createElement('div');
            c.id = id;
            c.style.cssText = 'position:fixed;left:-99999px;top:-99999px;opacity:0;pointer-events:none';
            // Wrap in <table><tbody> so the browser's HTML parser keeps <tr>/<td> intact.
            c.innerHTML = `<table><tbody>${html}</tbody></table>`;
            document.body.appendChild(c);
        }, [snapshot.rowHTML, snapId] as const);
    }

    try {
        const result: Record<string, any> = {};
        for (const [col, idx] of columnsToProcess) {
            const mapper = config.columnOverrides?.[col as keyof T]?.read;
            if (mapper) {
                try {
                    result[col] = await mapper(snapCell(idx), { row: env.row, columnName: col, columnIndex: idx, getCell });
                } catch (err) {
                    const wrapped = new Error(
                        `[SmartTable] toJSON({ atomic: true }): column override for "${col}" failed — ${(err as Error).message}`,
                    );
                    (wrapped as any).cause = err;
                    throw wrapped;
                }
            } else if (idx < snapshot.cells.length) {
                result[col] = snapshot.cells[idx].text;
            }
        }

        await computeSyntheticColumns(env, result, columns);
        return result as unknown as T;
    } finally {
        if (hasAnyOverride) await page.evaluate(id => document.getElementById(id)?.remove(), snapId);
    }
}

// ─── Live read ───────────────────────────────────────────────────────────────

/**
 * #366 / #392: on virtualized tables the row's DOM node can recycle between the
 * per-column awaits of a live read. When a self-healing locator is in use (the row locator was
 * rebuilt with a CSS selector, e.g. `[data-rowindex="47"]`), the locator automatically
 * re-queries the DOM — no rescan needed. For plain-number strategies (JS-only, no
 * selector), fall back to rescan-then-scrollToRow.
 *
 * Returns `resolveStableRow` (call before each column) and `current` (last known-good row).
 */
function createRowPinner<T>(env: RowSnapshotEnv<T>) {
    const { config, rowLocator, rowIndex } = env;
    const resolveRI = config.strategies.resolveRowIndex;
    const canPin = !!resolveRI && typeof rowIndex === 'number' && env.row._selfHealing !== true;
    let lastGood = rowLocator;

    const resolveStableRow = async (): Promise<Locator> => {
        // Self-healing locator: always re-queries the DOM by attribute — no rescan needed.
        if (!canPin) return rowLocator;
        const result = await resolveRI!(lastGood);
        if (result !== undefined && normalizeRowIndexResult(result).index === rowIndex) return lastGood; // still correct
        // Drifted (recycled). Re-locate the row carrying the expected logical index.
        lastGood = await relocateRecycledRow(env, rowIndex as number);
        return lastGood;
    };

    return { resolveStableRow, current: () => lastGood };
}

/** Mounted row whose logical index is `rowIndex` (strict: resolveRowIndex errors propagate). */
async function rescanStrict<T>(env: RowSnapshotEnv<T>, rowIndex: number): Promise<Locator | null> {
    const resolveRI = env.config.strategies.resolveRowIndex!;
    const rows = await env.resolve(env.config.rowSelector, env.rootLocator).all();
    for (const r of rows) {
        const rResult = await resolveRI(r);
        if (rResult !== undefined && normalizeRowIndexResult(rResult).index === rowIndex) return r;
    }
    return null;
}

/** Live-read recovery: rescan, then (outside batches) scrollToRow and rescan once more. */
async function relocateRecycledRow<T>(env: RowSnapshotEnv<T>, rowIndex: number): Promise<Locator> {
    const { config, rootLocator, resolve } = env;
    const inBatch = isBatchRow(env.row);
    let recovered = await rescanStrict(env, rowIndex);
    const scrollToRow = config.strategies.viewport?.scrollToRow;
    if (!recovered && !inBatch && scrollToRow) {
        await scrollToRow({ root: rootLocator, config, page: rootLocator.page(), resolve } as any, rowIndex);
        recovered = await rescanStrict(env, rowIndex);
    }
    if (recovered) return recovered;
    throw new Error(
        `[SmartTable] toJSON: row ${rowIndex} recycled out of the DOM mid-read and could not be recovered — ` +
        `the returned object would mix fields from different rows. ` +
        recycledRowHint(inBatch,
            `(During a map/forEach batch, scroll-back recovery is disabled to avoid disrupting sibling rows; the row must stay mounted for the read.)`,
            `Ensure a viewport.scrollToRow can restore the row.`)
    );
}

function cellIn<T>(env: RowSnapshotEnv<T>, row: Locator, colName: string, colIdx: number): Locator {
    const { config, rootLocator } = env;
    if (config.strategies.getCellLocator) {
        return config.strategies.getCellLocator({
            row, root: rootLocator, columnName: colName,
            columnIndex: colIdx, rowIndex: env.rowIndex, page: rootLocator.page(), config,
        });
    }
    return env.resolve(config.cellSelector, row).nth(colIdx);
}

type CellLoadOutcome = { read: true } | { read: false; value: any };
type IsCellLoading = NonNullable<NonNullable<FinalTableConfig['strategies']['loading']>['isCellLoading']>;

/** undefined = unset (read as-is immediately); 0 = no wait (immediate check); >0 = wait up to N ms */
function cellLoadingTimeoutOf(config: FinalTableConfig): number | undefined {
    const raw = config.strategies.loading?.cellLoadingTimeout;
    return raw !== undefined && Number.isFinite(raw) && raw >= 0 ? raw : undefined;
}

/** Polls `check` every `intervalMs` until it returns true or `deadline` passes. */
async function pollUntil(page: Page, deadline: number, intervalMs: number, check: () => Promise<boolean>, initial: boolean): Promise<boolean> {
    let done = initial;
    while (!done && Date.now() < deadline) {
        await page.waitForTimeout(Math.min(intervalMs, deadline - Date.now()));
        if (Date.now() >= deadline) break;
        done = await check();
    }
    return done;
}

/**
 * First-paint race: the cell node can attach a tick before the loading
 * indicator mounts. A single false-negative then reads "" and skips
 * onCellLoadingTimeout. Only grace when the cell still looks empty.
 */
async function graceForLoadingIndicator(page: Page, targetCell: Locator, isLoading: () => Promise<boolean>, deadline: number): Promise<boolean> {
    const peek = await withinDeadline(() => targetCell.evaluate((el) => (el.textContent || '').trim()).catch(() => ''), deadline, '');
    if (peek !== '') return false;
    return pollUntil(page, Math.min(Date.now() + 250, deadline), 25, isLoading, false);
}

/** What to do when a cell is still loading after `cellLoadingTimeout`. */
async function onStillLoading<T>(env: RowSnapshotEnv<T>, targetCell: Locator, col: string, timeout: number): Promise<CellLoadOutcome> {
    const { config, row: smart } = env;
    const onCellLoadingTimeout = config.strategies.loading?.onCellLoadingTimeout ?? 'read-as-is';
    logDebug(config, 'verbose', `toJSON: cell "${col}" — still loading after ${timeout}ms, action: ${typeof onCellLoadingTimeout === 'function' ? 'callback' : onCellLoadingTimeout}`);
    if (typeof onCellLoadingTimeout === 'function') {
        return { read: false, value: await onCellLoadingTimeout(targetCell, col, smart) };
    }
    if (onCellLoadingTimeout === 'skip') return { read: false, value: '' };
    if (onCellLoadingTimeout === 'throw') {
        throw new Error(`[SmartTable] Cell "${col}" (row ${env.rowIndex}) did not finish loading within ${timeout}ms`);
    }
    // 'read-as-is': fall through to normal read
    return { read: true };
}

/**
 * Applies `loading.isCellLoading` / `cellLoadingTimeout` / `onCellLoadingTimeout` to one cell.
 * Returns `{ read: true }` to read the cell normally, or the value to use instead.
 */
async function waitForCellLoaded<T>(env: RowSnapshotEnv<T>, targetCell: Locator, col: string): Promise<CellLoadOutcome> {
    const { config, row: smart } = env;
    const isCellLoading: IsCellLoading | undefined = config.strategies.loading?.isCellLoading;
    if (!isCellLoading) return { read: true };
    const page = env.rootLocator.page();
    const timeout = cellLoadingTimeoutOf(config);
    const deadline = Date.now() + (timeout ?? Infinity);
    const isLoading = () => withinDeadline(() => isCellLoading(targetCell, col, smart), deadline, true);

    let loading = await isLoading();
    if (!loading && timeout !== undefined && timeout > 0) {
        loading = await graceForLoadingIndicator(page, targetCell, isLoading, deadline);
    }
    if (!loading || timeout === undefined) return { read: true };

    logDebug(config, 'verbose', `toJSON: cell "${col}" — waiting up to ${timeout}ms`);
    const isLoaded = async () => !(await isLoading());
    const initial = (timeout === 0 || Date.now() < deadline) && await isLoaded();
    const cellResolved = await pollUntil(page, deadline, 100, isLoaded, initial);
    return cellResolved ? { read: true } : onStillLoading(env, targetCell, col, timeout);
}

/**
 * Default `toJSON()`: reads each column from the live DOM, navigating to it first
 * (keeps synchronized batches in lock-step) and re-pinning the row before each read.
 */
export async function readRowLive<T>(env: RowSnapshotEnv<T>, columns?: string[]): Promise<T> {
    env = await resolveSnapshotIdentity(env);
    const { config, map, rootLocator, rowIndex } = env;
    const result: Record<string, any> = {};
    const page = rootLocator.page();
    const getHeaderCell = headerCellGetter(env);
    const pinner = createRowPinner(env);

    // getCell for column overrides: a live cell Locator on the last-known-good row,
    // as fresh as possible, but raw (not override-processed).
    const getCellLive = (colName: string): Locator => {
        const colIdx = map.get(colName);
        if (colIdx === undefined) throw new Error(`[SmartTable] getCell: column "${colName}" not found`);
        return cellIn(env, pinner.current(), colName, colIdx);
    };

    for (const [col, idx] of map.entries()) {
        if (columns && !columns.includes(col)) continue;

        // Re-pin to the correct logical row before reading this column (#366).
        const stableRow = await pinner.resolveStableRow();
        const mapper = config.columnOverrides?.[col as keyof T]?.read;
        const cell = cellIn(env, stableRow, col, idx);

        // Always navigate to keep Lock-Step synchronization even if the cell is
        // already present (navigateToCell handles the barrier check-in).
        const navigatedCell = await navigateToCell({
            config,
            rootLocator,
            page,
            resolve: env.resolve,
            getHeaders: env.table?.getHeaders,
            column: col,
            index: idx,
            rowLocator: stableRow,
            rowIndex,
            renderWindowPosition: env.renderWindowPosition,
            barrier: env.row._barrier,
            allowMissingCell: !!mapper,
        });
        const targetCell = navigatedCell ?? cell;

        // Fires for BOTH columnOverrides.read and the default innerText path.
        if (config.strategies.beforeCellRead) {
            await config.strategies.beforeCellRead({
                cell: targetCell,
                columnName: col,
                columnIndex: idx,
                row: stableRow,
                page,
                root: rootLocator,
                getHeaderCell,
            });
        }

        const loadOutcome = await waitForCellLoaded(env, targetCell, col);
        if (!loadOutcome.read) {
            result[col] = loadOutcome.value;
            continue;
        }

        if (mapper) {
            result[col] = await mapper(targetCell, { row: env.row, columnName: col, columnIndex: idx, getCell: getCellLive });
        } else {
            const text = await targetCell.innerText();
            result[col] = (text || '').trim();
        }
    }

    await computeSyntheticColumns(env, result, columns);
    return result as unknown as T;
}
