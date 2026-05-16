import { test, expect } from '@playwright/test';
import { ElementTracker } from '../src/utils/elementTracker';

test.describe('ElementTracker — element identity', () => {
  test('reports a new DOM node as unseen even when its textContent matches an already-committed row', async ({ page }) => {
    await page.setContent(`
      <table id="t">
        <tbody>
          <tr id="row-a"><td>Alice</td></tr>
        </tbody>
      </table>
    `);

    const tracker = new ElementTracker('test');
    const rowLocator = page.locator('#t tr');

    // First scan: row-a is new
    const first = await tracker.getUnseenIndices(rowLocator);
    expect(first).toEqual([0]);

    // Second scan with the same DOM: nothing new
    const second = await tracker.getUnseenIndices(rowLocator);
    expect(second).toEqual([]);

    // Inject row-b with identical text
    await page.evaluate(() => {
      const tbody = document.querySelector('#t tbody')!;
      const tr = document.createElement('tr');
      tr.id = 'row-b';
      const td = document.createElement('td');
      td.textContent = 'Alice';
      tr.appendChild(td);
      tbody.appendChild(tr);
    });

    // Only row-b (index 1) should appear — row-a stays committed
    const third = await tracker.getUnseenIndices(rowLocator);
    expect(third).toEqual([1]);
  });
});
