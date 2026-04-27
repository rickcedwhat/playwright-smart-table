# SmartRow

A SmartRow is a Playwright Locator enhanced with column-aware methods. It extends the native Locator, so all Playwright methods work.

## Overview

```typescript
const row = table.getRow({ Name: 'John Doe' });

// SmartRow methods
const email = row.getCell('Email');
const data = await row.toJSON();

// Still a Locator - all Playwright methods work
await expect(row).toBeVisible();
await row.click();
```

## Methods

### getCell()

Get a cell Locator by column name.


<!-- api-signature: getCell -->

### Signature

```typescript
getCell(columnName: string): Locator
```

### Parameters

- `column` - Column name (case-sensitive)

<!-- /api-signature: getCell -->

#### Returns

`Locator` - Cell locator for the specified column

#### Examples

```typescript
const row = table.getRow({ Name: 'Airi Satou' });

// Get cell locator
const emailCell = row.getCell('Email');
const salaryCell = row.getCell('Salary');

// Use with Playwright assertions
await expect(emailCell).toHaveText('airi@example.com');
await expect(salaryCell).toBeVisible();

// Extract text
const email = await emailCell.textContent();
const salary = await salaryCell.innerText();

// Interact
await row.getCell('Status').click();
await row.getCell('Edit').click();
```

#### Error Handling

Throws a smart error with suggestions if column not found:

```typescript
// Typo: "Positon" instead of "Position"
row.getCell('Positon');

// Error message:
// Column "Positon" not found
// Did you mean:
//   - Position (87% match)
// Available columns: Name, Position, Office, Age
// Tip: Column names are case-sensitive
```

---

### toJSON()

Convert the row to a plain JavaScript object.


<!-- api-signature: toJSON -->

### Signature

```typescript
toJSON(options?: { columns?: string[] }): Promise<T>
```

### Parameters

- `options` - Optional configuration

<!-- /api-signature: toJSON -->

#### Returns

`Promise<T>` - Object with column-value pairs

#### Examples

```typescript
const row = table.getRow({ Name: 'Airi Satou' });

// Export all columns
const data = await row.toJSON();
console.log(data);
// {
//   Name: 'Airi Satou',
//   Position: 'Accountant',
//   Office: 'Tokyo',
//   Age: '33',
//   Salary: '$162,700'
// }

// Export specific columns
const partial = await row.toJSON({ 
  columns: ['Name', 'Email'] 
});
console.log(partial);
// { Name: 'Airi Satou', Email: 'airi@example.com' }

// Use in assertions
expect(data.Office).toBe('Tokyo');
expect(data.Name).toContain('Airi');
```

#### Use Cases

- Data validation
- Logging/debugging
- Exporting table data
- Comparing row values

---

### bringIntoView()

Scroll the row into the viewport.


<!-- api-signature: bringIntoView -->

### Signature

```typescript
bringIntoView(): Promise<void>
```

<!-- /api-signature: bringIntoView -->

#### Example

```typescript
const row = table.getRow({ Name: 'Cedric Kelly' });

// Ensure row is visible before interacting
await row.bringIntoView();
await row.getCell('Edit').click();
```

#### Notes

- Useful for rows returned by `findRow()`, `findRows()`, `filter()`, or `getRowByIndex()`
- Navigates back to the row's page when pagination metadata is available
- Ensures the row is visible before interactions

---

### smartFill()

Fill editable cells in the row.


<!-- api-signature: smartFill -->

### Signature

```typescript
smartFill(
  data: Partial<T>,
  options?: FillOptions
): Promise<void>
```

### Parameters

- `data` - Column-value pairs to fill
- `options` - Optional configuration

<!-- /api-signature: smartFill -->

#### Examples

```typescript
const row = table.getRow({ Name: 'John Doe' });

// Fill single cell
await row.smartFill({ 
  Email: 'john.doe@example.com' 
});

// Fill multiple cells
await row.smartFill({
  Email: 'john.doe@example.com',
  Phone: '555-1234',
  Department: 'Engineering'
});

// With custom input mappers
await row.smartFill(
  { Salary: '100000' },
  {
    inputMappers: {
      Salary: (cell) => cell.locator('input[name="salary"]')
    }
  }
);
```

#### Fill Strategies

The default fill behavior detects common inputs automatically: text inputs, selects, checkboxes, radios, textareas, and `contenteditable` elements.

For app-specific widgets, use `columnOverrides.write` in `TableConfig`, or pass `inputMappers` for a one-off call.

See [Fill Strategies](/api/strategies#fill) for more details.

---

### wasFound()

Returns whether the row exists in the DOM. Rows returned from failed searches are sentinel rows, so they can still be used with Playwright negative assertions like `await expect(row).not.toBeVisible()`.

<!-- api-signature: wasFound -->

### Signature

```typescript
wasFound(): boolean
```

<!-- /api-signature: wasFound -->

#### Example

```typescript
const row = table.getRow({ Name: 'Ghost User' });

await expect(row).not.toBeVisible();
expect(row.wasFound()).toBe(false);
```

---

## SmartRow as Locator

SmartRow extends Playwright's Locator, so all standard methods work:

```typescript
const row = table.getRow({ Name: 'Airi Satou' });

// Playwright assertions
await expect(row).toBeVisible();
await expect(row).toHaveClass('active');
await expect(row).toContainText('Tokyo');

// Playwright actions
await row.click();
await row.hover();
await row.dblclick();

// Locator methods
const cells = await row.locator('td').all();
const firstCell = row.locator('td').first();

// Screenshots
await row.screenshot({ path: 'row.png' });
```

## Complete Example

```typescript
import { useTable } from '@rickcedwhat/playwright-smart-table';

test('SmartRow example', async ({ page }) => {
  await page.goto('https://example.com/table');
  
  const table = useTable(page.locator('#employees'));
  await table.init();
  
  // Find a row
  const row = table.getRow({ Name: 'Airi Satou' });
  
  // Column-aware access
  const email = row.getCell('Email');
  await expect(email).toHaveText('airi@example.com');
  
  // Export data
  const data = await row.toJSON();
  console.log(data);
  
  // Fill cells
  await row.smartFill({
    Email: 'new.email@example.com',
    Phone: '555-9999'
  });
  
  // Scroll into view
  await row.bringIntoView();
  
  // Still a Locator
  await expect(row).toBeVisible();
  await row.click();
});
```
