<!-- NEEDS REVIEW -->
# SmartRowArray

`SmartRowArray` is a specialized array of [SmartRow](/api/smart-row) objects returned by methods like [getRows()](/api/table-methods#getrows) and [findRows()](/api/table-methods#findrows).

It extends the native Array, so you can use all standard array methods (`map`, `filter`, `forEach`, etc.), but adds a convenient `toJSON()` method to resolve data from all rows at once.

## Methods

### toJSON()

Resolves all rows in the array to a JSON representation. This is an async operation that calls `toJSON()` on each individual SmartRow.

```typescript
toJSON(options?: { columns?: string[] }): Promise<Record<string, any>[]>
```

#### Parameters

- `options` - (Optional) Configuration options
  - `columns` - specific columns to include in the output

#### Returns

`Promise<Record<string, any>[]>` - A promise that resolves to an array of objects representing the row data.

#### Example

```typescript
const rows = await table.getRows();

// Get all data
const allData = await rows.toJSON();
console.log(allData);
// [
//   { Name: 'John', Role: 'Admin' },
//   { Name: 'Jane', Role: 'User' }
// ]

// Get specific columns
const partialData = await rows.toJSON({ columns: ['Name'] });
console.log(partialData);
// [ { Name: 'John' }, { Name: 'Jane' } ]
```

## Usage with Array Methods

Since `SmartRowArray` extends `Array`, you can chain standard methods with `toJSON()`.

```typescript
const rows = await table.getRows();

// Filter rows locally (note: this filters SmartRow objects)
const adminRows = rows.filter(async row => 
  await row.getCell('Role').innerText() === 'Admin'
);

// Map to specific promises
const names = await Promise.all(
  rows.map(row => row.getCell('Name').innerText())
);
```
