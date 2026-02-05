<!-- NEEDS REVIEW -->
# Pagination Examples of handling paginated tables.

## Basic Pagination

```typescript
import { useTable, Strategies } from '@rickcedwhat/playwright-smart-table';

const table = useTable(page.locator('#table'), {
  strategies: {
    pagination: Strategies.Pagination.ClickNext('.pagination .next')
  }
});

await table.init();
```

## Finding Across Pages

```typescript
// Automatically searches all pages
const row = await table.findRow({ Name: 'Cedric Kelly' });

// Limit search to 5 pages
const row = await table.findRow(
  { Department: 'Engineering' },
  { maxPages: 5 }
);
```

## Getting All Matching Rows

```typescript
// Find all engineers across all pages
const engineers = await table.findRows({
  Department: 'Engineering'
});

console.log(`Found ${engineers.length} engineers`);

// Limit pages
const engineers = await table.findRows(
  { Department: 'Engineering' },
  { maxPages: 10 }
);
```

## Iterating Through All Pages

```typescript
await table.iterateThroughTable({
  callback: async (row, index) => {
    const name = await row.getCell('Name').textContent();
    console.log(`${index}: ${name}`);
  }
});
```

## Scanning Column Values

```typescript
// Get all email addresses across all pages
const emails = await table.getColumnValues('Email');

// With page limit
const emails = await table.getColumnValues('Email', {
  maxPages: 5
});
```

## Custom Pagination Strategy

```typescript
const table = useTable(page.locator('#table'), {
  strategies: {
    pagination: async ({ page, rootLocator }) => {
      const nextBtn = page.locator('.custom-next-button');
      
      // Check if there are more pages
      const isDisabled = await nextBtn.isDisabled();
      if (isDisabled) {
        return { hasMore: false };
      }
      
      // Navigate to next page
      await nextBtn.click();
      await page.waitForLoadState('networkidle');
      
      return { hasMore: true };
    }
  }
});
```

## Page Number Pagination

```typescript
const table = useTable(page.locator('#table'), {
  strategies: {
    pagination: Strategies.Pagination.ClickPageNumber({
      pageNumberSelector: (pageNum) => 
        page.locator(`.pagination button:has-text("${pageNum}")`)
    })
  }
});
```

## Complete Example

```typescript
import { test, expect } from '@playwright/test';
import { useTable, Strategies } from '@rickcedwhat/playwright-smart-table';

test('paginated table search', async ({ page }) => {
  await page.goto('https://datatables.net/examples/data_sources/dom');
  
  const table = useTable(page.locator('#example'), {
    headerSelector: 'thead th',
    strategies: {
      pagination: Strategies.Pagination.ClickNext('#example_next')
    },
    maxPages: 10
  });
  
  await table.init();
  
  // Find row that might be on any page
  const row = await table.findRow({ Name: 'Cedric Kelly' });
  await expect(row.getCell('Position')).toHaveText('Senior JavaScript Developer');
  
  // Get all San Francisco employees (across all pages)
  const sfEmployees = await table.findRows({
    Office: 'San Francisco'
  });
  
  console.log(`Found ${sfEmployees.length} SF employees`);
  
  // Export all data
  const allData = [];
  await table.iterateThroughTable({
    callback: async (row) => {
      const data = await row.toJSON();
      allData.push(data);
    }
  });
  
  console.log(`Total employees: ${allData.length}`);
});
```
