import type { HandlerContext } from '../handlers/webhook.js';
import {
  setExclusiveAILabel,
  replaceAIReviewSection,
  buildAIReviewSectionComplete,
  buildAIReviewSectionUnresolved,
  buildAIReviewSectionSpendLimited,
  findHQComment,
  AI_CONTEXT,
} from '../handlers/webhook.js';
import { SpendGuard, calculateCost } from './spend-guard.js';
import { createProvider } from './ai-provider.js';
import { fetchReviewConfig, getContextFiles } from './review-config.js';
import { parseReviewHistory, addReviewRound } from './review-history.js';
import type { ReviewRound } from './types.js';

function countActionableIssues(reviewBody: string): number {
  if (/\*\*no blocking issues\*\*/i.test(reviewBody)) return 0;
  if (!/\*\*actionable issues found\*\*/i.test(reviewBody)) return 0;
  // Count markdown list items that look like issue reports
  const bullets = reviewBody.match(/^[-*]\s+.+/gm) ?? [];
  return Math.max(1, bullets.length);
}

export async function executeReview(
  ctx: HandlerContext,
  prNumber: number,
  sha: string,
  hq: { id: number; body: string } | null,
): Promise<void> {
  const { github, env } = ctx;
  const repo = env.GITHUB_REPO;

  const spendGuard = new SpendGuard(env);

  // 1. Check spend limits
  const limitCheck = await spendGuard.checkLimits(repo);
  if (!limitCheck.allowed) {
    await setExclusiveAILabel(github, prNumber, 'ai-review: not started');
    await github.setCommitStatus(sha, 'failure', AI_CONTEXT, 'AI review skipped — spend limit reached');

    if (hq) {
      const section = buildAIReviewSectionSpendLimited(limitCheck.reason ?? 'limit reached');
      await github.updateComment(hq.id, replaceAIReviewSection(hq.body, section));
    }
    await github.createComment(prNumber, `⛔ AI review skipped — spend limit reached: ${limitCheck.reason}`);
    return;
  }

  // 2. Fetch config and PR data in parallel
  const prData = await github.getPR(prNumber);
  const headRef = prData.head.sha;

  const [config, diff] = await Promise.all([
    fetchReviewConfig(github, headRef),
    github.getPRDiff(prNumber),
  ]);

  // 3. Fetch context files
  const contextFiles = await getContextFiles(github, config, headRef);

  // 4. Get review history from HQ comment
  const hqFresh = hq ?? await findHQComment(github, prNumber);
  const history = hqFresh ? parseReviewHistory(hqFresh.body) : [];

  // 5. Call AI provider
  const provider = createProvider(env);
  const result = await provider.generateReview({
    prNumber,
    prTitle: prData.title,
    prBody: (prData as any).body ?? '',
    diff,
    contextFiles,
    config,
    history,
    headSha: sha,
  });

  // 6. Post review as a GitHub PR review (COMMENT = non-blocking)
  await github.createPRReview(prNumber, result.review_body, 'COMMENT');

  // 7. Record spend
  const cost = calculateCost(result.input_tokens, result.output_tokens);
  await spendGuard.recordSpend(repo, cost);

  // 8. Build new history round
  const newRound: ReviewRound = {
    round: history.length + 1,
    timestamp: new Date().toISOString(),
    commit_sha: sha,
    input_tokens: result.input_tokens,
    output_tokens: result.output_tokens,
    cost,
    summary: result.review_body.split('\n').find(l => l.trim())?.slice(0, 100) ?? 'Review complete',
  };
  const updatedHistory = addReviewRound(history, newRound);

  // 9. Get spend status for HQ display
  const spendStatus = await spendGuard.getSpendStatus(repo);

  // 10. Determine commit status from review content
  const actionableCount = countActionableIssues(result.review_body);
  const hasBlocking = actionableCount > 0;

  if (hasBlocking) {
    await setExclusiveAILabel(github, prNumber, 'ai-review: unresolved');
    await github.setCommitStatus(sha, 'failure', AI_CONTEXT, `AI review: ${actionableCount} actionable issue(s)`);

    const hqToUpdate = hqFresh ?? await findHQComment(github, prNumber);
    if (hqToUpdate) {
      const section = buildAIReviewSectionUnresolved(actionableCount, spendStatus, updatedHistory);
      await github.updateComment(hqToUpdate.id, replaceAIReviewSection(hqToUpdate.body, section));
    }
  } else {
    await setExclusiveAILabel(github, prNumber, 'ai-review: complete');
    await github.setCommitStatus(sha, 'success', AI_CONTEXT, 'AI review passed');

    const hqToUpdate = hqFresh ?? await findHQComment(github, prNumber);
    if (hqToUpdate) {
      const section = buildAIReviewSectionComplete(spendStatus, updatedHistory);
      await github.updateComment(hqToUpdate.id, replaceAIReviewSection(hqToUpdate.body, section));
    }
  }
}
