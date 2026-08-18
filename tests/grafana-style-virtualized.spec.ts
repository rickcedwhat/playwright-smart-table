import { test, expect, Locator } from '@playwright/test';
import { useTable, Strategies, TableConfig, TableContext } from '../src';
import type { ViewportStrategy, RowIndexResult } from '../src/types';
import type { StabilizationStrategy } from '../src/strategies/stabilization';

const PaginationStrategies = Strategies.Pagination;
const StabilizationStrategies = Strategies.Stabilization;

const ROW_HEIGHT = 36;
const VIEWPORT_HEIGHT = 264;
const TOTAL_ROWS = 100;
const OVERSCAN = 5;

/**
 * Builds an HTML fixture that mimics Grafana's react-window FixedSizeList:
 * - Absolute-positioned rows with style.top
 * - No data-index, aria-rowindex, or data-rowindex attributes
 * - Fixed row count in DOM (~visible + 2*overscan), recycling via remove/create
 * - Async rendering via requestAnimationFrame (like React reconciliation)
 * - Sortable columns
 */
function makeGrafanaTableHtml() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: sans-serif; padding: 20px; }
        .table-wrap { width: 900px; }
        [role="columnheader"], [role="cell"] {
          flex: 1;
          padding: 8px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        [role="columnheader"] {
          font-weight: bold;
          background: #f4f4f4;
          cursor: pointer;
          user-select: none;
          border-bottom: 2px solid #ddd;
        }
        [role="columnheader"]:hover { background: #e8e8e8; }
        [role="columnheader"].sorted-asc::after { content: ' ▲'; }
        [role="columnheader"].sorted-desc::after { content: ' ▼'; }
        [role="cell"] { border-bottom: 1px solid #eee; }
        [role="row"]:not(.header-row) { position: absolute; left: 0; width: 100%; display: flex; }
        .header-row { display: flex; width: 100%; }
        #scroll-container {
          position: relative;
          height: ${VIEWPORT_HEIGHT}px;
          width: 100%;
          overflow: hidden auto;
          will-change: transform;
          direction: ltr;
        }
        #inner-container { width: 100%; position: relative; }
      </style>
    </head>
    <body>
      <div class="table-wrap">
        <div role="table" id="the-table">
          <div role="row" class="header-row">
            <div role="columnheader" data-col="name">Name</div>
            <div role="columnheader" data-col="type">Type</div>
            <div role="columnheader" data-col="location">Location</div>
            <div role="columnheader" data-col="value">Value</div>
          </div>
          <div role="rowgroup">
            <div id="scroll-container">
              <div id="inner-container"></div>
            </div>
          </div>
        </div>
      </div>

      <script>
        const ROW_HEIGHT = ${ROW_HEIGHT};
        const VIEWPORT_HEIGHT = ${VIEWPORT_HEIGHT};
        const TOTAL_ROWS = ${TOTAL_ROWS};
        const OVERSCAN = ${OVERSCAN};

        const types = ['Dashboard', 'Folder', 'Panel', 'Alert', 'Plugin'];
        const locations = ['General', 'Monitoring', 'Alerts', 'Infrastructure', 'Application'];

        let data = [];
        for (let i = 0; i < TOTAL_ROWS; i++) {
          data.push({
            name: 'Item ' + String(i).padStart(3, '0'),
            type: types[i % types.length],
            location: locations[i % locations.length],
            value: String(i * 7 + 13),
          });
        }

        let sortCol = null;
        let sortDir = 'asc';

        const scrollContainer = document.getElementById('scroll-container');
        const innerContainer = document.getElementById('inner-container');
        let pendingRender = null;

        innerContainer.style.height = (TOTAL_ROWS * ROW_HEIGHT) + 'px';

        function render() {
          const scrollTop = scrollContainer.scrollTop;
          const firstVisible = Math.floor(scrollTop / ROW_HEIGHT);
          const lastVisible = Math.ceil((scrollTop + VIEWPORT_HEIGHT) / ROW_HEIGHT) - 1;
          const startIdx = Math.max(0, firstVisible - OVERSCAN);
          const endIdx = Math.min(TOTAL_ROWS - 1, lastVisible + OVERSCAN);

          // Remove rows outside the range (recycling)
          const existing = innerContainer.querySelectorAll('[role="row"]');
          existing.forEach(row => {
            const idx = parseInt(row.dataset.logicalIndex, 10);
            if (idx < startIdx || idx > endIdx) {
              row.remove();
            }
          });

          // Add rows inside the range that don't exist yet
          for (let i = startIdx; i <= endIdx; i++) {
            if (innerContainer.querySelector('[role="row"][data-logical-index="' + i + '"]')) continue;

            const row = document.createElement('div');
            row.setAttribute('role', 'row');
            row.dataset.logicalIndex = String(i);
            row.dataset.testid = 'search-row-' + data[i].name.replace(/\\s+/g, '-');
            row.style.position = 'absolute';
            row.style.left = '0px';
            row.style.top = (i * ROW_HEIGHT) + 'px';
            row.style.height = ROW_HEIGHT + 'px';
            row.style.width = '100%';
            row.style.display = 'flex';

            const d = data[i];
            ['name', 'type', 'location', 'value'].forEach(col => {
              const cell = document.createElement('div');
              cell.setAttribute('role', 'cell');
              cell.textContent = d[col];
              row.appendChild(cell);
            });

            innerContainer.appendChild(row);
          }
        }

        // Async rendering like React: scroll → requestAnimationFrame → DOM update
        scrollContainer.addEventListener('scroll', () => {
          if (pendingRender) cancelAnimationFrame(pendingRender);
          pendingRender = requestAnimationFrame(() => {
            pendingRender = null;
            render();
          });
        });

        render(); // initial synchronous render

        // Sorting: click header to sort
        document.querySelectorAll('[role="columnheader"]').forEach(header => {
          header.addEventListener('click', () => {
            const col = header.dataset.col;
            if (sortCol === col) {
              sortDir = sortDir === 'asc' ? 'desc' : 'asc';
            } else {
              sortCol = col;
              sortDir = 'asc';
            }

            document.querySelectorAll('[role="columnheader"]').forEach(h => {
              h.classList.remove('sorted-asc', 'sorted-desc');
            });
            header.classList.add('sorted-' + sortDir);

            data.sort((a, b) => {
              const va = a[col], vb = b[col];
              const cmp = col === 'value'
                ? (parseInt(va, 10) - parseInt(vb, 10))
                : va.localeCompare(vb);
              return sortDir === 'asc' ? cmp : -cmp;
            });

            innerContainer.querySelectorAll('[role="row"]').forEach(r => r.remove());
            render();
          });
        });
      </script>
    </body>
    </html>
  `;
}

function grafanaTableConfig(): TableConfig {
  const viewport: ViewportStrategy = {
    getVisibleRowIndices: async ({ root, config }: TableContext) => {
      return root.evaluate((el: HTMLElement, rowSel: string) => {
        const scroller = el.querySelector('[role="rowgroup"] > div');
        const rows = Array.from(el.querySelectorAll(rowSel));
        const scrollerRect = scroller?.getBoundingClientRect() ?? null;
        const visible: number[] = [];
        rows.forEach((row, index) => {
          if (!scrollerRect) { visible.push(index); return; }
          const rect = row.getBoundingClientRect();
          if (rect.height === 0) return;
          if (rect.bottom > scrollerRect.top && rect.top < scrollerRect.bottom) {
            visible.push(index);
          }
        });
        return visible;
      }, config.rowSelector as string);
    },
    scrollToRow: async ({ root }: TableContext, rowIndex: number) => {
      await root.evaluate((el: HTMLElement, args: { idx: number }) => {
        const scroller = el.querySelector('[role="rowgroup"] > div') as HTMLElement;
        if (!scroller) return;
        scroller.scrollTop = Math.max(0, args.idx * 36 - 20);
      }, { idx: rowIndex });
      await root.page().waitForTimeout(50);
    },
  };

  return {
    rowSelector: '[role="rowgroup"] [role="row"]',
    cellSelector: '[role="cell"]',
    headerSelector: '[role="columnheader"]',
    maxPages: 500,
    strategies: {
      viewport,
      resolveRowIndex: async (row: Locator): Promise<RowIndexResult | undefined> => {
        const top = await row.evaluate((el: HTMLElement) => parseFloat(el.style.top));
        if (!Number.isFinite(top)) return undefined;
        const height = await row.evaluate(
          (el: HTMLElement) => el.getBoundingClientRect().height || 36,
        );
        return Math.round(top / height);
      },
      pagination: PaginationStrategies.infiniteScroll({
        action: 'js-scroll',
        scrollTarget: (root: Locator) => root.locator('[role="rowgroup"] > div').first(),
        scrollAmount: 100,
        stabilization: StabilizationStrategies.contentChanged({
          scope: 'all',
          timeout: 5000,
        }),
      }),
    },
  };
}

/**
 * Builds a variant where scrolling updates style.top immediately but defers
 * cell content via setTimeout — simulating React's async reconciliation in
 * react-window / react-virtuoso. Without contentReady, atomic toJSON captures
 * stale cell content from the previous occupant of the DOM slot.
 */
function makeAsyncContentTableHtml() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: sans-serif; padding: 20px; }
        .table-wrap { width: 900px; }
        [role="columnheader"], [role="cell"] {
          flex: 1; padding: 8px; overflow: hidden;
          text-overflow: ellipsis; white-space: nowrap;
        }
        [role="columnheader"] { font-weight: bold; background: #f4f4f4; border-bottom: 2px solid #ddd; }
        [role="cell"] { border-bottom: 1px solid #eee; }
        [role="row"]:not(.header-row) { position: absolute; left: 0; width: 100%; display: flex; }
        .header-row { display: flex; width: 100%; }
        #scroll-container-async {
          position: relative; height: ${VIEWPORT_HEIGHT}px; width: 100%;
          overflow: hidden auto; will-change: transform; direction: ltr;
        }
        #inner-container-async { width: 100%; position: relative; }
      </style>
    </head>
    <body>
      <div class="table-wrap">
        <div role="table" id="the-table">
          <div role="row" class="header-row">
            <div role="columnheader">Name</div>
            <div role="columnheader">Value</div>
          </div>
          <div role="rowgroup">
            <div id="scroll-container-async">
              <div id="inner-container-async"></div>
            </div>
          </div>
        </div>
      </div>

      <script>
        const ROW_HEIGHT = ${ROW_HEIGHT};
        const TOTAL_ROWS = ${TOTAL_ROWS};
        const VIEWPORT_HEIGHT = ${VIEWPORT_HEIGHT};
        const OVERSCAN = ${OVERSCAN};

        const data = [];
        for (let i = 0; i < TOTAL_ROWS; i++) {
          data.push({ name: 'Row-' + String(i).padStart(3, '0'), value: String(i) });
        }

        const scrollContainer = document.getElementById('scroll-container-async');
        const innerContainer = document.getElementById('inner-container-async');
        innerContainer.style.height = (TOTAL_ROWS * ROW_HEIGHT) + 'px';

        // Pool of reusable row elements — simulates react-window's slot reuse
        const pool = [];
        const POOL_SIZE = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + 2 * OVERSCAN;
        for (let i = 0; i < POOL_SIZE; i++) {
          const row = document.createElement('div');
          row.setAttribute('role', 'row');
          row.style.position = 'absolute';
          row.style.left = '0px';
          row.style.height = ROW_HEIGHT + 'px';
          row.style.width = '100%';
          row.style.display = 'flex';
          const nameCell = document.createElement('div');
          nameCell.setAttribute('role', 'cell');
          const valueCell = document.createElement('div');
          valueCell.setAttribute('role', 'cell');
          row.appendChild(nameCell);
          row.appendChild(valueCell);
          row.dataset.logicalIndex = String(i);
          pool.push(row);
          innerContainer.appendChild(row);
        }

        let contentTimers = [];

        function render() {
          // Cancel any pending content updates
          contentTimers.forEach(t => clearTimeout(t));
          contentTimers = [];

          const scrollTop = scrollContainer.scrollTop;
          const firstVisible = Math.floor(scrollTop / ROW_HEIGHT);
          const startIdx = Math.max(0, firstVisible - OVERSCAN);

          for (let slot = 0; slot < pool.length; slot++) {
            const dataIdx = startIdx + slot;
            const row = pool[slot];
            if (dataIdx >= TOTAL_ROWS) {
              row.style.display = 'none';
              continue;
            }
            row.style.display = 'flex';

            // Position updates SYNCHRONOUSLY (like react-window)
            row.style.top = (dataIdx * ROW_HEIGHT) + 'px';
            row.dataset.logicalIndex = String(dataIdx);

            // Content updates ASYNCHRONOUSLY (like React reconciliation)
            const d = data[dataIdx];
            const cells = row.querySelectorAll('[role="cell"]');
            contentTimers.push(setTimeout(() => {
              cells[0].textContent = d.name;
              cells[1].textContent = d.value;
            }, 30));
          }
        }

        scrollContainer.addEventListener('scroll', () => {
          requestAnimationFrame(render);
        });

        // Initial render — synchronous content for first batch
        for (let slot = 0; slot < pool.length && slot < TOTAL_ROWS; slot++) {
          const row = pool[slot];
          row.style.top = (slot * ROW_HEIGHT) + 'px';
          row.dataset.logicalIndex = String(slot);
          const cells = row.querySelectorAll('[role="cell"]');
          cells[0].textContent = data[slot].name;
          cells[1].textContent = data[slot].value;
        }
      </script>
    </body>
    </html>
  `;
}

function asyncContentConfig(opts?: { contentReady?: boolean | 'mutationSettled' }): TableConfig {
  const isMutation = opts?.contentReady === 'mutationSettled';
  const viewport: ViewportStrategy = {
    getVisibleRowIndices: async ({ root, config }: TableContext) => {
      return root.evaluate((el: HTMLElement, rowSel: string) => {
        const scroller = el.querySelector('#scroll-container-async');
        const rows = Array.from(el.querySelectorAll(rowSel));
        const scrollerRect = scroller?.getBoundingClientRect() ?? null;
        const visible: number[] = [];
        rows.forEach((row, index) => {
          if (!scrollerRect) { visible.push(index); return; }
          const rect = row.getBoundingClientRect();
          if (rect.height === 0) return;
          if (rect.bottom > scrollerRect.top && rect.top < scrollerRect.bottom) {
            visible.push(index);
          }
        });
        return visible;
      }, config.rowSelector as string);
    },
    scrollToRow: async ({ root }: TableContext, rowIndex: number) => {
      await root.evaluate((el: HTMLElement, args: { idx: number }) => {
        const scroller = el.querySelector('#scroll-container-async') as HTMLElement;
        if (!scroller) return;
        scroller.scrollTop = Math.max(0, args.idx * 36 - 20);
      }, { idx: rowIndex });
      // For mutationSettled: keep the post-scroll wait short so the 30ms
      // async content timeout hasn't fired yet — the MutationObserver in
      // contentReady should catch the mutation, not miss it.
      // For textStable: wait long enough for the render to land so the
      // text-polling loop can detect the change.
      await root.page().waitForTimeout(isMutation ? 5 : 50);
    },
  };

  return {
    rowSelector: '#inner-container-async [role="row"]',
    cellSelector: '[role="cell"]',
    headerSelector: '[role="columnheader"]',
    maxPages: 500,
    strategies: {
      viewport,
      resolveRowIndex: async (row: Locator): Promise<RowIndexResult | undefined> => {
        const top = await row.evaluate((el: HTMLElement) => parseFloat(el.style.top));
        if (!Number.isFinite(top)) return undefined;
        return Math.round(top / ROW_HEIGHT);
      },
      ...(opts?.contentReady ? {
        contentReady: isMutation
          ? Strategies.ContentReady.mutationSettled({ timeout: 500, quietPeriod: 50 })
          : Strategies.ContentReady.textStable({ timeout: 500, interval: 30 }),
      } : {}),
      pagination: PaginationStrategies.infiniteScroll({
        action: 'js-scroll',
        scrollTarget: (root: Locator) => root.locator('#scroll-container-async').first(),
        scrollAmount: 100,
        stabilization: StabilizationStrategies.contentChanged({
          scope: 'all',
          timeout: 5000,
        }),
      }),
    },
  };
}

test.describe('Grafana-style virtualized table (#417)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(makeGrafanaTableHtml());
    await page.waitForSelector('[role="row"]');
  });

  test('map() collects all rows from a recycling virtualized table', async ({ page }) => {
    const table = useTable(page.locator('#the-table'), grafanaTableConfig());
    await table.init();

    const rows = await table.map(async ({ row }) => {
      return await row.toJSON();
    }, { concurrency: 'sequential' });

    expect(rows.length).toBe(TOTAL_ROWS);

    const names = rows.map((r: Record<string, string>) => r.Name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(TOTAL_ROWS);

    expect(names).toContain('Item 000');
    expect(names).toContain('Item 099');
  });

  test('membership is consistent between unsorted and sorted snapshots', async ({ page }) => {
    test.slow(); // two full iterations + sort on slow CI
    const table = useTable(page.locator('#the-table'), grafanaTableConfig());
    await table.init();

    const unsortedRows = await table.map(async ({ row }) => {
      return await row.toJSON();
    }, { concurrency: 'sequential' });

    // Reset scroll to top and wait for the virtualizer to render top-of-list rows
    const scroller = page.locator('#scroll-container');
    await scroller.evaluate((el: HTMLElement) => { el.scrollTop = 0; });
    await expect(page.locator('[role="rowgroup"] [role="row"][data-logical-index="0"]'))
      .toBeAttached();

    // Sort by Name descending — click twice (first asc, then desc)
    const nameHeader = page.locator('[role="columnheader"][data-col="name"]');
    await nameHeader.click();
    await nameHeader.click();
    await expect(nameHeader).toHaveClass(/sorted-desc/);

    const table2 = useTable(page.locator('#the-table'), grafanaTableConfig());
    await table2.init();

    const sortedRows = await table2.map(async ({ row }) => {
      return await row.toJSON();
    }, { concurrency: 'sequential' });

    expect(sortedRows.length).toBe(unsortedRows.length);

    const unsortedNames = new Set(unsortedRows.map((r: Record<string, string>) => r.Name));
    const sortedNames = new Set(sortedRows.map((r: Record<string, string>) => r.Name));
    expect(sortedNames).toEqual(unsortedNames);
  });

  test('final scan collects overscan rows not deferred by viewport filter', async ({ page }) => {
    // Use a small scrollAmount so at EOF some overscan rows may sit below
    // the visible area. Without the final-scan fix, those rows would be
    // deferred with no further page to pick them up.
    const config = grafanaTableConfig();
    const table = useTable(page.locator('#the-table'), {
      ...config,
      strategies: {
        ...config.strategies,
        pagination: PaginationStrategies.infiniteScroll({
          action: 'js-scroll',
          scrollTarget: (root: Locator) => root.locator('[role="rowgroup"] > div').first(),
          scrollAmount: 50,
          stabilization: StabilizationStrategies.contentChanged({
            scope: 'all',
            timeout: 2000,
          }),
        }),
      },
    });
    await table.init();

    const rows = await table.map(async ({ row }) => {
      return await row.toJSON();
    }, { concurrency: 'sequential' });

    expect(rows.length).toBe(TOTAL_ROWS);
  });

  test('scroll-position EOF detection continues past stabilization timeout', async ({ page }) => {
    const alwaysTimeoutStabilization: StabilizationStrategy = async (_ctx, action) => {
      await action();
      return false;
    };

    const config = grafanaTableConfig();
    const table = useTable(page.locator('#the-table'), {
      ...config,
      maxPages: 1000,
      strategies: {
        ...config.strategies,
        pagination: PaginationStrategies.infiniteScroll({
          action: 'js-scroll',
          scrollTarget: (root: Locator) => root.locator('[role="rowgroup"] > div').first(),
          scrollAmount: 200,
          stabilization: alwaysTimeoutStabilization,
        }),
      },
    });
    await table.init();

    const rows = await table.map(async ({ row }) => {
      return await row.toJSON();
    }, { concurrency: 'sequential' });

    expect(rows.length).toBe(TOTAL_ROWS);
  });
});

