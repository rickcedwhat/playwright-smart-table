# What does your header text actually say?

Real app headers often include noise: sort arrows, counts, badges. `headerTransformer` runs on each header before it's stored — the cleaned name is what you use everywhere else in `getRow`, `getCell`, etc.

:::tabs
== Sort arrows

| Name ↑ | Department ↓ | Salary |
|--------|-------------|--------|
| Ada    | Engineering | 90000  |
| Bob    | Marketing   | 65000  |
| Carol  | Engineering | 95000  |

```typescript
headerTransformer: async ({ text }) => text.replace(/[↑↓▲▼]/g, '').trim()
// Result: 'Name', 'Department', 'Salary'
```

== Unlabeled checkbox column

|  | Name  | Status   |
|:---:|-------|----------|
| ☐  | Ada   | Active   |
| ☐  | Bob   | Inactive |
| ☐  | Carol | Active   |

```typescript
headerTransformer: async ({ text, index }) => {
  if (!text.trim()) return 'Select'
  return text.trim()
}
// Result: 'Select', 'Name', 'Status'
```

== All-caps headers

| FIRST NAME | LAST NAME | EMAIL ADDRESS   |
|-----------|-----------|-----------------|
| Ada       | Lovelace  | ada@example.com |
| Bob       | Builder   | bob@example.com |
| Carol     | Danvers   | carol@example.com |

```typescript
headerTransformer: async ({ text }) => text.toLowerCase().replace(/_/g, ' ').trim()
// Result: 'first name', 'last name', 'email address'
```

:::

_Config: `headerTransformer`_
