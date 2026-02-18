import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';

test('The Internet Herokuapp - Standard Table', async ({ page }) => {
  await page.goto('https://the-internet.herokuapp.com/tables');
  
  const table = useTable(page.locator('#table1'));
  await table.init();

  // ✅ v2.0 FIX: Use .getCell() from the row
  const row = table.getRow({ "Last Name": "Doe" });
  const emailCell = row.getCell("Email");
  await expect(emailCell).toHaveText("jdoe@hotmail.com");

  // Interaction check
  const actionCell = row.getCell("Action");
  await actionCell.getByRole('link', { name: 'edit' }).click();
  expect(page.url()).toContain('#edit');
});