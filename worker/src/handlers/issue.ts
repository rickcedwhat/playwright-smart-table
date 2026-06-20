import type { GitHubClient } from '../lib/github.js';
import type { StateManager } from '../lib/state.js';
import type { Env } from '../index.js';
import { SpendGuard, calculateCost } from '../lib/spend-guard.js';
import { createProvider } from '../lib/ai-provider.js';
import { fetchReviewConfig, getContextFiles } from '../lib/review-config.js';

export interface IssueHandlerContext {
  github: GitHubClient;
  state: StateManager;
  env: Env;
  event: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

const BOT_LOGIN = 'rickcedwhat-ai';

const HQ_ISSUE_TEMPLATE = `<!-- bot-hq-issue -->
## 🤖 Bot HQ

<!-- ai-plan-section-start -->
### 📋 Planning
> _No plan requested yet. Comment \`@rickcedwhat-ai plan\` to generate one._
<!-- ai-plan-section-end -->

---
<sub>This comment is managed by the bot — do not edit directly.</sub>`;

function buildPlanSectionWaiting(): string {
  return `<!-- ai-plan-section-start -->
### 📋 Planning
> ⏳ Generating plan…
<!-- ai-plan-section-end -->`;
}

function buildPlanSectionComplete(planCommentUrl: string, spend: { repo_daily: number; global_daily: number; global_monthly: number; limits: { repo_daily: number; global_daily: number; global_monthly: number } }): string {
  const spendLine = `📊 Repo today: $${spend.repo_daily.toFixed(2)} / $${spend.limits.repo_daily.toFixed(2)} · Global today: $${spend.global_daily.toFixed(2)} / $${spend.limits.global_daily.toFixed(2)} · Month: $${spend.global_monthly.toFixed(2)} / $${spend.limits.global_monthly.toFixed(2)}`;
  return `<!-- ai-plan-section-start -->
### 📋 Planning
> ✅ Plan generated — [view plan](${planCommentUrl})

${spendLine}
<!-- ai-plan-section-end -->`;
}

function buildPlanSectionSpendLimited(reason: string): string {
  return `<!-- ai-plan-section-start -->
### 📋 Planning
> ⛔ Spend limit reached — ${reason}
<!-- ai-plan-section-end -->`;
}

function replacePlanSection(hqBody: string, newSection: string): string {
  return hqBody.replace(
    /<!-- ai-plan-section-start -->[\s\S]*?<!-- ai-plan-section-end -->/,
    newSection,
  );
}

async function findIssueHQComment(
  github: GitHubClient,
  issueNumber: number,
): Promise<{ id: number; body: string } | null> {
  const comments = await github.getIssueComments(issueNumber);
  const hq = comments.find(c => c.user.login === BOT_LOGIN && c.body.includes('<!-- bot-hq-issue -->'));
  return hq ? { id: hq.id, body: hq.body } : null;
}

async function runPlan(ctx: IssueHandlerContext, issueNumber: number): Promise<void> {
  const { github, env } = ctx;
  const repo = env.GITHUB_REPO;

  const spendGuard = new SpendGuard(env);

  // Ensure HQ comment exists
  let hq = await findIssueHQComment(github, issueNumber);
  if (!hq) {
    const created = await github.createComment(issueNumber, HQ_ISSUE_TEMPLATE);
    hq = { id: created.id, body: HQ_ISSUE_TEMPLATE };
  }

  // Check spend
  const limitCheck = await spendGuard.checkLimits(repo);
  if (!limitCheck.allowed) {
    const section = buildPlanSectionSpendLimited(limitCheck.reason ?? 'limit reached');
    await github.updateComment(hq.id, replacePlanSection(hq.body, section));
    await github.createComment(issueNumber, `⛔ Planning skipped — spend limit reached: ${limitCheck.reason}`);
    return;
  }

  // Update HQ to waiting
  await github.updateComment(hq.id, replacePlanSection(hq.body, buildPlanSectionWaiting()));

  // Fetch issue details and config
  const issueData = await github.getIssueBody(issueNumber);
  const config = await fetchReviewConfig(github, 'HEAD');
  const contextFiles = await getContextFiles(github, config, 'HEAD');

  // Call AI provider
  const provider = createProvider(env);
  const result = await provider.generatePlan({
    issueNumber,
    issueTitle: issueData.title,
    issueBody: issueData.body,
    contextFiles,
    config,
  });

  // Post plan as a comment
  const planComment = await github.createComment(issueNumber, result.review_body);

  // Record spend
  const cost = calculateCost(result.input_tokens, result.output_tokens);
  await spendGuard.recordSpend(repo, cost);

  // Update HQ with plan link and spend
  const spendStatus = await spendGuard.getSpendStatus(repo);
  const planUrl = `https://github.com/${repo}/issues/${issueNumber}#issuecomment-${planComment.id}`;
  const hqFresh = await findIssueHQComment(github, issueNumber);
  if (hqFresh) {
    const section = buildPlanSectionComplete(planUrl, spendStatus);
    await github.updateComment(hqFresh.id, replacePlanSection(hqFresh.body, section));
  }
}

export async function handleIssue(ctx: IssueHandlerContext): Promise<void> {
  const { payload } = ctx;
  const action: string = payload.action;
  const issue = payload.issue;
  const issueBody: string = issue.body ?? '';

  // Only trigger on opened issues that contain a planning checkbox or @bot plan
  if (action !== 'opened') return;
  if (!/\[ \]\s*(plan|@rickcedwhat-ai\s+plan)/i.test(issueBody)) return;

  await runPlan(ctx, issue.number);
}

export async function handleIssueComment(ctx: IssueHandlerContext): Promise<void> {
  const { payload } = ctx;
  const action: string = payload.action;
  const comment = payload.comment;
  const issue = payload.issue;

  // Skip PR comments (they have a pull_request field)
  if (issue.pull_request) return;

  const commentBody: string = comment.body ?? '';
  const commentAuthor: string = comment.user?.login ?? '';

  if (action !== 'created') return;
  if (commentAuthor === BOT_LOGIN) return;
  if (!/^@rickcedwhat-ai\s+plan/i.test(commentBody)) return;

  await runPlan(ctx, issue.number);
}
