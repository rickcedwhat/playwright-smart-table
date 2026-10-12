import type { TableContext, ViewportStrategy } from '../types';

/** Cache geometry only for one navigation; scans and later reads use the original oracles. */
export function memoizeViewport(viewport: ViewportStrategy): { viewport: ViewportStrategy; clear: () => void } {
    if (viewport.disableCache) return { viewport, clear: () => {} };
    type Range = { first: number; last: number };
    let columns: Promise<Range> | undefined;
    let rows: Promise<Range> | undefined;
    const clear = () => { columns = undefined; rows = undefined; };
    const wrapScroll = (scroll: ViewportStrategy['scrollToRow']) => scroll && (async (context: TableContext, index: number) => {
        clear();
        try { await scroll.call(viewport, context, index); }
        finally { clear(); }
    });
    return {
        clear,
        viewport: {
            ...viewport,
            getVisibleColumnRange: viewport.getVisibleColumnRange
                ? context => columns ??= viewport.getVisibleColumnRange!(context)
                : undefined,
            getVisibleRowRange: viewport.getVisibleRowRange
                ? context => rows ??= viewport.getVisibleRowRange!(context)
                : undefined,
            scrollToColumn: wrapScroll(viewport.scrollToColumn),
            scrollToRow: wrapScroll(viewport.scrollToRow),
        },
    };
}
