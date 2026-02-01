# Debugging 🐛

`playwright-smart-table` v5.2+ includes powerful debugging tools to help you understand what's happening under the hood.

## Debug Configuration

You can pass a `debug` object to the `useTable` configuration:

```typescript
const table = useTable(page.locator('#table'), {
  headerSelector: 'thead th',
  debug: {
    slow: 500,           // Add delay between actions
    logLevel: 'verbose'  // Enable detailed logs
  }
});
```

## Features

### 1. Slow Motion (`slow`)

Add a delay (in milliseconds) after every major action (pagination, finding rows, getting cells). This is incredibly useful for visually following the test execution.

```typescript
debug: {
  slow: 1000 // Wait 1 second after every action
}
```

Or configure granular delays:

```typescript
debug: {
  slow: {
    pagination: 2000, // Wait 2s after page turn
    findRow: 500,     // Wait 0.5s after finding a row
    default: 100      // Wait 0.1s for everything else
  }
}
```

### 2. Console Logging (`logLevel`)

Get real-time feedback in your terminal.

```typescript
debug: {
  logLevel: 'info' // Options: 'none' | 'error' | 'info' | 'verbose'
}
```

*   **info**: Shows major events (Init, Pagination, Row found).
*   **verbose**: Shows detailed steps (Column mapping, cell access).

### 3. Strict Validation (v5.2)

`table.init()` strictly validates your configuration to prevent silent failures:

*   ❌ **Zero Columns**: Throws if no columns are found (checks your `headerSelector`).
*   ❌ **Duplicate Columns**: Throws if multiple columns have the same name (ambiguous mapping).

### 4. Smart Error Messages

If you typo a column name when filtering, we'll try to guess what you meant:

```typescript
// Typo: 'Emal' instead of 'Email'
await table.findRow({ Emal: 'john@example.com' });
```

**Output:**
```
Error: Column "Emal" not found.
Did you mean:
• Email (80% match)
```
