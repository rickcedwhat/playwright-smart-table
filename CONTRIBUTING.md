# Contributing to Playwright Smart Table

Thank you for your interest in contributing! This guide will help you get started.

## 🚀 Quick Start

### 1. Fork and Clone

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/YOUR_USERNAME/playwright-smart-table.git
cd playwright-smart-table
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 4. Make Your Changes

Follow our [Development Guidelines](#development-guidelines) below.

### 5. Test Your Changes

```bash
# Run all tests
npm test

# Run specific test
npx playwright test tests/your-test.spec.ts

# Build the project
npm run build

# Test docs locally
npm run docs:dev
```

### 6. Commit Your Changes

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add new pagination strategy"
git commit -m "fix: resolve column detection issue"
git commit -m "docs: update API reference"
git commit -m "test: add tests for SmartRow"
```

**Commit types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `test:` - Adding or updating tests
- `refactor:` - Code refactoring
- `perf:` - Performance improvement
- `chore:` - Maintenance tasks

### 7. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

---

## 🎨 Design Philosophy

Understanding our design principles will help you contribute code that fits naturally with the library.

### 1. Stay Close to Native Playwright

**Return Playwright types whenever possible:**

```typescript
// ✅ Good - returns Locator
getCell(columnName: string): Locator

// ❌ Avoid - custom wrapper when Locator would work
getCell(columnName: string): CellWrapper
```

**Extend Playwright types, don't replace them:**

```typescript
// ✅ Good - SmartRow extends Locator behavior
interface SmartRow {
  locator: Locator;  // Underlying Playwright locator
  getCell(name: string): Locator;  // Returns Locator
}

// ❌ Avoid - completely custom type
interface TableRow {
  click(): Promise<void>;  // Reimplementing Playwright
}
```

### 2. Naming Conventions

**`get*` vs `find*` - Follow Playwright's pattern:**

```typescript
// get* - Synchronous, requires initialization, throws if not found
getRow(filters: Record<string, string>): SmartRow
getRowByIndex(index: number): SmartRow

// find* - Asynchronous, auto-initializes, searches (may cross pages)
findRow(filters: Record<string, string>): Promise<SmartRow>
findRows(filters: Record<string, string>): Promise<SmartRow[]>
```

**Why this matters:**
- `get*` = Fast, assumes table is ready
- `find*` = Thorough, handles setup automatically

### 3. Sync vs Async Methods

**Sync methods require initialization:**

```typescript
// ❌ Will throw if not initialized
const row = table.getRowByIndex(0);

// ✅ Must initialize first
await table.init();
const row = table.getRowByIndex(0);
```

**Async methods auto-initialize:**

```typescript
// ✅ Initializes automatically if needed
const row = await table.findRow({ Name: 'John' });

// ✅ Also auto-initializes
const rows = await table.getRows();
```

**What "initialized" means:**
- Headers have been mapped (column names → indices)
- Table structure is understood
- Ready for synchronous operations

**When to use each:**

```typescript
// Use sync when you know table is ready (performance)
await table.init();
for (let i = 0; i < 10; i++) {
  const row = table.getRowByIndex(i);  // Fast, no await
  // ...
}

// Use async when you're not sure or need search
const row = await table.findRow({ ID: '12345' });  // Handles everything
```

### 4. Locator-First Design

**Always prefer Locator over text content:**

```typescript
// ✅ Good - returns Locator for further Playwright operations
const emailCell = row.getCell('Email');
await expect(emailCell).toHaveText('john@example.com');
await emailCell.click();

// ❌ Avoid - extracting text too early
const emailText = await row.getCellText('Email');
expect(emailText).toBe('john@example.com');  // Can't click anymore
```

**Why:** Locators are lazy and auto-wait. Text is static and loses Playwright's power.

### 5. Minimal Abstraction

**Don't hide Playwright's capabilities:**

```typescript
// ✅ Good - SmartRow exposes underlying locator
interface SmartRow {
  locator: Locator;  // Users can access raw Playwright
  getCell(name: string): Locator;
}

// Usage:
await row.locator.hover();  // Direct Playwright access
await row.locator.screenshot();  // Full Playwright API available
```

**Don't reinvent Playwright methods:**

```typescript
// ❌ Avoid
row.clickCell('Email');  // Unnecessary wrapper

// ✅ Good
row.getCell('Email').click();  // Use Playwright's click
```

### 6. Type Safety Without Overhead

**Generic types should enhance, not complicate:**

```typescript
// ✅ Good - optional type safety
type User = { Name: string; Email: string };
const table = useTable<User>(locator);
const row = await table.findRow({ Name: 'John' });  // Autocomplete!

// ✅ Also good - works without types
const table = useTable(locator);  // Still fully functional
```

**Types should be exported and reusable:**

```typescript
// ✅ Export all public types
export interface SmartRow<T = any> { ... }
export interface TableConfig { ... }
export type PromptOptions = { ... };
```

### 7. Fail Fast with Helpful Errors

**Errors should guide users to solutions:**

```typescript
// ✅ Good error
throw new Error(
  `Column "Emai" not found. Did you mean "Email"? ` +
  `Available columns: Name, Email, Office`
);

// ❌ Bad error
throw new Error('Column not found');
```

**Validate early:**

```typescript
// ✅ Validate strategy inputs
if (!strategy || typeof strategy !== 'function') {
  throw new Error('Invalid pagination strategy. Must be a function.');
}
```

---

## 📋 Development Guidelines

### Code Style

- **TypeScript** - All code must be TypeScript
- **Formatting** - Code is auto-formatted (no config needed)
- **Naming** - Use descriptive names, camelCase for variables/functions
- **Comments** - Add JSDoc comments for public APIs

### Library-Specific Patterns

**Use `logDebug()` instead of `console.log()`:**

```typescript
// ❌ Don't use console.log
console.log('Finding row...');

// ✅ Use logDebug from debugUtils
import { logDebug } from './utils/debugUtils';

logDebug(config, 'verbose', 'Finding row with filters', filters);
logDebug(config, 'info', 'Row found successfully');
logDebug(config, 'error', 'Failed to find row', error);
```

**Log levels:**
- `'error'` - Critical errors only
- `'info'` - Important operations
- `'verbose'` - Detailed debugging

**Use `SmartRowArray` for row collections:**

```typescript
// ✅ Use SmartRowArray for type-safe row arrays
import { createSmartRowArray } from './utils/smartRowArray';

const rows = createSmartRowArray<T>(rowArray, headerMap);
// Now has .toJSON() and other SmartRow methods
```

**Follow Strategy Pattern:**

All strategies should:
- Be in `src/strategies/` directory
- Export a `*Strategies` object
- Include validation functions
- Have clear JSDoc comments

```typescript
// Example: src/strategies/myStrategy.ts
export const MyStrategies = {
  default: () => {
    return async (context: StrategyContext) => {
      // Implementation
    };
  }
};
```

### Testing Requirements

**All PRs must include tests:**

```typescript
// tests/your-feature.spec.ts
import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';

test('your feature works correctly', async ({ page }) => {
  await page.goto('https://example.com/table');
  const table = await useTable(page.locator('#table')).init();
  
  // Your test here
  expect(await table.getHeaders()).toContain('Name');
});
```

**Test checklist:**
- [ ] Tests pass locally (`npm test`)
- [ ] New features have test coverage
- [ ] Bug fixes include regression tests
- [ ] Tests are clear and well-documented

### Common Pitfalls to Avoid

**❌ Don't use `ElementHandle` - use `Locator`:**
```typescript
// ❌ Bad
const element = await page.$('td');

// ✅ Good
const cell = page.locator('td');
```

**❌ Don't mutate config directly:**
```typescript
// ❌ Bad
config.maxPages = 10;

// ✅ Good - config is readonly
const newConfig = { ...config, maxPages: 10 };
```

**❌ Don't forget to handle pagination state:**
```typescript
// ❌ Bad - doesn't reset pagination
await table.findRow({ Name: 'John' });
await table.findRow({ Name: 'Jane' }); // Might start from wrong page

// ✅ Good - reset if needed
await table.reset();
await table.findRow({ Name: 'Jane' });
```

**❌ Don't assume column order:**
```typescript
// ❌ Bad
const cell = row.locator('td').nth(2);

// ✅ Good
const cell = row.getCell('Email');
```

### Documentation Requirements

**Update docs for:**
- New features → Add to relevant API docs
- Breaking changes → Update migration guide
- New strategies → Add examples
- Bug fixes → Update troubleshooting if relevant

**Docs locations:**
- API Reference: `docs/api/`
- Examples: `docs/examples/`
- Guides: `docs/guide/`

### Type Safety

**All public APIs must:**
- Have TypeScript types defined in `src/types.ts`
- Include JSDoc comments with examples
- Export types for user consumption

**Type organization:**
- **Core types** → `src/types.ts`
- **Strategy types** → `src/strategies/*.ts`
- **Utility types** → Co-located with implementation

**Example:**
```typescript
// src/types.ts
export interface MyNewOption {
  /** Description of what this does */
  enabled: boolean;
  /** How many times to retry */
  retries?: number;
}

