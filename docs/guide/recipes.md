# Recipe Book 📖

Common patterns and advanced use cases for `playwright-smart-table`.

## Data Scraping

### Get All Data from All Pages

Sometimes you need to validate the entire dataset or export it.

```typescript
const allRows = await table.iterateThroughTable(async ({ rows }) => {
  // Convert SmartRows to JSON objects
  return Promise.all(rows.map(row => row.toJSON()));
});

// allRows is now an array of arrays (one per page). Flatten it:
const flatData = allRows.flat();
console.log(`Scraped ${flatData.length} total rows`);
```

### Processing in Batches (v5.1+)

For large tables, avoid loading everything into memory. Process rows in batches.

```typescript
await table.iterateThroughTable(
    async ({ rows, batchInfo }) => {
        const data = await Promise.all(rows.map(r => r.toJSON()));
        await db.insertMany(data);
        console.log(`Processed batch ${batchInfo?.startIndex}-${batchInfo?.endIndex}`);
    },
    { batchSize: 50 } // Process 50 rows at a time
);
```

## Infinite Scroll

Handling infinite scroll tables often requires checking for duplicates, as the exact same DOM elements might not persist or might be re-rendered.

```typescript
await table.iterateThroughTable(
    async ({ rows }) => {
        // processing logic...
    },
    { 
        // Use a unique ID from the row data to detect duplicates
        dedupeStrategy: async (row) => {
            const data = await row.toJSON();
            return data.ID; 
        }
    }
);
```

## Custom Strategies

### Clicking a "Load More" Button

If your table uses a "Load More" button instead of pages numbers:

```typescript
import { Strategies } from '@rickcedwhat/playwright-smart-table';

const table = useTable(locator, {
  // ... config ...
  strategies: {
    pagination: Strategies.Pagination.clickNext(() => 
      page.getByRole('button', { name: 'Load More' })
    )
  }
});
```
