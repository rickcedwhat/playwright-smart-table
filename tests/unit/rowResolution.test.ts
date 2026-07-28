import { describe, it, expect, vi } from 'vitest';
import { normalizeRowIndexResult, resolveLogicalRowIndex } from '../../src/engine/rowResolution';
import type { FinalTableConfig } from '../../src/types';

describe('normalizeRowIndexResult', () => {
  it('wraps a plain number into { index }', () => {
    expect(normalizeRowIndexResult(42)).toEqual({ index: 42 });
  });

  it('passes through an object with index and selector', () => {
    const result = { index: 7, selector: '[data-rowindex="7"]' };
    expect(normalizeRowIndexResult(result)).toBe(result);
  });

});

describe('resolveLogicalRowIndex', () => {
  const fakeRow = {} as any;

  it('returns { index, selector } when strategy returns an object', async () => {
    const config = {
      strategies: {
        resolveRowIndex: vi.fn().mockResolvedValue({ index: 5, selector: '[data-id="5"]' }),
      },
    } as unknown as Pick<FinalTableConfig, 'strategies'>;

    const result = await resolveLogicalRowIndex(fakeRow, config, () => 99);
    expect(result).toEqual({ index: 5, selector: '[data-id="5"]' });
  });

  it('normalizes a plain number from the strategy', async () => {
    const config = {
      strategies: {
        resolveRowIndex: vi.fn().mockResolvedValue(10),
      },
    } as unknown as Pick<FinalTableConfig, 'strategies'>;

    const result = await resolveLogicalRowIndex(fakeRow, config, () => 99);
    expect(result).toEqual({ index: 10 });
  });

  it('falls back when strategy returns undefined', async () => {
    const config = {
      strategies: {
        resolveRowIndex: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as Pick<FinalTableConfig, 'strategies'>;

    const result = await resolveLogicalRowIndex(fakeRow, config, () => 3);
    expect(result).toEqual({ index: 3 });
  });

  it('falls back when no strategy is configured', async () => {
    const config = {
      strategies: {},
    } as unknown as Pick<FinalTableConfig, 'strategies'>;

    const result = await resolveLogicalRowIndex(fakeRow, config, () => 7);
    expect(result).toEqual({ index: 7 });
  });

  it('returns undefined when fallback returns undefined', async () => {
    const config = {
      strategies: {},
    } as unknown as Pick<FinalTableConfig, 'strategies'>;

    const result = await resolveLogicalRowIndex(fakeRow, config, () => undefined);
    expect(result).toBeUndefined();
  });
});
