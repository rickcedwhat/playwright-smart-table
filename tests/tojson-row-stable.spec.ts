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

/**
 * #366 concurrency safety — the scroll-back recovery must only fire for STANDALONE reads.
 * During a map/forEach/iterator batch (parallel or synchronized), sibling rows share the same
 * viewport; a scroll-back to recover one drifted row would recycle the others out from under
 * their in-flight reads. So batch reads use rescan-only recovery (never scrollToRow) and throw
 * if the row can't be found in the current DOM; standalone reads may attempt scrollToRow.
 *
 * Both cases drift the target row's node away irrecoverably (the spied scrollToRow is a no-op),
 * so both ultimately throw — the observable difference is whether scrollToRow was CALLED.
 */
test.describe('toJSON recovery is concurrency-safe (#366)', () => {
    // Recycle the target row's node away on the first (Name) read so re-pin can't rescan it back.
    const recycleAwayOverride = {
        Name: {
            read: async (cell: import('@playwright/test').Locator) => {
                const name = (await cell.innerText()).trim();
                await cell.page().evaluate(() => {
                    // Every data-ri becomes something else → no row resolves to its original index.
                    document.querySelectorAll('#t tbody tr').forEach((tr, i) => {
                        tr.setAttribute('data-ri', String(100 + i));
                    });
                });
                return name;
            },
        },
    };

    test('standalone toJSON attempts scrollToRow recovery', async ({ page }) => {
        await page.setContent(HTML);
        let scrollCalls = 0;
        const table = await useTable(page.locator('#t'), {
            strategies: {
                resolveRowIndex,
                viewport: { scrollToRow: async () => { scrollCalls++; } },
            },
            columnOverrides: recycleAwayOverride,
        }).init();

        await expect(table.getRowByIndex(1).toJSON()).rejects.toThrow(/recycled out of the DOM/);
        // Standalone read is allowed to scroll back to try to recover the row.
        expect(scrollCalls).toBeGreaterThan(0);
    });

    test('standalone toJSON recovers via viewport.scrollToRow when the row is unmounted', async ({ page }) => {
        await page.setContent(HTML);
        let scrollCalls = 0;
        const table = await useTable(page.locator('#t'), {
            strategies: {
                resolveRowIndex,
                viewport: {
                    // scrollToRow brings the unmounted target row back into the DOM so the
                    // subsequent rescan finds it — exercising the recovery success branch.
                    scrollToRow: async () => {
                        scrollCalls++;
                        await page.evaluate(() => {
                            const tbody = document.querySelector('#t tbody')!;
                            if (tbody.querySelector('tr[data-ri="1"]')) return;
                            const tr = document.createElement('tr');
                            tr.setAttribute('data-ri', '1');
                            tr.innerHTML = '<td>Bob</td><td>Type-Bob</td><td>Extra-Bob</td>';
                            const carol = tbody.querySelector('tr[data-ri="2"]');
                            tbody.insertBefore(tr, carol);
                        });
                    },
                },
            },
            columnOverrides: {
                Name: {
                    read: async (cell) => {
                        const name = (await cell.innerText()).trim();
                        // Fully unmount Bob's row — only scrollToRow can bring it back.
                        await cell.page().evaluate(() => {
                            document.querySelector('#t tbody tr[data-ri="1"]')?.remove();
                        });
                        return name;
                    },
                },
            },
        }).init();

        const result = (await table.getRowByIndex(1).toJSON()) as Record<string, string>;
        expect(result).toEqual({ Name: 'Bob', Type: 'Type-Bob', Extra: 'Extra-Bob' });
        expect(scrollCalls).toBeGreaterThan(0);
    });

    test('map batch never scrolls (rescan-only) and throws with a batch-aware message', async ({ page }) => {
        await page.setContent(HTML);
        let scrollCalls = 0;
        const table = await useTable(page.locator('#t'), {
            strategies: {
                resolveRowIndex,
                viewport: { scrollToRow: async () => { scrollCalls++; } },
            },
            columnOverrides: recycleAwayOverride,
        }).init();

        await expect(table.map(({ row }) => row.toJSON())).rejects.toThrow(/map\/forEach batch/);
        // No scroll-back during a batch — that would disrupt sibling rows.
        expect(scrollCalls).toBe(0);
    });
});

