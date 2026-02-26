---
description: Full library health audit - reports on the good, the bad, and the ugly of the current state, and evaluates test coverage
---

## /gbu - Good, Bad & Ugly Library Audit

This workflow performs a comprehensive health check of the `playwright-smart-table` library and produces a structured report.

### Step 1: Understand the current codebase structure

Read the following to get oriented:
- `src/index.ts` - what is exported
- `src/types.ts` - all public types and interfaces
- `src/useTable.ts` - main entry point logic
- `src/smartRow.ts` - SmartRow implementation
- `src/plugins.ts` - plugin/preset exports
- `src/strategies/` directory - all strategy implementations
- `CHANGELOG.md` (last 3 versions) - recent changes
- `ROADMAP.md` - planned work
- `package.json` - version, scripts, dependencies

### Step 2: Audit the source code

Evaluate the following dimensions and take notes:

**THE GOOD** ✅
- Well-designed APIs and abstractions
- Clean separation of concerns
- Good TypeScript typing
- Useful exports and presets
- Smart defaults

**THE BAD** ⚠️
- Inconsistencies in naming conventions or API design
- Deprecated code that hasn't been cleaned up
- Overly complex implementations where simpler ones would work
- Missing documentation or confusing JSDoc
- Exported things that probably shouldn't be public
- Things that are close to good but need polish

**THE UGLY** 🚨
- Technical debt that actively causes problems
- Footguns or confusing behaviors for users
- Broken or unreliable functionality
- Security or performance concerns
- Dead code that should be deleted

### Step 3: Audit the test suite

List all test files in `tests/` and for each one:
1. Read the test file
2. Identify what feature/behavior it covers
3. Note if it overlaps significantly with another test file

Then evaluate:

**Redundant tests** - Tests that cover the same behavior as another test with little unique value. For each redundant test, note:
- Which test file / test name
- What it duplicates
- Recommendation: cut entirely, merge, or keep with reduced scope

**Missing tests** - Critical behaviors that have no test coverage. For each gap, note:
- What feature/behavior is untested
- Why it's important to test
- Recommendation: what the test should verify

### Step 4: Produce the GBU Report

Write a structured markdown report with these sections:

```
# GBU Report - playwright-smart-table v{version}
Generated: {date}

## THE GOOD ✅
[List of strengths with brief explanations]

## THE BAD ⚠️
[List of issues with brief explanations and suggested fixes]

## THE UGLY 🚨
[List of serious problems with recommended actions]

## TEST AUDIT

### Redundant Tests
[Table: Test File | Test Name | Duplicates | Recommendation]

### Missing Tests
[Table: Feature | Why Important | Suggested Test]

## SUMMARY
- Overall health score: X/10
- Top 3 priorities to address
```

Output this report to the user as a file that the user can review and add comments to.

### Step 5: Offer actions

After presenting the report, ask the user:
1. Which "bad" or "ugly" items they want to address first
2. For redundant tests: confirm which to cut (then remove them)
3. For missing tests: confirm which to add (then implement them)

Wait for user response before making any code changes.