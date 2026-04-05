# Dependabot + CODEOWNERS

`CODEOWNERS` requires review from `@rickcedwhat` on every path (`*`).

- **Auto-merge** (`.github/workflows/dependabot-auto-merge.yml`) turns on squash auto-merge for Dependabot PRs that pass your rules; it does **not** substitute for review rules.
- **Reviews from `github-actions[bot]`** do **not** satisfy code owner requirements ([GitHub docs](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/automating-dependabot-with-github-actions#approve-a-pull-request)).

## Ruleset bypass (required setup)

Use a **branch ruleset** on `main` (or the default branch):

1. **Settings** → **Rules** → **Rulesets** → your active ruleset for the default branch.
2. **Bypass list** → **Add bypass** → **Dependabot** (Dependabot App).
3. Set bypass to **Allow for pull requests only**.

**Note:** On **classic branch protection**, “allow specified actors to bypass required pull requests” exists only for repositories **owned by an organization** ([docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)). Personal repos should use **rulesets** with Dependabot bypass as above.

## Labels

`dependabot.yml` adds `auto-approve` for visibility only; merging depends on your ruleset + this workflow.
