import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';

test('Hybrid Naming: Fix missing headers dynamically', async ({ page }) => {
  // Setup: Table where the 3rd column (index 2) has NO header text
  await page.setContent(`
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th></th> <!-- Empty Header! -->
        </tr>
      </thead>
      <tbody>
        <tr><td>Alice</td><td>Admin</td><td><button>Edit</button></td></tr>
      </tbody>
    </table>
  `);

  const table = useTable(page.locator('table'));

  // 1. Detect the headers. 
  // The library will auto-name the 3rd column "__col_2"
  const initialHeaders = await table.getHeaders();
  console.log('Before:', initialHeaders); 
  expect(initialHeaders).toContain('__col_2');

  // 2. Apply your logic: 
  // "For column 2, if the name looks generated/empty, call it 'Actions'."
  await table.setColumnName(2, (oldName) => {
    // __col_ means it was auto-generated because it was empty
    if (oldName.startsWith('__col_')) return 'Actions';
    return oldName;
  });

  // 3. Verify
  console.log('After:', await table.getHeaders());
  expect(await table.getHeaders()).toContain('Actions');

  // 4. Use it
  const btn = await table.getByCell({ Name: 'Alice' }, 'Actions');
  await expect(btn.getByRole('button')).toHaveText('Edit');
  await btn.getByRole('button').click();
});