<!-- Last Reviewed: 02/06/2026 -->
# Getting Started

Learn how to install and use Playwright Smart Table in your tests.

## Installation

```bash
npm install @rickcedwhat/playwright-smart-table
# or
yarn add @rickcedwhat/playwright-smart-table
# or
pnpm add @rickcedwhat/playwright-smart-table
```

## Quick Start

```typescript
import { test, expect } from '@playwright/test';
import { useTable } from '@rickcedwhat/playwright-smart-table';

test('find and verify employee', async ({ page }) => {
  await page.goto('https://datatables.net/examples/data_sources/dom');
  
  // Initialize table
  const table = useTable(page.locator('#example'));
  
  // Find a row by content (auto-initializes!)
  const row = await table.findRow({ Name: 'Airi Satou' });
  
  // Verify cell values (returns Locator)
  await expect(row.getCell('Position')).toHaveText('Accountant');
  await expect(row.getCell('Office')).toHaveText('Tokyo');
});
```

## Why This Works

Notice how we:
- **Find rows by content** (`Name: 'Airi Satou'`) instead of fragile XPath
- **Access cells by column name** (`getCell('Position')`) instead of index
- **No manual column mapping** - the library reads headers automatically

## Configuration

Customize selectors for your table structure:

```typescript
const table = useTable(page.locator('#table'), {
  headerSelector: 'thead th',  // Optional, defaults to 'thead th'
  rowSelector: 'tbody tr',     // Optional, defaults to 'tbody tr'
  cellSelector: 'td'           // Optional, defaults to 'td'
});
```

## Next Steps

- [Core Concepts](/guide/core-concepts) - Understand SmartRow and strategies
- [API Reference](/api/) - Complete method documentation
- [Examples](/examples/) - Real-world usage patterns
