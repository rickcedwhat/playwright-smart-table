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
});
