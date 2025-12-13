import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';

test('The Internet Herokuapp - Standard Table', async ({ page }) => {
  await page.goto('https://the-internet.herokuapp.com/tables');
  
  const table = useTable(page.locator('#table1'));

  // ✅ v2.0 FIX: Use .getCell() from the row
  const row = await table.getByRow({ "Last Name": "Doe" });
  await expect(row.getCell("Email")).toHaveText("jdoe@hotmail.com");

  // Interaction check
  await row.getCell("Action").getByRole('link', { name: 'edit' }).click();
  expect(page.url()).toContain('#edit');
});