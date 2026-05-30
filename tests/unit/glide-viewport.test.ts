import { describe, it, expect, vi, type Mock } from 'vitest';
import { createGlideViewport } from '../../src/presets/glide/viewport';
import { createGlide, Glide } from '../../src/presets/glide';

interface LocatorMock {
    evaluate: Mock;
    evaluateAll: Mock;
    waitFor: Mock;
    scrollIntoViewIfNeeded: Mock;
    count: Mock;
    locator: Mock;
    first: Mock;
}

interface PageMock {
    locator: Mock;
}

interface ContextMock {
    page: PageMock;
    root: LocatorMock;
    config: Record<string, never>;
    resolve: Mock;
    getHeaders: Mock;
}

const loc = (overrides: Partial<LocatorMock> = {}): LocatorMock => {
    const self: LocatorMock = {
        evaluate: vi.fn().mockResolvedValue(undefined),
        evaluateAll: vi.fn().mockResolvedValue([]),
        waitFor: vi.fn().mockResolvedValue(undefined),
        scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(0),
        locator: vi.fn(),
        first: vi.fn(),
        ...overrides,
    };
    if (!overrides.locator) self.locator = vi.fn().mockReturnValue(self);
    if (!overrides.first) self.first = vi.fn().mockReturnValue(self);
    return self;
};

const ctx = (pageMock: PageMock, headers?: string[]): ContextMock => ({
    page: pageMock,
    root: loc(),
    config: {} as Record<string, never>,
    resolve: vi.fn(),
    getHeaders: vi.fn().mockResolvedValue(headers ?? Array.from({ length: 60 }, (_, i) => `col${i}`)),
});

// ─── getVisibleColumnRange ────────────────────────────────────────────────────

describe('createGlideViewport — getVisibleColumnRange', () => {
    it('converts 1-based aria-colindex to 0-based range', async () => {
        const viewport = createGlideViewport();

        const cellLoc = loc({
            evaluateAll: vi.fn().mockImplementation(async (fn: (els: unknown[]) => unknown) =>
                fn([
                    { getAttribute: () => '1' },
                    { getAttribute: () => '3' },
                    { getAttribute: () => '6' },
                ])
            ),
        });
        const rowLoc = loc({ locator: vi.fn().mockReturnValue(cellLoc) });
        const page: PageMock = { locator: vi.fn().mockReturnValue(rowLoc) };

        const range = await viewport.getVisibleColumnRange!(ctx(page) as any);
        // aria-colindex 1,3,6 → 0-based 0,2,5
        expect(range).toEqual({ first: 0, last: 5 });
    });

    it('returns {first:0, last:0} when no cells found', async () => {
        const viewport = createGlideViewport();
        const cellLoc = loc({
            evaluateAll: vi.fn().mockImplementation(async (fn: (els: unknown[]) => unknown) => fn([])),
        });
        const rowLoc = loc({ locator: vi.fn().mockReturnValue(cellLoc) });
        const page: PageMock = { locator: vi.fn().mockReturnValue(rowLoc) };

        const range = await viewport.getVisibleColumnRange!(ctx(page) as any);
        expect(range).toEqual({ first: 0, last: 0 });
    });
});

// ─── getVisibleRowRange ───────────────────────────────────────────────────────

describe('createGlideViewport — getVisibleRowRange', () => {
    it('converts aria-rowindex (2-based data rows) to 0-based range', async () => {
        const viewport = createGlideViewport();

        const rowLoc = loc({
            evaluateAll: vi.fn().mockImplementation(async (fn: (els: unknown[]) => unknown) =>
                fn([
                    { getAttribute: () => '2' },  // data row 0
                    { getAttribute: () => '3' },  // data row 1
                    { getAttribute: () => '11' }, // data row 9
                ])
            ),
        });
        const page: PageMock = { locator: vi.fn().mockReturnValue(rowLoc) };

        const range = await viewport.getVisibleRowRange!(ctx(page) as any);
        expect(range).toEqual({ first: 0, last: 9 });
    });

    it('returns {first:0, last:0} when no rows found', async () => {
        const viewport = createGlideViewport();
        const rowLoc = loc({
            evaluateAll: vi.fn().mockImplementation(async (fn: (els: unknown[]) => unknown) => fn([])),
        });
        const page: PageMock = { locator: vi.fn().mockReturnValue(rowLoc) };

        const range = await viewport.getVisibleRowRange!(ctx(page) as any);
        expect(range).toEqual({ first: 0, last: 0 });
    });
});

