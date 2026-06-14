import type { GitHubClient } from '../lib/github.js';
import type { StateManager } from '../lib/state.js';
import type { Env } from '../index.js';
import type { QueueLevel } from '../lib/types.js';
import {
  isSkipComment,
  isRateLimitComment,
  computeRateLimitDelay,
  parseActionableCount,
  getCheckedLabel,
  getPriorityFromCheckbox,
  labelToStatus,
} from '../lib/coderabbit.js';
import { enqueue, dequeue, pickNextPR, findPRInQueues, MAX_TOKENS } from '../lib/queue.js';
import { scheduleCoordinator, updateQueueIssueDashboard } from './coordinator.js';

export interface HandlerContext {
  github: GitHubClient;
  state: StateManager;
  env: Env;
  event: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

const BOT_LOGIN = 'rickcedwhat-ai';
const CR_BOT_LOGIN = 'coderabbitai[bot]';
const DEPENDABOT_LOGIN = 'dependabot[bot]';
const CR_CONTEXT = 'coderabbit-review';

export const HQ_COMMENT_TEMPLATE = `<!-- bot-hq -->
## 🤖 Bot HQ

<!-- bot-hq:issue-link -->
### 🔗 Issue Link
⚠️ No \`Closes #N\` found — add one to the PR description to auto-close on merge.
<!-- /bot-hq:issue-link -->

---

<!-- cr-section-start -->
<!-- cr-trigger-time: -->

### 🔍 CodeRabbit Review
- [ ] 🔴 Priority review _(skips to front)_
- [ ] 🟡 Normal review _(standard queue)_
- [ ] ⬜ Backburner review _(triggers only when bucket is full)_

> _Not yet requested_
<!-- cr-section-end -->

---
<sub>This comment is managed by the bot — do not edit directly.</sub>`;

const ALL_CR_LABELS = [
  'coderabbit: not started',
  'coderabbit: waiting',
  'coderabbit: rate-limited',
  'coderabbit: queued',
  'coderabbit: unresolved',
  'coderabbit: complete',
];

async function setExclusiveCRLabel(
  github: GitHubClient,
  prNumber: number,
  newLabel: string,
  currentLabels?: string[],
): Promise<void> {
  const labels = currentLabels ?? await github.getLabels(prNumber);
  const toRemove = labels.filter(l => ALL_CR_LABELS.includes(l) && l !== newLabel);
  await Promise.all(toRemove.map(l => github.removeLabel(prNumber, l).catch(() => {})));
  if (!labels.includes(newLabel)) {
    await github.addLabels(prNumber, [newLabel]);
  }
}

function buildCRSectionNotStarted(currentBody?: string): string {
  const checkboxes = getCheckedLabel(currentBody ?? '').replace(/\[x\]/g, '[ ]');
  return `<!-- cr-section-start -->
<!-- cr-trigger-time: -->

### 🔍 CodeRabbit Review
${checkboxes}

> _Not yet requested_
<!-- cr-section-end -->`;
}

function buildCRSectionWaiting(prNumber: number): string {
  const now = new Date().toISOString();
  return `<!-- cr-section-start -->
<!-- cr-trigger-time: ${now} -->

### 🔍 CodeRabbit Review
- [ ] 🔴 Priority review _(skips to front)_
- [ ] 🟡 Normal review _(standard queue)_
- [ ] ⬜ Backburner review _(triggers only when bucket is full)_

> ⏳ Review requested for #${prNumber} — waiting for CodeRabbit response…
<!-- cr-section-end -->`;
}

function buildCRSectionQueued(level: QueueLevel): string {
  const levelLabel = level === 'priority' ? '🔴 Priority' : level === 'normal' ? '🟡 Normal' : '⬜ Backburner';
  return `<!-- cr-section-start -->
<!-- cr-trigger-time: -->

### 🔍 CodeRabbit Review
- [ ] 🔴 Priority review _(skips to front)_
- [ ] 🟡 Normal review _(standard queue)_
- [ ] ⬜ Backburner review _(triggers only when bucket is full)_

> 📋 Queued as **${levelLabel}** — will trigger when a token is available.
<!-- cr-section-end -->`;
}

function buildCRSectionComplete(): string {
  return `<!-- cr-section-start -->
<!-- cr-trigger-time: -->

### 🔍 CodeRabbit Review
- [ ] 🔴 Priority review _(skips to front)_
- [ ] 🟡 Normal review _(standard queue)_
- [ ] ⬜ Backburner review _(triggers only when bucket is full)_

> ✅ Review complete — no blocking issues.
<!-- cr-section-end -->`;
}

function buildCRSectionUnresolved(actionableCount: number): string {
  return `<!-- cr-section-start -->
<!-- cr-trigger-time: -->

### 🔍 CodeRabbit Review
- [ ] 🔴 Priority review _(skips to front)_
- [ ] 🟡 Normal review _(standard queue)_
- [ ] ⬜ Backburner review _(triggers only when bucket is full)_

> ❌ Review complete — **${actionableCount} actionable comment(s)** require attention.
<!-- cr-section-end -->`;
}

function buildCRSectionRateLimited(retryAt: string): string {
  return `<!-- cr-section-start -->
<!-- cr-trigger-time: -->

### 🔍 CodeRabbit Review
- [ ] 🔴 Priority review _(skips to front)_
- [ ] 🟡 Normal review _(standard queue)_
- [ ] ⬜ Backburner review _(triggers only when bucket is full)_

> ⏱ Rate-limited · retry scheduled · fires ~${retryAt} UTC
<!-- cr-section-end -->`;
}

function replaceCRSection(hqBody: string, newSection: string): string {
  return hqBody.replace(
    /<!-- cr-section-start -->[\s\S]*?<!-- cr-section-end -->/,
    newSection,
  );
}

async function findHQComment(
  github: GitHubClient,
  prNumber: number,
): Promise<{ id: number; body: string } | null> {
  const comments = await github.getIssueComments(prNumber);
  const hq = comments.find(c => c.user.login === BOT_LOGIN && c.body.includes('<!-- bot-hq -->'));
  return hq ? { id: hq.id, body: hq.body } : null;
}

async function triggerOrEnqueue(
  ctx: HandlerContext,
  prNumber: number,
  prTitle: string,
  sha: string,
  level: QueueLevel,
): Promise<void> {
  const { github, state, env } = ctx;
  const queueState = await state.getState();

  const hasTokens = queueState.tokens > 0;
  const noPriorityInQueue = queueState.priority.length === 0;
  const bucketFull = queueState.tokens === MAX_TOKENS;

  const shouldTriggerNow =
    hasTokens && (
      level === 'priority' ||
      (level === 'normal' && noPriorityInQueue) ||
      (level === 'backburner' && bucketFull)
    );

  if (shouldTriggerNow) {
    // Post @coderabbitai review comment
    await github.createComment(prNumber, '@coderabbitai full review');
    await state.decrementToken();

    // Swap label to waiting
    await setExclusiveCRLabel(github, prNumber, 'coderabbit: waiting');
    await github.setCommitStatus(sha, 'pending', CR_CONTEXT, 'CodeRabbit review in progress');

    // Update HQ comment
    const hq = await findHQComment(github, prNumber);
    if (hq) {
      const updatedBody = replaceCRSection(hq.body, buildCRSectionWaiting(prNumber));
      await github.updateComment(hq.id, updatedBody);
    }

    await updateQueueIssueDashboard(github, env, await state.getState());
  } else {
    // Enqueue
    const newQueueState = enqueue(queueState, { pr: prNumber, title: prTitle, queued_at: new Date().toISOString() }, level);
    await state.saveState(newQueueState);

    await setExclusiveCRLabel(github, prNumber, 'coderabbit: queued');

    // Update HQ comment
    const hq = await findHQComment(github, prNumber);
    if (hq) {
      const updatedBody = replaceCRSection(hq.body, buildCRSectionQueued(level));
      await github.updateComment(hq.id, updatedBody);
    }

    // Schedule coordinator if not already scheduled, and persist the messageId
    let finalState = newQueueState;
    if (!newQueueState.refill_qstash_id) {
      const workerUrl = `https://cr-bot.${env.GITHUB_REPO.split('/')[0]}.workers.dev`;
      const msgId = await scheduleCoordinator(env.QSTASH_TOKEN, 60, workerUrl);
      if (msgId) {
        finalState = {
          ...newQueueState,
          refill_qstash_id: msgId,
          refill_at: new Date(Date.now() + 60_000).toISOString(),
        };
        await state.saveState(finalState);
      }
    }

    await updateQueueIssueDashboard(github, env, finalState);
  }
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
      await github.setCommitStatus(sha, 'success', CR_CONTEXT, 'Dependabot PR — CR review not required');
      return;
    }

