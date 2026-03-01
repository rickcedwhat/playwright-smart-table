# Understanding Strategies

This library uses the **Strategy Pattern** to handle the wide variety of table implementations found on the web.

## What is a Strategy?

Think of a Strategy as a **"Driver"** for a specific mechanism.

Playwright Smart Table knows *what* it wants to do (e.g., "Go to the next page"), but it doesn't know *how* to do it for your specific table (e.g., "Click the button with class `.next-btn`").

A Strategy is a function you provide that tells the library **how** to perform that specific action.

| Feature | **Strategy** | **Callback / Event** |
| :--- | :--- | :--- |
| **Purpose** | Defines **HOW** to do something (Logic) | Reacts **WHEN** something happens (Side Effect) |
| **Necessity** | Essential (Defaults provided, but replaceable) | Optional (Table works fine without them) |
| **Return Value** | **Critical** (Controls flow, logic, success/fail) | **Ignored** (Usually void) |
| **Mental Model** | "Plug-in Engine Component" | "Event Subscriber" |

## Example: Pagination Strategy

When you ask the table to find a row that isn't on the current page, the library relies on the `pagination` strategy.

The library asks: *"I need to see more rows. Please execute the pagination logic and tell me if it worked."*

```typescript
// Your custom strategy
const myPaginationStrategy = {
    goNext: async (context) => {
        const nextBtn = context.page.locator('.next-page-button');
        
        // 1. Perform the action (The "How")
        if (await nextBtn.isVisible() && await nextBtn.isEnabled()) {
            await nextBtn.click();
            await context.page.waitForLoadState('networkidle');
            
            // 2. Return the result (Crucial!)
            return true; // "Yes, I successfully navigated to a new page"
        }
        
        return false; // "No, I couldn't paginate anymore (end of data)"
    }
};

// Configuring it
const table = useTable(loc, {
    strategies: {
        pagination: myPaginationStrategy
    }
});
```


## Example: Sorting Strategy

When you call `table.sorting.apply('Name', 'asc')`, the library delegates the action to your sorting strategy.

```typescript
// Custom sorting logic for a table where headers are clickable
const mySortingStrategy = {
    doSort: async ({ columnName, direction, context }) => {
        const header = await context.table.getHeaderCell(columnName);
        
        // Check current state (maybe it's already sorted?)
        const currentState = await header.getAttribute('aria-sort');
        if (currentState === direction) return;
        
        // Click to sort
        await header.click();
        
        // Wait for sort to apply
        await context.page.waitForResponse(resp => resp.url().includes('/api/data'));
    },
    getSortState: async ({ columnName, context }) => {
        const header = await context.table.getHeaderCell(columnName);
        return await header.getAttribute('aria-sort') as 'asc' | 'desc' | 'none';
    }
};
```

## Example: Loading Strategy

The `loading` strategy is critical for stability. It tells the library *"Wait! The table is busy."*

The table uses these strategies under the hood to determine if it needs to wait before proceeding with an action (like finding a row).

If this strategy returns `true`, the library will assume the table is busy and retry the operation until it returns `false`.

```typescript
const myLoadingStrategy = {
    // Return true if the table is currently fetching data
    isTableLoading: async (context) => {
        const spinner = context.page.locator('.loading-spinner');
        return await spinner.isVisible();
    },
    // Return true if a specific row is busy (e.g. saving)
    isRowLoading: async (row) => {
        return await row.locator('.row-spinner').isVisible();
    }
};
```
