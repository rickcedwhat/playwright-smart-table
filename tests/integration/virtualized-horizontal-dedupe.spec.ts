import { test, expect, Page } from '@playwright/test';
import type { Locator } from '@playwright/test';
import { useTable, Strategies } from '../../src/index';

// Integration test: wide table (horizontal scroll) + infinite vertical scroll + dedupe by early column
test.describe('integration: virtualized horizontal + dedupe', () => {
  const makeWideTableHtml = (initialRows = 10, totalRows = 50) => {
    const cols = [
      'ID', 'Col1', 'Col2', 'Col3', 'Col4', 'Col5', 'Col6', 'Col7', 'state', 'postal_code', 'country', 'created_at'
    ];

    return `
      <html>
        <head>
          <style>
            body { font-family: sans-serif; }
            .container { width: 480px; height: 240px; overflow: auto; border: 1px solid #ddd; }
            table { border-collapse: collapse; min-width: 1200px; }
            th, td { padding: 6px 8px; border: 1px solid #ccc; min-width: 120px; }
          </style>
        </head>
        <body>
          <div id="container" class="container">
            <table id="tbl">
              <thead>
                <tr>
                  ${cols.map(c => `<th role="columnheader">${c}</th>`).join('')}
                </tr>
              </thead>
              <tbody id="tbody">
              </tbody>
            </table>
          </div>
          <script>
            (function(){
              const tbody = document.getElementById('tbody');
              let nextId = 1;
              const TOTAL = ${totalRows};
              const cols = ${JSON.stringify(cols)};

              function appendBatch(count) {
                const frag = [];
                for (let k = 0; k < count && nextId <= TOTAL; k++, nextId++) {
                  const row = ['<td>' + nextId + '</td>'];
                  for (let j = 1; j < ${cols.length}; j++) {
                    row.push('<td>' + cols[j] + '-' + nextId + '</td>');
                  }
                  frag.push('<tr data-id="' + nextId + '">' + row.join('') + '</tr>');
                }
                tbody.innerHTML += frag.join('');
              }

              // initial
              appendBatch(${initialRows});

              // append on scroll near bottom
              const container = document.getElementById('container');
              container.addEventListener('scroll', () => {
                if (container.scrollTop + container.clientHeight >= container.scrollHeight - 20) {
                  // append 10 on demand (imitate loading)
                  appendBatch(10);
                }
              });

              // expose helper to append (for deterministic test advances if needed)
              window.__appendBatch = (n) => appendBatch(n);
            })();
          </script>
        </body>
      </html>
    `;
  };

  async function makeTable(page: Page) {
    const table = useTable(page.locator('#container'), {
      rowSelector: '#tbl tbody tr',
      headerSelector: '#tbl thead th',
      cellSelector: 'td',
      maxPages: 20,
      debug: { logLevel: 'verbose' },
      strategies: {
        pagination: Strategies.Pagination.infiniteScroll({
          action: 'js-scroll',
          scrollTarget: (root: Locator) => root, // container is root
          scrollAmount: 200,
          stabilization: Strategies.Stabilization.rowCountIncreased({ timeout: 1000 })
        }),
        // beforeCellRead: let lib defaults handle header scroll; we keep it simple here
      }
    });
    await table.init();
    return table;
  }

  test('map sequential concurrency collects all rows with dedupe by ID', async ({ page }) => {
    test.setTimeout(120000);
    await page.setContent(makeWideTableHtml(10, 50));
    const table = await makeTable(page);

    // Ensure all rows are appended for deterministic test runs
    await page.evaluate(() => (window as any).__appendBatch(1000));

    const rows = await table.map(
      async ({ row }) => {
        // read an early column (ID) and another column to ensure content read
        const id = (await row.getCell('ID').innerText()).trim();
        const val = await row.getCell('Col1').innerText();
        return { id, val };
      },
      {
        dedupe: async (row) => {
          return (await row.getCell('ID').innerText()).trim();
        },
        concurrency: 'sequential',
        maxPages: 20
      }
    );

    const ids = rows.map(r => r.id);
    // expect unique and full set
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(50);
  });


  test('map concurrency parallel also collects all rows (may be slower)', async ({ page }) => {
    test.setTimeout(120000);
    await page.setContent(makeWideTableHtml(10, 50));
    const table = await makeTable(page);

    // Ensure remaining rows appended
    await page.evaluate(() => (window as any).__appendBatch(1000));

    const rows = await table.map(
      async ({ row }) => {
        const id = (await row.getCell('ID').innerText()).trim();
        const val = await row.getCell('Col1').innerText();
        return { id, val };
      },
      {
        dedupe: async (row) => {
          return (await row.getCell('ID').innerText()).trim();
        },
        concurrency: 'parallel',
        maxPages: 20
      }
    );

    const ids = rows.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(50);
  });
});

