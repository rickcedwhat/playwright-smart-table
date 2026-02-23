import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';

test('The Internet Herokuapp - Standard Table', async ({ page }) => {
  await page.setContent(`
    <table id="table1">
      <thead>
        <tr>
          <th>Last Name</th>
          <th>First Name</th>
          <th>Email</th>
          <th>Due</th>
          <th>Web Site</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Doe</td>
          <td>Jason</td>
          <td>jdoe@hotmail.com</td>
          <td>$100.00</td>
          <td>http://www.jdoe.com</td>
          <td><a href="#edit">edit</a> <a href="#delete">delete</a></td>
        </tr>
      </tbody>
    </table>
  `);

  const table = useTable(page.locator('#table1'));
  await table.init();

  const row = table.getRow({ "Last Name": "Doe" });
  const emailCell = row.getCell("Email");
  await expect(emailCell).toHaveText("jdoe@hotmail.com");

  const actionCell = row.getCell("Action");
  await expect(actionCell.getByRole('link', { name: 'edit' })).toBeVisible();
});