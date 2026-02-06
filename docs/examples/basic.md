<!-- Last Reviewed: 02/06/2026 -->
# Basic Usage

Simple examples of common table interactions.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/rickcedwhat/playwright-smart-table/tree/main/examples/playground?file=tests%2Fdemo.spec.ts&title=Playwright%20Smart%20Table%20Demo)

> [!TIP]
> **Try it now**: Click the button above to run this code in your browser, or open the [Live Demo](https://datatables.net/examples/data_sources/dom) to interpret the table structure manually.

## Setup

```typescript
import { test, expect } from '@playwright/test';
import { useTable } from '@rickcedwhat/playwright-smart-table';

test('basic table test', async ({ page }) => {
  await page.goto('https://datatables.net/examples/data_sources/dom');
  
  const table = useTable(page.locator('#example'), {
    headerSelector: 'thead th'
  });
  
  await table.init();
});
```

## Finding a Row

```typescript
// Find by single column
const row = await table.findRow({ Name: 'Airi Satou' });

// Find by multiple columns
const row = await table.findRow({
  Name: 'Airi Satou',
  Office: 'Tokyo'
});

// Exact match
const row = await table.findRow(
  { Name: 'Airi Satou' },
  { exact: true }
);
```

## Getting Cell Values

```typescript
const row = await table.findRow({ Name: 'Airi Satou' });

// Get cell locator
const emailCell = row.getCell('Email');

// Extract text
const email = await emailCell.textContent();
const position = await row.getCell('Position').innerText();

// Use in assertions
await expect(row.getCell('Office')).toHaveText('Tokyo');
await expect(row.getCell('Age')).toBeVisible();
```

## Getting Multiple Rows

```typescript
// Get all rows on current page
const allRows = await table.getRows();
console.log(`Found ${allRows.length} rows`);

// Filter rows
const tokyoEmployees = await table.getRows({
  filter: { Office: 'Tokyo' }
});

// Iterate through rows
for (const row of allRows) {
  const name = await row.getCell('Name').textContent();
  console.log(name);
}
```

## Exporting Data

```typescript
// Get rows and convert to JSON
const rows = await table.getRows();
const data = await rows.toJSON();

console.log(data);
// [
//   { Name: 'Airi Satou', Position: 'Accountant', Office: 'Tokyo', ... },
//   { Name: 'Angelica Ramos', Position: 'CEO', Office: 'London', ... },
//   ...
// ]

// Export specific row
const row = await table.findRow({ Name: 'Airi Satou' });
const rowData = await row.toJSON();
console.log(rowData);
// { Name: 'Airi Satou', Position: 'Accountant', Office: 'Tokyo', ... }
```

## Clicking Cells

```typescript
const row = await table.findRow({ Name: 'Airi Satou' });

// Click a cell
await row.getCell('Edit').click();

// Double-click
await row.getCell('Name').dblclick();

// Hover
await row.getCell('Actions').hover();
```

## Getting All Column Values

```typescript
// Get all names
const names = await table.getColumnValues('Name');
console.log(names); // ['Airi Satou', 'Angelica Ramos', ...]

// With custom mapper
const salaries = await table.getColumnValues('Salary', {
  mapper: async (cell) => {
    const text = await cell.textContent();
    return parseInt(text.replace(/[$,]/g, ''));
  }
});

const avgSalary = salaries.reduce((a, b) => a + b) / salaries.length;
console.log(`Average salary: $${avgSalary}`);
```

## Complete Example

```typescript
import { test, expect } from '@playwright/test';
import { useTable } from '@rickcedwhat/playwright-smart-table';

test('employee table operations', async ({ page }) => {
  await page.goto('https://datatables.net/examples/data_sources/dom');
  
  const table = useTable(page.locator('#example'), {
    headerSelector: 'thead th'
  });
  
  await table.init();
  
  // Find specific employee
  const airi = await table.findRow({ Name: 'Airi Satou' });
  
  // Verify details
  await expect(airi.getCell('Position')).toHaveText('Accountant');
  await expect(airi.getCell('Office')).toHaveText('Tokyo');
  await expect(airi.getCell('Age')).toHaveText('33');
  
  // Get all Tokyo employees
  const tokyoEmployees = await table.getRows({
    filter: { Office: 'Tokyo' }
  });
  
  console.log(`Tokyo has ${tokyoEmployees.length} employees`);
  
  // Export data
  const data = await tokyoEmployees.toJSON();
  expect(data.every(emp => emp.Office === 'Tokyo')).toBe(true);
});
```