    // Create HQ comment
    await github.createComment(prNumber, HQ_COMMENT_TEMPLATE);
    // Add label
    await github.addLabels(prNumber, ['coderabbit: not started']);
    // Set commit status
    await github.setCommitStatus(sha, 'pending', CR_CONTEXT, 'CodeRabbit review not yet requested');
    return;
  }

  if (action === 'synchronize') {
    const labels = await github.getLabels(prNumber);
    // Reset on any non-trivial CR state — terminal (complete/unresolved) AND
    // in-flight (waiting/queued/rate-limited). Only leave not-started alone.
    const shouldReset = labels.some(l =>
      l === 'coderabbit: complete' ||
      l === 'coderabbit: unresolved' ||
      l === 'coderabbit: waiting' ||
      l === 'coderabbit: queued' ||
      l === 'coderabbit: rate-limited',
    );

    if (shouldReset) {
      // Remove all CR labels, add not started
      await setExclusiveCRLabel(github, prNumber, 'coderabbit: not started', labels);
      await github.setCommitStatus(sha, 'pending', CR_CONTEXT, 'CodeRabbit review not yet requested');

      // Update HQ comment
      const hq = await findHQComment(github, prNumber);
      if (hq) {
        const updatedBody = replaceCRSection(hq.body, buildCRSectionNotStarted(hq.body));
        await github.updateComment(hq.id, updatedBody);
      }
    }
  }
}

