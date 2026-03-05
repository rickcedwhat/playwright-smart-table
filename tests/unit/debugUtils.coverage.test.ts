import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDebugDelay, debugDelay, logDebug, warnIfDebugInCI } from '../../src/utils/debugUtils';

describe('debugUtils', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getDebugDelay returns numbers from config', () => {
    const cfg1: any = {};
    expect(getDebugDelay(cfg1, 'default')).toBe(0);

    const cfg2: any = { debug: { slow: 100 } };
    expect(getDebugDelay(cfg2, 'pagination')).toBe(100);

    const cfg3: any = { debug: { slow: { pagination: 50, default: 5 } } };
    expect(getDebugDelay(cfg3, 'pagination')).toBe(50);
    expect(getDebugDelay(cfg3, 'getCell')).toBe(5);
  });

  it('debugDelay awaits when delay > 0', async () => {
    const cfg: any = { debug: { slow: 1 } };
    const start = Date.now();
    await debugDelay(cfg, 'default');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(1);
  });

  it('logDebug respects levels', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const cfg: any = { debug: { logLevel: 'info' } };
    logDebug(cfg, 'info', 'info-msg', { a: 1 });
    expect(spy).toHaveBeenCalled();
    spy.mockClear();
    logDebug(cfg, 'verbose', 'verbose-msg');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('warnIfDebugInCI warns when CI=true', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const original = process.env.CI;
    process.env.CI = 'true';
    const cfg: any = { debug: { slow: 1 } };
    warnIfDebugInCI(cfg);
    expect(spy).toHaveBeenCalled();
    process.env.CI = original;
    spy.mockRestore();
  });
});

