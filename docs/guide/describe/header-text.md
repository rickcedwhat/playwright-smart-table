# What does your header text actually say?

Real app headers often include noise: sort arrows, counts, badges. `headerTransformer` runs on each header before it's stored — the cleaned name is what you use everywhere else in `getRow`, `getCell`, etc.

**Sort arrows:**

| Name ↑ | Department ↓ | Salary |
|--------|-------------|--------|
| Ada    | Engineering | 90000  |
| Bob    | Marketing   | 65000  |
| Carol  | Engineering | 95000  |

```typescript
headerTransformer: async ({ text }) => text.replace(/[↑↓▲▼]/g, '').trim()
// Resulting columns: 'Name', 'Department', 'Salary'
```

---

**Checkbox column with no label:**

| _(checkbox)_ | Name  | Status |
|-------------|-------|--------|
| ☐           | Ada   | Active |
| ☐           | Bob   | Inactive |
| ☐           | Carol | Active |

```typescript
headerTransformer: async ({ text, index }) => {
  if (!text.trim()) return 'Select'
  return text.trim()
}
// Resulting columns: 'Select', 'Name', 'Status'
```

---

**All-caps headers:**

| FIRST NAME | LAST NAME | EMAIL ADDRESS |
|-----------|-----------|---------------|
| Ada       | Lovelace  | ada@example.com |

```typescript
headerTransformer: async ({ text }) => text.toLowerCase().replace(/_/g, ' ').trim()
// Resulting columns: 'first name', 'last name', 'email address'
```

_Config: `headerTransformer`_
