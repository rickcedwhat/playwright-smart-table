import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDebugDelay, debugDelay, logDebug, warnIfDebugInCI } from '../../src/utils/debugUtils';

describe('debugUtils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.CI;
  });

  it('getDebugDelay returns 0 when no debug config', () => {
    expect(getDebugDelay({} as any, 'default')).toBe(0);
  });

  it('getDebugDelay returns number when slow is number', () => {
    expect(getDebugDelay({ debug: { slow: 300 } } as any, 'pagination')).toBe(300);
  });

  it('getDebugDelay returns per-action when slow is object', () => {
    expect(getDebugDelay({ debug: { slow: { pagination: 100, default: 5 } } } as any, 'pagination')).toBe(100);
    expect(getDebugDelay({ debug: { slow: { pagination: 100, default: 5 } } } as any, 'getCell')).toBe(5);
  });

  it('debugDelay waits when delay > 0', async () => {
    const p = debugDelay({ debug: { slow: 50 } } as any, 'default');
    // fast-forward
    vi.advanceTimersByTime(60);
    await p;
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
    process.env.CI = 'true';
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnIfDebugInCI({ debug: { slow: 100 } } as any);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