export async function handleIssueComment(ctx: HandlerContext): Promise<void> {
  const { github, state, env, payload } = ctx;
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

  if (commentAuthor === CR_BOT_LOGIN) {
    if (isSkipComment(commentBody)) {
      const pr = await github.getPR(prNumber);
      await setExclusiveCRLabel(github, prNumber, 'coderabbit: complete');
      await github.setCommitStatus(pr.head.sha, 'success', CR_CONTEXT, 'CodeRabbit review passed');

      const hq = await findHQComment(github, prNumber);
      if (hq) {
        const updatedBody = replaceCRSection(hq.body, buildCRSectionComplete());
        await github.updateComment(hq.id, updatedBody);
      }
      return;
    }

    if (isRateLimitComment(commentBody)) {
      const pr = await github.getPR(prNumber);
      await setExclusiveCRLabel(github, prNumber, 'coderabbit: rate-limited');
      await github.setCommitStatus(pr.head.sha, 'pending', CR_CONTEXT, 'CodeRabbit rate-limited · retry scheduled');

      // Compute delay and re-enqueue
      const delaySecs = computeRateLimitDelay(commentBody, comment.created_at, Date.now());
      const queueState = await state.getState();
      const newQueueState = enqueue(
        queueState,
        { pr: prNumber, title: pr.title, queued_at: new Date().toISOString() },
        'normal',
      );
      await state.saveState(newQueueState);

      // Schedule coordinator — only update HQ if scheduling actually succeeded
      const workerUrl = `https://cr-bot.${env.GITHUB_REPO.split('/')[0]}.workers.dev`;
      const msgId = await scheduleCoordinator(env.QSTASH_TOKEN, delaySecs, workerUrl);
      if (msgId) {
        const retryAt = new Date(Date.now() + delaySecs * 1000).toISOString().slice(11, 16);
        const updatedState = {
          ...newQueueState,
          refill_qstash_id: msgId,
          refill_at: new Date(Date.now() + delaySecs * 1000).toISOString(),
        };
        await state.saveState(updatedState);

        // Update HQ to show retry time only when retry is actually scheduled
        const hq = await findHQComment(github, prNumber);
        if (hq) {
          await github.updateComment(hq.id, replaceCRSection(hq.body, buildCRSectionRateLimited(retryAt)));
        }
      }
      return;
    }

    // Other CR bot comments: ignore
    return;
  }

  // Human reviewer triggers: "@rickcedwhat-ai review" command
  if (commentAuthor !== BOT_LOGIN && action === 'created' && /^@rickcedwhat-ai\s+(?:coderabbit\s+)?review/i.test(commentBody)) {
    // Parse priority from command, default normal
    let level: QueueLevel = 'normal';
    if (/priority/i.test(commentBody)) level = 'priority';
    else if (/backburner/i.test(commentBody)) level = 'backburner';

    const pr = await github.getPR(prNumber);
    await triggerOrEnqueue(ctx, prNumber, pr.title, pr.head.sha, level);
    return;
  }

  // @rickcedwhat-ai promote #N command
  if (commentAuthor !== BOT_LOGIN && action === 'created') {
    const promoteMatch = commentBody.match(/^@rickcedwhat-ai\s+promote\s+#(\d+)/i);
    if (promoteMatch) {
      const targetPR = parseInt(promoteMatch[1], 10);
      const queueState = await state.getState();
      const found = findPRInQueues(queueState, targetPR);

      if (!found) {
        await github.createComment(prNumber, `❌ PR #${targetPR} is not in the queue.`);
      } else if (found.level === 'priority') {
        await github.createComment(prNumber, `PR #${targetPR} is already in the 🔴 Priority queue.`);
      } else {
        // Dequeue then re-enqueue at priority
        const pr = await github.getPR(targetPR);
        const afterDequeue = dequeue(queueState, targetPR);
        const afterEnqueue = enqueue(
          afterDequeue,
          { pr: targetPR, title: pr.title, queued_at: new Date().toISOString() },
          'priority',
        );
        await state.saveState(afterEnqueue);
        await github.createComment(prNumber, `✅ PR #${targetPR} promoted to 🔴 Priority queue.`);

        // Update Queue Issue dashboard
        await updateQueueIssueDashboard(github, env, afterEnqueue);
      }
      return;
    }
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
        // Only confirm to the user when scheduling actually succeeded
        const unitLabel = unit === 'm' ? `${amount}m` : unit === 'h' ? `${amount}h` : `${amount}d`;
        await github.createComment(prNumber, `⏱ Reminder scheduled for ${unitLabel}.`);
      } catch (err) {
        console.error('Failed to schedule reminder:', err);
      }
      return;
    }
  }

  // HQ comment checkbox edit detection
  // The HQ comment is authored by BOT_LOGIN; an edit by someone else is a checkbox toggle
  if (commentAuthor === BOT_LOGIN && senderLogin !== BOT_LOGIN && comment.body.includes('<!-- bot-hq -->')) {
    const priority = getPriorityFromCheckbox(commentBody);
    if (priority) {
      const pr = await github.getPR(prNumber);
      await triggerOrEnqueue(ctx, prNumber, pr.title, pr.head.sha, priority);
    }
  }
}

