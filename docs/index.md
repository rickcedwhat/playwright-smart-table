# Playwright Smart Table

Dealing with tables sucks. The locators involved are often ugly, brittle, and difficult to wrap your head around.

Which of these is easier to read?

```typescript [Without Playwright Smart Table]
const row = page.locator('tbody tr')
  .filter({ has: page.locator('td:nth-child(1)', { hasText: 'John' }) })
  .filter({ has: page.locator('td:nth-child(2)', { hasText: 'Doe' }) })
const email = await row.locator('td:nth-child(3)').innerText()
```

```typescript [With Playwright Smart Table]
const row = table.getRow({ firstName: 'John', lastName: 'Doe' })
const email = await row.getCell('Email').innerText()
```

Playwright Smart Table gives you a way to describe how your specific table works — and then lets you ask questions against it in plain terms. Works for standard HTML tables, div-based grids, paginated tables, and virtualized ones.

**You describe your table. Playwright Smart Table does the rest.**

[Get started](/guide/start) · [See examples](/examples/)
