# Data Scraping

Learn how to efficiently extract data from tables, whether they are small, paginated, or infinitely scrolled.

## Extracting All Data

The most efficient way to scrape an entire table is using `table.map()`. This handles pagination automatically and processes rows in chunks.

```typescript
// Define the data shape you want to extract
interface User {
  id: string;
  name: string;
  email: string;
}

const allUsers = await table.map<User>(async ({ row }) => {
  return {
    id: await row.getCell('ID').innerText(),
    name: await row.getCell('Name').innerText(),
    email: await row.getCell('Email').innerText()
  };
});

console.log(`Extracted ${allUsers.length} users`);
```

## Handling Large Datasets

For very large tables (1000+ rows), accumulation in memory might be too heavy. You can process data in chunks or write to a file directly.

```typescript
import fs from 'fs';

const stream = fs.createWriteStream('users.csv');
stream.write('ID,Name,Email\n');

await table.forEach(
  async ({ row }) => {
    const id = await row.getCell('ID').innerText();
    const name = await row.getCell('Name').innerText();
    const email = await row.getCell('Email').innerText();
    
    stream.write(`${id},${name},${email}\n`);
  }
);

stream.end();
```

## Scraping Specific Columns

If you only need values from a single column across all pages, use `table.map()`.

```typescript
// Get all email addresses from the entire table
const emails = await table.map(({ row }) => row.getCell('Email').innerText());

// Get and transform values (e.g., parse currency)
const salaries = await table.map(async ({ row }) => {
  const text = await row.getCell('Salary').innerText();
  return parseFloat(text.replace('$', '').replace(',', ''));
});
```

## Handling Dynamic Content

Some tables load data lazily. You might need to wait for cell content to be non-empty.

```typescript
const allData = await table.map(
  async ({ row }) => {
    // Wait for specific cell to have content
    await expect(row.getCell('Status')).not.toBeEmpty();
    // Or wait for a specific condition
    await row.getCell('Status').locator('.badge').waitFor();
    
    // Now extract data...
    return row.toJSON();
  }
);
```

## Exporting to JSON

You can easily dump the current page or specific rows to JSON.

```typescript
// Dump current page
const pageData = await table.findRows({}).then(r => r.toJSON());

// Dump specific rows
const activeUsers = await table.findRows({ Status: 'Active' });
const json = await activeUsers.toJSON();

// Write to file
fs.writeFileSync('active-users.json', JSON.stringify(json, null, 2));
```
