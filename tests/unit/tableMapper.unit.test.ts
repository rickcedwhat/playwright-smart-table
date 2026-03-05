import { describe, it, expect, vi } from 'vitest';
import { TableMapper } from '../../src/engine/tableMapper';

describe('TableMapper.processHeaders/getMap', () => {
  const makeRootLocator = () => {
    return {
      scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
      page: () => ({}),
    } as any;
  };

  const makeResolve = (rawHeaders: string[]) => {
    // resolve should return a locator-like object whose first().waitFor is callable
    return (sel: any, parent: any) => {
      return {
        first: () => ({ waitFor: async (_: any) => { /* no-op */ } }),
        nth: (i: number) => ({ _nth: i }),
      } as any;
    };
  };

  it('maps headers and applies headerTransformer', async () => {
    const root = makeRootLocator();
    const cfg: any = {
      headerSelector: 'th',
      cellSelector: 'td',
      autoScroll: false,
      strategies: { header: async () => [' A ', 'B'] },
      headerTransformer: ({ text }) => text.trim().toUpperCase(),
    };
    const mapper = new TableMapper(root, cfg, makeResolve(['A', 'B']));
    const map = await mapper.getMap();
    expect(map.get('A')).toBe(0);
    expect(map.get('B')).toBe(1);
    expect(map.size).toBe(2);
  });

  it('throws when no headers found', async () => {
    const root = makeRootLocator();
    const cfg: any = {
      headerSelector: 'th',
      cellSelector: 'td',
      autoScroll: false,
      strategies: { header: async () => [] },
    };
    const mapper = new TableMapper(root, cfg, makeResolve([]));
    await expect(mapper.getMap()).rejects.toThrow(/No columns found/);
  });

  it('throws on duplicate headers', async () => {
    const root = makeRootLocator();
    const cfg: any = {
      headerSelector: 'th',
      cellSelector: 'td',
      autoScroll: false,
      strategies: { header: async () => ['X', 'X'] },
    };
    const mapper = new TableMapper(root, cfg, makeResolve(['X', 'X']));
    await expect(mapper.getMap()).rejects.toThrow(/Duplicate column names/);
  });

  it('remapHeaders resets internal map', async () => {
    const root = makeRootLocator();
    const cfg: any = {
      headerSelector: 'th',
      cellSelector: 'td',
      autoScroll: false,
      strategies: { header: async () => ['One'] },
    };
    const mapper = new TableMapper(root, cfg, makeResolve(['One']));
    const m1 = await mapper.getMap();
    expect(mapper.isInitialized()).toBe(true);
    mapper.clear();
    expect(mapper.isInitialized()).toBe(false);
    await mapper.remapHeaders();
    expect(mapper.isInitialized()).toBe(true);
  });
});

