import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';

test.describe('Trace Integration', () => {
  test('emits trace events for table operations', async ({ page }) => {
    // Note: Run this test with --trace on to see events in trace viewer
    // npx playwright test tests/trace-integration.spec.ts --trace on
    
    await page.goto('https://datatables.net/examples/data_sources/dom');
    
    // These operations will emit trace events visible in the trace viewer
    const table = await useTable(page.locator('#example')).init();
    
    // getCell will emit a trace event
    const row = table.getRow({ Name: 'Airi Satou' });
    const cell = row.getCell('Position');
    await expect(cell).toHaveText('Accountant');
    
    // The trace file will contain console logs like:
    // [SmartTable:init] {"headers":["Name","Position","Office","Age","Start date","Salary"],"columnCount":6}
    // [SmartTable:getCell] {"column":"Position","columnIndex":1,"rowIndex":undefined}
  });

  test('trace events appear in console logs', async ({ page }) => {
    const consoleLogs: string[] = [];
    
    // Capture console logs
    page.on('console', msg => {
      if (msg.text().includes('[SmartTable')) {
        consoleLogs.push(msg.text());
      }
    });
    
    await page.goto('https://datatables.net/examples/data_sources/dom');
    
    const table = await useTable(page.locator('#example')).init();
    const row = table.getRow({ Name: 'Airi Satou' });
    row.getCell('Position');
    
    // Wait a bit for console logs to be captured
    await page.waitForTimeout(100);
    
    // Verify trace events were logged
    expect(consoleLogs.length).toBeGreaterThan(0);
    expect(consoleLogs.some(log => log.includes('[SmartTable:init]'))).toBe(true);
    expect(consoleLogs.some(log => log.includes('[SmartTable:getCell]'))).toBe(true);
  });
});
