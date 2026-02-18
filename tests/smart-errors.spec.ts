import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';

test.describe('Smart Error Messages', () => {
  test('shows helpful suggestions for misspelled column names', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');

    const table = await useTable(page.locator('#example')).init();
    const row = table.getRow({ Name: 'Airi Satou' });

    // Try to access a misspelled column
    try {
      row.getCell('Positon'); // Typo: should be 'Position'
      throw new Error('Should have thrown');
    } catch (error: any) {
      // Verify error message includes suggestions
      expect(error.message).toContain('Column \'Positon\' not found');
      expect(error.message).toContain('Did you mean:');
      expect(error.message).toContain('Position');
      expect(error.message).toContain('% match');
      expect(error.message).toContain('Available columns:');
      expect(error.message).toContain('Tip: Column names are case-sensitive');
    }
  });

  test('shows suggestions for case mismatch', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');

    const table = await useTable(page.locator('#example')).init();
    const row = table.getRow({ Name: 'Airi Satou' });

    // Try lowercase when it should be capitalized
    try {
      row.getCell('position'); // Should be 'Position'
      throw new Error('Should have thrown');
    } catch (error: any) {
      expect(error.message).toContain('position');
      expect(error.message).toContain('Position');
    }
  });

  test('shows helpful suggestions for invalid filter columns in findRow', async ({ page }) => {
    await page.goto('https://datatables.net/examples/data_sources/dom');

    const table = await useTable(page.locator('#example')).init();

    // Try to filter by a misspelled column
    try {
      await table.findRow({ 'Positon': 'Accountant' }); // Typo: should be 'Position'
      throw new Error('Should have thrown');
    } catch (error: any) {
      expect(error.message).toContain("Column 'Positon' not found");
      expect(error.message).toContain('Did you mean:');
      expect(error.message).toContain('Position');
    }
  });
});
