# Quick Start

> **Fair warning:** This will get you running fast, but it skips a lot. This page is for the DIY-ers who don't have time for manuals.

## Install

```bash
npm install @rickcedwhat/playwright-smart-table
```

## Your first test

```typescript
import { useTable } from '@rickcedwhat/playwright-smart-table';
import { test, expect } from '@playwright/test';

test('find a row by value', async ({ page }) => {
  await page.goto('https://your-app.com/table-page');

  const table = await useTable(page.locator('#my-table')).init();
  const row = table.getRow({ Name: 'John Doe' });

  await expect(row.getCell('Email')).toHaveText('john@example.com');
});
```

## What just happened

`useTable()` takes a root locator and an optional config. `.init()` reads the headers and builds an internal column map. After that, `getRow()` translates `{ Name: 'John Doe' }` into a Playwright locator that matches the right row — regardless of what column index `Name` happens to be at.

`getCell('Email')` returns a plain Playwright locator for that cell. Pass it directly to `expect()`, `click()`, `fill()`, or anything else Playwright supports.

## That's the basics

If your use case is more complicated — and it likely is — head to [Describe Your Table](/guide/describe/).


---

::: tip Full API Reference
All config options → [Config Options](/api/table-config) · All table methods → [Table Methods](/api/table-methods) · Row API → [SmartRow](/api/smart-row) · Strategies → [Strategies](/api/strategies)
:::