test.describe('contentReady strategy (#417 content staleness)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(makeAsyncContentTableHtml());
    await page.waitForSelector('[role="row"]');
  });

  test('textStable captures correct content from async-rendering virtualizer', async ({ page }) => {
    const table = useTable(page.locator('#the-table'), asyncContentConfig({ contentReady: true }));
    await table.init();

    const rows = await table.map(async ({ row }) => {
      return await row.toJSON({ atomic: true });
    }, { concurrency: 'sequential' });

    expect(rows.length).toBe(TOTAL_ROWS);

    const names = rows.map((r: Record<string, string>) => r.Name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(TOTAL_ROWS);

    expect(names).toContain('Row-000');
    expect(names).toContain('Row-099');
  });

  test('mutationSettled captures correct content from async-rendering virtualizer', { timeout: 60000 }, async ({ page }) => {
    const table = useTable(page.locator('#the-table'), asyncContentConfig({ contentReady: 'mutationSettled' }));
    await table.init();

    const rows = await table.map(async ({ row }) => {
      return await row.toJSON({ atomic: true });
    }, { concurrency: 'sequential' });

    expect(rows.length).toBe(TOTAL_ROWS);

    const names = rows.map((r: Record<string, string>) => r.Name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(TOTAL_ROWS);

    expect(names).toContain('Row-000');
    expect(names).toContain('Row-099');
  });
});
