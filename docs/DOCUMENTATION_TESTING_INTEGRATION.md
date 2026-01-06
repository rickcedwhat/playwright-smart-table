# Documentation & Testing Integration Guide

This document explains how this project integrates tests with documentation to ensure code examples in the README are always accurate and executable.

## Core Philosophy

**Tests are the source of truth for documentation.** Code snippets in the README are extracted directly from test files, ensuring:
- ✅ All examples are executable and tested
- ✅ Documentation stays in sync with code changes
- ✅ No manual copy-paste errors
- ✅ Examples reflect real-world usage patterns

## System Overview

The integration works through a **code region extraction system**:

1. **Tests contain code regions** marked with `// #region name` and `// #endregion name`
2. **README contains placeholder markers** like `<!-- embed: name -->`
3. **Build script extracts** code from tests and injects it into README
4. **Type definitions** can also be embedded from source files

## Workflow

### Step 1: Write Tests with Code Regions

In your test file (e.g., `tests/readme_verification.spec.ts`), wrap example code in regions:

```typescript
test('Quick Start Example', async ({ page }) => {
  await page.goto('https://example.com');
  
  // #region quick-start
  const table = await useTable(page.locator('#example')).init();
  const row = table.getByRow({ Name: 'John' });
  await expect(row).toBeVisible();
  // #endregion quick-start
});
```

**Key Points:**
- Regions can appear anywhere in test code
- The code inside regions should be **standalone and executable**
- Include comments that explain context (e.g., `// Example from: https://example.com`)
- Regions are automatically dedented (leading whitespace removed)

### Step 2: Mark Embed Points in README

In your `README.md`, use HTML comments to mark where code should be embedded:

```markdown
## Quick Start

<!-- embed: quick-start -->
```typescript
// This will be replaced automatically
```
<!-- /embed: quick-start -->
```

**Important:**
- The region name must match exactly (case-sensitive)
- The opening and closing tags must match
- The code block between tags will be replaced

### Step 3: Run Documentation Generation

Run the build script to sync tests → README:

```bash
npm run generate-docs
```

This script:
1. Reads `tests/readme_verification.spec.ts`
2. Extracts all `#region` blocks
3. Finds matching `<!-- embed: name -->` markers in README
4. Replaces the content between markers with extracted code
5. Preserves formatting and language tags

## Type Embedding System

In addition to code snippets, you can embed TypeScript type definitions:

### Step 1: Export Types in Source

Ensure your types are exported in `src/types.ts`:

```typescript
/**
 * Configuration options for the table
 */
export interface TableConfig {
  debug?: boolean;
  maxPages?: number;
}
```

### Step 2: Embed in README

Use `embed-type` markers:

```markdown
<!-- embed-type: TableConfig -->
```typescript
// Type definition will appear here
```
<!-- /embed-type: TableConfig -->
```

The build script automatically:
- Extracts exported types from `src/types.ts`
- Includes JSDoc comments
- Removes import statements
- Formats for display

## Build Integration

The documentation generation is integrated into the build process:

```json
{
  "scripts": {
    "generate-docs": "node scripts/generate-readme.mjs",
    "generate-types": "node scripts/embed-types.mjs",
    "build": "npm run generate-types && npm run generate-docs && tsc"
  }
}
```

**Build Order:**
1. `generate-types` - Embeds types into `src/typeContext.ts` (for LLM context)
2. `generate-docs` - Syncs test code → README
3. `tsc` - Compiles TypeScript

## CI/CD Integration

The project uses a comprehensive CI/CD setup that ensures documentation and code stay in sync, and automates publishing to npm.

### Pre-Commit Hooks (Husky)

**Purpose:** Automatically generate documentation and build artifacts before commits, ensuring generated files are always up-to-date.

**Setup:**

1. **Install Husky:**
   ```bash
   npm install --save-dev husky
   ```

2. **Initialize Husky:**
   ```bash
   npx husky install
   ```

3. **Add prepare script** to `package.json`:
   ```json
   {
     "scripts": {
       "prepare": "husky install"
     }
   }
   ```

4. **Create pre-commit hook** (`.husky/pre-commit`):
   ```bash
   #!/usr/bin/env sh
   . "$(dirname -- "$0")/_/husky.sh"
   
   echo "🚧 Running build and docs generation..."
   npm run build
   
   # Add all generated/modified files to the commit
   git add dist README.md src/typeContext.ts
   
   # Check if npm run build was successful before committing
   if [ $? -ne 0 ]; then
     echo "Build failed, commit aborted."
     exit 1
   fi
   ```

