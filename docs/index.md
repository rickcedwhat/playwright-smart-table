# Playwright Smart Table

Dealing with tables sucks. The locators involved are often ugly, brittle, and difficult to wrap your head around.

Which of these is easier to read?

<span class="code-label">Without Playwright Smart Table</span>

```typescript
const row = page.locator('tbody tr')
  .filter({ has: page.locator('td:nth-child(1)', { hasText: 'John' }) })
  .filter({ has: page.locator('td:nth-child(2)', { hasText: 'Doe' }) })
const email = await row.locator('td:nth-child(3)').innerText()
```

<span class="code-label">With Playwright Smart Table</span>

```typescript
const row = table.getRow({ firstName: 'John', lastName: 'Doe' })
const email = await row.getCell('Email').innerText()
```

You tell it how your table is built. After that, it's just asking questions.

**You describe your table. Playwright Smart Table does the rest.**

[Get started](/guide/start) · [See examples](/examples/)
