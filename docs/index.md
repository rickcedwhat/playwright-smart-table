<!-- NEEDS REVIEW -->
# Introduction

## Why Playwright Smart Table?

Testing HTML tables in Playwright is painful. Traditional approaches are fragile and hard to maintain.

### The Problem

**Traditional approach:**

```typescript
// ❌ Fragile - breaks if columns reorder
const email = await page.locator('tbody tr').nth(2).locator('td').nth(3).textContent();

// ❌ Brittle XPath
const row = page.locator('//tr[td[contains(text(), "John")]]');

// ❌ Manual column mapping
const headers = await page.locator('thead th').allTextContents();
const emailIndex = headers.indexOf('Email');
const email = await row.locator('td').nth(emailIndex).textContent();
```

**Problems:**
- Column indices break when columns reorder
- XPath is hard to read and maintain
- Manual header mapping is tedious
- No type safety
- Pagination requires custom logic

### The Solution

**Playwright Smart Table:**

```typescript
// ✅ Column-aware - survives column reordering
const row = await table.findRow({ Name: 'John Doe' });
const email = await row.getCell('Email').textContent();

// ✅ Auto-pagination
const allEngineers = await table.findRows({ Department: 'Engineering' });

// ✅ Type-safe
type Employee = { Name: string; Email: string; Department: string };
const table = useTable<Employee>(page.locator('#table'));
```

## Key Features

### 🎯 Smart Locators

Find rows by content, not position:

```typescript
const row = await table.findRow({ Name: 'Airi Satou', Office: 'Tokyo' });
```

### 📄 Auto-Pagination

Search across all pages automatically:

```typescript
const row = await table.findRow({ ID: '12345' }); // Searches all pages
```

### 🔍 Column-Aware Access

Access cells by column name:

```typescript
const email = row.getCell('Email'); // No manual mapping needed
```

### 🛠️ Debug Mode

Visual debugging with slow motion and logging:

```typescript
const table = useTable(page.locator('#table'), {
  debug: { slow: 500, logLevel: 'verbose' }
});
```

### 🔌 Extensible Strategies

Support any table implementation:

```typescript
import { Strategies } from '@rickcedwhat/playwright-smart-table';

const table = useTable(page.locator('#table'), {
  strategies: {
    pagination: Strategies.Pagination.ClickNext('.next-btn'),
    sorting: Strategies.Sorting.AriaSort()
  }
});
```

## When to Use This Library

**Use this library when you need to:**

- ✅ **Find rows by column values** - "Get the row where Name is 'John' and Status is 'Active'"
- ✅ **Access cells by column name** - "Get the Email cell from this row"
- ✅ **Search across paginated tables** - "Find all rows with Department 'Engineering' across all pages"
- ✅ **Handle column reordering** - Your tests survive when columns move
- ✅ **Extract structured data** - Convert table rows to JSON objects
- ✅ **Fill/edit table cells** - Smart filling with custom strategies
- ✅ **Work with dynamic tables** - MUI DataGrid, AG Grid, custom implementations

**You might not need this library if:**

- ❌ You don't deal with tables
- ❌ You don't need to handle pagination or virtualization
- ❌ You enjoy writing complex CSS selectors manually
- ❌ You like doing things the hard way

## Quick Comparison

| Task | Traditional | Smart Table |
|------|------------|-------------|
| Find row | `page.locator('//tr[td[contains(text(), "John")]]')` | `table.findRow({ Name: 'John' })` |
| Get cell | `row.locator('td').nth(3)` | `row.getCell('Email')` |
| Pagination | Manual loop + click logic | `table.findRows({ ... })` |
| Type safety | None | Full TypeScript support |
| Column reorder | Breaks | Survives |

## Get Started

Ready to simplify your table tests?

[Get Started →](/guide/getting-started)
