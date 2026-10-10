// tests/sorting.spec.ts
import { test, expect } from '@playwright/test';
import path from 'path';
import { useTable, Strategies } from '../src/index';

// Resolve the absolute path to the test HTML file
const testFile = `file://${path.resolve(__dirname, 'test-assets/sortable-table.html')}`;

test.describe('AriaSort Strategy', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(testFile);
  });

  test('should correctly read initial sort state', async ({ page }) => {
    const table = useTable(page.locator('#sortable-table'), {
      strategies: {
        sorting: Strategies.Sorting.AriaSort(),
      },
    });
    await table.init();

    await expect(table.sorting.getState('Name')).resolves.toBe('none');
    await expect(table.sorting.getState('Age')).resolves.toBe('none');
  });

  test('apply asc sets the state, aria-sort and row order (alphabetical)', async ({ page }) => {
    const table = useTable(page.locator('#sortable-table'), {
      strategies: {
        sorting: Strategies.Sorting.AriaSort(),
      },
    });
    await table.init();

    await table.sorting.apply('Name', 'asc');

    await expect(table.sorting.getState('Name')).resolves.toBe('asc');
    await expect(page.locator('#name-header')).toHaveAttribute('aria-sort', 'ascending');
    const names = await table.map(({ row }) => row.getCell('Name').innerText());
    expect(names).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  test('apply desc sets the state, aria-sort and row order (numeric)', async ({ page }) => {
    const table = useTable(page.locator('#sortable-table'), {
      strategies: {
        sorting: Strategies.Sorting.AriaSort(),
      },
    });
    await table.init();

    await table.sorting.apply('Age', 'desc');

    await expect(table.sorting.getState('Age')).resolves.toBe('desc');
    await expect(page.locator('#age-header')).toHaveAttribute('aria-sort', 'descending');
    const ages = await table.map(({ row }) => row.getCell('Age').innerText());
    expect(ages).toEqual(['35', '30', '25']);
  });

  test('should throw an error when trying to sort an unsortable column', async ({ page }) => {
    const table = useTable(page.locator('#sortable-table'), {
      strategies: {
        sorting: Strategies.Sorting.AriaSort(),
      },
    });
    await table.init();

    // The 'City' column in our test HTML doesn't have `aria-sort` and is not part of the script
    await expect(table.sorting.apply('City', 'asc')).rejects.toThrow();
  });

  test('sorting.apply throws after max retries when strategy never reaches target state', async ({ page }) => {
    await page.goto(testFile);
    const table = useTable(page.locator('#sortable-table'), {
      strategies: {
        sorting: {
          doSort: async () => { /* no-op: never actually sort */ },
          getSortState: async () => 'none' as const,
        },
      },
    });
    await table.init();

    await expect(table.sorting.apply('Name', 'asc')).rejects.toThrow(/Failed to sort column "Name" to "asc" after 3 attempts/);
  });
});

test.describe('sorting.apply() — loading stabilization', () => {
  test('polls isTableLoading until false before checking sort state', async ({ page }) => {
    await page.setContent(`
      <table id="t">
        <thead><tr><th>Name</th></tr></thead>
        <tbody><tr><td>Alice</td></tr></tbody>
      </table>
    `);

    let isLoadingCallCount = 0;
    let doSortCallCount = 0;

    const table = await useTable(page.locator('#t'), {
      strategies: {
        sorting: {
          doSort: async () => { doSortCallCount++; },
          getSortState: async () => (isLoadingCallCount >= 3 ? 'asc' : 'none'),
        },
        loading: {
          isTableLoading: async () => {
            isLoadingCallCount++;
            return isLoadingCallCount < 3;
          },
        },
      },
    }).init();

    await table.sorting.apply('Name', 'asc');

    expect(doSortCallCount).toBe(1);
    expect(isLoadingCallCount).toBeGreaterThanOrEqual(3);
  });

  for (const [label, isTableLoading] of [
    ['stays true', async () => true],
    ['never resolves', () => new Promise<boolean>(() => {})],
  ] as const) {
    test(`rejects within the sortStabilizationTimeout budget when isTableLoading ${label}`, async ({ page }) => {
      await page.setContent(`
        <table id="t">
          <thead><tr><th>Name</th></tr></thead>
          <tbody><tr><td>Alice</td></tr></tbody>
        </table>
      `);

      let doSortCallCount = 0;
      const table = await useTable(page.locator('#t'), {
        strategies: {
          sorting: {
            doSort: async () => { doSortCallCount++; },
            getSortState: async () => 'none',
          },
          loading: { isTableLoading, sortStabilizationTimeout: 200 },
        },
      }).init();

      const start = Date.now();
      await expect(table.sorting.apply('Name', 'asc')).rejects.toThrow(/after 3 attempts/);
      const elapsed = Date.now() - start;

      expect(doSortCallCount).toBe(3);
      // 3 attempts × 200ms budget, plus slack for the getSortState reads.
      expect(elapsed).toBeGreaterThanOrEqual(3 * 200 * 0.85);
      expect(elapsed).toBeLessThan(3000);
    });
  }
});
