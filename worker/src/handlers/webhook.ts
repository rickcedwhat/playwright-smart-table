import type { GitHubClient } from '../lib/github.js';
import type { StateManager } from '../lib/state.js';
import type { Env } from '../index.js';
import type { SpendStatus, ReviewRound } from '../lib/types.js';
import { serializeReviewHistory } from '../lib/review-history.js';
export interface HandlerContext {
  github: GitHubClient;
  state: StateManager;
  env: Env;
  event: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

const BOT_LOGIN = 'rickcedwhat-ai';
const DEPENDABOT_LOGIN = 'dependabot[bot]';
export const AI_CONTEXT = 'ai-review';

const ALL_AI_LABELS = [
  'ai-review: not started',
  'ai-review: waiting',
  'ai-review: unresolved',
  'ai-review: complete',
];

export const HQ_COMMENT_TEMPLATE = `<!-- bot-hq -->
## 🤖 Bot HQ

<!-- bot-hq:issue-link -->
### 🔗 Issue Link
⚠️ No \`Closes #N\` found — add one to the PR description to auto-close on merge.
<!-- /bot-hq:issue-link -->

---

<!-- ai-review-section-start -->
<!-- ai-review-trigger-time: -->

### 🔍 AI Review
- [ ] 🔴 Priority review
- [ ] 🟡 Normal review
- [ ] ⬜ Backburner review

> _Not yet requested_
<!-- ai-review-section-end -->

---
<sub>This comment is managed by the bot — do not edit directly.</sub>`;

export async function setExclusiveAILabel(
  github: GitHubClient,
  prNumber: number,
  newLabel: string,
  currentLabels?: string[],
): Promise<void> {
  const labels = currentLabels ?? await github.getLabels(prNumber);
  const toRemove = labels.filter(l => ALL_AI_LABELS.includes(l) && l !== newLabel);
  await Promise.all(toRemove.map(l => github.removeLabel(prNumber, l).catch(() => {})));
  if (!labels.includes(newLabel)) {
    await github.addLabels(prNumber, [newLabel]);
  }
}

function spendLine(spend: SpendStatus): string {
  return `📊 Repo today: $${spend.repo_daily.toFixed(2)} / $${spend.limits.repo_daily.toFixed(2)} · Global today: $${spend.global_daily.toFixed(2)} / $${spend.limits.global_daily.toFixed(2)} · Month: $${spend.global_monthly.toFixed(2)} / $${spend.limits.global_monthly.toFixed(2)}`;
}

function buildAIReviewSectionNotStarted(currentBody?: string): string {
  const checkboxes = extractCheckboxes(currentBody ?? '').replace(/\[x\]/gi, '[ ]');
  return `<!-- ai-review-section-start -->
<!-- ai-review-trigger-time: -->

### 🔍 AI Review
${checkboxes}

> _Not yet requested_
<!-- ai-review-section-end -->`;
}

function buildAIReviewSectionWaiting(prNumber: number): string {
  const now = new Date().toISOString();
  return `<!-- ai-review-section-start -->
<!-- ai-review-trigger-time: ${now} -->

### 🔍 AI Review
- [ ] 🔴 Priority review
- [ ] 🟡 Normal review
- [ ] ⬜ Backburner review

> ⏳ Review requested for #${prNumber} — AI review in progress…
<!-- ai-review-section-end -->`;
}

export function buildAIReviewSectionComplete(spend: SpendStatus, history: ReviewRound[]): string {
  return `<!-- ai-review-section-start -->
<!-- ai-review-trigger-time: -->

### 🔍 AI Review
- [ ] 🔴 Priority review
- [ ] 🟡 Normal review
- [ ] ⬜ Backburner review

> ✅ Review complete — no blocking issues.

${spendLine(spend)}

${serializeReviewHistory(history)}
<!-- ai-review-section-end -->`;
}

export function buildAIReviewSectionUnresolved(actionableCount: number, spend: SpendStatus, history: ReviewRound[]): string {
  return `<!-- ai-review-section-start -->
<!-- ai-review-trigger-time: -->

### 🔍 AI Review
- [ ] 🔴 Priority review
- [ ] 🟡 Normal review
- [ ] ⬜ Backburner review

> ❌ Review complete — **${actionableCount} actionable issue(s)** require attention.

${spendLine(spend)}

${serializeReviewHistory(history)}
<!-- ai-review-section-end -->`;
}

export function buildAIReviewSectionSpendLimited(reason: string): string {
  return `<!-- ai-review-section-start -->
<!-- ai-review-trigger-time: -->

### 🔍 AI Review
- [ ] 🔴 Priority review
- [ ] 🟡 Normal review
- [ ] ⬜ Backburner review

> ⛔ Spend limit reached — ${reason}
<!-- ai-review-section-end -->`;
}

export function replaceAIReviewSection(hqBody: string, newSection: string): string {
  return hqBody.replace(
    /<!-- ai-review-section-start -->[\s\S]*?<!-- ai-review-section-end -->/,
    newSection,
  );
}

function extractCheckboxes(body: string): string {
  const match = body.match(/- \[[ x]\] [^\n]+\n- \[[ x]\] [^\n]+\n- \[[ x]\] [^\n]+/);
  if (match) return match[0];
  return `- [ ] 🔴 Priority review\n- [ ] 🟡 Normal review\n- [ ] ⬜ Backburner review`;
}

function getCheckedPriority(body: string): 'priority' | 'normal' | 'backburner' | null {
  if (/- \[x\] 🔴/i.test(body)) return 'priority';
  if (/- \[x\] 🟡/i.test(body)) return 'normal';
  if (/- \[x\] ⬜/i.test(body)) return 'backburner';
  return null;
}

export async function findHQComment(
  github: GitHubClient,
  prNumber: number,
): Promise<{ id: number; body: string } | null> {
  const comments = await github.getIssueComments(prNumber);
  const hq = comments.find(c => c.user.login === BOT_LOGIN && c.body.includes('<!-- bot-hq -->'));
  return hq ? { id: hq.id, body: hq.body } : null;
}

async function triggerReview(
  ctx: HandlerContext,
  prNumber: number,
  sha: string,
): Promise<void> {
  const { github } = ctx;

  await setExclusiveAILabel(github, prNumber, 'ai-review: waiting');
  await github.setCommitStatus(sha, 'pending', AI_CONTEXT, 'AI review in progress');

  const hq = await findHQComment(github, prNumber);
  if (hq) {
    const updatedBody = replaceAIReviewSection(hq.body, buildAIReviewSectionWaiting(prNumber));
    await github.updateComment(hq.id, updatedBody);
  }

  const { executeReview } = await import('../lib/review-executor.js');
  await executeReview(ctx, prNumber, sha, hq);
}

export async function handlePullRequest(ctx: HandlerContext): Promise<void> {
  const { github, payload } = ctx;
  const action: string = payload.action;
  const pr = payload.pull_request;
  const prNumber: number = pr.number;
  const sha: string = pr.head.sha;
  const userLogin: string = pr.user.login;
  const isDependabot = userLogin === DEPENDABOT_LOGIN;

  if (action === 'opened') {
    if (isDependabot) {
      await github.setCommitStatus(sha, 'success', AI_CONTEXT, 'Dependabot PR — AI review not required');
      return;
    }

    await github.createComment(prNumber, HQ_COMMENT_TEMPLATE);
    await github.addLabels(prNumber, ['ai-review: not started']);
    await github.setCommitStatus(sha, 'pending', AI_CONTEXT, 'AI review not yet requested');
    return;
  }

  if (action === 'synchronize') {
    const labels = await github.getLabels(prNumber);
    const shouldReset = labels.some(l =>
      l === 'ai-review: complete' ||
      l === 'ai-review: unresolved' ||
      l === 'ai-review: waiting',
    );

    if (shouldReset) {
      await setExclusiveAILabel(github, prNumber, 'ai-review: not started', labels);
      await github.setCommitStatus(sha, 'pending', AI_CONTEXT, 'AI review not yet requested');

      const hq = await findHQComment(github, prNumber);
      if (hq) {
        const updatedBody = replaceAIReviewSection(hq.body, buildAIReviewSectionNotStarted(hq.body));
        await github.updateComment(hq.id, updatedBody);
      }
    }
  }
}

export async function handleIssueComment(ctx: HandlerContext): Promise<void> {
  const { github, env, payload } = ctx;
  const action: string = payload.action;
  const comment = payload.comment;
  const issue = payload.issue;
  const sender = payload.sender;

  // Only handle PR comments
  if (!issue.pull_request) return;

  const prNumber: number = issue.number;
  const commentBody: string = comment.body ?? '';
  const commentAuthor: string = comment.user.login;
  const senderLogin: string = sender.login;

  // @rickcedwhat-ai review command
  if (commentAuthor !== BOT_LOGIN && action === 'created' && /^@rickcedwhat-ai\s+(?:ai\s+)?review/i.test(commentBody)) {
    const pr = await github.getPR(prNumber);
    await triggerReview(ctx, prNumber, pr.head.sha);
    return;
  }

  // @rickcedwhat-ai reminder <delay> command
  if (commentAuthor !== BOT_LOGIN && action === 'created') {
    const reminderMatch = commentBody.match(/^@rickcedwhat-ai\s+reminder\s+(\d+)([mhd])/i);
    if (reminderMatch) {
      const amount = parseInt(reminderMatch[1], 10);
      const unit = reminderMatch[2].toLowerCase();
      const multiplier: Record<string, number> = { m: 60, h: 3600, d: 86400 };
      const delaySecs = amount * (multiplier[unit] ?? 60);

      const workerUrl = `https://cr-bot.${env.GITHUB_REPO.split('/')[0]}.workers.dev`;
      const reminderUrl = `https://qstash.upstash.io/v2/publish/${workerUrl}/reminder`;
      try {
        const res = await fetch(reminderUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.QSTASH_TOKEN}`,
            'Content-Type': 'application/json',
            'Upstash-Delay': `${delaySecs}s`,
          },
          body: JSON.stringify({ pr_number: prNumber, repo: env.GITHUB_REPO }),
        });
        if (!res.ok) {
          console.error(`Failed to schedule reminder: QStash returned ${res.status}`);
          return;
        }
        const unitLabel = unit === 'm' ? `${amount}m` : unit === 'h' ? `${amount}h` : `${amount}d`;
        await github.createComment(prNumber, `⏱ Reminder scheduled for ${unitLabel}.`);
      } catch (err) {
        console.error('Failed to schedule reminder:', err);
      }
      return;
    }
  }

  // HQ comment checkbox edit detection
  if (commentAuthor === BOT_LOGIN && senderLogin !== BOT_LOGIN && comment.body.includes('<!-- bot-hq -->')) {
    const priority = getCheckedPriority(commentBody);
    if (priority) {
      const pr = await github.getPR(prNumber);
      await triggerReview(ctx, prNumber, pr.head.sha);
    }
  }
}

export async function handlePullRequestReview(ctx: HandlerContext): Promise<void> {
  // Prevent feedback loops: ignore reviews posted by our own bot
  const review = ctx.payload.review;
  if (review?.user?.login === BOT_LOGIN) return;
  // All other reviews are informational — the AI review commit status is set
  // by the review executor, not by watching for review events from others.
}

