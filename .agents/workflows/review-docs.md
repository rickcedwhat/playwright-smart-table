---
description: Perform a comprehensive audit of all project documentation against the source code and truth of the tests.
---

## /review-docs - Documentation Accuracy Audit

This workflow performs an in-depth review of all documentation files in the `playwright-smart-table` repository. It systematically checks every page and paragraph for accuracy against the actual source code and the behavior proven by the test suite.

### Step 1: Understand Current Capabilities

Read the following core files to establish the "ground truth" of the v6.7.0+ library:
- `src/types.ts`
- `src/useTable.ts`
- `CHANGELOG.md`
- Key test files in `tests/` depending on the feature being reviewed.

Pay special attention to recent architectural shifts:
- The removal of `iterateThroughTable`, `dataMapper`, `getColumnValues`, and `clickNext`.
- The introduction of `table.map()`, `table.forEach()`, and `table.filter()`.
- The unification of custom cell handling into `columnOverrides.read` and `.write`.
- The simplification of `SortingStrategy` and how standard pagination handles `nextBulk/previousBulk`.

### Step 2: Audit `README.md`

Read `README.md` thoroughly. Evaluate:
- **Accuracy**: Does every single code snippet use valid v6.7.0 APIs? Are there lingering references to deprecated methods?
- **Relevance**: Are the primary use cases highlighted (SmartRow, Iterators, columnOverrides) front and center?
- **Conciseness**: Are explanations tight and developer-friendly?
- **Test Alignment**: Do the claims in the README match what `playwright-smart-table` actually does in `tests/readme_verification.spec.ts`?

Take exact notes on what needs to be changed.

### Step 3: Audit `ROADMAP.md` and `CHANGELOG.md`

Read these files to ensure:
- The Roadmap correctly reflects what has recently been accomplished (e.g., v6.7.0 cleanup).
- The Changelog is accurate and formatting is consistent.
- The versions mentioned match the reality of `package.json`.

### Step 4: Audit Inline JSDoc & Comments

Scan the public signatures in `src/types.ts` and `src/useTable.ts`.
- Ensure the examples provided inside JSDoc comments are accurate and use the latest APIs.
- Ensure the parameter descriptions accurately reflect how the library functions.

### Step 5: Produce the Unified Documentation Report

Once all files are reviewed, DO NOT MAKE CHANGES YET. Instead, output a unified markdown report structured like this:

```markdown
# Documentation Audit Report

## 1. README.md
### Discrepancies / Inaccuracies
- [Line xx]: Example code uses deprecated `iterateThroughTable` instead of `table.forEach()`.
- ...

### Relevance & Conciseness
- The section on "Advanced Usage" is overly verbose and could be simplified using the new `columnOverrides` syntax.
- ...

## 2. JSDoc / Source Comments
### Inaccuracies
- `src/types.ts` (SmartRow): Example snippet references `dataMapper` which no longer exists.
- ...

## 3. ROADMAP / CHANGELOG
- `ROADMAP.md` still lists "cleanup deprecated methods" under Future work, but this was completed in v6.7.0.
- ...

## Proposed Action Plan
Summary of the exact Markdown/Code edits required to bring docs up to 100% accuracy.
```

Present this unified report to the user and ask for completely explicit permission on which sections they want you to automatically fix. Wait for their response.
