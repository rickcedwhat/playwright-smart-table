import { describe, it, expect, vi } from 'vitest';
import { HeaderStrategies } from '../../src/strategies/headers';
import { scrollRightHeader } from '../../src/presets/glide/headers';
import type { StrategyContext } from '../../src/types';

describe('HeaderStrategies.visible', () => {
  it('returns trimmed header texts when waitFor succeeds', async () => {
    const headerLoc: any = {
      first: vi.fn().mockReturnThis(),
      waitFor: vi.fn().mockResolvedValue(undefined),
      allInnerTexts: vi.fn().mockResolvedValue([' A ', ' B ']),
    };

    const resolve = vi.fn().mockReturnValue(headerLoc);
    const ctx: StrategyContext = { config: { headerSelector: 'th' } as any, resolve, root: {} as any, page: {} as any };

    const res = await HeaderStrategies.visible(ctx as any);
    expect(res).toEqual(['A', 'B']);
    expect(headerLoc.first).toHaveBeenCalled();
    expect(headerLoc.allInnerTexts).toHaveBeenCalled();
  });

  it('handles waitFor throwing and still returns texts', async () => {
    const headerLoc: any = {
      first: vi.fn().mockReturnThis(),
      waitFor: vi.fn().mockRejectedValue(new Error('timeout')),
      allInnerTexts: vi.fn().mockResolvedValue(['X']),
    };

    const resolve = vi.fn().mockReturnValue(headerLoc);
    const ctx: StrategyContext = { config: { headerSelector: 'th' } as any, resolve, root: {} as any, page: {} as any };

    const res = await HeaderStrategies.visible(ctx as any);
    expect(res).toEqual(['X']);
    expect(headerLoc.waitFor).toHaveBeenCalled();
  });
});

describe('HeaderStrategies.horizontalScroll', () => {
  it('returns visible headers only when selector is omitted (#431)', async () => {
    const headerLoc: any = {
      allInnerTexts: vi.fn().mockResolvedValue(['ColA', 'ColB']),
    };
    const evaluateHandle = vi.fn();
    const root: any = { evaluateHandle };
    const resolve = vi.fn().mockReturnValue(headerLoc);
    const ctx: StrategyContext = {
      config: { headerSelector: 'th', debug: { logLevel: 'none' } } as any,
      resolve,
      root,
      page: { waitForTimeout: vi.fn() } as any,
    };

    const res = await HeaderStrategies.horizontalScroll()(ctx as any);
    expect(res).toEqual(['ColA', 'ColB']);
    expect(evaluateHandle).not.toHaveBeenCalled();
  });

  it('looks up the explicit selector when provided', async () => {
    const headerLoc: any = {
      allInnerTexts: vi.fn().mockResolvedValue(['Visible']),
    };
    const scrollerHandle = {
      evaluate: vi.fn()
        .mockResolvedValueOnce(false), // isScrollerFound
    };
    const evaluateHandle = vi.fn().mockResolvedValue(scrollerHandle);
    const root: any = { evaluateHandle };
    const resolve = vi.fn().mockReturnValue(headerLoc);
    const ctx: StrategyContext = {
      config: { headerSelector: 'th', debug: { logLevel: 'none' } } as any,
      resolve,
      root,
      page: { waitForTimeout: vi.fn() } as any,
    };

    const res = await HeaderStrategies.horizontalScroll({ selector: '.dvn-scroller' })(ctx as any);
    expect(res).toEqual(['Visible']);
    expect(evaluateHandle).toHaveBeenCalledWith(expect.any(Function), '.dvn-scroller');
  });
});

// A fake scroller whose visible headers depend on scrollLeft (3 columns per 300px window).
const makeScrollingContext = (columnCount: number) => {
  const el = { scrollLeft: 0 };
  const visible = () => {
    const first = Math.floor(el.scrollLeft / 100);
    return Array.from({ length: 3 }, (_, i) => first + i)
      .filter(i => i < columnCount)
      .map(i => `Col${i}`);
  };
  const scrollerHandle = {
    evaluate: vi.fn(async (fn: any, arg?: any) => fn(el, arg)),
  };
  const evaluateHandle = vi.fn().mockResolvedValue(scrollerHandle);
  const ctx: StrategyContext = {
    config: { headerSelector: 'th', debug: { logLevel: 'none' } } as any,
    resolve: vi.fn().mockReturnValue({ allInnerTexts: vi.fn(async () => visible()) }),
    root: { evaluateHandle } as any,
    page: { waitForTimeout: vi.fn() } as any,
  };
  return { ctx, el, evaluateHandle };
};

describe('shared horizontal header scroll (#439)', () => {
  it('HeaderStrategies.horizontalScroll collects every column and scrolls back to the start', async () => {
    const { ctx, el } = makeScrollingContext(8);
    const res = await HeaderStrategies.horizontalScroll({ selector: '.scroller', scrollAmount: 300 })(ctx as any);
    expect(res).toEqual(['Col0', 'Col1', 'Col2', 'Col3', 'Col4', 'Col5', 'Col6', 'Col7']);
    expect(el.scrollLeft).toBe(0);
  });

  it('Glide scrollRightHeader uses the same loop and defaults to .dvn-scroller', async () => {
    const { ctx, el, evaluateHandle } = makeScrollingContext(5);
    const res = await scrollRightHeader(ctx, { scrollAmount: 300 });
    expect(res).toEqual(['Col0', 'Col1', 'Col2', 'Col3', 'Col4']);
    expect(el.scrollLeft).toBe(0);
    expect(evaluateHandle).toHaveBeenCalledWith(expect.any(Function), undefined);
  });

  it('Glide lookup falls back to a document-wide search when the scroller is a sibling', async () => {
    const { ctx, evaluateHandle } = makeScrollingContext(1);
    await scrollRightHeader(ctx);
    const lookup = evaluateHandle.mock.calls[0][0];
    const sibling = { id: 'scroller' };
    const querySelector = vi.fn().mockReturnValue(sibling);
    vi.stubGlobal('document', { querySelector });
    const canvas = { matches: () => false, closest: () => null };
    expect(lookup(canvas, undefined)).toBe(sibling);
    expect(querySelector).toHaveBeenCalledWith('.dvn-scroller');
    vi.unstubAllGlobals();
  });
});