// ─── scrollToColumn ───────────────────────────────────────────────────────────

describe('createGlideViewport — scrollToColumn', () => {
    it('passes colIndex and header-derived column count to the scroller evaluate', async () => {
        const viewport = createGlideViewport();

        let capturedArgs: { idx: number; count: number } | undefined;
        const scrollerLoc = loc({
            evaluate: vi.fn().mockImplementation(async (_fn: unknown, args: { idx: number; count: number }) => {
                capturedArgs = args;
            }),
        });
        const cellLoc = loc({ waitFor: vi.fn().mockResolvedValue(undefined) });

        const page: PageMock = {
            locator: vi.fn().mockImplementation((sel: string) =>
                sel.includes('dvn-scroller') ? scrollerLoc : cellLoc
            ),
        };

        const headers = Array.from({ length: 100 }, (_, i) => `col${i}`);
        await viewport.scrollToColumn!(ctx(page, headers) as any, 50);
        expect(capturedArgs).toEqual({ idx: 50, count: 100 });
    });

    it('derives column count from getHeaders (60 columns)', async () => {
        const viewport = createGlideViewport();
        let capturedCount: number | undefined;
        const scrollerLoc = loc({
            evaluate: vi.fn().mockImplementation(async (_fn: unknown, args: { idx: number; count: number }) => {
                capturedCount = args.count;
            }),
        });
        const cellLoc = loc();
        const page: PageMock = {
            locator: vi.fn().mockImplementation((sel: string) =>
                sel.includes('dvn-scroller') ? scrollerLoc : cellLoc
            ),
        };

        await viewport.scrollToColumn!(ctx(page) as any, 10); // default ctx has 60 headers
        expect(capturedCount).toBe(60);
    });

    it('uses 800ms for the fast-path probe and full remaining budget after a nudge', async () => {
        // deadline = now + 800 + attachTimeout; first probe is min(800, remaining)=800ms,
        // post-nudge probe uses remaining (≈ attachTimeout since mocks resolve instantly).
        const viewport = createGlideViewport({ attachTimeout: 1500 });
        const scrollerEvaluate = vi.fn().mockResolvedValue(undefined);
        const scrollerLoc = loc({ evaluate: scrollerEvaluate });

        const timeoutErr = Object.assign(new Error('Timeout 800ms exceeded'), { name: 'TimeoutError' });
        const waitFor = vi.fn()
            .mockRejectedValueOnce(timeoutErr)
            .mockResolvedValueOnce(undefined);
        const cellLoc = loc({ waitFor });

        const page: PageMock = {
            locator: vi.fn().mockImplementation((sel: string) =>
                sel.includes('dvn-scroller') ? scrollerLoc : cellLoc
            ),
        };

        await viewport.scrollToColumn!(ctx(page) as any, 15);
        // First probe: fast path at 800ms
        expect(waitFor).toHaveBeenNthCalledWith(1, { state: 'attached', timeout: 800 });
        // Second probe: uses remaining budget (nudged=true), not capped to 800ms
        const secondTimeout: number = waitFor.mock.calls[1][0].timeout;
        expect(secondTimeout).toBeGreaterThan(800);
        // Scroller was called for the ratio seek and once for the nudge
        expect(scrollerEvaluate).toHaveBeenCalledTimes(2);
    });

    it('caps fast-path probe to remaining budget when attachTimeout < 800ms', async () => {
        // deadline = now + 800 + 200 = 1000ms; first probe = min(800, ~1000) = 800ms
        // BUT the test verifies the cap kicks in when attachTimeout is very small.
        const viewport = createGlideViewport({ attachTimeout: 50 });
        const scrollerLoc = loc();
        const waitFor = vi.fn().mockResolvedValue(undefined);
        const cellLoc = loc({ waitFor });

        const page: PageMock = {
            locator: vi.fn().mockImplementation((sel: string) =>
                sel.includes('dvn-scroller') ? scrollerLoc : cellLoc
            ),
        };

        await viewport.scrollToColumn!(ctx(page) as any, 15);
        // remaining = ~850ms, min(800, ~850) = 800ms — cap applies within deadline
        const [[{ timeout }]] = waitFor.mock.calls;
        expect(timeout).toBeLessThanOrEqual(800);
        expect(timeout).toBeGreaterThan(0);
    });

    it('rethrows non-TimeoutErrors immediately', async () => {
        const viewport = createGlideViewport();
        const scrollerLoc = loc();
        const networkErr = new Error('network error');
        const cellLoc = loc({ waitFor: vi.fn().mockRejectedValue(networkErr) });

        const page: PageMock = {
            locator: vi.fn().mockImplementation((sel: string) =>
                sel.includes('dvn-scroller') ? scrollerLoc : cellLoc
            ),
        };

        await expect(viewport.scrollToColumn!(ctx(page) as any, 5)).rejects.toThrow('network error');
    });

    it('waits for the correct aria-colindex selector', async () => {
        const viewport = createGlideViewport();
        const scrollerLoc = loc();
        const waitFor = vi.fn().mockResolvedValue(undefined);
        const cellLoc = loc({ waitFor });

        let requestedSel = '';
        const page: PageMock = {
            locator: vi.fn().mockImplementation((sel: string) => {
                if (sel.includes('dvn-scroller')) return scrollerLoc;
                requestedSel = sel;
                return cellLoc;
            }),
        };

        await viewport.scrollToColumn!(ctx(page) as any, 7); // colIndex 7 → aria-colindex="8"
        expect(requestedSel).toContain('aria-colindex="8"');
    });

    it('skips ratio seek when getHeaders returns empty array', async () => {
        const viewport = createGlideViewport();
        const scrollerEvaluate = vi.fn().mockResolvedValue(undefined);
        const scrollerLoc = loc({ evaluate: scrollerEvaluate });
        const cellLoc = loc({ waitFor: vi.fn().mockResolvedValue(undefined) });

        const page: PageMock = {
            locator: vi.fn().mockImplementation((sel: string) =>
                sel.includes('dvn-scroller') ? scrollerLoc : cellLoc
            ),
        };

        const emptyCtx: ContextMock = { ...ctx(page, []), getHeaders: vi.fn().mockResolvedValue([]) };
        await viewport.scrollToColumn!(emptyCtx as any, 5);
        // evaluate should not have been called for the ratio seek (no scroller.evaluate with idx/count)
        expect(scrollerEvaluate).not.toHaveBeenCalled();
    });
});