test.describe('toJSON({ atomic }) — frozen snapshot with lazy materialization', () => {
    test('reads all columns in one snapshot (no stagger possible)', async ({ page }) => {
        await page.setContent(HTML);
        const table = await useTable(page.locator('#t')).init();
        const result = (await table.getRowByIndex(1).toJSON({ atomic: true })) as Record<string, string>;
        expect(result).toEqual({ Name: 'Bob', Type: 'Type-Bob', Extra: 'Extra-Bob' });
    });

    test('columns filter works in atomic mode', async ({ page }) => {
        await page.setContent(HTML);
        const table = await useTable(page.locator('#t')).init();
        const result = (await table.getRowByIndex(0).toJSON({ atomic: true, columns: ['Name', 'Extra'] })) as Record<string, string>;
        expect(result).toEqual({ Name: 'Alice', Extra: 'Extra-Alice' });
        expect(result).not.toHaveProperty('Type');
    });

    test('immune to mid-read recycling that breaks non-atomic toJSON', async ({ page }) => {
        await page.setContent(HTML);

        // Non-atomic: the column override on Name swaps the DOM between reads → stagger.
        const staggerTable = await useTable(page.locator('#t'), {
            columnOverrides: {
                Name: {
                    read: async (cell) => {
                        const name = (await cell.innerText()).trim();
                        await cell.page().evaluate(() => {
                            const rows = document.querySelectorAll('#t tbody tr');
                            const set = (tr: Element, a: string, b: string, c: string) => {
                                const tds = tr.querySelectorAll('td');
                                tds[0].textContent = a; tds[1].textContent = b; tds[2].textContent = c;
                            };
                            set(rows[1], 'Ghost', 'Type-Ghost', 'Extra-Ghost');
                        });
                        return name;
                    },
                },
            },
        }).init();

        // Without resolveRowIndex, non-atomic toJSON silently mixes fields.
        const broken = (await staggerTable.getRowByIndex(1).toJSON()) as Record<string, string>;
        expect(broken.Name).toBe('Bob');
        expect(broken.Type).toBe('Type-Ghost'); // stagger: read Ghost's Type

        // Reset DOM for atomic test.
        await page.setContent(HTML);
        const atomicTable = await useTable(page.locator('#t')).init();

        // Atomic snapshots the row before any column override can fire → coherent.
        const coherent = (await atomicTable.getRowByIndex(1).toJSON({ atomic: true })) as Record<string, string>;
        expect(coherent).toEqual({ Name: 'Bob', Type: 'Type-Bob', Extra: 'Extra-Bob' });
    });

    test('skips fake columns that exceed DOM cell count', async ({ page }) => {
        await page.setContent(HTML);
        const table = await useTable(page.locator('#t'), {
            strategies: {
                header: async (ctx) => {
                    const headers = await ctx.root.locator('th').allInnerTexts();
                    headers.push('fake');
                    return headers;
                },
            },
        }).init();
        const result = (await table.getRowByIndex(1).toJSON({ atomic: true })) as Record<string, string>;
        // 'fake' maps to index 3, but only 3 cells exist (indices 0-2) → omitted.
        expect(result).toEqual({ Name: 'Bob', Type: 'Type-Bob', Extra: 'Extra-Bob' });
        expect(result).not.toHaveProperty('fake');
    });

    test('column overrides run against the frozen reconstruction (not live DOM)', async ({ page }) => {
        await page.setContent(HTML);

        const table = await useTable(page.locator('#t'), {
            columnOverrides: {
                Name: {
                    read: async (cell) => {
                        const name = (await cell.innerText()).trim();
                        // Mutate the LIVE DOM after reading — this would break non-atomic reads
                        // of later columns, but atomic reads from the frozen reconstruction.
                        await page.evaluate(() => {
                            const rows = document.querySelectorAll('#t tbody tr');
                            rows[1].querySelectorAll('td')[1].textContent = 'CORRUPTED';
                        });
                        return name;
                    },
                },
            },
        }).init();

        const result = (await table.getRowByIndex(1).toJSON({ atomic: true })) as Record<string, string>;
        // Name comes from the override (which reads the frozen cell). Type comes from the
        // snapshot text. Neither is affected by the live DOM mutation.
        expect(result.Name).toBe('Bob');
        expect(result.Type).toBe('Type-Bob'); // NOT 'CORRUPTED'
    });

    test('getCell() lets an override read a sibling cell from the same frozen row', async ({ page }) => {
        await page.setContent(HTML);

        const table = await useTable(page.locator('#t'), {
            strategies: {
                header: async (ctx) => {
                    const headers = await ctx.root.locator('th').allInnerTexts();
                    headers.push('derived');
                    return headers;
                },
            },
            columnOverrides: {
                derived: {
                    read: async (_cell, { getCell }) => {
                        const name = (await getCell('Name').innerText()).trim();
                        const type = (await getCell('Type').innerText()).trim();
                        return `${name}::${type}`;
                    },
                },
            },
        }).init();

        const result = (await table.getRowByIndex(1).toJSON({ atomic: true })) as Record<string, string>;
        expect(result.derived).toBe('Bob::Type-Bob');
        // Real columns still come from the snapshot text.
        expect(result.Name).toBe('Bob');
        expect(result.Type).toBe('Type-Bob');
    });

    test('getCell() works in non-atomic mode too (live cell)', async ({ page }) => {
        await page.setContent(HTML);

        const table = await useTable(page.locator('#t'), {
            strategies: {
                header: async (ctx) => {
                    const headers = await ctx.root.locator('th').allInnerTexts();
                    headers.push('combo');
                    return headers;
                },
                getCellLocator: ({ row, columnName, columnIndex, config: cfg }) => {
                    if (columnName === 'combo') return row;
                    return row.locator(cfg.cellSelector as string).nth(columnIndex);
                },
            },
            columnOverrides: {
                combo: {
                    read: async (_cell, { getCell }) => {
                        const name = (await getCell('Name').innerText()).trim();
                        const extra = (await getCell('Extra').innerText()).trim();
                        return `${name}+${extra}`;
                    },
                },
            },
        }).init();

        const result = (await table.getRowByIndex(0).toJSON()) as Record<string, string>;
        expect(result.combo).toBe('Alice+Extra-Alice');
    });

    test('snapshot container is cleaned up after toJSON completes', async ({ page }) => {
        await page.setContent(HTML);

        const table = await useTable(page.locator('#t'), {
            columnOverrides: {
                Name: { read: async (cell) => (await cell.innerText()).trim().toUpperCase() },
            },
        }).init();

        await table.getRowByIndex(1).toJSON({ atomic: true });
        // No snapshot containers should remain in the DOM.
        const leftover = await page.locator('[id^="__st_snap_"]').count();
        expect(leftover).toBe(0);
    });
});
