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

describe('StabilizationStrategies.contentChanged (#432)', () => {
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

describe('StabilizationStrategies.rowCountIncreased (#432)', () => {
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

describe('ContentReadyStrategies (#432)', () => {
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
});

describe('PaginationStrategies.click edge cases (#432)', () => {
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
