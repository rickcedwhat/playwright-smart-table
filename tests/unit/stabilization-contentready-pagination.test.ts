import { describe, it, expect, vi } from 'vitest';
import { StabilizationStrategies } from '../../src/strategies/stabilization';
import { ContentReadyStrategies } from '../../src/strategies/contentReady';
import { PaginationStrategies } from '../../src/strategies/pagination';
import type { TableContext } from '../../src/types';

function makeMockContext(overrides: Partial<TableContext> = {}): TableContext {
  return {
    root: {} as any,
    page: {
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
    } as any,
    resolve: vi.fn() as any,
    config: { rowSelector: 'tr', strategies: {} } as any,
    ...overrides,
  };
}

describe('StabilizationStrategies.contentChanged', () => {
  it('returns true when row text changes after action', async () => {
    const firstRow = {
      innerText: vi.fn()
        .mockResolvedValueOnce('before')
        .mockResolvedValueOnce('after'),
    };
    const rows = {
      first: () => firstRow,
      allInnerTexts: vi.fn(),
    };
    const ctx = makeMockContext({
      resolve: vi.fn().mockReturnValue(rows) as any,
    });
    const action = vi.fn().mockResolvedValue(undefined);
    const strategy = StabilizationStrategies.contentChanged({ scope: 'first', timeout: 500 });

    await expect(strategy(ctx, action)).resolves.toBe(true);
    expect(action).toHaveBeenCalledOnce();
  });

  it('returns false when fingerprint never changes', async () => {
    const rows = {
      first: () => ({
        innerText: vi.fn().mockResolvedValue('same'),
      }),
      allInnerTexts: vi.fn().mockResolvedValue(['same']),
    };
    const ctx = makeMockContext({
      resolve: vi.fn().mockReturnValue(rows) as any,
      page: {
        waitForTimeout: vi.fn().mockResolvedValue(undefined),
      } as any,
    });
    const strategy = StabilizationStrategies.contentChanged({ scope: 'first', timeout: 150 });

    await expect(strategy(ctx, async () => {})).resolves.toBe(false);
  });
});

describe('StabilizationStrategies.rowCountIncreased', () => {
  it('returns true when count rises', async () => {
    const rows = {
      count: vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(5),
    };
    const ctx = makeMockContext({
      resolve: vi.fn().mockReturnValue(rows) as any,
    });
    const strategy = StabilizationStrategies.rowCountIncreased({ timeout: 500 });

    await expect(strategy(ctx, async () => {})).resolves.toBe(true);
  });

  it('returns false when count stays the same', async () => {
    const rows = {
      count: vi.fn().mockResolvedValue(3),
    };
    const ctx = makeMockContext({
      resolve: vi.fn().mockReturnValue(rows) as any,
      page: { waitForTimeout: vi.fn().mockResolvedValue(undefined) } as any,
    });
    const strategy = StabilizationStrategies.rowCountIncreased({ timeout: 150 });

    await expect(strategy(ctx, async () => {})).resolves.toBe(false);
  });
});

