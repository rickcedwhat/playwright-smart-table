import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';

test('should filter rows by locator (custom filter)', async ({ page }) => {
    await page.setContent(`
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Alice</td>
                    <td><input type="checkbox" checked /> Active</td>
                </tr>
                <tr>
                    <td>Bob</td>
                    <td><input type="checkbox" /> Inactive</td>
                </tr>
            </tbody>
        </table>
    `);

    const table = useTable(page.locator('table'));
    await table.init();

    // This should fail (or typescript error) before implementation
    // usage: getRow({ Column: (cell) => cell.locator(...) })
    // We want to find the row where "Status" cell contains a checked input
    const activeRow = table.getRow({
        Status: (cell) => cell.locator('input:checked')
    });

    await expect(activeRow).toContainText('Alice');

    // Verify finding the inactive one
    const inactiveRow = table.getRow({
        Status: (cell) => cell.locator('input:not(:checked)')
    });

    await expect(inactiveRow).toContainText('Bob');

    // Verify findRow (async)
    const asyncRow = await table.findRow({
        Status: (cell) => cell.locator('input:checked')
    });
    await expect(asyncRow).toContainText('Alice');

    // Verify findRows (multiple)
    const rows = await table.findRows({
        Status: (cell) => cell.locator('input')
    });
    expect(rows).toHaveLength(2);
});
