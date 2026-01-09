// tests/sorting.spec.ts
import { test, expect } from '@playwright/test';
import path from 'path';
import { useTable, Strategies } from '../src/useTable';

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

  test('should apply ascending sort and update aria-sort attribute', async ({ page }) => {
    const table = useTable(page.locator('#sortable-table'), {
      strategies: {
        sorting: Strategies.Sorting.AriaSort(),
      },
    });
    await table.init();

    await table.sorting.apply('Name', 'asc');

    await expect(table.sorting.getState('Name')).resolves.toBe('asc');
    await expect(page.locator('#name-header')).toHaveAttribute('aria-sort', 'ascending');
  });

  test('should apply descending sort and update aria-sort attribute', async ({ page }) => {
    const table = useTable(page.locator('#sortable-table'), {
      strategies: {
        sorting: Strategies.Sorting.AriaSort(),
      },
    });
    await table.init();

    // It takes two clicks to get to descending for this implementation
    await table.sorting.apply('Age', 'asc');
    await table.sorting.apply('Age', 'desc');

    await expect(table.sorting.getState('Age')).resolves.toBe('desc');
    await expect(page.locator('#age-header')).toHaveAttribute('aria-sort', 'descending');
  });

  test('should verify row data is correctly sorted alphabetically', async ({ page }) => {
    const table = useTable(page.locator('#sortable-table'), {
      strategies: {
        sorting: Strategies.Sorting.AriaSort(),
      },
    });
    await table.init();

    await table.sorting.apply('Name', 'asc');

    // After sorting by name asc, the order should be Alice, Bob, Charlie
    const names = await table.getColumnValues('Name');
    expect(names).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  test('should verify row data is correctly sorted numerically', async ({ page }) => {
    const table = useTable(page.locator('#sortable-table'), {
      strategies: {
        sorting: Strategies.Sorting.AriaSort(),
      },
    });
    await table.init();

    await table.sorting.apply('Age', 'desc');

    // After sorting by age desc, the order should be 35, 30, 25
    const ages = await table.getColumnValues('Age');
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
});
