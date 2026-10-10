import { test, expect, Page } from '@playwright/test';
import { useTable, Strategies } from '../src/index';

/**
 * A paged table with two rows per page. Page-number buttons show a sliding window of
 * `window` pages around the current page; when page 1 falls outside the window it is
 * rendered last, so a substring match for "1" would hit "10".."14" first.
 * Clicks per control are counted in `window.clicks`.
 */
async function setupPager(page: Page, opts: { pages: number; startPage?: number; window?: number }) {
    await page.setContent(`
        <div id="wrap">
            <table id="t">
                <thead><tr><th>ID</th><th>Name</th></tr></thead>
                <tbody id="tbody"></tbody>
            </table>
            <div id="pager">
                <button id="first">First</button>
                <button id="prev">Prev</button>
                <span id="numbers"></span>
                <button id="next">Next</button>
                <button id="last">Last</button>
            </div>
            <div id="status"></div>
        </div>
        <script>
            const TOTAL = ${opts.pages};
            const WINDOW = ${opts.window ?? 0};
            window.clicks = { first: 0, prev: 0, next: 0, last: 0, number: 0 };
            let current = ${opts.startPage ?? 1};

            function render(p) {
                current = Math.max(1, Math.min(TOTAL, p));
                const a = current * 2 - 1, b = current * 2;
                document.getElementById('tbody').innerHTML =
                    '<tr><td>' + a + '</td><td>Row ' + a + '</td></tr><tr><td>' + b + '</td><td>Row ' + b + '</td></tr>';
                document.getElementById('status').textContent = 'Page ' + current;
                document.getElementById('prev').disabled = current === 1;
                document.getElementById('first').disabled = current === 1;
                document.getElementById('next').disabled = current === TOTAL;
                document.getElementById('last').disabled = current === TOTAL;

                const numbers = document.getElementById('numbers');
                numbers.innerHTML = '';
                if (!WINDOW) return;
                const half = Math.floor(WINDOW / 2);
                const start = Math.max(1, Math.min(current - half, TOTAL - WINDOW + 1));
                const labels = [];
                for (let n = start; n < start + WINDOW; n++) labels.push(n);
                if (!labels.includes(1)) labels.push(1);
                for (const n of labels) {
                    const btn = document.createElement('button');
                    btn.className = 'pg';
                    btn.textContent = String(n);
                    btn.addEventListener('click', () => { window.clicks.number++; render(n); });
                    numbers.appendChild(btn);
                }
            }

            document.getElementById('first').addEventListener('click', () => { window.clicks.first++; render(1); });
            document.getElementById('prev').addEventListener('click', () => { window.clicks.prev++; render(current - 1); });
            document.getElementById('next').addEventListener('click', () => { window.clicks.next++; render(current + 1); });
            document.getElementById('last').addEventListener('click', () => { window.clicks.last++; render(TOTAL); });
            render(current);
        </script>
    `);
}

const getClicks = (page: Page) => page.evaluate(() => (window as any).clicks as Record<string, number>);
const resetClicks = (page: Page) => page.evaluate(() => {
    (window as any).clicks = { first: 0, prev: 0, next: 0, last: 0, number: 0 };
});

test.describe('Pagination.click detectCurrentPage', () => {
    test('init() starts currentPageIndex at the detected page', async ({ page }) => {
        await setupPager(page, { pages: 5, startPage: 3 });
        const table = await useTable(page.locator('#wrap'), {
            rowSelector: 'tbody tr',
            strategies: {
                pagination: Strategies.Pagination.click(
                    { next: '#next', previous: '#prev' },
                    {
                        detectCurrentPage: async (root) =>
                            Number((await root.locator('#status').innerText()).replace('Page ', '')) - 1,
                    },
                ),
            },
        }).init();

        expect(table.currentPageIndex).toBe(2);
    });

    for (const [label, detect] of [
        ['returns -1', async () => -1],
        ['returns a non-integer', async () => 1.5],
        ['throws', async () => { throw new Error('no pager'); }],
    ] as const) {
        test(`falls back to page 0 when detectCurrentPage ${label}`, async ({ page }) => {
            await setupPager(page, { pages: 5, startPage: 3 });
            const table = await useTable(page.locator('#wrap'), {
                rowSelector: 'tbody tr',
                strategies: {
                    pagination: Strategies.Pagination.click(
                        { next: '#next', previous: '#prev' },
                        { detectCurrentPage: detect },
                    ),
                },
            }).init();

            expect(table.currentPageIndex).toBe(0);
        });
    }
});

test.describe('Pagination.click navigation planning', () => {
    test('bringIntoView near the end uses Last + Prev when numberOfPages is known', async ({ page }) => {
        await setupPager(page, { pages: 10 });
        const table = useTable(page.locator('#wrap'), {
            rowSelector: 'tbody tr',
            strategies: {
                pagination: Strategies.Pagination.click(
                    { first: '#first', previous: '#prev', next: '#next', last: '#last' },
                    { numberOfPages: 10 },
                ),
            },
            maxPages: 10,
        });

        const row = await table.findRow({ ID: '17' });
        expect(table.currentPageIndex).toBe(8);

        await table.reset();
        await expect(page.locator('#status')).toHaveText('Page 1');
        await resetClicks(page);

        await row.bringIntoView();

        await expect(page.locator('#status')).toHaveText('Page 9');
        expect(table.currentPageIndex).toBe(8);
        expect(await getClicks(page)).toEqual({ first: 0, prev: 1, next: 0, last: 1, number: 0 });
    });

    test('pageNumbers steps a sliding window to reach page 12, then matches "1" exactly', async ({ page }) => {
        await setupPager(page, { pages: 15, window: 5 });
        const table = useTable(page.locator('#wrap'), {
            rowSelector: 'tbody tr',
            strategies: {
                pagination: Strategies.Pagination.click({
                    first: '#first', previous: '#prev', next: '#next', pageNumbers: '.pg',
                }),
            },
            maxPages: 15,
        });

        const firstPageRow = await table.findRow({ ID: '1' });
        const page12Row = await table.findRow({ ID: '23' });
        expect(table.currentPageIndex).toBe(11);

        await table.reset();
        await resetClicks(page);

        await page12Row.bringIntoView();
        await expect(page.locator('#status')).toHaveText('Page 12');
        expect(table.currentPageIndex).toBe(11);
        const toTwelve = await getClicks(page);
        expect(toTwelve.number).toBe(1);
        expect(toTwelve.next).toBeGreaterThan(0);

        // Window is now 10–14 with "1" rendered after it.
        await expect(page.locator('.pg')).toHaveText(['10', '11', '12', '13', '14', '1']);
        await firstPageRow.bringIntoView();
        await expect(page.locator('#status')).toHaveText('Page 1');
        expect(table.currentPageIndex).toBe(0);
    });
});
