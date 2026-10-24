import { test, expect, type Page } from '@playwright/test';
import { useTable, Strategies, presets, type HeaderStrategy } from '../src/index';
import { scrollRightHeader } from '../src/presets/glide/headers';

const names = Array.from({ length: 8 }, (_, i) => `Column ${i}`);
async function fixture(page: Page, indexed = true, duplicate = false) {
  await page.setContent(`<div id="grid" role="grid" aria-colcount="8" style="width:300px;overflow:auto;position:relative">
    <div style="width:800px;height:70px"><div id="headers"></div>
    <div role="row" style="position:absolute;top:35px">${names.map((_, i) => `<span role="gridcell">value ${i}</span>`).join('')}</div></div></div>`);
  await page.locator('#grid').evaluate((el, { indexed, duplicate }) => {
    const render = () => {
      const start = Math.floor(el.scrollLeft / 100);
      el.querySelector('#headers')!.innerHTML = Array.from({ length: Math.min(3, 8 - start) }, (_, n) => {
        const i = start + n;
        return `<span role="columnheader" ${indexed ? `aria-colindex="${i + 1}"` : ''} style="position:absolute;left:${i * 100}px;width:100px">${duplicate && i === 6 ? 'Column 0' : `Column ${i}`}</span>`;
      }).join('');
    };
    el.addEventListener('scroll', () => setTimeout(render, 20));
    el.scrollLeft = 400;
    render();
  }, { indexed, duplicate });
}
const strategies: Record<string, HeaderStrategy> = {
  generic: Strategies.Header.horizontalScroll({ selector: '#grid' }),
  glide: context => scrollRightHeader(context, { selector: '#grid' }),
  rdg: presets.rdg.strategies!.header!,
};
for (const [name, header] of Object.entries(strategies)) {
  test(`${name}: initial discovery and remapping keep complete column order`, async ({ page }) => {
    await fixture(page);
    const table = useTable(page.locator('#grid'), {
      headerSelector: '[role="columnheader"]', rowSelector: '[role="row"]', cellSelector: '[role="gridcell"]',
      autoScroll: false, strategies: { header },
    });
    for (const initialize of [() => table.init(), () => table.revalidate(), () => table.reset()]) {
      await page.locator('#grid').evaluate(el => { el.scrollLeft = 400; });
      await expect(page.locator('[role="columnheader"]').first()).toHaveText('Column 4');
      await initialize();
      expect(await table.getHeaders()).toEqual(names);
      for (let i = 0; i < names.length; i++) {
        expect(await table.getRowByIndex(0).getCell(names[i]).innerText()).toBe(`value ${i}`);
      }
      expect(await page.locator('#grid').evaluate(el => el.scrollLeft)).toBe(0);
    }
  });
}
for (const indexed of [true, false]) {
  test(`duplicate labels reach mapper validation (indexed=${indexed})`, async ({ page }) => {
    await fixture(page, indexed, true);
    const table = useTable(page.locator('#grid'), {
      headerSelector: '[role="columnheader"]', strategies: { header: strategies.generic },
    });
    await expect(table.init()).rejects.toThrow('Duplicate column names');
    expect(await page.locator('#grid').evaluate(el => el.scrollLeft)).toBe(0);
  });
}
test('geometry fallback and headerTransformer preserve distinct duplicate columns', async ({ page }) => {
  await fixture(page, false, true);
  const table = await useTable(page.locator('#grid'), {
    headerSelector: '[role="columnheader"]', strategies: { header: strategies.generic },
    headerTransformer: ({ text, index }) => `${text}_${index}`,
  }).init();
  expect(await table.getHeaders()).toEqual(names.map((name, i) => `${i === 6 ? 'Column 0' : name}_${i}`));
});

test('partially indexed headers use one ordering coordinate system', async ({ page }) => {
  await fixture(page);
  await page.locator('#grid').evaluate(el => {
    (el as HTMLElement).style.marginLeft = '200px';
    const removeFirstIndex = () => el.querySelector('[aria-colindex="1"]')?.removeAttribute('aria-colindex');
    new MutationObserver(removeFirstIndex).observe(el.querySelector('#headers')!, { childList: true });
    removeFirstIndex();
  });
  const table = await useTable(page.locator('#grid'), {
    headerSelector: '[role="columnheader"]', rowSelector: '[role="row"]', cellSelector: '[role="gridcell"]',
    autoScroll: false, strategies: { header: strategies.generic },
  }).init();
  expect(await table.getHeaders()).toEqual(names);
  expect(await table.getRowByIndex(0).getCell('Column 0').innerText()).toBe('value 0');
  expect(await table.getRowByIndex(0).getCell('Column 7').innerText()).toBe('value 7');
});

test('RDG reaches columns beyond thirty viewport-sized steps', async ({ page }) => {
  await page.setContent('<div id="grid" role="grid" aria-colcount="130" style="width:400px;overflow:auto;position:relative"><div id="headers" style="width:13000px;height:35px"></div></div>');
  await page.locator('#grid').evaluate(el => {
    const render = () => {
      const start = Math.floor(el.scrollLeft / 100);
      el.querySelector('#headers')!.innerHTML = Array.from({ length: Math.min(4, 130 - start) }, (_, n) => {
        const i = start + n;
        return `<span role="columnheader" aria-colindex="${i + 1}" style="position:absolute;left:${i * 100}px;width:100px">Column ${i}</span>`;
      }).join('');
    };
    el.addEventListener('scroll', render);
    render();
  });
  const table = await useTable(page.locator('#grid'), {
    headerSelector: '[role="columnheader"]', strategies: { header: strategies.rdg },
  }).init();
  expect(await table.getHeaders()).toEqual(Array.from({ length: 130 }, (_, i) => `Column ${i}`));
  expect(await page.locator('#grid').evaluate(el => el.scrollLeft)).toBe(0);
});
