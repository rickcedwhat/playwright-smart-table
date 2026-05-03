# Agent Conventions

This file is the shared source of truth for all AI agents working on this repo.

---

## Agent Workflow

Two agents operate on this project with different isolation strategies:

| Agent | Isolation | Why |
|---|---|---|
| **Claude Code** | Git worktrees | Async tasks — works in a separate directory so the main checkout stays clean |
| **Antigravity** | Branches within the main worktree | Workspace-bound tools; stays in the current working directory |

### Claude Code

Claude creates a new worktree for each task and opens a PR when done. You never need to switch branches or stash work — Claude's directory is separate from yours.

### Antigravity

Antigravity operates inside the main worktree. Use the `antigravity` branch as a sandbox for exploratory work, then create a descriptive feature branch for the PR (e.g. `feat/issue-42-row-virtualization`). Do **not** switch to or modify a worktree directory — those belong to Claude.

---

## Package Manager

This project uses **pnpm**. Do not use `npm install` or commit `package-lock.json`.

```bash
pnpm install                   # install dependencies
pnpm run build                 # build the library
pnpm run test:unit             # unit tests (Vitest)
pnpm version minor             # bump version (updates package.json + pnpm-lock.yaml)
```

Sub-projects (`playground/`, `tests/apps/mui-datagrid/`) are standalone and still use npm — leave them as-is.

---

## Release Flow

1. Work on a feature branch, open a PR, get it merged to `main`
2. To publish a new version: bump via `pnpm version patch|minor|major` (updates `package.json` + `pnpm-lock.yaml` + creates a git tag)
3. Update `CHANGELOG.md` with the new version entry
4. Push — CI detects the version change and publishes to npm automatically

**Never run `npm publish` manually. Never edit `package.json` version by hand.**

A pre-commit hook (`scripts/check-version-bump.mjs`) enforces that `pnpm-lock.yaml` is staged whenever the version changes.

---

## Branch Conventions

| Branch | Purpose |
|---|---|
| `main` | Production — protected, CI required |
| `feat/<issue>-<slug>` | New features |
| `fix/<issue>-<slug>` | Bug fixes |
| `chore/<slug>` | Maintenance / tooling |
| `docs/<slug>` | Documentation-only changes |
| `antigravity` | Antigravity sandbox (not merged directly) |

---

## Key Commands

```bash
pnpm run build                 # compile TypeScript → dist/
pnpm run test:unit             # Vitest unit tests
npx playwright test            # all E2E tests
npx playwright test --config playwright.config.ci-a.ts   # core tests only
npx playwright test --config playwright.config.ci-b.ts   # integration tests only
pnpm run docs:dev              # local VitePress docs server
pnpm run generate-docs         # sync README from test regions
npx tsc --noEmit               # type check without building
```

---

## Before Opening a PR (mandatory)

Always sync with `origin/main` before pushing a branch for review:

```bash
git fetch origin
git rebase origin/main
```

This prevents stale-base conflicts and the rebase pain that comes from opening PRs against an outdated main. Do this even if you think you're up to date.

---

## CI

| Job | Trigger | What runs |
|---|---|---|
| `lint` | every PR | tsc, TODO check, commitlint |
| `test-a` | PRs touching `src/`, `tests/`, etc. | unit tests + core E2E + build |
| `test-b` | same | MUI DataGrid integration tests |
| `CodeQL` | same path filter | security scan |
| `publish` | push to `main` | npm publish if version changed |

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): message`

Types: `feat` `fix` `docs` `test` `refactor` `perf` `chore`

---

## Design Constraints

- `useTable()` signature must not change (no breaking changes)
- Pagination/loading/sorting logic belongs in `src/strategies/`, not `src/useTable.ts`
- Return `Locator` from public APIs, not custom wrappers
- Use `logDebug()` instead of `console.log()`
- All public types exported from `src/types.ts`

See `CONTRIBUTING.md` for full design philosophy.
