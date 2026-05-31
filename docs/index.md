---
layout: page
---

<HomepageHero />

## Why not just use Playwright selectors?

Raw selectors break when columns reorder, pages paginate, or the DOM structure changes.

**Without Smart Table — fragile:**
```typescript
// Breaks if a column is added before "Office"
const office = row.locator('td:nth-child(4)');
```

**With Smart Table — stable:**
```typescript
// Works regardless of column order
await expect(row.getCell('Office')).toHaveText('Tokyo');
```

| | Raw Playwright | Smart Table |
|---|---|---|
| Column reorder | ❌ breaks `nth-child` | ✅ looks up by name |
| Paginated search | ❌ manual loop | ✅ built-in `findRow` |
| Multi-column filter | ❌ chained locators | ✅ `{ Name: 'X', Status: 'Active' }` |
| Typo in column name | ❌ silent wrong element | ✅ throws with suggestions |
| Works with div grids | ❌ need custom selectors | ✅ configurable selectors |
