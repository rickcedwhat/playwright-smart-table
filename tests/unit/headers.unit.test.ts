import { describe, it, expect, vi } from 'vitest';
import { HeaderStrategies } from '../../src/strategies/headers';
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
