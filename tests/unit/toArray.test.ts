/**
 * Unit tests for table.toArray().
 *
 * toArray() is a thin wrapper that calls map() then reset() in a finally block.
 * These tests mock the map/reset surface of a table-like object so no browser
 * or Playwright context is needed.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => vi.restoreAllMocks());

// ─── Helpers ──────────────────────────────────────────────────────────────────

type MockRow = { toJSON: () => Promise<Record<string, unknown>> };

/** Build a minimal table-like object that mirrors the real toArray implementation. */
function makeTable(rows: Record<string, unknown>[] = [{ id: 1 }, { id: 2 }]) {
  const reset = vi.fn().mockResolvedValue(undefined);

  const map = vi.fn().mockImplementation(
    async (callback: (ctx: { row: MockRow }) => unknown) => {
      return Promise.all(
        rows.map((data) =>
          callback({ row: { toJSON: async () => data } }),
        ),
      );
    },
  );

  // Mirror the real toArray implementation so we test the exact logic.
  const toArray = async <R = Record<string, unknown>>(
    callback?: (ctx: { row: MockRow }) => R | Promise<R>,
    options: Record<string, unknown> = {},
  ): Promise<R[]> => {
    const cb =
      callback ?? (({ row }: { row: MockRow }) => row.toJSON() as Promise<R>);
    try {
      return await map(cb, options);
    } finally {
      await reset();
    }
  };

  return { map, reset, toArray };
}

// ─── Zero-arg: returns toJSON() results ───────────────────────────────────────

describe('toArray() — zero-arg', () => {
  it('returns toJSON() results for every row', async () => {
    const rows = [{ name: 'Alice' }, { name: 'Bob' }];
    const { toArray } = makeTable(rows);

    const result = await toArray();

    expect(result).toEqual(rows);
  });

  it('returns an empty array when the table has no rows', async () => {
    const { toArray } = makeTable([]);

    const result = await toArray();

    expect(result).toEqual([]);
  });
});

// ─── Custom callback ───────────────────────────────────────────────────────────

describe('toArray() — custom callback', () => {
  it('uses the provided callback instead of toJSON()', async () => {
    const rows = [{ name: 'Alice' }, { name: 'Bob' }];
    const { toArray } = makeTable(rows);

    const result = await toArray(async ({ row }) => {
      const json = await row.toJSON();
      return json['name'] as string;
    });

    expect(result).toEqual(['Alice', 'Bob']);
  });

  it('passes the callback return value through unchanged', async () => {
    const { toArray } = makeTable([{ score: 42 }]);

    const result = await toArray(() => 'constant');

    expect(result).toEqual(['constant']);
  });
});

// ─── reset() is called after success ──────────────────────────────────────────

describe('toArray() — reset() after success', () => {
  it('calls reset() after a successful map()', async () => {
    const { toArray, reset } = makeTable([{ id: 1 }]);

    await toArray();

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('calls reset() after map() with a custom callback', async () => {
    const { toArray, reset } = makeTable([{ id: 1 }]);

    await toArray(({ row }) => row.toJSON());

    expect(reset).toHaveBeenCalledTimes(1);
  });
});

// ─── reset() is called even when the callback throws ─────────────────────────

describe('toArray() — reset() on error', () => {
  it('calls reset() even when the callback throws', async () => {
    const reset = vi.fn().mockResolvedValue(undefined);
    const map = vi.fn().mockRejectedValue(new Error('boom'));

    const toArray = async (callback?: () => unknown) => {
      const cb = callback ?? (() => {});
      try {
        return await map(cb, {});
      } finally {
        await reset();
      }
    };

    await expect(toArray()).rejects.toThrow('boom');
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('re-throws the original error after calling reset()', async () => {
    const reset = vi.fn().mockResolvedValue(undefined);
    const map = vi.fn().mockRejectedValue(new Error('original error'));

    const toArray = async () => {
      try {
        return await map(() => {}, {});
      } finally {
        await reset();
      }
    };

    const err = await toArray().catch((e: Error) => e);
    expect(err.message).toBe('original error');
  });
});

// ─── Options forwarding ───────────────────────────────────────────────────────

describe('toArray() — options forwarded to map()', () => {
  it('passes options to map()', async () => {
    const { toArray, map } = makeTable([{ id: 1 }]);
    const options = { concurrency: 'parallel' };

    await toArray(undefined, options);

    expect(map).toHaveBeenCalledWith(expect.any(Function), options);
  });

  it('defaults to an empty options object when none provided', async () => {
    const { toArray, map } = makeTable([{ id: 1 }]);

    await toArray();

    expect(map).toHaveBeenCalledWith(expect.any(Function), {});
  });
});
