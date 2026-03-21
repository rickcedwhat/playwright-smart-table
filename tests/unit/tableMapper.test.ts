import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TableMapper } from '../../src/engine/tableMapper';
import { FinalTableConfig, HeaderStrategy } from '../../src/types';
import { Locator, Page } from '@playwright/test';

describe('TableMapper', () => {
    let mockConfig: FinalTableConfig;
    let mockRoot: Locator;
    let mockResolve: any;
    let mockHeaderLocator: any;

    beforeEach(() => {
        mockHeaderLocator = {
            first: vi.fn().mockReturnValue({
                waitFor: vi.fn().mockResolvedValue(undefined)
            }),
            nth: vi.fn().mockReturnValue({
                innerText: vi.fn().mockResolvedValue('Mock Header Content')
            })
        };

        mockResolve = vi.fn().mockReturnValue(mockHeaderLocator);

        mockRoot = {
            locator: vi.fn().mockReturnValue(mockHeaderLocator),
            page: vi.fn().mockReturnValue({} as Page),
            scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined)
        } as unknown as Locator;

        mockConfig = {
            headerSelector: 'thead th',
            strategies: {
                loading: {} // disable smart loading for unit test simplicity
            }
        } as FinalTableConfig;
    });

    const createMapper = () => new TableMapper(mockRoot, mockConfig, mockResolve);

    it('should map headers correctly', async () => {
        // Mock strategy returning headers
        mockConfig.strategies.header = vi.fn().mockResolvedValue(['ID', 'Name', 'Email']);

        const mapper = createMapper();
        const map = await mapper.getMap();

        expect(map.size).toBe(3);
        expect(map.get('ID')).toBe(0);
        expect(map.get('Name')).toBe(1);
        expect(map.get('Email')).toBe(2);
    });

    it('should throw error if no headers found', async () => {
        mockConfig.strategies.header = vi.fn().mockResolvedValue([]);

        const mapper = createMapper();
        await expect(mapper.getMap(100)).rejects.toThrow(/No columns found/);
    });

    it('should throw error if duplicate headers found', async () => {
        mockConfig.strategies.header = vi.fn().mockResolvedValue(['ID', 'Name', 'ID']);

        const mapper = createMapper();
        await expect(mapper.getMap(100)).rejects.toThrow(/Duplicate column names found: "ID"/);
    });

    it('should use headerTransformer to rename columns', async () => {
        mockConfig.strategies.header = vi.fn().mockResolvedValue(['ID', 'Name', 'Name']);

        // Transformer that appends index to duplicates
        mockConfig.headerTransformer = vi.fn().mockImplementation(({ text, index, seenHeaders }) => {
            if (seenHeaders.has(text)) {
                return `${text}_${index}`;
            }
            return text;
        });

        const mapper = createMapper();
        const map = await mapper.getMap();

        expect(map.get('ID')).toBe(0);
        expect(map.get('Name')).toBe(1);
        expect(map.get('Name_2')).toBe(2);
    });

    it('should retry if mapping fails (simulating temporary failure)', async () => {
        const strategy = vi.fn()
            .mockRejectedValueOnce(new Error('DOM not ready'))
            .mockResolvedValue(['ID', 'Name']);

        mockConfig.strategies.header = strategy;

        const mapper = createMapper();
        const map = await mapper.getMap(1000); // Give it enough time to retry

        expect(map.size).toBe(2);
        expect(strategy).toHaveBeenCalledTimes(2);
    });

    it('should return cached map on subsequent calls', async () => {
        mockConfig.strategies.header = vi.fn().mockResolvedValue(['ID']);
        const mapper = createMapper();

        const map1 = await mapper.getMap();
        expect(mockConfig.strategies.header).toHaveBeenCalledTimes(1);

        const map2 = await mapper.getMap();
        expect(mockConfig.strategies.header).toHaveBeenCalledTimes(1); // Should not call again
        expect(map1).toBe(map2);

        // Verify synchronous access
        expect(mapper.getMapSync()).toBe(map1);
    });

    it('should check isHeaderLoading strategy', async () => {
        // First unstable, then stable
        const loadingStrategy = vi.fn()
            .mockResolvedValueOnce(true) // Loading (unstable)
            .mockResolvedValueOnce(false); // Not loading (stable)

        mockConfig.strategies.loading = {
            isHeaderLoading: loadingStrategy
        };
        mockConfig.strategies.header = vi.fn().mockResolvedValue(['ID']);

        const mapper = createMapper();
        await mapper.getMap(1000);

        expect(loadingStrategy).toHaveBeenCalledTimes(2);
    });
});


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
      headerTransformer: ({ text }: { text: string }) => text.trim().toUpperCase(),
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

