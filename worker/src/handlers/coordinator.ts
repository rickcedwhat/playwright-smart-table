import type { GitHubClient } from '../lib/github.js';
import type { StateManager } from '../lib/state.js';
import type { Env } from '../index.js';
import { SpendGuard } from '../lib/spend-guard.js';

export interface CoordinatorContext {
  github: GitHubClient;
  state: StateManager;
  env: Env;
}

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

// Manual coordinator endpoint: can be used to re-trigger a stuck review
// by POSTing { pr_number: N } to /coordinator
export async function handleCoordinator(ctx: CoordinatorContext): Promise<void> {
  // The old queue-draining logic has been removed — reviews now execute
  // immediately when triggered. This endpoint is kept as a manual re-trigger
  // hook for stuck items and for future use.
  console.log('Coordinator invoked (no-op in AI review mode)');
}

export async function updateQueueIssueDashboard(
  github: GitHubClient,
  env: Env,
  _state?: unknown,
): Promise<void> {
  const dashboardIssueNumber = parseInt(env.QUEUE_ISSUE_NUMBER, 10);
  if (isNaN(dashboardIssueNumber)) return;

  try {
    const spendGuard = new SpendGuard(env);
    const spend = await spendGuard.getSpendStatus(env.GITHUB_REPO);

    // Gather active PRs with ai-review labels
    const openPRs = await github.listOpenPRs();
    const aiPRs: Array<{ pr: number; title: string; status: string; updated: string }> = [];
    for (const pr of openPRs) {
      const labels = await github.getPRLabels(pr.number).catch(() => [] as string[]);
      const aiLabel = labels.find(l => l.startsWith('ai-review:'));
      if (aiLabel) {
        aiPRs.push({ pr: pr.number, title: pr.title, status: aiLabel, updated: pr.updated_at });
      }
    }

    const waiting = aiPRs.filter(p => p.status === 'ai-review: waiting').length;
    const unresolved = aiPRs.filter(p => p.status === 'ai-review: unresolved').length;
    const complete = aiPRs.filter(p => p.status === 'ai-review: complete').length;

    const safeTitle = (t: string) => String(t).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
    const nowMs = Date.now();
    const relTime = (iso: string) => {
      const diffMs = nowMs - new Date(iso).getTime();
      if (diffMs < 60_000) return 'just now';
      const mins = Math.floor(diffMs / 60_000);
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(diffMs / 3_600_000);
      if (hrs < 24) return `${hrs}h ago`;
      return `${Math.floor(diffMs / 86_400_000)}d ago`;
    };

    const STATUS_ICON: Record<string, string> = {
      'ai-review: waiting':     '⏳ Waiting',
      'ai-review: unresolved':  '❌ Unresolved',
      'ai-review: complete':    '✅ Complete',
      'ai-review: not started': '🔲 Not started',
    };

    const prRows = aiPRs.length
      ? aiPRs.map(p => `| ${STATUS_ICON[p.status] ?? p.status} | #${p.pr} | ${safeTitle(p.title)} | ${relTime(p.updated)} |`).join('\n')
      : '| — | _none_ | — | — |';

    const body = `<!-- ai-dashboard-state
spend_repo_daily: ${spend.repo_daily.toFixed(4)}
spend_global_daily: ${spend.global_daily.toFixed(4)}
spend_global_monthly: ${spend.global_monthly.toFixed(4)}
-->

## 🤖 AI Review Dashboard

💰 **Spend today (repo):** $${spend.repo_daily.toFixed(2)} / $${spend.limits.repo_daily.toFixed(2)}
💰 **Spend today (global):** $${spend.global_daily.toFixed(2)} / $${spend.limits.global_daily.toFixed(2)}
💰 **Spend this month:** $${spend.global_monthly.toFixed(2)} / $${spend.limits.global_monthly.toFixed(2)}

📊 ${waiting} waiting · ${unresolved} unresolved · ${complete} complete

### 🔍 Active PRs
| Status | PR | Title | Updated |
|---|---|---|---|
${prRows}`;

    await github.updateIssue(dashboardIssueNumber, body);
  } catch (err) {
    console.error('Failed to update dashboard:', err);
  }
}
