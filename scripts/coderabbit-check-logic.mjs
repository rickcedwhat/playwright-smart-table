/**
 * Pure decision logic for the coderabbit-check bot step.
 *
 * This module is imported by unit tests to verify correctness independently
 * of the GitHub Actions runtime. The YAML keeps the logic inline, so keep
 * this file in sync if the receiver changes.
 *
 * @typedef {{ isResolved: boolean, comments: { nodes: Array<{ author: { login: string } }> } }} ReviewThread
 * @typedef {{ author: { login: string } | null, state: string, submittedAt: string, body: string }} Review
 */

/**
 * Returns true for any CodeRabbit bot login.
 * GraphQL returns 'coderabbitai'; REST returns 'coderabbitai[bot]'.
 * Using startsWith handles both forms defensively.
 *
 * @param {string | null | undefined} login
 * @returns {boolean}
 */
export function isCR(login) {
  return login?.startsWith('coderabbitai') ?? false;
}

/**
 * Filters review threads to find unresolved ones authored by CodeRabbit.
 *
 * @param {ReviewThread[]} threads
 * @returns {ReviewThread[]}
 */
export function getUnresolvedCRThreads(threads) {
  return threads.filter(
    t => !t.isResolved && isCR(t.comments.nodes[0]?.author?.login)
  );
}

/**
 * Filters formal reviews to find CR nitpick reviews submitted after trigger_time.
 * CR posts nitpick-level content in a COMMENTED review body rather than as
 * resolvable inline threads.
 *
 * @param {Review[]} reviews
 * @param {string} trigger_time  ISO-8601 timestamp
 * @returns {Review[]}
 */
export function getCRNitpickReviews(reviews, trigger_time) {
  const triggerDate = new Date(trigger_time);
  return reviews.filter(
    r => isCR(r.author?.login) &&
         r.state === 'COMMENTED' &&
         new Date(r.submittedAt) > triggerDate &&
         r.body.trim().length > 0
  );
}

/**
 * Returns the outcome label and status detail string.
 *
 * @param {ReviewThread[]} unresolvedThreads
 * @param {Review[]} nitpickReviews
 * @returns {{ label: 'coderabbit: unresolved' | 'coderabbit: complete', detail: string }}
 */
export function getReviewOutcome(unresolvedThreads, nitpickReviews) {
  if (unresolvedThreads.length > 0 || nitpickReviews.length > 0) {
    const detail = unresolvedThreads.length > 0
      ? `${unresolvedThreads.length} unresolved thread${unresolvedThreads.length > 1 ? 's' : ''}`
      : 'nitpick comments';
    return { label: 'coderabbit: unresolved', detail };
  }
  return { label: 'coderabbit: complete', detail: '' };
}