**What It Does:**
- Runs `npm run build` before every commit
- Automatically stages generated files (`dist/`, `README.md`, `src/typeContext.ts`)
- Prevents commits if build fails
- Ensures documentation is always synced with tests

**Key Benefits:**
- ✅ No manual documentation updates needed
- ✅ Generated files are always committed with source changes
- ✅ Prevents broken builds from being committed
- ✅ Team members can't forget to regenerate docs

### GitHub Actions Workflow

**Purpose:** Automatically test, build, and publish to npm when version changes.

**Location:** `.github/workflows/publish.yml`

**Workflow Overview:**

```yaml
name: Node.js Package Publish

on:
  push:
    branches:
      - main

jobs:
  publish-gpr:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write  # Required for npm provenance

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Check if version changed
        id: check_version
        run: |
          PACKAGE_NAME=@your-scope/your-package
          LATEST_VERSION=$(npm view $PACKAGE_NAME version 2>/dev/null || echo "0.0.0")
          LOCAL_VERSION=$(node -p "require('./package.json').version")
          
          if [ "$LOCAL_VERSION" != "$LATEST_VERSION" ]; then
            echo "✨ Version change detected!"
            echo "changed=true" >> $GITHUB_OUTPUT
          else
            echo "💤 Version matches NPM. Skipping release."
            echo "changed=false" >> $GITHUB_OUTPUT
          fi

      - name: Cache Playwright Browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: ${{ runner.os }}-playwright-${{ hashFiles('package-lock.json') }}

      - name: Install Dependencies
        run: npm ci

      - name: Install Playwright Browsers
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: npx playwright install --with-deps

      - name: Run Tests
        run: npm test

      - name: Publish to NPM
        if: steps.check_version.outputs.changed == 'true'
        run: npm publish --provenance --access public
```

**Key Features:**

1. **Version Detection:**
   - Compares `package.json` version with published npm version
   - Only publishes if version changed
   - Prevents duplicate publishes on non-version commits

2. **Playwright Caching:**
   - Caches browser binaries to speed up CI
   - Reduces workflow time significantly

3. **Test Execution:**
   - Runs full test suite before publishing
   - Ensures all examples in README work correctly
   - Fails workflow if tests fail

4. **NPM Publishing:**
   - Uses `--provenance` for supply chain security
   - Only runs if version changed
   - Requires NPM token in repository secrets

**NPM Token Setup:**

1. Generate an npm access token:
   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Create a "Automation" token

2. Add to GitHub Secrets:
   - Go to repository Settings → Secrets and variables → Actions
   - Add secret: `NPM_TOKEN` with your token value

3. The `setup-node` action automatically uses `NPM_TOKEN` from secrets

### Publishing Workflow

**Release Process:**

1. **Update Version:**
   ```bash
   # Edit package.json
   "version": "3.1.1"  # Increment patch/minor/major
   ```

2. **Commit and Push:**
   ```bash
   git add package.json
   git commit -m "chore: bump version to 3.1.1"
   git push origin main
   ```

3. **Automated Steps:**
   - GitHub Actions workflow triggers
   - Tests run automatically
   - Build executes (generates docs)
   - Version check detects change
   - Package publishes to npm

**Important Notes:**
- ⚠️ **Never run `npm publish` locally** - GitHub Actions handles it
- ✅ Just increment version and push to `main`
- ✅ All tests must pass before publish
- ✅ Documentation is auto-generated during build

### Integration Points

**How CI/CD Integrates with Documentation:**

1. **Pre-Commit:**
   - Husky runs `npm run build`
   - `generate-docs` syncs tests → README
   - Generated README is staged automatically
   - Ensures docs are current before commit

2. **CI Pipeline:**
   - Runs `npm test` which includes `readme_verification.spec.ts`
   - Verifies all README examples are executable
   - Fails if any example breaks

3. **Publishing:**
   - `prepublishOnly` hook runs `npm run build`
   - Documentation is regenerated before publish
   - Published package includes up-to-date README

**Complete Flow:**

```
Developer edits test → 
  Pre-commit hook runs build → 
    Docs auto-generated → 
      Files staged → 
        Commit → 
          Push to main → 
            GitHub Actions runs tests → 
              Version check → 
                Publish to npm (if version changed)
```

