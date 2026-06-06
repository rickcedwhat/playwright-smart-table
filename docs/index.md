# Playwright Smart Table

Dealing with tables sucks. The locators involved are often ugly, brittle, and difficult to wrap your head around.

What works today might not work tomorrow. What will you do when a column moves? Or when the data that was on the first page is now on the second or third? Or when your data is technically on the page but not in the DOM because the rows, columns, or both are virtualized?

And that's before you factor in that every table is different — semantic `<table>` elements are the exception, not the rule. You're more likely to be dealing with a `<div>`-based grid where the library author made all their own decisions about structure, attributes, and behavior.

Which of these is easier to read?

```typescript
// Without Playwright Smart Table
const row = page.locator('tbody tr')
  .filter({ has: page.locator('td:nth-child(1)', { hasText: 'John' }) })
  .filter({ has: page.locator('td:nth-child(2)', { hasText: 'Doe' }) })
const email = await row.locator('td:nth-child(3)').innerText()
```

```typescript
// With Playwright Smart Table
const row = table.getRow({ firstName: 'John', lastName: 'Doe' })
const email = await row.getCell('Email').innerText()
```

Playwright Smart Table doesn't try to solve all of that automatically. Instead it gives you a way to describe how your specific table works — and then lets you ask questions against it in plain terms.

You describe your table. Playwright Smart Table does the rest.

[Get started](/guide/start) · [See examples](/examples/)
