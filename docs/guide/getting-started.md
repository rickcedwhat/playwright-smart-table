# Getting Started

## Installation

```bash
npm install @rickcedwhat/playwright-smart-table
```

## Quick Start

### 1. Import `useTable`

```typescript
import { useTable } from '@rickcedwhat/playwright-smart-table';
```

### 2. Define the Table

Pass a locator for the table wrapper and a config object defining the structure.

```typescript
const table = useTable(page.locator('.my-table'), {
  // Finding Headers (Required)
  headerSelector: 'thead th',

  // Finding Rows (Optional - defaults to 'tbody tr')
  rowSelector: 'tbody tr',
  
  // Finding Cells (Optional - defaults to 'td')
  cellSelector: 'td',
});
```

### 3. Initialize

This maps the column names to their indices.

```typescript
await table.init();
```

### 4. Interact

Now you can find rows by their content naturally.

```typescript
// Find a row where the "Name" column is "John Doe"
const row = table.getRow({ Name: 'John Doe' });

// Assert it exists
await expect(row).toBeVisible();

// Get a specific cell from that row
const emailCell = row.getCell('Email');
await expect(emailCell).toHaveText('john@example.com');

// Click a button in the "Actions" column
await row.getCell('Actions').getByRole('button', { name: 'Edit' }).click();
```
