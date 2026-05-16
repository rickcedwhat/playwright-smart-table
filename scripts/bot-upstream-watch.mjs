/**
 * Handles `@rickcedwhat-ai upstream watch npm <pkg> >= <version>`.
 *
 * - Parses the package and semver condition from ARGS
 * - Writes (or updates) the upstream-check yaml block in the issue body
 * - Adds the upstream-blocker:waiting label
 * - Posts a confirmation comment
 *
 * Environment:
 *   GH_TOKEN      — bot PAT (write access to issues)
 *   ISSUE_NUMBER  — the issue to update
 *   ARGS          — everything after "upstream watch", e.g. "npm vitepress >= 2.0.0"
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

const issueNumber = process.env.ISSUE_NUMBER;
const args = (process.env.ARGS || '').trim();

// Parse: npm <package> <operator> <version>
const match = args.match(/^npm\s+(\S+)\s+(>=|<=|>|<|=~|\^|~)\s*(\S+)$/);
if (!match) {
  console.error(`Could not parse args: "${args}"`);
  console.error('Expected format: npm <package> >= <version>');
  process.exit(1);
}
const [, pkg, op, version] = match;

// Fetch current issue body
const issue = JSON.parse(
  execSync(`gh issue view ${issueNumber} --json body,title`, { encoding: 'utf8' })
);

const yamlBlock =
  '```yaml\n' +
  `type: npm\n` +
  `package: ${pkg}\n` +
  `condition: latest ${op} ${version}\n` +
  '```';

const detailsBlock =
  '<details>\n' +
  '<summary>upstream-check</summary>\n\n' +
  `${yamlBlock}\n\n` +
  '</details>';

let body = issue.body || '';

// Replace existing upstream-check details block, or append
if (/<details>\s*<summary>upstream-check<\/summary>[\s\S]*?<\/details>/m.test(body)) {
  body = body.replace(
    /<details>\s*<summary>upstream-check<\/summary>[\s\S]*?<\/details>/m,
    detailsBlock
  );
} else {
  body = body.trimEnd() + '\n\n' + detailsBlock;
}

// Write updated body to a temp file to avoid shell quoting issues
writeFileSync('/tmp/issue-body.md', body);
execSync(`gh issue edit ${issueNumber} --body-file /tmp/issue-body.md`);

// Add label
try {
  execSync(`gh issue edit ${issueNumber} --add-label "upstream-blocker:waiting"`, {
    stdio: 'pipe'
  });
} catch (e) {
  console.warn(`Could not add label: ${e.message}`);
}

// Post confirmation
const comment =
  `🔍 Now watching **${pkg}** — will notify when \`latest ${op} ${version}\`.\n\n` +
  `Added \`upstream-blocker:waiting\` label.\n\n` +
  `_Checked every Monday at 09:00 UTC. Use \`@rickcedwhat-ai upstream check\` to run immediately._`;

writeFileSync('/tmp/bot-comment.md', comment);
execSync(`gh issue comment ${issueNumber} --body-file /tmp/bot-comment.md`);

console.log(`upstream watch registered: ${pkg} ${op} ${version} on issue #${issueNumber}`);
