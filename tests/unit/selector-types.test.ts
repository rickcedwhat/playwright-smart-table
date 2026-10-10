import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cssSelectorOrWarn, UNKNOWN_RANGE } from '../../src/utils/cssSelector';
import { ViewportStrategies } from '../../src/strategies/viewport';
import { muiDataGrid } from '../../src/presets/mui';

const fnSelector = (root: any) => root.locator('.row');

describe('selector types', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  describe('cssSelectorOrWarn', () => {
    it('returns a string selector without warning', () => {
      expect(cssSelectorOrWarn({ rowSelector: 'tbody tr' }, 'rowSelector', 'feature')).toBe('tbody tr');
      expect(warn).not.toHaveBeenCalled();
    });

    it('returns null and warns once per config + feature for a function selector', () => {
      const config = { rowSelector: fnSelector };
      expect(cssSelectorOrWarn(config, 'rowSelector', 'A')).toBeNull();
      expect(cssSelectorOrWarn(config, 'rowSelector', 'A')).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('A needs rowSelector to be a CSS string');

      cssSelectorOrWarn(config, 'rowSelector', 'B');
      cssSelectorOrWarn({ rowSelector: fnSelector }, 'rowSelector', 'A');
      expect(warn).toHaveBeenCalledTimes(3);
    });
  });

  describe('dataAttribute viewport with a function rowSelector', () => {
    const makeContext = (rowCount = 3) => {
      const root = { evaluate: vi.fn(), locator: vi.fn() };
      const resolve = vi.fn(() => ({ count: async () => rowCount }));
      return {
        root,
        resolve,
        ctx: { root, resolve, config: { rowSelector: fnSelector, headerSelector: 'th', cellSelector: 'td' } } as any,
      };
    };

    it('reports unknown ranges instead of evaluating a function in the browser', async () => {
      const vp = ViewportStrategies.dataAttribute({ scrollContainer: '.scroller' });
      const { root, ctx } = makeContext();
      expect(await vp.getVisibleRowRange!(ctx)).toEqual(UNKNOWN_RANGE);
      expect(await vp.getVisibleColumnRange!(ctx)).toEqual(UNKNOWN_RANGE);
      expect(root.evaluate).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
    });

    it('keeps every row for overscan filtering', async () => {
      const vp = ViewportStrategies.dataAttribute({ scrollContainer: '.scroller' });
      const { ctx, resolve } = makeContext(4);
      expect(await vp.getVisibleRowIndices!(ctx)).toEqual([0, 1, 2, 3]);
      expect(resolve).toHaveBeenCalledWith(fnSelector, ctx.root);
    });

    it('skips scrollToRow', async () => {
      const vp = ViewportStrategies.dataAttribute({ scrollContainer: '.scroller' });
      const { root, ctx } = makeContext();
      await vp.scrollToRow!(ctx, 10);
      expect(root.evaluate).not.toHaveBeenCalled();
      expect(root.locator).not.toHaveBeenCalled();
    });
  });

  describe('MUI DataGrid viewport with function selectors', () => {
    it('falls back to [data-rowindex] for logical row ranges', async () => {
      const root = { evaluate: vi.fn(async () => ({ first: 2, last: 9 })) };
      const vp = muiDataGrid.strategies!.viewport!;
      const range = await vp.getVisibleRowRange!({ root, config: { rowSelector: fnSelector } } as any);
      expect(range).toEqual({ first: 2, last: 9 });
      expect(root.evaluate).toHaveBeenCalledWith(expect.any(Function), '[data-rowindex]');
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
