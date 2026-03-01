import { expect, test } from '@playwright/test';
import { useTable, Strategies } from '../src';
import { DedupeStrategies } from '../src/strategies/dedupe';

// ─── Shared HTML fixture ──────────────────────────────────────────────────────
// A 3-page table (2 rows per page) navigated by a simple JS button.
const TABLE_HTML = `
<!DOCTYPE html>
<html>
<head><style>
  table { border-collapse: collapse; }
  td, th { padding: 4px 8px; border: 1px solid #ccc; }
</style></head>
<body>
  <div id="current-page">1</div>
  <table id="tbl">
    <thead><tr><th>ID</th><th>Name</th><th>Status</th></tr></thead>
    <tbody id="tbody"></tbody>
  </table>
  <button id="next">Next</button>
  <script>
    const pages = [
      [['1','Alice','Active'],['2','Bob','Inactive']],
      [['3','Carol','Active'],['4','Dave','Inactive']],
      [['5','Eve','Active'],['6','Frank','Inactive']],
    ];
    let currentPage = 0;
    function render() {
      const tbody = document.getElementById('tbody');
      tbody.innerHTML = pages[currentPage]
        .map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>')
        .join('');
      document.getElementById('current-page').textContent = String(currentPage + 1);
    }
    document.getElementById('next').addEventListener('click', () => {
      if (currentPage < pages.length - 1) { currentPage++; render(); }
    });
    render();
  </script>
</body>
</html>
`;

// 3-page table with both Next and Next Bulk (bulk jumps 2 pages) for useBulkPagination tests.
const TABLE_HTML_WITH_BULK = `
<!DOCTYPE html>
<html><head><style> table { border-collapse: collapse; } td, th { padding: 4px 8px; border: 1px solid #ccc; } </style></head><body>
  <div id="current-page">1</div>
  <table id="tbl">
    <thead><tr><th>ID</th><th>Name</th></tr></thead>
    <tbody id="tbody"></tbody>
  </table>
  <button id="next">Next</button>
  <button id="next-bulk">Next Bulk</button>
  <script>
    const pages = [
      [['1','Alice'],['2','Bob']],
      [['3','Carol'],['4','Dave']],
      [['5','Eve'],['6','Frank']],
    ];
    let currentPage = 0;
    const nextBtn = document.getElementById('next');
    const nextBulkBtn = document.getElementById('next-bulk');
    function render() {
      const tbody = document.getElementById('tbody');
      tbody.innerHTML = pages[currentPage].map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('');
      document.getElementById('current-page').textContent = String(currentPage + 1);
      nextBtn.disabled = currentPage >= 2;
      nextBulkBtn.disabled = currentPage >= 2;
    }
    document.getElementById('next').addEventListener('click', () => { if (currentPage < 2) { currentPage++; render(); } });
    document.getElementById('next-bulk').addEventListener('click', () => { if (currentPage < 2) { currentPage = Math.min(currentPage + 2, 2); render(); } });
    render();
  </script>
</body></html>
`;

function makeTable(page: import('@playwright/test').Page) {
    return useTable(page.locator('#tbl'), {
        maxPages: 3,
        strategies: {
            pagination: Strategies.Pagination.click({ next: () => page.locator('#next') }),
        },
    });
}

// ─── forEach ─────────────────────────────────────────────────────────────────
test.describe('forEach', () => {
    test('visits all rows across all pages', async ({ page }) => {
        await page.setContent(TABLE_HTML);
        const table = makeTable(page);
        const ids: string[] = [];

        await table.forEach(async ({ row }) => {
            ids.push(await row.getCell('ID').innerText());
        });

        expect(ids).toEqual(['1', '2', '3', '4', '5', '6']);
    });

    test('stop() halts iteration early', async ({ page }) => {
        await page.setContent(TABLE_HTML);
        const table = makeTable(page);
        const ids: string[] = [];

        await table.forEach(async ({ row, rowIndex, stop }) => {
            ids.push(await row.getCell('ID').innerText());
            if (rowIndex === 2) stop(); // stop after processing the 3rd row (0-based index 2)
        });

        // stopped after visiting rowIndex 2 (3rd row), so we should have exactly 3 rows
        expect(ids).toEqual(['1', '2', '3']);
    });

    test('maxPages limits pages visited', async ({ page }) => {
        await page.setContent(TABLE_HTML);
        const table = makeTable(page);
        let count = 0;

        await table.forEach(async () => { count++; }, { maxPages: 1 });

        expect(count).toBe(2); // only page 1 (2 rows)
    });

    test('parallel: true runs within-page concurrently', async ({ page }) => {
        await page.setContent(TABLE_HTML);
        const table = makeTable(page);
        const ids: string[] = [];

        // parallel=true should still produce all rows (just concurrent within each page)
        await table.forEach(async ({ row }) => {
            ids.push(await row.getCell('ID').innerText());
        }, { parallel: true });

        expect(ids.sort()).toEqual(['1', '2', '3', '4', '5', '6']);
    });
});

