import type { GitHubClient } from '../lib/github.js';
import type { StateManager } from '../lib/state.js';
import type { Env } from '../index.js';
import type { QueueState } from '../lib/types.js';
import { pickNextPR, dequeue, serializeQueueState, incrementReviewsThisSession } from '../lib/queue.js';
import { isRateLimitComment, computeRateLimitDelay } from '../lib/coderabbit.js';

export interface CoordinatorContext {
  github: GitHubClient;
  state: StateManager;
  env: Env;
}

const CR_CONTEXT = 'coderabbit-review';

export async function scheduleCoordinator(
  qstashToken: string,
  delaySecs: number,
  workerUrl: string,
): Promise<string | null> {
  const url = `https://qstash.upstash.io/v2/publish/${workerUrl}/coordinator`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${qstashToken}`,
        'Content-Type': 'application/json',
        'Upstash-Delay': `${delaySecs}s`,
      },
      body: JSON.stringify({ triggered_at: new Date().toISOString() }),
    });
    if (!res.ok) {
      console.error(`QStash schedule failed: ${res.status}`);
      return null;
    }
    const data = await res.json() as { messageId?: string };
    return data.messageId ?? null;
  } catch (err) {
    console.error('QStash schedule error:', err);
    return null;
  }
}

export async function handleCoordinator(ctx: CoordinatorContext): Promise<void> {
  const { github, state, env } = ctx;

  // 1. Get state from Redis (includes lazy token refill)
  let queueState = await state.getState();

  // 2. Scan open PRs for rate-limited ones not in queue → migrate to normal queue
  try {
    const openPRs = await github.listOpenPRs();
    const allQueued = new Set([
      ...queueState.priority.map(p => p.pr),
      ...queueState.normal.map(p => p.pr),
      ...queueState.backburner.map(p => p.pr),
    ]);

    for (const pr of openPRs) {
      if (allQueued.has(pr.number)) continue;
      const labels = await github.getPRLabels(pr.number);
      if (!labels.includes('coderabbit: rate-limited')) continue;

      // Check if the rate-limit has expired by inspecting comments
      const comments = await github.getIssueComments(pr.number);
      const rateLimitComment = [...comments]
        .reverse()
        .find(c => c.user.login === 'coderabbitai[bot]' && isRateLimitComment(c.body));

      if (rateLimitComment) {
        // Compute actual remaining delay — only migrate if window has expired
        const delaySecs = computeRateLimitDelay(
          rateLimitComment.body,
          rateLimitComment.created_at,
          Date.now(),
        );
        if (delaySecs <= 0) {
          // Rate-limit window has passed — migrate to normal queue
          const { enqueue: enqueueItem } = await import('../lib/queue.js');
          queueState = enqueueItem(
            queueState,
            { pr: pr.number, title: pr.title, queued_at: new Date().toISOString() },
            'normal',
          );
        }
        // else: still rate-limited — leave it; coordinator was fired too early
      }
    }
  } catch (err) {
    console.error('Error scanning rate-limited PRs:', err);
  }

  // 3. If tokens=0 and queues non-empty → reschedule for 3600s and return
  const totalQueued = queueState.priority.length + queueState.normal.length + queueState.backburner.length;
  if (queueState.tokens === 0 && totalQueued > 0) {
    const workerUrl = `https://cr-bot.${env.GITHUB_REPO.split('/')[0]}.workers.dev`;
    await scheduleCoordinator(env.QSTASH_TOKEN, 3600, workerUrl);
    await state.saveState(queueState);
    return;
  }

  // 4. Pick next PR
  const next = pickNextPR(queueState);
  if (!next) {
    await state.saveState(queueState);
    return;
  }

  // 5. Post @coderabbitai full review on the PR
  try {
    await github.createComment(next.pr, '@coderabbitai full review');
  } catch (err) {
    console.error(`Failed to post review comment on PR #${next.pr}:`, err);
    await state.saveState(queueState);
    return;
  }

  // 6. Swap label to waiting
  try {
    const pr = await github.getPR(next.pr);
    await github.addLabels(next.pr, ['coderabbit: waiting']);
    await github.setCommitStatus(pr.head.sha, 'pending', CR_CONTEXT, 'CodeRabbit review in progress');
    // Remove queued label
    await github.removeLabel(next.pr, 'coderabbit: queued').catch(() => {});
    await github.removeLabel(next.pr, 'coderabbit: rate-limited').catch(() => {});
  } catch (err) {
    console.error(`Failed to update labels for PR #${next.pr}:`, err);
  }

  // 7. Decrement token — refresh in-memory state to reflect the authoritative Redis value
  const newTokens = await state.decrementToken();
  queueState = {
    ...queueState,
    tokens: newTokens,
    last_decremented_at: new Date().toISOString(),
  };

  // 8. Dequeue PR from state
  queueState = dequeue(queueState, next.pr);

  // 9. Increment session reviews
  queueState = incrementReviewsThisSession(queueState);

  // 10. If queue still non-empty → schedule next QStash dispatch
  const remainingQueued = queueState.priority.length + queueState.normal.length + queueState.backburner.length;
  if (remainingQueued > 0) {
    const workerUrl = `https://cr-bot.${env.GITHUB_REPO.split('/')[0]}.workers.dev`;
    const msgId = await scheduleCoordinator(env.QSTASH_TOKEN, 3600, workerUrl);
    if (msgId) {
      queueState = {
        ...queueState,
        refill_qstash_id: msgId,
        refill_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      };
    }
  } else {
    queueState = { ...queueState, refill_qstash_id: '', refill_at: '' };
  }

  // 11. Save state to Redis
  await state.saveState(queueState);

  // 12. Update Queue Issue dashboard
  await updateQueueIssueDashboard(github, env, queueState);
}

async function updateQueueIssueDashboard(
  github: GitHubClient,
  env: Env,
  queueState: QueueState,
): Promise<void> {
  const queueIssueNumber = parseInt(env.QUEUE_ISSUE_NUMBER, 10);
  if (isNaN(queueIssueNumber)) return;

  try {
    // Gather live PR info
    const openPRs = await github.listOpenPRs();
    const liveItems: Array<{ pr: number; title: string; status: string; updated: string }> = [];

    for (const pr of openPRs) {
      const labels = await github.getPRLabels(pr.number).catch(() => [] as string[]);
      const crLabel = labels.find(l => l.startsWith('coderabbit:'));
      if (crLabel) {
        liveItems.push({
          pr: pr.number,
          title: pr.title,
          status: crLabel,
          updated: pr.updated_at,
        });
      }
    }

    const inReview = liveItems.filter(i => i.status === 'coderabbit: waiting').length;
    const unresolved = liveItems.filter(i => i.status === 'coderabbit: unresolved').length;

    const newBody = serializeQueueState(queueState, { inReview, unresolved }, liveItems);
    await github.updateIssue(queueIssueNumber, newBody);
  } catch (err) {
    console.error('Failed to update queue issue dashboard:', err);
  }
}
