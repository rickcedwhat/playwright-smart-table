import { test, expect, type Page } from '@playwright/test';
import { useTable, Strategies, type TableConfig } from '../src';

const HTML = `
  <table id="t">
    <thead><tr><th>Name</th><th>Age</th></tr></thead>
    <tbody>
      <tr data-index="0"><td>Alice</td><td>35</td></tr>
      <tr data-index="1"><td>Bob</td><td>42</td></tr>
    </tbody>
  </table>
`;
const DATA = [{ Name: 'Alice', Age: '35' }, { Name: 'Bob', Age: '42' }];

async function makeTable(page: Page, columnOverrides?: TableConfig['columnOverrides']) {
    await page.setContent(HTML);
    return useTable(page.locator('#t'), {
        concurrency: 'synchronized',
        autoScroll: false,
        columnOverrides,
        strategies: {
            loading: { isHeaderLoading: Strategies.Loading.Headers.never },
            resolveRowIndex: async row => Number(await row.getAttribute('data-index')),
            viewport: { getVisibleColumnRange: async () => ({ first: 0, last: 1 }) },
        },
    }).init();
}

test.describe('findRows returns independently readable rows', () => {
    test('reads a single result without consuming its peers', async ({ page }) => {
        const table = await makeTable(page);
        const rows = await table.findRows();
        expect(rows).toHaveLength(2);
        expect(await rows[0].toJSON()).toEqual(DATA[0]);
    });

    test('reads every result sequentially', async ({ page }) => {
        const rows = await (await makeTable(page)).findRows();
        const results = [];
        for (const row of rows) results.push(await row.toJSON());
        expect(results).toEqual(DATA);
    });

    test('repeated getValue and selected-column reads need no peer participation', async ({ page }) => {
        const rows = await (await makeTable(page)).findRows();
        expect(await rows[1].getValue('Name')).toBe('Bob');
        expect(await rows[1].toJSON({ columns: ['Age'] })).toEqual({ Age: '42' });
        expect(await rows[1].getValue('Name')).toBe('Bob');
    });

    test('concurrent readers can select different columns', async ({ page }) => {
        const rows = await (await makeTable(page)).findRows();
        expect(await Promise.all([
            rows[0].toJSON({ columns: ['Name'] }),
            rows[1].toJSON({ columns: ['Age'] }),
        ])).toEqual([{ Name: 'Alice' }, { Age: '42' }]);
    });

    test('a failed read does not prevent a later peer read', async ({ page }) => {
        const failure = new Error('Alice read failed');
        const table = await makeTable(page, {
            Name: { read: async cell => {
                const value = await cell.innerText();
                if (value === 'Alice') throw failure;
                return value;
            } },
        });
        const rows = await table.findRows();
        await expect(rows[0].toJSON()).rejects.toBe(failure);
        expect(await rows[1].toJSON()).toEqual(DATA[1]);
    });

    test('the array toJSON helper still reads every result', async ({ page }) => {
        const rows = await (await makeTable(page)).findRows();
        expect(await rows.toJSON()).toEqual(DATA);
    });
});

for (const method of ['map', 'array'] as const) {
    test(`${method} reads across a shared viewport with safe column navigation`, async ({ page }) => {
        await page.setContent(HTML);
        await page.locator('tbody tr').evaluateAll(rows => rows.forEach(row => {
            row.children[0].setAttribute('data-col', '0');
            row.children[1].remove();
        }));
        let visibleColumn = 0;
        const scrolls: number[] = [];
        const table = await useTable(page.locator('#t'), {
            concurrency: 'synchronized',
            autoScroll: false,
            strategies: {
                loading: { isHeaderLoading: Strategies.Loading.Headers.never },
                resolveRowIndex: async row => Number(await row.getAttribute('data-index')),
                getCellLocator: ({ row, columnIndex }) => row.locator(`[data-col="${columnIndex}"]`),
                viewport: {
                    getVisibleColumnRange: async () => ({ first: visibleColumn, last: visibleColumn }),
                    scrollToColumn: async (_context, index) => {
                        scrolls.push(index);
                        visibleColumn = index;
                        await page.locator('tbody tr').evaluateAll((rows, column) => rows.forEach((row, i) => {
                            const value = column === 0 ? (i === 0 ? 'Alice' : 'Bob') : (i === 0 ? '35' : '42');
                            row.innerHTML = `<td data-col="${column}">${value}</td>`;
                        }), index);
                    },
                },
            },
        }).init();

        const results = method === 'map'
            ? await table.map(({ row }) => row.toJSON())
            : await (await table.findRows()).toJSON();
        expect(results).toEqual(DATA);
        expect(scrolls).toEqual(method === 'map' ? [1] : [1, 0, 1]);
    });
}
