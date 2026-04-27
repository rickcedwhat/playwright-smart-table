# Examples

Pick the example closest to what you are trying to do. If you are new, start with Basic Usage, then Pagination.

## By Task

| I want to... | Start here |
|---|---|
| Find a row and assert a cell | [Basic Usage](/examples/basic) |
| Search across pages | [Pagination](/examples/pagination) |
| Work with infinite scroll | [Infinite Scroll](/examples/infinite-scroll) |
| Extract many rows into data | [Data Scraping](/recipes/data-scraping) |
| Use MUI DataGrid | [MUI DataGrid](/examples/mui-datagrid) |
| Use AG Grid | [AG Grid](/examples/ag-grid) |
| Write a custom strategy | [Custom Strategies](/recipes/custom-strategies) |

## Common Starting Points

### Assert a Cell by Column Name

```typescript
const row = table.getRow({ Name: 'John Doe' });
await expect(row.getCell('Email')).toHaveText('john@example.com');
```

### Find Rows Across Pages

```typescript
const engineers = await table.findRows({ Department: 'Engineering' });
expect(engineers.length).toBeGreaterThan(0);
```

### Extract Data

```typescript
const data = await table.map(({ row }) => row.toJSON());
```

### Fill Editable Cells

```typescript
const row = table.getRow({ ID: '12345' });
await row.smartFill({ Email: 'new.email@example.com' });
```

## Need API Details?

Use the [API Reference](/api/) when you know the method or config option and need exact signatures.
