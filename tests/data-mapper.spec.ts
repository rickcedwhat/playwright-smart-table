import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';

interface UserRow {
    ID: number;
    Name: string;
    Active: boolean; // Mapped to boolean
    Role: string;
}

test.describe('Data Mapper', () => {
    test.beforeEach(async ({ page }) => {
        await page.setContent(`
            <table>
                <thead>
                    <tr><th>ID</th><th>Name</th><th>Active</th><th>Role</th></tr>
                </thead>
                <tbody>
                    <tr><td>1</td><td>Alice</td><td>Yes</td><td>Admin</td></tr>
                    <tr><td>2</td><td>Bob</td><td>No</td><td>User</td></tr>
                </tbody>
            </table>
        `);
    });

    test('should map data using dataMapper', async ({ page }) => {
        const table = useTable<UserRow>(page.locator('table'), {
            dataMapper: {
                ID: async (cell) => parseInt(await cell.innerText(), 10),
                Active: async (cell) => (await cell.innerText()) === 'Yes'
            }
        });

        const rows = await table.findRows({});
        const data = await rows.toJSON();

        // data is UserRow[] but mapped columns have changed types
        // To properly test this in TS without advanced mapped types in test file:
        const firstRow = data[0] as any;
        expect(firstRow.ID).toBe(1);
        expect(typeof firstRow.ID).toBe('number');
        expect(firstRow.Active).toBe(true);
        expect(typeof firstRow.Active).toBe('boolean');
        expect(firstRow.Name).toBe('Alice'); // Unmapped remains string
    });

    test('should handle findRow with dataMapper', async ({ page }) => {
        const table = useTable<UserRow>(page.locator('table'), {
            dataMapper: {
                ID: async (cell) => parseInt(await cell.innerText(), 10)
            }
        });

        const row = await table.findRow({ Name: 'Bob' });
        const data = await row.toJSON();

        expect((data as any).ID).toBe(2);
        expect(typeof (data as any).ID).toBe('number');
    });
});