describe('ContentReadyStrategies', () => {
  it('textStable resolves when consecutive reads match', async () => {
    const row = {
      innerText: vi.fn()
        .mockResolvedValueOnce('a')
        .mockResolvedValueOnce('b')
        .mockResolvedValueOnce('b'),
    };
    const page = { waitForTimeout: vi.fn().mockResolvedValue(undefined) };
    await ContentReadyStrategies.textStable({ timeout: 1000, interval: 10 })(row as any, page as any);
    expect(row.innerText.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('mutationSettled delegates to row.evaluate', async () => {
    const row = {
      evaluate: vi.fn().mockResolvedValue(undefined),
    };
    await ContentReadyStrategies.mutationSettled({ timeout: 200, quietPeriod: 50 })(row as any);
    expect(row.evaluate).toHaveBeenCalledOnce();
    expect(row.evaluate.mock.calls[0][1]).toEqual({ timeout: 200, quietPeriod: 50 });
  });

  describe('until (#487)', () => {
    const predicate = (el: HTMLElement | SVGElement, cls: string) => !el.querySelector(cls);
    const timeoutError = () => Object.assign(new Error('Timeout 50ms exceeded'), { name: 'TimeoutError' });

    it.each([0, -1, NaN, Infinity])('rejects timeout %s instead of allowing an unbounded native wait', (timeout) => {
      expect(() => ContentReadyStrategies.until(predicate, { timeout })).toThrow('timeout must be a positive finite number');
    });

    it.each([0, -1, NaN, Infinity])('rejects invalid polling interval %s', (interval) => {
      expect(() => ContentReadyStrategies.until(predicate, { interval })).toThrow('interval must be a positive finite number');
    });

    it('waits via locator.waitForFunction with the arg and timeout', async () => {
      const row = { waitForFunction: vi.fn().mockResolvedValue(undefined), evaluate: vi.fn() };
      await ContentReadyStrategies.until(predicate, { arg: '.skeleton', timeout: 300 })(row as any, {} as any);
      expect(row.waitForFunction).toHaveBeenCalledWith(predicate, '.skeleton', { timeout: 300 });
      expect(row.evaluate).not.toHaveBeenCalled();
    });

    it('falls back to polling row.evaluate when waitForFunction is missing (Playwright < 1.62)', async () => {
      const row = { evaluate: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true) };
      const page = { waitForTimeout: vi.fn().mockResolvedValue(undefined) };
      await ContentReadyStrategies.until(predicate, { arg: '.skeleton', timeout: 1000, interval: 10 })(row as any, page as any);
      expect(row.evaluate).toHaveBeenCalledTimes(2);
      expect(row.evaluate.mock.calls[0][1]).toBe('.skeleton');
      expect(page.waitForTimeout).toHaveBeenCalledOnce();
    });

    it('resolves when the predicate never passes before the timeout', async () => {
      const row = { waitForFunction: vi.fn().mockRejectedValue(timeoutError()) };
      await expect(ContentReadyStrategies.until(predicate, { timeout: 50 })(row as any, {} as any)).resolves.toBeUndefined();
    });

    it('bounds a pending fallback evaluation and leaves no deadline timer after completion', async () => {
      vi.useFakeTimers();
      try {
        const row = { evaluate: vi.fn().mockReturnValue(new Promise(() => {})) };
        const strategy = ContentReadyStrategies.until(() => true, { timeout: 50 });
        const assertion = expect(strategy(row as any, {} as any)).resolves.toBeUndefined();
        await vi.advanceTimersByTimeAsync(50);
        await assertion;
        expect(row.evaluate).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('clears the fallback deadline timer when the predicate succeeds or throws', async () => {
      vi.useFakeTimers();
      try {
        const page = { waitForTimeout: vi.fn() };
        const success = { evaluate: vi.fn().mockResolvedValue(true) };
        await ContentReadyStrategies.until(predicate)(success as any, page as any);
        expect(vi.getTimerCount()).toBe(0);
        const failure = { evaluate: vi.fn().mockRejectedValue(new TypeError('predicate failed')) };
        await expect(ContentReadyStrategies.until(predicate)(failure as any, page as any)).rejects.toThrow('predicate failed');
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('rethrows errors thrown by the predicate', async () => {
      const row = { waitForFunction: vi.fn().mockRejectedValue(new TypeError('row.children[1] is undefined')) };
      await expect(ContentReadyStrategies.until(predicate)(row as any, {} as any)).rejects.toThrow(TypeError);
    });
  });
});

describe('PaginationStrategies.click edge cases', () => {
  it('goNext returns false when next button is disabled', async () => {
    const btn = {
      first: vi.fn().mockReturnThis(),
      isVisible: vi.fn().mockResolvedValue(true),
      isEnabled: vi.fn().mockResolvedValue(false),
      click: vi.fn(),
    };
    const ctx = makeMockContext({
      resolve: vi.fn().mockReturnValue(btn) as any,
    });
    // Avoid contentChanged wait — use a no-op stabilizer
    const strategy = PaginationStrategies.click(
      { next: '#next' },
      { stabilization: async (_c, action) => { await action(); return true; } },
    );

    await expect(strategy.goNext!(ctx)).resolves.toBe(false);
    expect(btn.click).not.toHaveBeenCalled();
  });

  it('goToPage returns false when page number is outside the window', async () => {
    const pageBtn = {
      filter: vi.fn().mockReturnThis(),
      first: vi.fn().mockReturnThis(),
      isVisible: vi.fn().mockResolvedValue(false),
      isEnabled: vi.fn().mockResolvedValue(true),
      click: vi.fn(),
    };
    const ctx = makeMockContext({
      resolve: vi.fn().mockReturnValue(pageBtn) as any,
    });
    const strategy = PaginationStrategies.click(
      { pageNumbers: '.page' },
      { stabilization: async (_c, action) => { await action(); return true; } },
    );

    await expect(strategy.goToPage!(5, ctx)).resolves.toBe(false);
    expect(pageBtn.click).not.toHaveBeenCalled();
  });
});