### Setup Checklist

To implement this CI/CD system in a new project:

**Husky Setup:**
- [ ] Install husky: `npm install --save-dev husky`
- [ ] Add `"prepare": "husky install"` to package.json
- [ ] Run `npx husky install`
- [ ] Create `.husky/pre-commit` hook
- [ ] Make hook executable: `chmod +x .husky/pre-commit`
- [ ] Test by making a commit

**GitHub Actions Setup:**
- [ ] Create `.github/workflows/publish.yml`
- [ ] Update package name in version check script
- [ ] Add `NPM_TOKEN` to GitHub repository secrets
- [ ] Configure npm registry URL if using scoped packages
- [ ] Test workflow by pushing a version bump

**NPM Configuration:**
- [ ] Ensure `package.json` has correct `files` field
- [ ] Verify `prepublishOnly` script runs build
- [ ] Test local build: `npm run build`
- [ ] Verify generated files are in `.gitignore` (if not committing them)

**Verification:**
- [ ] Make a test commit - verify pre-commit hook runs
- [ ] Push version bump - verify GitHub Actions publishes
- [ ] Check npm - verify package published correctly
- [ ] Verify README on npm matches local README

### Troubleshooting CI/CD

**Pre-Commit Hook Not Running:**

**Solution:**
- Ensure husky is installed: `npm install`
- Check hook exists: `ls -la .husky/pre-commit`
- Verify hook is executable: `chmod +x .husky/pre-commit`
- Check `prepare` script in package.json

**GitHub Actions Fails on Publish:**

**Common Issues:**
- Missing `NPM_TOKEN` secret → Add to repository secrets
- Version already exists → Increment version in package.json
- Permission denied → Check npm token has publish access
- Build fails → Check build script runs successfully locally

**Version Check Always Fails:**

**Solution:**
- Verify package name in workflow matches actual package name
- Check npm registry URL is correct
- Ensure package exists on npm (or handle first publish differently)

**Generated Files Not Committed:**

**Solution:**
- Check pre-commit hook stages files correctly
- Verify file paths in `git add` command
- Ensure files aren't in `.gitignore`
- Check hook exit code handling

## Script Architecture

### `scripts/generate-readme.mjs`

Main documentation generator:

**Input:**
- `tests/readme_verification.spec.ts` - Source of code regions
- `src/types.ts` - Source of type definitions (via `extract-types.mjs`)
- `README.md` - Target file with embed markers

**Process:**
1. Extract regions using regex: `// #region name\n...\n// #endregion name`
2. Extract types using `extract-types.mjs`
3. Find embed markers: `<!-- embed: name -->...<!-- /embed: name -->`
4. Replace content between markers
5. Write updated README

**Output:**
- Updated `README.md` with fresh code snippets

### `scripts/extract-types.mjs`

Type definition extractor:

**Input:**
- `src/types.ts` - Source file with exported types

**Process:**
1. Parse exported `type` and `interface` declarations
2. Extract JSDoc comments preceding each type
3. Handle nested braces/parens to find complete definitions
4. Return Map of `typeName → fullDefinition`

**Output:**
- Map of type names to their complete definitions (for use by `generate-readme.mjs`)

### `scripts/embed-types.mjs`

Type context generator (for LLM prompts):

**Input:**
- `src/types.ts` - Source file

**Process:**
1. Read types file
2. Remove imports
3. Escape backticks and template literals
4. Embed into template string

**Output:**
- `src/typeContext.ts` - File containing types as a string constant (for AI context)

## Best Practices

### 1. Test Structure

- **One test per example** - Each region should be in its own test
- **Real URLs** - Use actual websites when possible (e.g., `datatables.net`)
- **Self-contained** - Each example should work independently
- **Assertions** - Include assertions to verify examples work

### 2. Region Naming

- Use **kebab-case**: `quick-start`, `pagination-strategy`
- Be **descriptive**: `header-transformer-normalize` not `example-1`
- Match **README structure**: Region names should reflect section names

### 3. README Organization

- Group related examples together
- Use clear section headers
- Add explanatory text before/after code blocks
- Keep examples focused (one concept per example)

### 4. Type Documentation

- Always include JSDoc comments on exported types
- Use descriptive property names
- Document optional vs required fields
- Include usage examples in comments when helpful

