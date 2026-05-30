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

## Concurrency Strategy

Strategies govern *how* the library performs individual operations. Concurrency governs *when* row callbacks run relative to each other during multi-row iteration (`forEach`, `map`, `filter`).

Think of it as another axis of the strategy pattern: rather than swapping out the mechanism for pagination or sorting, you are swapping out the scheduler that decides whether rows are visited one at a time, all at once, or in coordinated batches.

### The three modes

**`sequential`** — one row at a time. The callback for row N finishes completely before the library touches row N+1. This is the safest default for callbacks that open tooltips, fill inputs, or mutate shared UI state.

**`parallel`** — all rows on the current page start simultaneously. Pages are still processed in order, but within a page every row callback is launched without waiting for its neighbours. This is the fastest mode for pure data reads — no UI interaction, no shared state.

**`synchronized`** — rows on a page start simultaneously like `parallel`, but the engine inserts a barrier at any point where all workers must agree on a shared position (for example, when scrolling a virtualized column into view). This prevents workers from racing each other to the same scroll target. Use it when your table virtualizes columns but you still want per-page concurrency.

### Choosing the right mode

| Table type | Recommended mode |
| :--- | :--- |
| All cells in the DOM, no UI interaction needed | `parallel` |
| All cells in the DOM, callback opens a popover / tooltip | `sequential` |
| Virtualized columns (horizontal scroll per row) | `synchronized` |
| Any callback that mutates shared state | `sequential` |

### Interactive demo

The animation below runs the same 3-page `forEach` across all three modes simultaneously. Use the scenario tabs to load different table shapes and watch which modes break — and why.

<LabConcurrencyAnimator />

### Configuring concurrency

Set a default at the table level (applies to every `forEach`, `map`, and `filter` call):

```typescript
const table = useTable(locator, {
    concurrency: 'parallel'   // or 'sequential' | 'synchronized'
});
```

Override per call when a single operation has different requirements:

```typescript
// Fast read — parallel is fine
const statuses = await table.map(({ row }) =>
    row.getCell('Status').innerText()
);

// Opens a tooltip — must be sequential
const names = await table.map(async ({ row }) => {
    await row.getCell('User').locator('.avatar').click();
    const name = await page.locator('.tooltip .full-name').innerText();
    await page.keyboard.press('Escape');
    return name;
}, { concurrency: 'sequential' });

// Virtualized columns — synchronized keeps the scroll in sync
await table.forEach(async ({ row }) => {
    const dept = await row.getCell('Department').innerText();
    // ...
}, { concurrency: 'synchronized' });
```

### What to notice

- **Sequential** always finishes last on multi-page tables: it waits for each row before moving to the next, so total time scales linearly with row count.
- **Parallel** is fastest when callbacks are independent reads. It breaks when multiple callbacks compete for the same UI widget (tooltips, dropdowns) because only one element can be active at a time.
- **Synchronized** matches `parallel` in speed for simple DOM tables — the barrier never fires because no column scrolling is needed. Prefer `parallel` in those cases.
- The elapsed time badges in the demo reflect relative cost. At realistic speed the gap between sequential and parallel can be a 3× to 5× difference on a 9-row, 3-page table.
