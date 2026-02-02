# Examples

Real-world examples of using Playwright Smart Table with different table libraries and patterns.

## Quick Links

- [Basic Usage](/examples/basic) - Simple table interactions
- [Pagination](/examples/pagination) - Handling paginated tables
- [Infinite Scroll](/examples/infinite-scroll) - Infinite scroll tables
- [MUI DataGrid](/examples/mui-datagrid) - Material-UI DataGrid
- [AG Grid](/examples/ag-grid) - AG Grid integration

## Common Patterns

### Finding and Asserting

```typescript
const row = await table.findRow({ Name: 'John Doe' });
await expect(row.getCell('Email')).toHaveText('john@example.com');
```

### Filtering and Iteration

```typescript
const engineers = await table.getRows({ 
  filter: { Department: 'Engineering' } 
});

for (const engineer of engineers) {
  const name = await engineer.getCell('Name').textContent();
  console.log(name);
}
```

### Data Export

```typescript
const rows = await table.getRows();
const data = await rows.toJSON();
console.log(JSON.stringify(data, null, 2));
```

### Editing Cells

```typescript
const row = await table.findRow({ ID: '12345' });
await row.smartFill({
  Email: 'new.email@example.com',
  Phone: '555-1234'
});
```

## Browse Examples

Click on the links above to see detailed examples for each use case.
