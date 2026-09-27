# SmartRow

A `SmartRow` is a Playwright `Locator` extended with table-aware methods. Every method that returns a row (`getRow`, `findRow`, iteration callbacks, etc.) returns a `SmartRow`.

Because `SmartRow` extends `Locator`, all standard Playwright locator methods — `click()`, `innerText()`, `waitFor()`, `locator()`, etc. — are available directly on the row.

→ [API: Table Methods](/api/table-methods)

---

## Properties

### `rowIndex`

<!-- api-signature: rowIndex -->

### Signature

```typescript
rowIndex?: number
```

<!-- /api-signature: rowIndex -->

The 0-based row index within the table, if known. Set by `findRow`, `findRows`, `getRowByIndex`, `filter`, and async iteration. May be `undefined` when returned by `getRow`.

```typescript
const row = await table.findRow({ Name: 'John' });
console.log(row.rowIndex); // e.g. 12
```

---

### `tablePageIndex`

<!-- api-signature: tablePageIndex -->

### Signature

```typescript
tablePageIndex?: number
```

<!-- /api-signature: tablePageIndex -->

The 0-based page index this row was found on during pagination. Set alongside `rowIndex` by async operations.

---

### `table`

<!-- api-signature: table -->

### Signature

```typescript
table: TableResult<T>
```

<!-- /api-signature: table -->

Reference back to the parent `TableResult`. Useful when passing rows between helpers.

---

## Methods

### `getCell`

<!-- api-signature: getCell -->

### Signature

```typescript
getCell(column: string): SmartCell
```

### Parameters

- `column` - Column name (case-sensitive)

<!-- /api-signature: getCell -->

Returns a `SmartCell` (Locator + `bringIntoView`) for the named column. Column name is case-sensitive.

```typescript
const emailCell = row.getCell('Email');
await expect(emailCell).toHaveText('john@example.com');

// SmartCell also exposes bringIntoView
await row.getCell('Notes').bringIntoView();
```

→ [Guide: Read Cells](/guide/query/read-cells)

---

### `toJSON`

<!-- api-signature: toJSON -->

### Signature

```typescript
toJSON(options?: { columns?: string[]; atomic?: boolean }): Promise<T>
```

### Parameters

- `options` - Optional configuration

<!-- /api-signature: toJSON -->

Reads all (or specified) columns and returns a plain object. Includes `columnOverrides.read` values and [`syntheticColumns`](/api/table-config#syntheticcolumns).

- **`columns`** — only read these columns.
- **`atomic`** — snapshot every cell in a single browser evaluate, so no column is read at a different moment than another (useful for live-updating rows). Requires `cellSelector` to be a CSS string, not a function. Column overrides still run, against a frozen off-screen copy of the row. Non-override columns are read with `textContent` rather than `innerText`.

```typescript
const data = await row.toJSON();
// { Name: 'John', Email: 'john@example.com', Status: 'Active' }

const partial = await row.toJSON({ columns: ['Name', 'Status'] });
// { Name: 'John', Status: 'Active' }

const coherent = await row.toJSON({ atomic: true });
```

→ [Guide: Read Cells](/guide/query/read-cells)

---

### `getValue`

<!-- api-signature: getValue -->

### Signature

```typescript
getValue(column: string): Promise<string>
```

### Parameters

- `column` - Column name (case-sensitive)

<!-- /api-signature: getValue -->

Returns the resolved value of one column as a string — works for real DOM columns, `columnOverrides.read` columns, and `syntheticColumns`.

When `strategies.viewport` or `strategies.navigation` is configured, it runs the same cell-navigation pipeline as `toJSON()`, so off-screen virtualized cells are mounted before reading. Without those strategies it reads the current DOM cell.

```typescript
const email = await row.getValue('Email');
const total = await row.getValue('Total'); // synthetic column
```

→ [Guide: Read Cells](/guide/query/read-cells)

---

### `bringIntoView`

<!-- api-signature: bringIntoView -->

### Signature

```typescript
bringIntoView(): Promise<void>
```

<!-- /api-signature: bringIntoView -->

Scrolls and/or paginates to make this row visible. Requires `rowIndex` to be set — works when the row was returned by `findRow`, `findRows`, `getRowByIndex`, `filter`, or async iteration. Prefers `strategies.viewport.scrollToRow` when configured (avoids Y-axis eviction from `scrollIntoViewIfNeeded` on virtualized grids).

```typescript
const rows = await table.findRows({ Status: 'Flagged' });
for (const row of rows) {
  await row.bringIntoView();
  await expect(row.getCell('Status')).toBeVisible();
}
```

::: warning
Throws if `rowIndex` is unknown (e.g., rows from `getRow`).
:::

---

### `smartFill`

<!-- api-signature: smartFill -->

### Signature

```typescript
smartFill(data: Partial<T> | Record<string, any>, options?: FillOptions): Promise<void>
```

### Parameters

- `data` - Column-value pairs to fill
- `options` - Optional configuration

<!-- /api-signature: smartFill -->

Fills form fields in the row. Auto-detects input type (text, select, checkbox, contenteditable). Uses `columnOverrides.write` when configured.

```typescript
await row.smartFill({ Name: 'Jane', Status: 'Active', Subscribe: true });

// Custom input mapper for a non-standard input
await row.smartFill(
  { Notes: 'Updated' },
  { inputMappers: { Notes: (cell) => cell.locator('.rich-text-editor') } }
);
```

→ [Guide: Fill Cells](/guide/describe/editing)

---

### `wasFound`

<!-- api-signature: wasFound -->

### Signature

```typescript
wasFound(): boolean
```

<!-- /api-signature: wasFound -->

Returns `false` if this is a sentinel "not found" row (e.g., when `findRow` finds no match in a non-throwing mode). Returns `true` for any real row.

```typescript
const row = await table.findRow({ Name: 'Ghost' });
if (!row.wasFound()) {
  console.log('Row not found');
}
```
