```typescript
const row = page.locator('tbody tr')
  .filter({ has: page.locator('td:nth-child(1)', { hasText: 'John' }) })
  .filter({ has: page.locator('td:nth-child(2)', { hasText: 'Doe' }) })
const email = await row.locator('td:nth-child(3)').innerText()
```
