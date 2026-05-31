/**
 * Pure functions for CodeRabbit bot logic.
 * Imported by bot-coderabbit-gate.yml and bot-receiver.yml via dynamic import,
 * and tested by tests/unit/bot/coderabbit-logic.test.ts.
 */

/**
 * Returns true if a pull_request_review body is a skip or rate-limit notice —
 * not a real substantive review. These events must not trigger label transitions.
 * @param {string|null|undefined} body
 */
export function isSkipOrRateLimitReview(body) {
  return /auto-generated comment: (?:rate limited|skip review) by coderabbit\.ai/i.test(body ?? '');
}

/**
 * Given the current label names and the count of unresolved CR threads,
 * decides what label transition the gate should perform.
 *
 * Returns { newLabel, state, description } or null if no transition is needed.
 *
 * @param {string[]} labelNames
 * @param {number} unresolved
 */
export function computeGateTransition(labelNames, unresolved) {
  const hasCRLabel = labelNames.some(n => n.startsWith('coderabbit:'));
  const isActive = hasCRLabel
    && !labelNames.includes('coderabbit: rate-limited')
    && !labelNames.includes('coderabbit: not started');
  if (!isActive) return null;

  if (unresolved === 0 && !labelNames.includes('coderabbit: complete'))
    return { newLabel: 'coderabbit: complete', state: 'success', description: 'CodeRabbit review complete' };

  if (unresolved > 0 && !labelNames.includes('coderabbit: unresolved'))
    return { newLabel: 'coderabbit: unresolved', state: 'failure', description: 'CodeRabbit has unresolved comments' };

  return null;
}

/**
 * Maps the current label set to a commit status to post.
 * @param {string[]} labelNames
 * @returns {{ state: string, description: string }}
 */
export function labelToStatus(labelNames) {
  if (labelNames.includes('coderabbit: complete'))
    return { state: 'success', description: 'CodeRabbit review complete' };
  if (labelNames.includes('coderabbit: unresolved'))
    return { state: 'failure', description: 'CodeRabbit has unresolved comments' };
  if (labelNames.includes('coderabbit: rate-limited'))
    return { state: 'pending', description: 'CodeRabbit rate-limited — retry queued' };
  if (labelNames.includes('coderabbit: waiting'))
    return { state: 'pending', description: 'CodeRabbit review in progress' };
  return { state: 'pending', description: 'CodeRabbit review not started — comment @rickcedwhat-ai coderabbit review' };
}

/**
 * Filters GraphQL reviewThreads nodes and returns the count of unresolved CR threads.
 * @param {Array<{ isResolved: boolean, comments: { nodes: Array<{ author: { login: string }|null }> } }>} nodes
 */
export function countUnresolvedCRThreads(nodes) {
  return nodes.filter(
    t => !t.isResolved && t.comments.nodes[0]?.author?.login === 'coderabbitai[bot]'
  ).length;
}

/**
 * Parses the wait duration from a CodeRabbit rate-limit comment body.
 * Looks for hours, minutes, and seconds independently.
 * Returns milliseconds; falls back to 30 minutes if nothing matches.
 * @param {string} body
 */
export function parseRateLimitDuration(body) {
  const hMatch = body.match(/(\d+)\s*hour/i);
  const mMatch = body.match(/(\d+)\s*min/i);
  const sMatch = body.match(/(\d+)\s*sec/i);
  const ms = (hMatch ? parseInt(hMatch[1]) * 3_600_000 : 0)
           + (mMatch ? parseInt(mMatch[1]) *    60_000 : 0)
           + (sMatch ? parseInt(sMatch[1]) *     1_000 : 0);
  return ms || 30 * 60_000;
}

/**
 * Computes the QStash delay in seconds for a rate-limit retry.
 *
 * Anchors to when CR *posted* the rate-limit comment (createdAtIso) so elapsed
 * processing time doesn't inflate the delay. Falls back to now if the timestamp
 * is missing or malformed. Always adds a 60 s safety buffer.
 *
 * @param {string} body          - Rate-limit comment body text
 * @param {string|null} createdAtIso - ISO timestamp of the rate-limit comment
 * @param {number} nowMs         - Current time as Unix ms (Date.now())
 * @returns {number} Delay in seconds (minimum 90)
 */
export function computeRateLimitDelay(body, createdAtIso, nowMs) {
  const durationMs = parseRateLimitDuration(body);
  const commentedAt = createdAtIso ? new Date(createdAtIso).getTime() : NaN;
  const anchor = isNaN(commentedAt) ? nowMs : commentedAt;
  const availableAt = anchor + durationMs;
  return Math.max(30, Math.ceil((availableAt - nowMs) / 1_000)) + 60;
}

/**
 * Returns true if the coderabbit-retry job should skip because the PR is
 * no longer rate-limited (duplicate QStash messages in flight).
 * @param {string[]} labelNames
 */
export function shouldSkipRetry(labelNames) {
  return !labelNames.includes('coderabbit: rate-limited');
}

/**
 * Returns true if the coderabbit-trigger job should skip.
 *
 * Skips when the PR is already in a terminal state (complete/unresolved),
 * or when a review is already in-progress (waiting) and this is a first-attempt
 * trigger — which means it's a duplicate. Retries from bot-coderabbit-check
 * arrive with attempt > 1 and must proceed even when waiting.
 *
 * @param {string[]} labelNames
 * @param {number} attempt - 1-based attempt number
 */
export function shouldSkipTrigger(labelNames, attempt) {
  if (labelNames.includes('coderabbit: complete') || labelNames.includes('coderabbit: unresolved'))
    return true;
  if (labelNames.includes('coderabbit: waiting') && attempt <= 1)
    return true;
  return false;
}
