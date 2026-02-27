import { test, expect } from '@playwright/test';
import { useTable, Strategies } from '../src/index';

test.describe('Stateful Cross-Page Navigation & PaginationPrimitives', () => {

    const setupThreePageTable = async (page: any) => {
        const tableHTML = `
      <table id="my-table">
        <thead><tr><th>ID</th><th>Name</th></tr></thead>
        <tbody id="tbody">
          <!-- Page 1 -->
          <tr><td>1</td><td>Row 1</td></tr>
          <tr><td>2</td><td>Row 2</td></tr>
        </tbody>
        <tfoot><tr><td>
          <button id="first">First</button>
          <button id="prev" disabled>Prev</button>
          <button id="next">Next</button>
          <button id="prev-bulk" disabled>Prev Bulk</button>
          <button id="next-bulk">Next Bulk</button>
          
          <input type="number" id="page-input" value="1" />
          <button id="jump">Go</button>
        </td></tr></tfoot>
      </table>
      <div id="status">Page 1</div>
      
      <script>
        let currentPage = 1;

        const renderPage = (page) => {
          currentPage = page;
          document.getElementById('status').innerText = 'Page ' + page;
          
          // ADD SYNTHETIC DELAY to allow Playwright to observe "before" state
          setTimeout(() => {
            if (page === 1) {
                document.getElementById('tbody').innerHTML = '<tr><td>1</td><td>Row 1</td></tr><tr><td>2</td><td>Row 2</td></tr>';
                document.getElementById('prev').disabled = true;
                document.getElementById('next').disabled = false;
                document.getElementById('prev-bulk').disabled = true;
                document.getElementById('next-bulk').disabled = false;
            } else if (page === 2) {
                document.getElementById('tbody').innerHTML = '<tr><td>3</td><td>Row 3</td></tr><tr><td>4</td><td>Row 4</td></tr>';
                document.getElementById('prev').disabled = false;
                document.getElementById('next').disabled = false;
                document.getElementById('prev-bulk').disabled = false;
                document.getElementById('next-bulk').disabled = false;
            } else if (page === 3) {
                document.getElementById('tbody').innerHTML = '<tr><td>5</td><td>Row 5</td></tr><tr><td>6</td><td>Row 6</td></tr>';
                document.getElementById('prev').disabled = false;
                document.getElementById('next').disabled = true;
                document.getElementById('prev-bulk').disabled = false;
                document.getElementById('next-bulk').disabled = true;
            }
          }, 30); 
        };

        document.getElementById('next').addEventListener('click', () => {
          if (currentPage < 3) renderPage(currentPage + 1);
        });

        document.getElementById('prev').addEventListener('click', () => {
          if (currentPage > 1) renderPage(currentPage - 1);
        });

        document.getElementById('next-bulk').addEventListener('click', () => {
          if (currentPage < 3) renderPage(Math.min(currentPage + 2, 3));
        });

        document.getElementById('prev-bulk').addEventListener('click', () => {
          if (currentPage > 1) renderPage(Math.max(currentPage - 2, 1));
        });

        document.getElementById('first').addEventListener('click', () => renderPage(1));

        document.getElementById('jump').addEventListener('click', () => {
             const val = parseInt(document.getElementById('page-input').value);
             if (val >= 1 && val <= 3) renderPage(val);
        });
      </script>
    `;

        await page.setContent(tableHTML);
    };

    test('TableResult correctly tracks currentPageIndex during findRows and iterates', async ({ page }) => {
        await setupThreePageTable(page);

        // Target the parent wrapper instead of the table directly so the controls are in scope
        const table = useTable(page.locator('#my-table'), {
            strategies: {
                pagination: Strategies.Pagination.click({ next: '#next' })
            },
            maxPages: 3,
            debug: { logLevel: 'verbose' }
        });

        expect(table.currentPageIndex).toBe(0); // Starts at 0

        // Auto-paginates until no more Next buttons
        await table.findRows({});


        // Since there are 3 pages (indexes 0, 1, 2)
        expect(table.currentPageIndex).toBe(2);

        // Status text should read Page 3
        await expect(page.locator('#status')).toHaveText('Page 3');
    });

    test('SmartRow tracks tablePageIndex and bringIntoView loops goPrevious correctly', async ({ page }) => {
        await setupThreePageTable(page);

        const table = useTable(page.locator('#my-table'), {
            strategies: {
                pagination: Strategies.Pagination.click({
                    next: '#next',
                    previous: '#prev'
                })
            },
            maxPages: 3,
            debug: { logLevel: 'verbose' }
        });

        const rows = await table.findRows({});
        expect(rows.length).toBe(6);
        expect(table.currentPageIndex).toBe(2);

        // Row 1 should be on page 1 (index 0)
        expect(rows[0].tablePageIndex).toBe(0);
        expect(rows[0].table.currentPageIndex).toBe(2);

        // Bring Row 1 from Page 1 into view
        // Library should realize we are at 2, target is 0, so loop goPrevious twice
        await rows[0].bringIntoView();

        expect(table.currentPageIndex).toBe(0);
        expect(rows[0].table.currentPageIndex).toBe(0);
        await expect(page.locator('#status')).toHaveText('Page 1');
    });

    test('bringIntoView uses goToPage for instant jumping', async ({ page }) => {
        await setupThreePageTable(page);

        const table = useTable(page.locator('#my-table'), {
            strategies: {
                pagination: {
                    goNext: async (ctx) => {
                        const btn = ctx.page.locator('#next');
                        if (await btn.isDisabled()) return false;
                        await btn.click();
                        await ctx.page.waitForTimeout(50);
                        return true;
                    },
                    goToPage: async (pageIndex, ctx) => {
                        await ctx.page.locator('#page-input').fill((pageIndex + 1).toString());
                        await ctx.page.locator('#jump').click();
                        await ctx.page.waitForTimeout(50);
                        return true;
                    }
                }
            },
            maxPages: 3,
            debug: { logLevel: 'verbose' }
        });

        const rows = await table.findRows({});
        expect(table.currentPageIndex).toBe(2); // Ends on page 3

        // Row on Page 2 (index 1)
        await rows[2].bringIntoView();

        // Should instant jump using goToPage(1)
        expect(table.currentPageIndex).toBe(1);
        await expect(page.locator('#status')).toHaveText('Page 2');
    });

    test('bringIntoView calculates goToFirst + goNext loop if no goPrevious or goToPage', async ({ page }) => {
        await setupThreePageTable(page);

        const table = useTable(page.locator('#my-table'), {
            strategies: {
                pagination: {
                    goNext: async (ctx) => {
                        const btn = ctx.page.locator('#next');
                        if (await btn.isDisabled()) return false;
                        await btn.click();
                        await ctx.page.waitForTimeout(50);
                        return true;
                    },
                    goToFirst: async (ctx) => {
                        await ctx.page.locator('#first').click();
                        await ctx.page.waitForTimeout(50);
                        return true;
                    }
                    // NO goPrevious and NO goToPage !
                }
            },
            maxPages: 3,
            debug: { logLevel: 'verbose' }
        });

        const rows = await table.findRows({});
        expect(table.currentPageIndex).toBe(2); // Ends on page 3

        // Row on Page 2 (index 1)
        await rows[2].bringIntoView();

        // Library knows target is 1, current is 2. Path: goToFirst() -> 0, then goNext() -> 1.
        expect(table.currentPageIndex).toBe(1);
        await expect(page.locator('#status')).toHaveText('Page 2');
    });

    test('TableResult correctly tracks bulk jumps', async ({ page }) => {
        await setupThreePageTable(page);

        // Target the parent wrapper instead of the table directly so the controls are in scope
        const table = useTable(page.locator('#my-table'), {
            strategies: {
                pagination: Strategies.Pagination.click({
                    nextBulk: '#next-bulk',
                    previousBulk: '#prev-bulk'
                }, {
                    nextBulkPages: 2,
                    previousBulkPages: 2
                })
            },
            maxPages: 3,
            debug: { logLevel: 'verbose' }
        });

        expect(table.currentPageIndex).toBe(0); // Starts at 0

        // In findRows, if custom strategies are evaluated, bulk takes priority
        // It should click next-bulk once, jumping +2 pages
        await table.findRows({});

        // Since there are 3 pages (indexes 0, 1, 2)
        expect(table.currentPageIndex).toBe(2);

        // Status text should read Page 3
        await expect(page.locator('#status')).toHaveText('Page 3');
    });

});