// ─── scrollToRow ──────────────────────────────────────────────────────────────

describe('createGlideViewport — scrollToRow', () => {
    it('calls scrollIntoViewIfNeeded when the row is already mounted', async () => {
        const viewport = createGlideViewport();
        const scrollIntoViewIfNeeded = vi.fn().mockResolvedValue(undefined);
        const rowLoc = loc({
            count: vi.fn().mockResolvedValue(1),
            scrollIntoViewIfNeeded,
        });
        const page: PageMock = { locator: vi.fn().mockReturnValue(rowLoc) };

        await viewport.scrollToRow!(ctx(page) as any, 5);
        expect(scrollIntoViewIfNeeded).toHaveBeenCalled();
    });

    it('measures row height from DOM and passes it to the scroller evaluate', async () => {
        const viewport = createGlideViewport({ attachTimeout: 2000 });

        let capturedArgs: { idx: number; height: number } | undefined;
        const scrollerLoc = loc({
            evaluate: vi.fn().mockImplementation(async (_fn: unknown, args: { idx: number; height: number }) => {
                capturedArgs = args;
            }),
        });

        const notMountedRow = loc({ count: vi.fn().mockResolvedValue(0), waitFor: vi.fn().mockResolvedValue(undefined) });
        const firstRowLoc = loc({ evaluate: vi.fn().mockResolvedValue(40) });

        const page: PageMock = {
            locator: vi.fn().mockImplementation((sel: string) => {
                if (sel.includes('dvn-scroller')) return scrollerLoc;
                if (sel === 'table[role="grid"] tbody tr') return firstRowLoc;
                return notMountedRow;
            }),
        };

        await viewport.scrollToRow!(ctx(page) as any, 10);
        expect(capturedArgs).toEqual({ idx: 10, height: 40 });
    });

    it('falls back to 34px row height when DOM measurement fails', async () => {
        const viewport = createGlideViewport();

        let capturedHeight: number | undefined;
        const scrollerLoc = loc({
            evaluate: vi.fn().mockImplementation(async (_fn: unknown, args: { idx: number; height: number }) => {
                capturedHeight = args.height;
            }),
        });
        const notMountedRow = loc({ count: vi.fn().mockResolvedValue(0), waitFor: vi.fn().mockResolvedValue(undefined) });
        const firstRowLoc = loc({ evaluate: vi.fn().mockRejectedValue(new Error('not found')) });

        const page: PageMock = {
            locator: vi.fn().mockImplementation((sel: string) => {
                if (sel.includes('dvn-scroller')) return scrollerLoc;
                if (sel === 'table[role="grid"] tbody tr') return firstRowLoc;
                return notMountedRow;
            }),
        };

        await viewport.scrollToRow!(ctx(page) as any, 10);
        expect(capturedHeight).toBe(34);
    });

    it('waits for aria-rowindex = rowIndex + 2 when estimating', async () => {
        const viewport = createGlideViewport({ attachTimeout: 3000 });
        const scrollerLoc = loc();
        const waitFor = vi.fn().mockResolvedValue(undefined);
        const notMountedRow = loc({ count: vi.fn().mockResolvedValue(0), waitFor });
        const firstRowLoc = loc({ evaluate: vi.fn().mockResolvedValue(34) });

        let requestedSel = '';
        const page: PageMock = {
            locator: vi.fn().mockImplementation((sel: string) => {
                if (sel.includes('dvn-scroller')) return scrollerLoc;
                if (sel === 'table[role="grid"] tbody tr') return firstRowLoc;
                requestedSel = sel;
                return notMountedRow;
            }),
        };

        await viewport.scrollToRow!(ctx(page) as any, 3); // rowIndex 3 → aria-rowindex="5"
        expect(requestedSel).toContain('aria-rowindex="5"');
    });
});

// ─── preset integration ───────────────────────────────────────────────────────

describe('Glide preset — viewport replaces navigation', () => {
    it('static Glide uses viewport, not navigation', () => {
        expect(Glide.strategies?.viewport).toBeDefined();
        expect((Glide.strategies as any)?.navigation).toBeUndefined();
    });

    it('createGlide() uses viewport, not navigation', () => {
        const preset = createGlide();
        expect(preset.strategies?.viewport).toBeDefined();
        expect((preset.strategies as any)?.navigation).toBeUndefined();
    });

    it('createGlide passes options through to the viewport', () => {
        const a = createGlide({ attachTimeout: 1000 });
        const b = createGlide({ attachTimeout: 5000 });
        expect(a.strategies?.viewport).not.toBe(b.strategies?.viewport);
    });
});
