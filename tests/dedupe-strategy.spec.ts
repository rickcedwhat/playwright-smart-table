import { test, expect } from '@playwright/test';
import { useTable, Strategies, type DedupeStrategy } from '../src/index';

test('legacy position keys collide when different records reuse a screen slot', async ({ page }) => {
  await page.setContent('<table><thead><tr><th>ID</th></tr></thead><tbody><tr><td>A</td></tr></tbody></table>');
  const table = await useTable(page.locator('table')).init();
  const positionKey = Strategies.Dedupe.byTopPosition();
  const firstKey = await positionKey(table.getRowByIndex(0));

  // Replace the node too: ElementTracker cannot account for this collision.
  await page.locator('tbody').evaluate(el => { el.innerHTML = '<tr><td>B</td></tr>'; });
  expect(await table.getRowByIndex(0).getCell('ID').innerText()).toBe('B');
  expect(await positionKey(table.getRowByIndex(0))).toBe(firstKey);
});

for (const mode of ['recycled node', 'replacement node'] as const) {
  test(`stable record keys retain different records and suppress repeated records (${mode})`, async ({ page }) => {
    await page.setContent('<table><thead><tr><th>ID</th></tr></thead><tbody><tr><td>A</td></tr></tbody></table>');
    const records = ['A', 'B', 'A'];
    let current = 0;
    const dedupe: DedupeStrategy = async row => row.getCell('ID').innerText();
    const table = useTable(page.locator('table'), {
      autoScroll: false,
      strategies: {
        dedupe,
        pagination: {
          goNext: async () => {
            if (++current >= records.length) return false;
            await page.locator('tbody').evaluate((el, { record, replace }) => {
              if (replace) el.innerHTML = `<tr><td>${record}</td></tr>`;
              else el.querySelector('td')!.textContent = record;
            }, { record: records[current], replace: mode === 'replacement node' });
            return true;
          },
        },
      },
    });
    expect(await table.map(({ row }) => row.getCell('ID').innerText(), { maxPages: 3 })).toEqual(['A', 'B']);
  });
}

test('legacy position keys still group replacement nodes at the same position', async ({ page }) => {
  await page.setContent('<table><thead><tr><th>ID</th></tr></thead><tbody><tr><td>A</td></tr></tbody></table>');
  let advanced = false;
  const table = useTable(page.locator('table'), {
    autoScroll: false,
    strategies: {
      dedupe: Strategies.Dedupe.byTopPosition(5),
      pagination: {
        goNext: async () => {
          if (advanced) return false;
          advanced = true;
          await page.locator('tbody').evaluate(el => { el.innerHTML = '<tr><td>A</td></tr>'; });
          return true;
        },
      },
    },
  });
  expect(await table.map(({ row }) => row.getCell('ID').innerText(), { maxPages: 2 })).toEqual(['A']);
});
