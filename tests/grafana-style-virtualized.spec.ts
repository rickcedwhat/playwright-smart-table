import { test, expect } from '@playwright/test';
import { useTable, Strategies } from '../src';

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

function grafanaTableConfig() {
  return {
    rowSelector: '[role="rowgroup"] [role="row"]',
    cellSelector: '[role="cell"]',
    headerSelector: '[role="columnheader"]',
    maxPages: 500,
    strategies: {
      viewport: {
        getVisibleRowIndices: async ({ root, config }: any) => {
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
          }, config.rowSelector);
        },
        scrollToRow: async ({ root }: any, rowIndex: number) => {
          await root.evaluate((el: HTMLElement, args: any) => {
            const scroller = el.querySelector('[role="rowgroup"] > div') as HTMLElement;
            if (!scroller) return;
            scroller.scrollTop = Math.max(0, args.idx * 36 - 20);
          }, { idx: rowIndex });
          await root.page().waitForTimeout(50);
        },
      },
      resolveRowIndex: async (row: any) => {
        const top = await row.evaluate((el: HTMLElement) => parseFloat(el.style.top));
        if (!Number.isFinite(top)) return undefined;
        const height = await row.evaluate(
          (el: HTMLElement) => el.getBoundingClientRect().height || 36,
        );
        return Math.round(top / height);
      },
      pagination: PaginationStrategies.infiniteScroll({
        action: 'js-scroll',
        scrollTarget: (root: any) => root.locator('[role="rowgroup"] > div').first(),
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
    const table = useTable(page.locator('#the-table'), grafanaTableConfig() as any);
    await table.init();

    const rows = await table.map(async ({ row }) => {
      return await row.toJSON();
    }, { concurrency: 'sequential' });

    expect(rows.length).toBe(TOTAL_ROWS);

    const names = rows.map((r: any) => r.Name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(TOTAL_ROWS);

    expect(names).toContain('Item 000');
    expect(names).toContain('Item 099');
  });

  test('membership is consistent between unsorted and sorted snapshots', async ({ page }) => {
    test.slow(); // two full iterations + sort on slow CI
    const table = useTable(page.locator('#the-table'), grafanaTableConfig() as any);
    await table.init();

    const unsortedRows = await table.map(async ({ row }) => {
      return await row.toJSON();
    }, { concurrency: 'sequential' });

    // Reset scroll position
    await page.evaluate(() => {
      const scroller = document.getElementById('scroll-container')!;
      scroller.scrollTop = 0;
    });
    await page.waitForTimeout(100);

    // Sort by Name descending
    await page.locator('[role="columnheader"][data-col="name"]').click();
    await page.locator('[role="columnheader"][data-col="name"]').click();
    await page.waitForTimeout(200);

    const table2 = useTable(page.locator('#the-table'), grafanaTableConfig() as any);
    await table2.init();

    const sortedRows = await table2.map(async ({ row }) => {
      return await row.toJSON();
    }, { concurrency: 'sequential' });

    expect(sortedRows.length).toBe(unsortedRows.length);

    const unsortedNames = new Set(unsortedRows.map((r: any) => r.Name));
    const sortedNames = new Set(sortedRows.map((r: any) => r.Name));
    expect(sortedNames).toEqual(unsortedNames);
  });

  test('scroll-position EOF detection continues past stabilization timeout', async ({ page }) => {
    // Use a stabilization that always returns false (simulates contentChanged timeout).
    // Without the scroll-position EOF fix, the library would stop after the first scroll.
    // With the fix, it continues scrolling as long as scrollTop changes.
    const alwaysTimeoutStabilization = async (_ctx: any, action: () => Promise<void>) => {
      await action();
      return false; // simulate timeout — no content change detected
    };

    const config = grafanaTableConfig() as any;
    const table = useTable(page.locator('#the-table'), {
      ...config,
      maxPages: 1000,
      strategies: {
        ...config.strategies,
        pagination: PaginationStrategies.infiniteScroll({
          action: 'js-scroll',
          scrollTarget: (root: any) => root.locator('[role="rowgroup"] > div').first(),
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
