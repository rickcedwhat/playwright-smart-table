import { describe, it, expect, vi } from 'vitest';
import { StabilizationStrategies } from '../../src/strategies/stabilization';
import type { TableContext } from '../../src/types';

function makeMockContext(overrides: Partial<TableContext> = {}): TableContext {
  return {
    root: {} as any,
    page: {
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
    } as any,
    resolve: vi.fn() as any,
    config: { strategies: {} } as any,
    ...overrides,
  };
}

// Bug #102: StabilizationStrategies.networkIdle never calls action()
// The inner async function was missing the `action` parameter entirely.
describe('StabilizationStrategies.networkIdle', () => {
  it('calls action() (fallback path, no spinnerSelector)', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    const ctx = makeMockContext();
    const strategy = StabilizationStrategies.networkIdle();

    await strategy(ctx, action);

    expect(action).toHaveBeenCalledOnce();
  });

  it('calls action() when spinnerSelector is provided', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    const mockSpinner = { waitFor: vi.fn().mockResolvedValue(undefined) };
    const ctx = makeMockContext({
      resolve: vi.fn().mockReturnValue(mockSpinner) as any,
    });
    const strategy = StabilizationStrategies.networkIdle({ spinnerSelector: '.loading-spinner' });

    await strategy(ctx, action);

    expect(action).toHaveBeenCalledOnce();
    expect(mockSpinner.waitFor).toHaveBeenCalledWith({ state: 'detached', timeout: 5000 });
  });

  it('still returns true after calling action()', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    const ctx = makeMockContext();
    const strategy = StabilizationStrategies.networkIdle();

    const result = await strategy(ctx, action);

    expect(result).toBe(true);
  });
});
