import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDebugDelay, debugDelay, logDebug, warnIfDebugInCI } from '../../src/utils/debugUtils';

// ─── Mock ElementTracker so tests don't need a browser ───────────────────────
// getUnseenIndices is stubbed to return [0, 1, ...pageRows.length-1] on first
// call and [] on subsequent calls (simulates: first page = all rows, then done).
vi.mock('../../src/utils/elementTracker', () => {
  return {
    ElementTracker: class {
      private _called = false;
      async getUnseenIndices(locators: any) {
        if (this._called) return [];
        this._called = true;
        // Return indices 0..n-1 matching how many rows the env exposes via .all()
        const rows = await locators.all();
        return rows.map((_: any, i: number) => i);
      }
      async cleanup() { }
    }
  };
});

// Import AFTER mock is declared (vi.mock is hoisted but imports are resolved post-hoist)
import { runForEach, runMap, runFilter } from '../../src/engine/tableIteration';
import type { TableIterationEnv } from '../../src/engine/tableIteration';
import type { FinalTableConfig } from '../../src/types';

// ─── debugUtils baseline tests ────────────────────────────────────────────────

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
    vi.advanceTimersByTime(60);
    await p;
    vi.useRealTimers();
  });

  it('logDebug respects logLevel and prints messages', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => { });
    logDebug({ debug: { logLevel: 'info' } } as any, 'info', 'hello', { foo: 'bar' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logDebug with verbose prints verbose messages', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => { });
    logDebug({ debug: { logLevel: 'verbose' } } as any, 'verbose', 'detail');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('warnIfDebugInCI warns when CI=true and slow is set', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => { });
    process.env.CI = 'true';
    warnIfDebugInCI({ debug: { slow: 100 } } as any);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    delete process.env.CI;
  });
});

// ─── Iteration engine verbose logging tests ───────────────────────────────────

function makeVerboseConfig(overrides: Partial<FinalTableConfig> = {}): FinalTableConfig {
  return {
    rowSelector: 'tr',
    headerSelector: 'th',
    cellSelector: 'td',
    maxPages: 1,
    autoScroll: false,
    headerTransformer: ({ text }: any) => text,
    onReset: async () => { },
    strategies: {},
    debug: { logLevel: 'verbose' },
    ...overrides,
  } as any;
}

/**
 * Build a minimal TableIterationEnv with fake rows.
 * getRowLocators() returns an object whose .all() resolves to fake row objects.
 * The mocked ElementTracker (above) will return all indices on the first call, [] thereafter.
 */
function makeEnv(
  rowData: Record<string, string>[],
  config: FinalTableConfig,
  pagesTotal = 1,
  dedupeStrategy?: (row: any) => Promise<string>
): TableIterationEnv<any> {
  let pagesAdvanced = 0;

  if (dedupeStrategy) {
    (config as any).strategies = { dedupe: dedupeStrategy };
  }

  return {
    getRowLocators: () => ({
      all: async () => rowData.map((data, i) => ({ _data: data, _index: i })),
    }) as any,
    getMap: () => new Map([['Name', 0]]),
    advancePage: async () => {
      pagesAdvanced++;
      return pagesAdvanced < pagesTotal;
    },
    makeSmartRow: (_loc: any, _map: any, idx: number) =>
      ({ rowIndex: idx, getCell: () => ({}), toJSON: async () => rowData[idx] }) as any,
    createSmartRowArray: (arr: any[]) => arr as any,
    config,
    getPage: () => ({ evaluate: async () => { } } as any),
  };
}

describe('Iteration engine verbose logging', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let loggedMessages: string[];

  beforeEach(() => {
    loggedMessages = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      loggedMessages.push(args.join(' '));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('runMap emits "map: starting" under verbose', async () => {
    const env = makeEnv([], makeVerboseConfig());
    await runMap(env, async () => 'x');
    expect(loggedMessages.some(m => m.includes('map: starting'))).toBe(true);
  });

  it('runMap emits "map: complete" under verbose', async () => {
    const env = makeEnv([], makeVerboseConfig());
    await runMap(env, async () => 'x');
    expect(loggedMessages.some(m => m.includes('map: complete'))).toBe(true);
  });

  it('runForEach emits "forEach: starting" under verbose', async () => {
    const env = makeEnv([], makeVerboseConfig());
    await runForEach(env, async () => { });
    expect(loggedMessages.some(m => m.includes('forEach: starting'))).toBe(true);
  });

  it('runForEach emits "forEach: complete" under verbose', async () => {
    const env = makeEnv([], makeVerboseConfig());
    await runForEach(env, async () => { });
    expect(loggedMessages.some(m => m.includes('forEach: complete'))).toBe(true);
  });

  it('runFilter emits "filter: starting" and "filter: complete" under verbose', async () => {
    const env = makeEnv([], makeVerboseConfig());
    await runFilter(env, async () => true);
    expect(loggedMessages.some(m => m.includes('filter: starting'))).toBe(true);
    expect(loggedMessages.some(m => m.includes('filter: complete'))).toBe(true);
  });

  it('runForEach emits "stop() called" when stop is invoked', async () => {
    const env = makeEnv([{ Name: 'A' }, { Name: 'B' }], makeVerboseConfig());
    await runForEach(env, async ({ stop }) => {
      stop();
    });
    expect(loggedMessages.some(m => m.includes('stop() called'))).toBe(true);
  });

  it('runForEach emits "advancing to next page" when multiple pages configured', async () => {
    const env = makeEnv([], makeVerboseConfig({ maxPages: 2 } as any), 2);
    await runForEach(env, async () => { });
    expect(loggedMessages.some(m => m.includes('advancing to next page'))).toBe(true);
  });

  it('runMap logs no [SmartTable] messages under logLevel "none"', async () => {
    const config = makeVerboseConfig();
    (config as any).debug = { logLevel: 'none' };
    const env = makeEnv([], config);
    await runMap(env, async () => 'x');
    const smartTableLogs = loggedMessages.filter(m => m.includes('[SmartTable]'));
    expect(smartTableLogs.length).toBe(0);
  });

  it('runForEach emits "dedupe skip" when dedupe key is repeated', async () => {
    const dedupeStrategy = async (_row: any) => 'same-key';
    const config = makeVerboseConfig();
    const env = makeEnv([{ Name: 'A' }, { Name: 'B' }], config, 1, dedupeStrategy);
    await runForEach(env, async () => { });
    expect(loggedMessages.some(m => m.includes('dedupe skip'))).toBe(true);
  });
});
