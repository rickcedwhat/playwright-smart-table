import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';

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

    // Moved from strategies.spec.ts
    test.describe('RowType Generic Support', () => {
        test('should provide typed row data with generic', async ({ page }) => {
            await page.goto('https://datatables.net/examples/data_sources/dom');

            interface Employee {
                Name: string;
                Position: string;
                Office: string;
                Age: string;
                'Start date': string;
                Salary: string;
            }

            const table = useTable<Employee>(page.locator('#example'), {
                headerSelector: 'thead th'
            });
            await table.init();

            const row = table.getRowByIndex(0);
            const data = await row.toJSON();

            // TypeScript should infer data as Employee
            expect(data.Name).toBeDefined();
            expect(data.Position).toBeDefined();
            expect(data.Office).toBeDefined();
            expect(typeof data.Name).toBe('string');
        });

        test('should support Partial<T> in filters', async ({ page }) => {
            await page.goto('https://datatables.net/examples/data_sources/dom');

            interface Employee {
                Name: string;
                Position: string;
                Office: string;
            }

            const table = useTable<Employee>(page.locator('#example'), {
                headerSelector: 'thead th'
            });
            await table.init();

            // Should accept Partial<Employee> - only Name field
            const row = table.getRow({ Name: 'Airi Satou' });
            await expect(row).toBeVisible();

            // Should also work with findRow
            const searchedRow = await table.findRow({ Office: 'Tokyo' });
            await expect(searchedRow).toBeVisible();
        });

        test('should work with findRows and asJSON', async ({ page }) => {
            await page.goto('https://datatables.net/examples/data_sources/dom');

            interface Employee {
                Name: string;
                Office: string;
            }

            const table = useTable<Employee>(page.locator('#example'), {
                headerSelector: 'thead th'
            });
            await table.init();

            // Get typed data
            const rows = await table.findRows({}, { maxPages: 1 });
            const data = await rows.toJSON();

            // TypeScript should infer data as Employee[]
            expect(data.length).toBeGreaterThan(0);
            expect(data[0].Name).toBeDefined();
            expect(data[0].Office).toBeDefined();
        });
    });

});
