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

async function openFixture(page: Page, query: string) {
  await page.goto(fixtureUrl(query));
  await expect(page.locator('[role="rowgroup"] [role="row"] a').first()).toBeVisible();
}

test.describe('Grafana search table fixture (#417, #473)', () => {
  test.describe.configure({ timeout: 120_000 });

  for (const height of [300, 450, 800]) {
    test(`default scroll step collects every row in a ${height}px list`, async ({ page }) => {
      await openFixture(page, `rows=200&height=${height}`);
      const expected = await expectedHrefs(page);

      const rows = await scrape(page, grafanaConfig({ loadingAware: true }));

      expect(rows.map(r => r.href)).toEqual(expected);
      const names = rows.map(r => r.name);
      expect(new Set(names).size).toBeLessThan(names.length);
    });
  }

  test('warns once when scrollAmount is taller than the scroller', async ({ page }) => {
    await openFixture(page, 'rows=200&height=400');
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
    try {
      await scrape(page, grafanaConfig({ loadingAware: true, scrollAmount: 1000 }));
    } finally {
      console.warn = original;
    }
    const stepWarnings = warnings.filter(w => w.includes('infiniteScroll scrollAmount (1000px)'));
    expect(stepWarnings).toHaveLength(1);
    expect(stepWarnings[0]).toContain('visible height (400px)');
  });

  test('sort parity: A–Z and Z–A collect the same hrefs in the expected order', async ({ page }) => {
    await openFixture(page, 'rows=200&delay=400&jitter=300');
    const config = grafanaConfig({ loadingAware: true });

    const asc = await scrape(page, config);
    await page.getByLabel('Sort').selectOption('alpha-desc');
    await expect(page.getByTestId('status')).toHaveText('');
    const desc = await scrape(page, config);

    expect(asc.map(r => r.href)).toEqual(await expectedHrefs(page, 'alpha-asc'));
    expect(desc.map(r => r.href)).toEqual(await expectedHrefs(page, 'alpha-desc'));
  });
});
