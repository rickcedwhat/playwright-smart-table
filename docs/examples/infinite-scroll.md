<!-- Last Reviewed: 02/06/2026 -->
# Infinite Scroll Examples

Infinite scroll is common in modern feeds and dashboards. The library handles this by treating "scrolling down" as "going to the next page".

## Basic Infinite Scroll

Use the included `InfiniteScroll` strategy. It scrolls the container to the bottom and waits for new rows to appear.

```typescript
import { useTable, Strategies } from 'playwright-smart-table';

const table = useTable(page.locator('.feed-container'), {
  rowSelector: '.feed-item',
  
  strategies: {
    pagination: Strategies.Pagination.InfiniteScroll({
      // The element that has the overflow-y: scroll style
      scrollContainer: page.locator('.feed-scroll-view'),
      
      // How long to wait for new items after scrolling (default: 1000ms)
      waitForNewRows: 2000
    })
  }
});
```

## Usage

Once configured, standard methods work seamlessly across the "pages" (scroll batches).

```typescript
// Will keep scrolling down until it finds the row or hits maxPages
const row = await table.findRow({ 
  Title: 'Older Post from 2021' 
}, { 
  maxPages: 20 // Limit to prevent infinite loops
});
```

## "Load More" Button

Some implementations use a manual button instead of automatic scrolling. Use a custom pagination strategy for this.

```typescript
strategies: {
  pagination: async ({ page }) => {
    const loadMore = page.locator('button:has-text("Load More")');
    
    if (await loadMore.isVisible()) {
      await loadMore.click();
      await page.waitForTimeout(500); // Wait for render
      return true; // We "turned the page"
    }
    
    return false; // Reached the end
  }
}
```

## Data Scraping with Infinite Scroll

You can scrape an entire infinite list using `table.map()`.

```typescript
const allItems = await table.map(async ({ row }) => {
  // Process visible rows
  return row.toJSON();
}, {
  // dedupe is important for infinite scroll!
  // Rows often stay in the DOM, so we might see them again.
  dedupeStrategy: (row) => row.getCell('ID').innerText()
});
```