// ─── map ─────────────────────────────────────────────────────────────────────
test.describe('map', () => {
    test('collects values from all rows across all pages', async ({ page }) => {
        await page.setContent(TABLE_HTML);
        const table = makeTable(page);

        const names = await table.map(({ row }) => row.getCell('Name').innerText());

        expect(names).toEqual(['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank']);
    });

    test('stop() halts after current page', async ({ page }) => {
        await page.setContent(TABLE_HTML);
        const table = makeTable(page);

        const names = await table.map(async ({ row, rowIndex, stop }) => {
            if (rowIndex >= 2) stop();
            return row.getCell('Name').innerText();
        });

        // stop called after row 2 meaning page 2 doesn't get processed
        expect(names.length).toBeLessThanOrEqual(4); // at most page 1 + page 2 (stop() mid-page)
    });

    test('maxPages: 1 limits to first page', async ({ page }) => {
        await page.setContent(TABLE_HTML);
        const table = makeTable(page);

        const names = await table.map(({ row }) => row.getCell('Name').innerText(), { maxPages: 1 });

        expect(names).toEqual(['Alice', 'Bob']);
    });

    test('parallel: false produces ordered results', async ({ page }) => {
        await page.setContent(TABLE_HTML);
        const table = makeTable(page);

        const names = await table.map(({ row }) => row.getCell('Name').innerText(), { parallel: false });

        expect(names).toEqual(['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank']);
    });
});

// ─── filter ──────────────────────────────────────────────────────────────────
test.describe('filter', () => {
    test('returns only rows matching predicate across all pages', async ({ page }) => {
        await page.setContent(TABLE_HTML);
        const table = makeTable(page);

        const active = await table.filter(async ({ row }) =>
            await row.getCell('Status').innerText() === 'Active'
        );

        // 3 active rows (Alice/Carol/Eve, one per page)
        expect(active.length).toBe(3);
        // Note: active rows are returned as-is (no bringIntoView).
        // toJSON() will read the current DOM page (page 3 after full pagination),
        // so content-based assertions require bringIntoView() first.
        // We verify the count and that the array is a proper SmartRowArray.
        expect(typeof active.toJSON).toBe('function');
    });

    test('returns a SmartRowArray with toJSON()', async ({ page }) => {
        await page.setContent(TABLE_HTML);
        const table = makeTable(page);

        const inactive = await table.filter(async ({ row }) =>
            await row.getCell('Status').innerText() === 'Inactive'
        );

        expect(typeof inactive.toJSON).toBe('function');
        expect(inactive.length).toBe(3);
    });

    test('stop() returns partial results collected so far', async ({ page }) => {
        await page.setContent(TABLE_HTML);
        const table = makeTable(page);

        const rows = await table.filter(async ({ row, stop }) => {
            const id = await row.getCell('ID').innerText();
            if (id === '3') stop();
            return true;
        });

        // stop called on row 3 — should include rows 1 and 2, row 3 may or may not be included
        expect(rows.length).toBeGreaterThanOrEqual(2);
        expect(rows.length).toBeLessThanOrEqual(3);
    });

    test('filter with maxPages: 1 only looks at first page', async ({ page }) => {
        await page.setContent(TABLE_HTML);
        const table = makeTable(page);

        const active = await table.filter(async ({ row }) =>
            await row.getCell('Status').innerText() === 'Active',
            { maxPages: 1 }
        );

        expect(active.length).toBe(1); // Only Alice on page 1
    });
});

// ─── Async iterator ──────────────────────────────────────────────────────────
test.describe('async iterator [Symbol.asyncIterator]', () => {
    test('for await...of iterates all rows across pages', async ({ page }) => {
        await page.setContent(TABLE_HTML);
        const table = makeTable(page);
        await table.init();

        const ids: string[] = [];
        for await (const { row, rowIndex } of table) {
            ids.push(await row.getCell('ID').innerText());
            expect(typeof rowIndex).toBe('number');
        }

        expect(ids).toEqual(['1', '2', '3', '4', '5', '6']);
    });

    test('for await...of supports early break', async ({ page }) => {
        await page.setContent(TABLE_HTML);
        const table = makeTable(page);
        await table.init();

        const ids: string[] = [];
        for await (const { row } of table) {
            ids.push(await row.getCell('ID').innerText());
            if (ids.length === 3) break;
        }

        expect(ids).toEqual(['1', '2', '3']);
    });
});

