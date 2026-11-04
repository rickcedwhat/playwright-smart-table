import { test, expect, type Page } from '@playwright/test';
import { Strategies, useTable, type TableContext } from '../src';

const unknown = { first: 0, last: Infinity };
async function fixture(page: Page, values: (string | null)[], axis: 'row' | 'column') {
  await page.setContent('<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody></tbody></table>');
  await page.locator('tbody').evaluate((body, { values, axis }) => {
    const add = (parent: Element, tag: string, value: string | null) => {
      const el = document.createElement(tag);
      if (value !== null) el.setAttribute('data-index', value);
      parent.append(el);
      return el;
    };
    if (axis === 'row') for (const value of values) add(body, 'tr', value).append(document.createElement('td'));
    else {
      const row = document.createElement('tr');
      body.append(row);
      for (const value of values) add(row, 'td', value);
    }
  }, { values, axis });
}
function context(page: Page): TableContext {
  return { root: page.locator('table'), config: { rowSelector: 'tbody tr', cellSelector: 'td', debug: { logLevel: 'error' } } } as TableContext;
}
for (const axis of ['row', 'column'] as const) {
  const read = (page: Page, offset = 0) => {
    const viewport = Strategies.Viewport.dataAttribute({ rowOffset: offset, columnOffset: offset });
    return axis === 'row' ? viewport.getVisibleRowRange!(context(page)) : viewport.getVisibleColumnRange!(context(page));
  };
  test(`${axis}: missing, blank and invalid attributes produce unknown ranges and diagnostics`, async ({ page }) => {
    const messages: string[] = [];
    const original = console.log;
    console.log = (...args) => { messages.push(String(args[0])); };
    try {
      for (const value of [null, '', '   ', 'oops', 'NaN', 'Infinity', '-Infinity', '1.5', '-1']) {
        await fixture(page, [value], axis);
        expect(await read(page), `attribute ${JSON.stringify(value)}`).toEqual(unknown);
      }
    } finally { console.log = original; }
    expect(messages).toHaveLength(9);
    expect(messages.every(message => message.includes('data-index') && message.includes('unknown range'))).toBe(true);
  });
  test(`${axis}: valid zero, trimmed numbers and offsets are preserved`, async ({ page }) => {
    for (const [values, offset, expected] of [
      [['0'], 0, { first: 0, last: 0 }],
      [[' 2 ', '4'], 0, { first: 2, last: 4 }],
      [['1', '3'], 1, { first: 0, last: 2 }],
    ] as const) {
      await fixture(page, [...values], axis);
      expect(await read(page, offset)).toEqual(expected);
    }
    await fixture(page, ['0'], axis);
    expect(await read(page, 1)).toEqual(unknown); // invalid after offset normalization
  });
  test(`${axis}: mixed valid and invalid attributes cannot assert a partial range`, async ({ page }) => {
    for (const invalid of [null, '', 'bad', 'Infinity']) {
      await fixture(page, ['5', invalid, '7'], axis);
      expect(await read(page)).toEqual(unknown);
    }
  });
  test(`${axis}: no matching elements means unknown without a metadata warning`, async ({ page }) => {
    await fixture(page, [], axis);
    const original = console.log;
    const messages: unknown[] = [];
    console.log = (...args) => { messages.push(args); };
    try { expect(await read(page)).toEqual(unknown); }
    finally { console.log = original; }
    expect(messages).toEqual([]);
  });
}

test('mounted cells without index metadata can be read without unnecessary viewport scrolling', async ({ page }) => {
  await page.setContent('<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>Alice</td><td>10</td></tr><tr><td>Bob</td><td>20</td></tr></tbody></table>');
  let scrolls = 0;
  const viewport = Strategies.Viewport.dataAttribute();
  const table = useTable(page.locator('table'), { autoScroll: false, strategies: {
    loading: {}, viewport: { ...viewport, scrollToColumn: async () => { scrolls++; }, scrollToRow: async () => { scrolls++; } },
  } });
  expect(await table.map(({ row }) => row.getValue('Value'))).toEqual(['10', '20']);
  expect(scrolls).toBe(0);
});

test('invalid offscreen row metadata does not invalidate a valid visible range', async ({ page }) => {
  await page.setContent('<div id="scroll" style="height:30px;overflow:auto"><table style="border-collapse:collapse"><tbody><tr data-index="5" style="height:30px"><td>Visible</td></tr><tr style="height:30px"><td>Overscan</td></tr></tbody></table></div>');
  const viewport = Strategies.Viewport.dataAttribute({ scrollContainer: '#scroll' });
  expect(await viewport.getVisibleRowRange!(context(page))).toEqual({ first: 5, last: 5 });
});
