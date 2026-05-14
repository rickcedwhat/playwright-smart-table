/**
 * Parses open issues labelled "upstream-blocker:waiting", runs each check,
 * and swaps the label to "upstream-blocker:cleared" when the condition is met.
 *
 * Expects issues.json (written by the workflow) to contain the result of:
 *   gh issue list --label "upstream-blocker:waiting" --json number,body,title
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

const issues = JSON.parse(readFileSync('issues.json', 'utf8'));
console.log(`Found ${issues.length} issue(s) with upstream-blocker:waiting`);

for (const { number, title, body } of issues) {
  console.log(`\n── Issue #${number}: ${title}`);

  const blockMatch = body.match(/<!--\s*upstream-check\s*([\s\S]*?)-->/);
  if (!blockMatch) {
    console.log('  No upstream-check block found — skipping');
    continue;
  }

  const fields = Object.fromEntries(
    blockMatch[1].trim().split('\n')
      .map(line => line.split(':').map(s => s.trim()))
      .filter(([k]) => k)
      .map(([k, ...v]) => [k, v.join(':').trim()])
  );

  const { type, package: pkg, condition } = fields;
  const blockedPr = fields['blocked-pr'];

  if (type !== 'npm') {
    console.log(`  Unsupported check type "${type}" — skipping`);
    continue;
  }
  if (!pkg || !condition) {
    console.log('  Missing package or condition — skipping');
    continue;
  }

  let currentVersion;
  try {
    currentVersion = execSync(`npm view ${pkg} dist-tags.latest`, { encoding: 'utf8' }).trim();
  } catch (e) {
    console.error(`  Failed to fetch ${pkg} version: ${e.message}`);
    continue;
  }

  console.log(`  ${pkg}@latest = ${currentVersion}`);

  // condition format: "latest >= 2.0.0"
  const range = condition.replace(/^latest\s*/, '');

  let cleared = false;
  try {
    execSync(`npx --yes semver@7 "${currentVersion}" --range "${range}"`, { stdio: 'pipe' });
    cleared = true;
  } catch {
    cleared = false;
  }

  if (!cleared) {
    console.log(`  Still blocked — ${pkg}@${currentVersion} does not satisfy ${range}`);
    continue;
  }

  console.log(`  CLEARED — ${pkg}@${currentVersion} satisfies ${range}`);

  const lines = [
    '## :green_circle: Upstream blocker cleared',
    '',
    `**${pkg}@${currentVersion}** is now available and satisfies \`${range}\`.`,
  ];
  if (blockedPr) {
    lines.push('', `Next step: pick up #${blockedPr} to resume this work.`);
  }
  lines.push('', '_Posted automatically by the upstream blocker check workflow._');

  writeFileSync('/tmp/upstream-comment.md', lines.join('\n'));
  execSync(`gh issue comment ${number} --body-file /tmp/upstream-comment.md`);
  execSync(`gh issue edit ${number} --remove-label "upstream-blocker:waiting" --add-label "upstream-blocker:cleared"`);
  console.log('  Label swapped and comment posted.');
}
