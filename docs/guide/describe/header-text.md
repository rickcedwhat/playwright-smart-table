# What does your header text actually say?

Real app headers often include noise: sort arrows, counts, badges. `headerTransformer` runs on each header before it's stored — the cleaned name is what you use everywhere else in `getRow`, `getCell`, etc.

:::tabs
== Sort arrows

| Name ↑ | Department ↓ | Salary | Status | Start Date |
|--------|-------------|--------|--------|------------|
| Ada    | Engineering | 90000  | Active | 2022-03-01 |
| Bob    | Marketing   | 65000  | Active | 2021-07-15 |
| Carol  | Engineering | 95000  | On Leave | 2020-11-08 |

```typescript
headerTransformer: async ({ text }) => text.replace(/[↑↓▲▼]/g, '').trim()
// Result: 'Name', 'Department', 'Salary', 'Status', 'Start Date'
```

== Unlabeled checkbox column

|  | Name  | Status   | Department  | Salary |
|:---:|-------|----------|-------------|--------|
| ☐  | Ada   | Active   | Engineering | 90000  |
| ☐  | Bob   | Inactive | Marketing   | 65000  |
| ☐  | Carol | Active   | Engineering | 95000  |

```typescript
headerTransformer: async ({ text, index }) => {
  if (!text.trim()) return 'Select'
  return text.trim()
}
// Result: 'Select', 'Name', 'Status', 'Department', 'Salary'
```

== All-caps headers

| FIRST NAME | LAST NAME | EMAIL ADDRESS   | DEPARTMENT  | START DATE |
|-----------|-----------|-----------------|-------------|------------|
| Ada       | Lovelace  | ada@example.com | Engineering | 2022-03-01 |
| Bob       | Builder   | bob@example.com | Marketing   | 2021-07-15 |
| Carol     | Danvers   | carol@example.com | Design    | 2020-11-08 |

```typescript
headerTransformer: async ({ text }) => text.toLowerCase().replace(/_/g, ' ').trim()
// Result: 'first name', 'last name', 'email address', 'department', 'start date'
```

:::

_Config: `headerTransformer`_