// src/useTable.ts
/**
 * Find rows matching the filter criteria.
 * Searches across all pages if pagination is configured.
 * 
 * @param filters - Column-value pairs to match
 * @param options - Search options
 * @returns Array of matching SmartRows
 * 
 * @example
 * ```typescript
 * const rows = await table.findRows({ Status: 'Active' });
 * ```
 */
findRows(
  filters: Record<string, string | RegExp | number>,
  options?: { exact?: boolean; maxPages?: number }
): Promise<SmartRow[]>
```

**Important type patterns:**
- Use `Locator` from `@playwright/test`, not `ElementHandle`
- Strategies return functions (factory pattern)
- Config uses `Partial<>` for optional overrides

---

## 🔍 Pull Request Process

### Before Submitting

**Checklist:**
- [ ] Code follows TypeScript best practices
- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation is updated
- [ ] Commit messages follow conventional commits
- [ ] No `console.log()` - use `logDebug()` instead
- [ ] Types are exported from `src/types.ts`
- [ ] Strategies follow factory pattern
- [ ] Used `SmartRowArray` for row collections
- [ ] Added debug delays if needed (`debugDelay()`)
- [ ] Validated strategy inputs if applicable

### PR Template

When creating a PR, include:

```markdown
## Description
Brief description of what this PR does

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How did you test this?