export async function handlePullRequestReview(ctx: HandlerContext): Promise<void> {
  const { github, payload } = ctx;
  const review = payload.review;
  const pr = payload.pull_request;
  const prNumber: number = pr.number;
  const sha: string = pr.head.sha;
  const reviewerLogin: string = review.user.login;
  const reviewBody: string = review.body ?? '';
  const reviewState: string = review.state ?? '';

  if (reviewerLogin !== CR_BOT_LOGIN) return;

  const actionableCount = parseActionableCount(reviewBody);
  const isApproved = reviewState.toLowerCase() === 'approved';
  const isChangesRequested = reviewState.toLowerCase() === 'changes_requested';
  const hasBlocking = !isApproved && (isChangesRequested || actionableCount > 0);

  if (hasBlocking) {
    await setExclusiveCRLabel(github, prNumber, 'coderabbit: unresolved');
    await github.setCommitStatus(sha, 'failure', CR_CONTEXT, 'CodeRabbit review has open comments');

    const hq = await findHQComment(github, prNumber);
    if (hq) {
      const updatedBody = replaceCRSection(hq.body, buildCRSectionUnresolved(actionableCount));
      await github.updateComment(hq.id, updatedBody);
    }
  } else {
    await setExclusiveCRLabel(github, prNumber, 'coderabbit: complete');
    await github.setCommitStatus(sha, 'success', CR_CONTEXT, 'CodeRabbit review passed');

    const hq = await findHQComment(github, prNumber);
    if (hq) {
      const updatedBody = replaceCRSection(hq.body, buildCRSectionComplete());
      await github.updateComment(hq.id, updatedBody);
    }
  }
}