## Common Patterns

### Pattern 1: Basic Usage Example

```typescript
test('Basic Usage', async ({ page }) => {
  await page.goto('https://example.com');
  
  // #region basic-usage
  const result = await myFunction(page);
  await expect(result).toBeVisible();
  // #endregion basic-usage
});
```

### Pattern 2: Configuration Example

```typescript
test('With Configuration', async ({ page }) => {
  // #region with-config
  const result = await myFunction(page, {
    option1: true,
    option2: 'value'
  });
  // #endregion with-config
  
  await expect(result).toBeVisible();
});
```

### Pattern 3: Advanced Feature

```typescript
test('Advanced Feature', async ({ page }) => {
  await page.goto('https://example.com');
  
  // #region advanced-feature
  // Setup
  const config = { advanced: true };
  
  // Usage
  const result = await myFunction(page, config);
  
  // Verification
  await expect(result).toHaveText('Expected');
  // #endregion advanced-feature
});
```

## Troubleshooting

### Region Not Found

**Error:** `⚠️ Warning: Region 'name' found in README but not in test file`

**Solution:**
- Check region name spelling (case-sensitive)
- Ensure `// #region name` and `// #endregion name` match exactly
- Verify the test file is `tests/readme_verification.spec.ts`

### Type Not Found

**Error:** `⚠️ Warning: Type 'TypeName' not found`

**Solution:**
- Ensure type is exported from `src/types.ts`
- Check type name spelling (case-sensitive)
- Verify type is `export type` or `export interface`

### Code Not Updating

**Solution:**
- Run `npm run generate-docs` manually
- Check that build script runs before commits
- Verify file paths in scripts are correct

## Migration Checklist

To implement this system in a new project:

**Documentation System:**
- [ ] Create `scripts/generate-readme.mjs`
- [ ] Create `scripts/extract-types.mjs`
- [ ] Create `scripts/embed-types.mjs` (if using LLM context)
- [ ] Create `tests/readme_verification.spec.ts` with initial examples
- [ ] Update `README.md` with embed markers
- [ ] Add scripts to `package.json`:
  - `generate-docs`
  - `generate-types` (if needed)
  - Update `build` to include doc generation

**Pre-Commit Hooks:**
- [ ] Install husky: `npm install --save-dev husky`
- [ ] Add `"prepare": "husky install"` to package.json
- [ ] Run `npx husky install`
- [ ] Create `.husky/pre-commit` hook
- [ ] Make hook executable: `chmod +x .husky/pre-commit`
- [ ] Test by making a commit

**CI/CD Pipeline:**
- [ ] Create `.github/workflows/publish.yml`
- [ ] Update package name in version check script
- [ ] Add `NPM_TOKEN` to GitHub repository secrets
- [ ] Configure npm registry URL if using scoped packages
- [ ] Test workflow by pushing a version bump

**Verification:**
- [ ] Test documentation workflow:
  1. Add a new region to tests
  2. Add embed marker to README
  3. Run `npm run generate-docs`
  4. Verify README updated correctly
- [ ] Test pre-commit hook:
  1. Make a commit
  2. Verify build runs automatically
  3. Verify generated files are staged
- [ ] Test CI/CD:
  1. Bump version in package.json
  2. Push to main branch
  3. Verify GitHub Actions publishes to npm
- [ ] Document the workflow for team members

## Benefits

This system provides:

1. **Accuracy** - Documentation always matches code
2. **Maintainability** - Update tests, docs auto-update
3. **Confidence** - All examples are tested
4. **Developer Experience** - No manual sync required
5. **Type Safety** - Type definitions stay in sync

## Example: Adding a New Feature

1. **Write the test:**
   ```typescript
   test('New Feature', async ({ page }) => {
     // #region new-feature
     const result = await newFeature(page);
     // #endregion new-feature
   });
   ```

2. **Add to README:**
   ```markdown
   ## New Feature
   
   <!-- embed: new-feature -->
   ```typescript
   // Will be auto-filled
   ```
   <!-- /embed: new-feature -->
   ```

3. **Run build:**
   ```bash
   npm run generate-docs
   ```

4. **Verify:**
   - Check README has correct code
   - Run tests to ensure example works
   - Commit both test and README changes

---

**Remember:** The README is generated. Don't edit code blocks manually—edit the test regions instead!