## Checklist
- [ ] Tests pass
- [ ] Docs updated
- [ ] Types added/updated
```

### Review Process

1. **Automated Checks** - CI must pass (tests, build, lint)
2. **Code Review** - Maintainer will review within 2-3 days
3. **Feedback** - Address any requested changes
4. **Approval** - Once approved, maintainer will merge

---

## 🏗️ Project Structure

```
playwright-smart-table/
├── src/                    # Source code
│   ├── index.ts           # Main export (public API)
│   ├── useTable.ts        # Core table logic
│   ├── types.ts           # TypeScript types & interfaces
│   ├── smartRow.ts        # SmartRow implementation
│   ├── typeContext.ts     # Type definitions for AI prompts
│   ├── filterEngine.ts    # Row filtering logic
│   ├── strategies/        # Built-in strategies
│   │   ├── index.ts       # Strategy exports
│   │   ├── pagination.ts  # Pagination strategies
│   │   ├── sorting.ts     # Sorting strategies
│   │   ├── fill.ts        # Cell filling strategies
│   │   ├── headers.ts     # Header detection strategies
│   │   ├── columns.ts     # Cell navigation strategies
│   │   ├── resolution.ts  # Column resolution strategies
│   │   └── validation.ts  # Strategy validation
│   └── utils/             # Utility functions
│       ├── debugUtils.ts  # logDebug, debugDelay, etc.
│       ├── smartRowArray.ts # SmartRowArray factory
│       └── stringUtils.ts # String manipulation
├── tests/                 # Playwright tests
│   ├── *.spec.ts         # Test files
│   └── test-pages/       # HTML test fixtures
├── docs/                  # VitePress documentation
│   ├── .vitepress/       # VitePress config
│   ├── api/              # API reference (auto-generated)
│   ├── guide/            # User guides
│   └── examples/         # Code examples
├── scripts/              # Build & doc generation scripts
│   ├── generate-all-api-docs.mjs
│   └── update-all-api-signatures.mjs
└── dist/                 # Compiled output (git-ignored)
```

**Key files to know:**
- `src/useTable.ts` - Main table implementation
- `src/smartRow.ts` - Row wrapper with column awareness
- `src/types.ts` - All TypeScript interfaces
- `src/utils/debugUtils.ts` - Logging utilities
- `src/strategies/` - All built-in strategies

---

## 🐛 Reporting Bugs

**Before reporting:**
1. Check [existing issues](https://github.com/rickcedwhat/playwright-smart-table/issues)
2. Try latest version
3. Review [Troubleshooting guide](https://rickcedwhat.github.io/playwright-smart-table/troubleshooting)

**Bug report should include:**
- Playwright version
- Library version
- Minimal reproduction code
- Expected vs actual behavior
- Error messages/screenshots

---

## 💡 Feature Requests

We welcome feature requests! Please:
1. Check if it already exists
2. Describe the use case
3. Provide examples of how it would work
4. Consider if it fits the library's scope

---

## 🤝 Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

---

## 📞 Getting Help

- **Questions** - Open a [Discussion](https://github.com/rickcedwhat/playwright-smart-table/discussions)
- **Bugs** - Open an [Issue](https://github.com/rickcedwhat/playwright-smart-table/issues)
- **Documentation** - Check the [docs](https://rickcedwhat.github.io/playwright-smart-table/)

---

## 🎉 Recognition

Contributors will be:
- Listed in release notes
- Credited in the README
- Thanked publicly!

Thank you for contributing! 🙏
