import { test, expect } from '@playwright/test';
import { useTable } from '../src';

/**
 * #366 — toJSON must return a coherent snapshot of ONE logical row even when the row's DOM
 * node recycles between the per-column reads (virtualized grids reuse nodes for other rows).
 *
 * With a resolveRowIndex strategy, toJSON re-pins to the expected logical index before each
 * column read: if the node it was reading drifted to a different logical row, it re-locates the
 * correct one (or throws) rather than silently mixing fields.
 *
 * The recycle is injected deterministically: a columnOverride.read on the first column reads its
 * own value, then swaps the DOM so the node the row locator points at now holds a DIFFERENT
 * logical row, and the target row (data-ri=1, "Bob") moves to another node.
 */
const HTML = `
  <table id="t">
    <thead><tr><th>Name</th><th>Type</th><th>Extra</th></tr></thead>
    <tbody>
      <tr data-ri="0"><td>Alice</td><td>Type-Alice</td><td>Extra-Alice</td></tr>
      <tr data-ri="1"><td>Bob</td><td>Type-Bob</td><td>Extra-Bob</td></tr>
      <tr data-ri="2"><td>Carol</td><td>Type-Carol</td><td>Extra-Carol</td></tr>
    </tbody>
  </table>
`;

const resolveRowIndex = async (row: import('@playwright/test').Locator) => {
    const v = await row.getAttribute('data-ri');
    return v != null ? Number(v) : undefined;
};

test.describe('toJSON row stability (#366)', () => {
    test('re-pins to the correct logical row when the node recycles mid-read', async ({ page }) => {
        await page.setContent(HTML);

        const table = await useTable(page.locator('#t'), {
            strategies: { resolveRowIndex },
            columnOverrides: {
                Name: {
                    read: async (cell) => {
                        const name = (await cell.innerText()).trim();
                        // Recycle AFTER reading Name: node 1 → Ghost(99), Bob(data-ri=1) → node 2.
                        await cell.page().evaluate(() => {
                            const rows = document.querySelectorAll('#t tbody tr');
                            const set = (tr: Element, ri: string, a: string, b: string, c: string) => {
                                tr.setAttribute('data-ri', ri);
                                const tds = tr.querySelectorAll('td');
                                tds[0].textContent = a; tds[1].textContent = b; tds[2].textContent = c;
                            };
                            set(rows[1], '99', 'Ghost', 'Type-Ghost', 'Extra-Ghost');
                            set(rows[2], '1', 'Bob', 'Type-Bob', 'Extra-Bob');
                        });
                        return name;
                    },
                },
            },
        }).init();

        const result = (await table.getRowByIndex(1).toJSON()) as Record<string, string>;
        // Every field must come from Bob (data-ri=1), not the recycled Ghost node.
        expect(result.Name).toBe('Bob');
        expect(result.Type).toBe('Type-Bob');
        expect(result.Extra).toBe('Extra-Bob');
    });

    test('throws when the row recycles away entirely and cannot be recovered', async ({ page }) => {
        await page.setContent(HTML);

        const table = await useTable(page.locator('#t'), {
            strategies: { resolveRowIndex },
            columnOverrides: {
                Name: {
                    read: async (cell) => {
                        const name = (await cell.innerText()).trim();
                        await cell.page().evaluate(() => {
                            // data-ri=1 disappears from the DOM entirely.
                            const rows = document.querySelectorAll('#t tbody tr');
                            rows[1].setAttribute('data-ri', '99');
                            rows[2].setAttribute('data-ri', '98');
                        });
                        return name;
                    },
                },
            },
        }).init();

        await expect(table.getRowByIndex(1).toJSON()).rejects.toThrow(/recycled out of the DOM/);
    });

    test('no resolveRowIndex → unchanged behavior (no re-pin)', async ({ page }) => {
        await page.setContent(HTML);
        const table = await useTable(page.locator('#t')).init();
        const result = (await table.getRowByIndex(1).toJSON()) as Record<string, string>;
        expect(result).toEqual({ Name: 'Bob', Type: 'Type-Bob', Extra: 'Extra-Bob' });
    });
});