// ─── dedupe option ───────────────────────────────────────────────────────────
test.describe('dedupe option', () => {
    test('map with dedupe skips duplicate rows', async ({ page }) => {
        // Use a page that has duplicate IDs to test dedup
        await page.setContent(TABLE_HTML);
        const table = makeTable(page);

        // Without dedupe: 6 items. With dedupe by unique ID: same 6 (all unique in fixture)
        const ids = await table.map(({ row }) => row.getCell('ID').innerText(), {
            dedupe: async (row) => row.getCell('ID').innerText(),
        });

        // All unique in this fixture, so dedupe doesn't remove anything
        expect(ids.length).toBe(6);
        // Verify no duplicates
        expect(new Set(ids).size).toBe(6);
    });

    test('filter uses globally configured dedupe strategy sequentially', async ({ page }) => {
        // Create table with repeated identical rows across "pages"
        const DUP_HTML = `
            <table id="dup-table">
                <thead><tr><th>ID</th><th>Status</th></tr></thead>
                <tbody>
                    <tr><td>1</td><td>Active</td></tr>
                    <tr><td>1</td><td>Active</td></tr>
                </tbody>
            </table>
        `;
        await page.setContent(DUP_HTML);
        let paginationCalled = false;

        const table = useTable(page.locator('#dup-table'), {
            strategies: {
                dedupe: async (row) => row.getCell('ID').innerText(),
                pagination: {
                    goNext: async () => {
                        if (paginationCalled) return false;
                        paginationCalled = true;
                        // Mock pagination by appending the identical rows again
                        await page.evaluate(() => {
                            const tbody = document.querySelector('tbody');
                            tbody!.innerHTML += '<tr><td>1</td><td>Active</td></tr><tr><td>1</td><td>Active</td></tr>';
                        });
                        return true;
                    }
                }
            }
        });

        // Use filter with default sequential iteration
        const activeRows = await table.filter(async ({ row }) => {
            return await row.getCell('Status').innerText() === 'Active';
        });

        // 4 rows in DOM matching 'Active', but all have ID '1', so dedupe should return exactly 1
        expect(activeRows.length).toBe(1);
    });
});

// ─── useBulkPagination option ─────────────────────────────────────────────────
test.describe('useBulkPagination option', () => {
    test('map with useBulkPagination: true uses goNextBulk and collects all rows', async ({ page }) => {
        await page.setContent(TABLE_HTML_WITH_BULK);
        const table = useTable(page.locator('#tbl'), {
            maxPages: 3,
            strategies: {
                pagination: {
                    goNext: async (ctx) => {
                        const b = ctx.page.locator('#next');
                        if (await b.isDisabled()) return false;
                        await b.click();
                        return true;
                    },
                    goNextBulk: async (ctx) => {
                        const b = ctx.page.locator('#next');
                        if (await b.isDisabled()) return false;
                        await b.click();
                        return 1;
                    },
                    nextBulkPages: 1,
                },
            },
        });

        const ids = await table.map(({ row }) => row.getCell('ID').innerText(), {
            useBulkPagination: true,
        });

        expect(ids).toEqual(['1', '2', '3', '4', '5', '6']);
        expect(table.currentPageIndex).toBe(2);
    });

    test('forEach with useBulkPagination: false uses goNext (default)', async ({ page }) => {
        await page.setContent(TABLE_HTML);
        const table = makeTable(page);
        const ids: string[] = [];
        await table.forEach(
            async ({ row }) => { ids.push(await row.getCell('ID').innerText()); },
            { useBulkPagination: false }
        );
        expect(ids).toEqual(['1', '2', '3', '4', '5', '6']);
        expect(table.currentPageIndex).toBe(2);
    });
});

// ─── numeric pagination result (useTable path) ─────────────────────────────────
test.describe('numeric pagination result in useTable iteration', () => {
    test('currentPageIndex increases by numeric return from goNextBulk', async ({ page }) => {
        await page.setContent(TABLE_HTML_WITH_BULK);
        let advanceCount = 0;
        const table = useTable(page.locator('#tbl'), {
            maxPages: 3,
            strategies: {
                pagination: {
                    goNext: async (ctx) => {
                        const btn = ctx.page.locator('#next');
                        if (await btn.isDisabled()) return false;
                        await btn.click();
                        return true;
                    },
                    goNextBulk: async (ctx) => {
                        const btn = ctx.page.locator('#next-bulk');
                        if (await btn.isDisabled()) return false;
                        advanceCount++;
                        await btn.click();
                        // Wait for fixture to update so next _advancePage sees button disabled
                        await expect(ctx.page.locator('#next-bulk')).toBeDisabled();
                        return 2;
                    },
                    nextBulkPages: 2,
                },
            },
        });

        const ids = await table.map(({ row }) => row.getCell('ID').innerText(), {
            useBulkPagination: true,
        });

        expect(ids).toEqual(['1', '2', '5', '6']);
        expect(table.currentPageIndex).toBe(2);
        expect(advanceCount).toBe(1);
    });
});
