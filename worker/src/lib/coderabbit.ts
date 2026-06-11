import type { CommitState } from './types.js';

/**
 * Returns true if a pull_request_review body is a skip or rate-limit notice —
 * not a real substantive review. These events must not trigger label transitions.
 */
export function isSkipOrRateLimitReview(body: string | null | undefined): boolean {
  return /auto-generated comment: (?:rate limited|skip review) by coderabbit\.ai/i.test(body ?? '');
}

/**
 * Returns true if the comment body contains the CR skip marker.
 */
export function isSkipComment(body: string | null | undefined): boolean {
  return (body ?? '').includes('<!-- skip review by coderabbit.ai -->');
}

/**
 * Returns true if the comment body contains rate-limit language from CodeRabbit.
 */
export function isRateLimitComment(body: string | null | undefined): boolean {
  const b = body ?? '';
  return /exceeded|try again in|available in \d+/i.test(b) ||
         b.includes('rate limited by coderabbit.ai');
}

/**
 * Parses the wait duration from a CodeRabbit rate-limit comment body.
 * Looks for hours, minutes, and seconds independently.
 * Returns milliseconds; falls back to 30 minutes if nothing matches.
 */
export function parseRateLimitDuration(body: string): number {
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
 * Anchors to when CR posted the rate-limit comment so elapsed processing
 * time doesn't inflate the delay. Always adds a 60 s safety buffer.
 */
export function computeRateLimitDelay(
  body: string,
  createdAtIso: string | null,
  nowMs: number,
): number {
  const durationMs = parseRateLimitDuration(body);
  const commentedAt = createdAtIso ? new Date(createdAtIso).getTime() : NaN;
  const anchor = isNaN(commentedAt) ? nowMs : commentedAt;
  const availableAt = anchor + durationMs;
  return Math.max(30, Math.ceil((availableAt - nowMs) / 1_000)) + 60;
}

/**
 * Parses the number of actionable comments from a CodeRabbit review body.
 */
export function parseActionableCount(body: string | null | undefined): number {
  const m = (body ?? '').match(/Actionable comments posted:\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Parses the number of nitpick comments from a CodeRabbit review body.
 */
export function parseNitpickCount(body: string | null | undefined): number {
  const m = (body ?? '').match(/Nitpick comments\s*\((\d+)\)/i);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Returns the checkbox lines for the HQ CR section based on the current HQ body.
 * Preserves whichever checkbox was previously selected; defaults to all unchecked.
 */
export function getCheckedLabel(hqBody: string | null | undefined): string {
  const body = hqBody ?? '';
  if (/- \[x\] 🔴/u.test(body))
    return '- [x] 🔴 Priority review _(skips to front)_\n- [ ] 🟡 Normal review _(standard queue)_\n- [ ] ⬜ Backburner review _(triggers only when bucket is full)_';
  if (/- \[x\] 🟡/u.test(body))
    return '- [ ] 🔴 Priority review _(skips to front)_\n- [x] 🟡 Normal review _(standard queue)_\n- [ ] ⬜ Backburner review _(triggers only when bucket is full)_';
  if (/- \[x\] ⬜/u.test(body))
    return '- [ ] 🔴 Priority review _(skips to front)_\n- [ ] 🟡 Normal review _(standard queue)_\n- [x] ⬜ Backburner review _(triggers only when bucket is full)_';
  // Old-style backward compat
  if (/- \[x\] Full review/i.test(body))
    return '- [x] Full review\n- [ ] Incremental review';
  if (/- \[x\] Incremental review/i.test(body))
    return '- [ ] Full review\n- [x] Incremental review';
  return '- [ ] 🔴 Priority review _(skips to front)_\n- [ ] 🟡 Normal review _(standard queue)_\n- [ ] ⬜ Backburner review _(triggers only when bucket is full)_';
}

/**
 * Extract priority level from HQ comment body checkbox state.
 */
export function getPriorityFromCheckbox(
  hqBody: string | null | undefined,
): 'priority' | 'normal' | 'backburner' | null {
  const body = hqBody ?? '';
  if (/- \[x\] 🔴/u.test(body)) return 'priority';
  if (/- \[x\] 🟡/u.test(body)) return 'normal';
  if (/- \[x\] ⬜/u.test(body)) return 'backburner';
  if (/- \[x\] Full review/i.test(body)) return 'normal'; // backward compat
  return null;
}

/**
 * Maps the current label set to a commit status to post.
 */
export function labelToStatus(labelNames: string[]): { state: CommitState; description: string } {
  if (labelNames.includes('coderabbit: complete'))
    return { state: 'success', description: 'CodeRabbit review passed' };
  if (labelNames.includes('coderabbit: unresolved'))
    return { state: 'failure', description: 'CodeRabbit review has open comments' };
  if (labelNames.includes('coderabbit: rate-limited'))
    return { state: 'pending', description: 'CodeRabbit rate-limited · retry scheduled' };
  if (labelNames.includes('coderabbit: waiting'))
    return { state: 'pending', description: 'CodeRabbit review in progress' };
  return { state: 'pending', description: 'CodeRabbit review not yet requested' };
}
