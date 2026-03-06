import { describe, it, expect, vi } from 'vitest';
import { getDebugDelay, debugDelay, logDebug, warnIfDebugInCI } from '../../src/utils/debugUtils';

describe('debugUtils (merged)', () => {
  it('getDebugDelay returns correct values for various configs', () => {
    const cfg1: any = {};
    expect(getDebugDelay(cfg1, 'default')).toBe(0);

    const cfg2: any = { debug: { slow: 100 } };
    expect(getDebugDelay(cfg2, 'pagination')).toBe(100);

    const cfg3: any = { debug: { slow: { pagination: 50, default: 5 } } };
    expect(getDebugDelay(cfg3, 'pagination')).toBe(50);
    expect(getDebugDelay(cfg3, 'getCell')).toBe(5);
  });

  it('debugDelay waits when delay > 0 (deterministic via fake timers)', async () => {
    vi.useFakeTimers();
    const p = debugDelay({ debug: { slow: 50 } } as any, 'default');
    // fast-forward
    vi.advanceTimersByTime(60);
    await p;
    vi.useRealTimers();
  });

  it('logDebug respects logLevel and prints messages', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logDebug({ debug: { logLevel: 'info' } } as any, 'info', 'hello', { foo: 'bar' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logDebug with verbose prints verbose messages', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logDebug({ debug: { logLevel: 'verbose' } } as any, 'verbose', 'detail');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('warnIfDebugInCI warns when CI=true and slow is set', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.CI = 'true';
    warnIfDebugInCI({ debug: { slow: 100 } } as any);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    delete process.env.CI;
  });
});

