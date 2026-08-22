---
description: Full library health audit - reports on the good, the bad, and the ugly of the current state, and evaluates test coverage
---

## /gbu - Good, Bad & Ugly Library Audit

This workflow performs a comprehensive health check of the `playwright-smart-table` library and produces a structured report.

### Step 1: Understand the current codebase structure

Read the following to get oriented:
- **`PHILOSOPHY.md`** — guiding light; every finding below should be judged against it
- `src/index.ts` - what is exported
- `src/types.ts` - all public types and interfaces
- `src/useTable.ts` - main entry point logic
- `src/smartRow.ts` - SmartRow implementation
- `src/plugins/index.ts` (or `src/plugins/`) - plugin/preset exports
- `src/presets/` - official library presets (strategy packs)
- `src/strategies/` directory - all strategy implementations
- `CHANGELOG.md` (last 3 versions) - recent changes
- `ROADMAP.md` - planned work
- `package.json` - version, scripts, dependencies

### Step 2: Audit the source code

Evaluate the following dimensions and take notes. **Philosophy alignment is mandatory** — compare the library to `PHILOSOPHY.md` before scoring health.

**PHILOSOPHY ALIGNMENT** 🧭
Score the current design against each principle in `PHILOSOPHY.md`. Call out drift explicitly (even when the code “works”).

Ask at least:
- Is variation still expressed as strategies/presets, or is the core accumulating framework-specific branches?
- Are new capabilities *describe-your-table* config, or encoded one-off behavior?
- Do public APIs stay Playwright-native (Locators), scoped to the table boundary?
- Would the decision checklist in `PHILOSOPHY.md` reject any recent or proposed changes?

Map alignment into Good / Bad / Ugly:
- Faithful to philosophy → Good
- Soft drift, fixable without breaking changes → Bad
- Core special-casing, fused framework knowledge, or growing un-pluggable surface → Ugly

**THE GOOD** ✅
- Well-designed APIs and abstractions
- Clean separation of concerns (core thin, strategies pluggable)
- Good TypeScript typing
- Useful exports and presets that remain configuration, not new engines
- Smart defaults
- Places where the library clearly lets users *describe* how their table works

**THE BAD** ⚠️
- Inconsistencies in naming conventions or API design
- Deprecated code that hasn't been cleaned up
- Overly complex implementations where a strategy would be simpler
- Missing documentation or confusing JSDoc
- Exported things that probably shouldn't be public
- Things that are close to good but need polish
- Soft philosophy drift (config flags that should be strategies, core weight creeping up)

**THE UGLY** 🚨
- Technical debt that actively causes problems
- Footguns or confusing behaviors for users
- Broken or unreliable functionality
- Security or performance concerns
- Dead code that should be deleted
- Hard philosophy violations (framework conditionals in core, non-removable special cases, APIs that abandon Locators)

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

## PHILOSOPHY ALIGNMENT 🧭
(Reference: PHILOSOPHY.md)
- Mission fit: [does the library still teach itself via description, or is it encoding table types?]
- Strategy-first: [where variation lives today — strategies/presets vs core]
- Core thinness: [notable growth or special-casing in useTable / rowFinder / engine]
- Decision-checklist failures: [any recent patterns that would fail the checklist]
- Score: X/10 alignment

## THE GOOD ✅
[List of strengths with brief explanations — include philosophy wins]

## THE BAD ⚠️
[List of issues with brief explanations and suggested fixes — include soft drift]

## THE UGLY 🚨
[List of serious problems with recommended actions — include hard philosophy violations]

## TEST AUDIT

### Redundant Tests
[Table: Test File | Test Name | Duplicates | Recommendation]

### Missing Tests
[Table: Feature | Why Important | Suggested Test]

## SUMMARY
- Overall health score: X/10
- Philosophy alignment score: X/10
- Top 3 priorities to address (prefer fixes that restore describe/strategy-first design)
```

Output this report to the user as a file that the user can review and add comments to.

### Step 5: Offer actions

After presenting the report, ask the user:
1. Which "bad" or "ugly" items they want to address first
2. For redundant tests: confirm which to cut (then remove them)
3. For missing tests: confirm which to add (then implement them)

Wait for user response before making any code changes.