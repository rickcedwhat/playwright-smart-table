# Pagination Examples

Use pagination strategies when Smart Table needs to move through pages while searching or iterating.

By default, Smart Table only scans one page (`maxPages: 1`). To search or iterate beyond the current page, configure `maxPages` on the table or pass it to the method call.

## Basic Pagination

```typescript
import { useTable, Strategies } from '@rickcedwhat/playwright-smart-table';

const table = useTable(page.locator('#table'), {
  strategies: {
    pagination: Strategies.Pagination.click({
      next: () => page.locator('.pagination .next')
    })
  },
  maxPages: 5
});

await table.init();
```

## Finding Across Pages

```typescript
// Uses the table-level maxPages value
const row = await table.findRow({ Name: 'Cedric Kelly' });

// Or override the page limit for one search
const rowWithinFivePages = await table.findRow(
  { Department: 'Engineering' },
  { maxPages: 5 }
);
```

## Getting All Matching Rows

```typescript
const engineers = await table.findRows({
  Department: 'Engineering'
});

console.log(`Found ${engineers.length} engineers`);

const engineersWithinTenPages = await table.findRows(
  { Department: 'Engineering' },
  { maxPages: 10 }
);
```

## Iterating Through Multiple Pages

```typescript
await table.forEach(
  async ({ row, rowIndex }) => {
    const name = await row.getCell('Name').textContent();
    console.log(`${rowIndex}: ${name}`);
  },
  { maxPages: 5 }
);
```

## Scanning Column Values

```typescript
// Get email addresses from the default scan range
const emails = await table.map(({ row }) => row.getCell('Email').innerText());

// Or override the page limit for one scan
const limitedEmails = await table.map(({ row }) => row.getCell('Email').innerText(), {
  maxPages: 5
});
```

## Custom Pagination Strategy

```typescript
const table = useTable(page.locator('#table'), {
  strategies: {
    pagination: {
      goNext: async ({ page }) => {
        const nextBtn = page.locator('.custom-next-button');
        
        // Check if there are more pages
        const isDisabled = await nextBtn.isDisabled();
        if (isDisabled) {
          return false;
        }
        
        // Navigate to next page
        await nextBtn.click();
        await page.waitForLoadState('networkidle');
        
        return true;
      }
    }
  }
});
```

## Page Number Pagination

```typescript
const table = useTable(page.locator('#table'), {
  strategies: {
    pagination: {
      goNext: async ({ page }) => {
        const next = page.getByRole('button', { name: 'Next' });
        if (await next.isDisabled()) return false;
        await next.click();
        return true;
      },
      goToPage: async (pageIndex, { page }) => {
        const button = page.getByRole('button', { name: String(pageIndex + 1) });
        if (await button.count() === 0) return false;
        await button.click();
        return true;
      }
    }
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
      pagination: Strategies.Pagination.click({
        next: () => page.locator('#example_next')
      })
    },
    maxPages: 10
  });
  
  await table.init();
  
  // Find a row within the configured page limit
  const row = await table.findRow({ Name: 'Cedric Kelly' });
  await expect(row.getCell('Position')).toHaveText('Senior JavaScript Developer');
  
  // Get San Francisco employees within the configured page limit
  const sfEmployees = await table.findRows({
    Office: 'San Francisco'
  });
  
  console.log(`Found ${sfEmployees.length} SF employees`);
  
  // Export all data
  const allData = await table.map(async ({ row }) => {
    return row.toJSON();
  });
  
  console.log(`Total employees: ${allData.length}`);
});
```
