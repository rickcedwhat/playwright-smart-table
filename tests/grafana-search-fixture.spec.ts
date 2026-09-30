import path from 'path';
import { test, expect, Locator, Page } from '@playwright/test';
import { useTable, Strategies, TableConfig, TableContext } from '../src';
import type { ViewportStrategy, RowIndexResult } from '../src/types';

const ROW_HEIGHT = 36;
const fixtureUrl = (query = '') =>
  `file://${path.resolve(__dirname, 'test-assets/grafana-search-table.html')}${query ? `?${query}` : ''}`;

const scroller = (root: Locator) => root.locator('[role="rowgroup"] > div').first();

function grafanaConfig(opts: { loadingAware: boolean; scrollAmount?: number }): TableConfig {
  const viewport: ViewportStrategy = {
    getVisibleRowIndices: async ({ root, config }: TableContext) =>
      root.evaluate((el: HTMLElement, rowSel: string) => {
        const box = el.querySelector('[role="rowgroup"] > div')?.getBoundingClientRect();
        const visible: number[] = [];
        Array.from(el.querySelectorAll(rowSel)).forEach((row, index) => {
          const r = row.getBoundingClientRect();
          if (!box) { visible.push(index); return; }
          if (r.height > 0 && r.bottom > box.top && r.top < box.bottom) visible.push(index);
        });
        return visible;
      }, config.rowSelector as string),
    scrollToRow: async ({ root }: TableContext, rowIndex: number) => {
      await scroller(root).evaluate((el: HTMLElement, idx: number) => {
        el.scrollTop = Math.max(0, idx * 36 - 20);
      }, rowIndex);
      await root.page().waitForTimeout(50);
    },
  };

  return {
    rowSelector: '[role="rowgroup"] [role="row"]',
    headerSelector: '[role="columnheader"]',
    cellSelector: '[role="cell"]',
    maxPages: 500,
    strategies: {
      viewport,
      resolveRowIndex: async (row: Locator): Promise<RowIndexResult | undefined> => {
        const top = await row.evaluate((el: HTMLElement) => parseFloat(el.style.top));
        return Number.isFinite(top) ? Math.round(top / ROW_HEIGHT) : undefined;
      },
      dedupe: async (row) => (await row.getCell('Name').locator('a').getAttribute('href')) ?? '',
      pagination: Strategies.Pagination.infiniteScroll({
        action: 'js-scroll',
        scrollTarget: scroller,
        ...(opts.scrollAmount ? { scrollAmount: opts.scrollAmount } : {}),
        stabilization: Strategies.Stabilization.contentChanged({ scope: 'all', timeout: 2000 }),
      }),
      ...(opts.loadingAware ? {
        loading: {
          isTableLoading: async ({ root }: TableContext) =>
            (await root.page().getByTestId('status').textContent()) === 'loading',
          isRowLoading: async (row) => (await row.getCell('Name').locator('a').count()) === 0,
          rowLoadingTimeout: 5000,
        },
      } : {}),
    },
  };
}

async function scrape(page: Page, config: TableConfig) {
  const table = await useTable(page.locator('#search-table'), config).init();
  const rows = await table.map(async ({ row }) => ({
    name: await row.getCell('Name').innerText(),
    href: await row.getCell('Name').locator('a').getAttribute('href'),
  }), { concurrency: 'sequential' });
  return rows;
}

async function expectedHrefs(page: Page, sort = 'alpha-asc'): Promise<string[]> {
  return page.evaluate((s) => (window as any).__grafanaFixture.allHrefs(s), sort);
}

test.describe('Grafana search table fixture (#417)', () => {
  test('explore: sort parity by href', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(fixtureUrl('delay=800&jitter=600'));
    await expect(page.locator('[role="rowgroup"] [role="row"] a').first()).toBeVisible();
    const config = grafanaConfig({ loadingAware: true, scrollAmount: 200 });
    const asc = await scrape(page, config);
    await page.getByLabel('Sort').selectOption('alpha-desc');
    await expect(page.getByTestId('status')).toHaveText('');
    const desc = await scrape(page, config);
    const a = new Set(asc.map(r => r.href)); const d = new Set(desc.map(r => r.href));
    const onlyAsc = [...a].filter(h => !d.has(h)).length; const onlyDesc = [...d].filter(h => !a.has(h)).length;
    const expDesc = await expectedHrefs(page, 'alpha-desc');
    const orderOk = desc.map(r => r.href).join() === expDesc.join();
    console.log(`[sort] asc=${asc.length} desc=${desc.length} onlyAsc=${onlyAsc} onlyDesc=${onlyDesc} descOrderMatches=${orderOk}`);
  });

  const scenarios = [
    { query: 'height=300', scrollAmount: 0 },
    { query: 'height=450', scrollAmount: 0 },
    { query: 'height=520', scrollAmount: 0 },
    { query: 'height=800', scrollAmount: 0 },
  ];
  for (const sc of scenarios) for (const loadingAware of [false]) test(`explore ${sc.query} scroll=${sc.scrollAmount} ${loadingAware ? 'aware' : 'naive'}`, async ({ page }) => {
    test.setTimeout(300_000);
    {
      await page.goto(fixtureUrl(sc.query));
      await expect(page.locator('[role="rowgroup"] [role="row"] a').first()).toBeVisible();
      const expected = await expectedHrefs(page);
      const t0 = Date.now();
      const rows = await scrape(page, grafanaConfig({ loadingAware, scrollAmount: sc.scrollAmount }));
      const hrefs = rows.map(r => r.href).filter(Boolean) as string[];
      const blanks = rows.filter(r => !r.href).length;
      const unique = new Set(hrefs);
      const missing = expected.filter(h => !unique.has(h)).length;
      console.log(`[${sc.query} scroll=${sc.scrollAmount} ${loadingAware ? 'loading-aware' : 'naive'}] ${((Date.now() - t0) / 1000).toFixed(0)}s rows=${rows.length} blanks=${blanks} unique=${unique.size}/${expected.length} missing=${missing} dupHrefs=${hrefs.length - unique.size}`);
    }
  });
});
