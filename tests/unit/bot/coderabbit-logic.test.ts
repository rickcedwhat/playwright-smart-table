import { describe, it, expect } from 'vitest';
import {
  isSkipOrRateLimitReview,
  computeGateTransition,
  labelToStatus,
  countUnresolvedCRThreads,
  parseRateLimitDuration,
  computeRateLimitDelay,
  shouldSkipRetry,
  shouldSkipTrigger,
} from '../../../.github/scripts/coderabbit-logic.mjs';

// ─── isSkipOrRateLimitReview ─────────────────────────────────────────────────

describe('isSkipOrRateLimitReview', () => {
  it('matches "skip review" in CR auto-generated body', () => {
    expect(isSkipOrRateLimitReview(
      '<!-- auto-generated comment: skip review by coderabbit.ai -->'
    )).toBe(true);
  });

  it('matches "rate limited" CR auto-generated comment', () => {
    expect(isSkipOrRateLimitReview(
      '<!-- This is an auto-generated comment: rate limited by coderabbit.ai -->'
    )).toBe(true);
  });

  it('does not match a real review body with "rate limit" in prose', () => {
    expect(isSkipOrRateLimitReview(
      '**Actionable comments posted: 1**\n\nThis function has no rate limit handling.'
    )).toBe(false);
  });

  it('does not match a real review body', () => {
    expect(isSkipOrRateLimitReview('**Actionable comments posted: 2**')).toBe(false);
  });

  it('does not match an empty body', () => {
    expect(isSkipOrRateLimitReview('')).toBe(false);
  });

  it('handles null/undefined gracefully', () => {
    expect(isSkipOrRateLimitReview(null)).toBe(false);
    expect(isSkipOrRateLimitReview(undefined)).toBe(false);
  });
});

// ─── computeGateTransition ───────────────────────────────────────────────────

describe('computeGateTransition', () => {
  // Bug regression: waiting → complete was broken (waiting was excluded from isActive)
  it('transitions waiting → complete when unresolved=0', () => {
    const result = computeGateTransition(['coderabbit: waiting'], 0);
    expect(result).toEqual({
      newLabel: 'coderabbit: complete',
      state: 'success',
      description: 'CodeRabbit review complete',
    });
  });

  it('transitions waiting → unresolved when threads exist', () => {
    const result = computeGateTransition(['coderabbit: waiting'], 3);
    expect(result).toEqual({
      newLabel: 'coderabbit: unresolved',
      state: 'failure',
      description: 'CodeRabbit has unresolved comments',
    });
  });

  it('transitions unresolved → complete when all threads resolved', () => {
    const result = computeGateTransition(['coderabbit: unresolved'], 0);
    expect(result?.newLabel).toBe('coderabbit: complete');
  });

  it('transitions complete → unresolved when new threads appear', () => {
    const result = computeGateTransition(['coderabbit: complete'], 1);
    expect(result?.newLabel).toBe('coderabbit: unresolved');
  });

  it('returns null when already complete with 0 threads (no change needed)', () => {
    expect(computeGateTransition(['coderabbit: complete'], 0)).toBeNull();
  });

  it('returns null when already unresolved with threads (no change needed)', () => {
    expect(computeGateTransition(['coderabbit: unresolved'], 2)).toBeNull();
  });

  it('returns null for rate-limited (not active)', () => {
    expect(computeGateTransition(['coderabbit: rate-limited'], 0)).toBeNull();
  });

  it('returns null for not-started (not active)', () => {
    expect(computeGateTransition(['coderabbit: not started'], 0)).toBeNull();
  });

  it('returns null when no CR label at all', () => {
    expect(computeGateTransition(['bug', 'enhancement'], 0)).toBeNull();
  });

  it('returns null for empty label list', () => {
    expect(computeGateTransition([], 0)).toBeNull();
  });
});

// ─── labelToStatus ───────────────────────────────────────────────────────────

describe('labelToStatus', () => {
  it('complete → success', () => {
    expect(labelToStatus(['coderabbit: complete'])).toEqual({
      state: 'success',
      description: 'CodeRabbit review complete',
    });
  });

  it('unresolved → failure', () => {
    expect(labelToStatus(['coderabbit: unresolved'])).toEqual({
      state: 'failure',
      description: 'CodeRabbit has unresolved comments',
    });
  });

  it('rate-limited → pending with retry message', () => {
    const { state, description } = labelToStatus(['coderabbit: rate-limited']);
    expect(state).toBe('pending');
    expect(description).toMatch(/rate-limited/i);
  });

  it('waiting → pending with in-progress message', () => {
    const { state, description } = labelToStatus(['coderabbit: waiting']);
    expect(state).toBe('pending');
    expect(description).toMatch(/in progress/i);
  });

  it('not started → pending with not-started message', () => {
    const { state } = labelToStatus(['coderabbit: not started']);
    expect(state).toBe('pending');
  });

  it('no label → pending', () => {
    expect(labelToStatus([])).toMatchObject({ state: 'pending' });
  });
});

// ─── countUnresolvedCRThreads ─────────────────────────────────────────────────

describe('countUnresolvedCRThreads', () => {
  const crThread = (isResolved: boolean) => ({
    isResolved,
    comments: { nodes: [{ author: { login: 'coderabbitai[bot]' } }] },
  });
  const userThread = (isResolved: boolean) => ({
    isResolved,
    comments: { nodes: [{ author: { login: 'some-user' } }] },
  });
  const emptyThread = () => ({
    isResolved: false,
    comments: { nodes: [] },
  });

  it('counts unresolved CR threads', () => {
    expect(countUnresolvedCRThreads([crThread(false), crThread(false)])).toBe(2);
  });

  it('ignores resolved CR threads', () => {
    expect(countUnresolvedCRThreads([crThread(true), crThread(false)])).toBe(1);
  });

  it('ignores non-CR threads', () => {
    expect(countUnresolvedCRThreads([userThread(false), crThread(false)])).toBe(1);
  });

  it('ignores threads with no author', () => {
    expect(countUnresolvedCRThreads([emptyThread(), crThread(false)])).toBe(1);
  });

  it('returns 0 for empty list', () => {
    expect(countUnresolvedCRThreads([])).toBe(0);
  });

  it('returns 0 when all threads resolved', () => {
    expect(countUnresolvedCRThreads([crThread(true), crThread(true)])).toBe(0);
  });
});

// ─── parseRateLimitDuration ──────────────────────────────────────────────────

describe('parseRateLimitDuration', () => {
  it('parses hours', () => {
    expect(parseRateLimitDuration('available in 1 hour')).toBe(3_600_000);
  });

  it('parses minutes', () => {
    expect(parseRateLimitDuration('available in 30 minutes')).toBe(1_800_000);
  });

  it('parses seconds', () => {
    expect(parseRateLimitDuration('available in 45 seconds')).toBe(45_000);
  });

  // Regression: old code only parsed hours+minutes, dropped seconds
  it('parses combined hours, minutes, and seconds', () => {
    expect(parseRateLimitDuration('available in 1 hour 30 minutes and 15 seconds'))
      .toBe(3_600_000 + 1_800_000 + 15_000);
  });

  it('parses the real CR format "41 minutes and 59 seconds"', () => {
    expect(parseRateLimitDuration(
      'More reviews will be available in 41 minutes and 59 seconds.'
    )).toBe(41 * 60_000 + 59 * 1_000);
  });

  it('falls back to 30 minutes when no time found', () => {
    expect(parseRateLimitDuration('rate limit reached, try again later')).toBe(30 * 60_000);
  });

  it('is case-insensitive', () => {
    expect(parseRateLimitDuration('Available in 2 Hours')).toBe(7_200_000);
  });
});

// ─── computeRateLimitDelay ───────────────────────────────────────────────────

describe('computeRateLimitDelay', () => {
  const commentBody = 'available in 30 minutes';

  // Regression: old code used Date.now() as anchor, inflating delay by processing time
  it('anchors to comment creation time, not now', () => {
    const commentedAt = new Date('2026-05-30T10:00:00Z').getTime();
    const now = commentedAt + 5 * 60_000; // 5 minutes have elapsed since comment
    const delay = computeRateLimitDelay(commentBody, '2026-05-30T10:00:00Z', now);
    // 30 min window - 5 min elapsed = 25 min remaining + 60s buffer
    expect(delay).toBe(25 * 60 + 60);
  });

  it('returns minimum 90 seconds even if window has passed', () => {
    const commentedAt = new Date('2026-05-30T10:00:00Z').getTime();
    const now = commentedAt + 60 * 60_000; // 60 minutes elapsed, well past 30min window
    const delay = computeRateLimitDelay(commentBody, '2026-05-30T10:00:00Z', now);
    expect(delay).toBe(90); // max(30, negative→0 rounded up to 30) + 60 = 90
  });

  // Regression: old code passed NaN to QStash when created_at missing
  it('falls back to now-anchored delay when created_at is null', () => {
    const now = Date.now();
    const delay = computeRateLimitDelay(commentBody, null, now);
    // 30 min from now + 60s buffer (no time elapsed from anchor=now)
    expect(delay).toBe(30 * 60 + 60);
  });

  it('falls back to now-anchored delay when created_at is malformed', () => {
    const now = Date.now();
    const delay = computeRateLimitDelay(commentBody, 'not-a-date', now);
    expect(delay).toBe(30 * 60 + 60);
  });

  it('result is always a finite positive number', () => {
    const delay = computeRateLimitDelay('', null, Date.now());
    expect(Number.isFinite(delay)).toBe(true);
    expect(delay).toBeGreaterThan(0);
  });
});

// ─── shouldSkipRetry ─────────────────────────────────────────────────────────

describe('shouldSkipRetry', () => {
  // Regression: bot was posting @coderabbitai full review on every duplicate QStash message
  it('does NOT skip when label is rate-limited', () => {
    expect(shouldSkipRetry(['coderabbit: rate-limited'])).toBe(false);
  });

  it('skips when label is waiting (already triggered)', () => {
    expect(shouldSkipRetry(['coderabbit: waiting'])).toBe(true);
  });

  it('skips when label is complete', () => {
    expect(shouldSkipRetry(['coderabbit: complete'])).toBe(true);
  });

  it('skips when no CR label', () => {
    expect(shouldSkipRetry([])).toBe(true);
  });
});

// ─── shouldSkipTrigger ───────────────────────────────────────────────────────

describe('shouldSkipTrigger', () => {
  // Regression: duplicate bot-coderabbit-trigger messages stacked parallel review loops
  it('skips when complete regardless of attempt', () => {
    expect(shouldSkipTrigger(['coderabbit: complete'], 1)).toBe(true);
    expect(shouldSkipTrigger(['coderabbit: complete'], 5)).toBe(true);
  });

  it('skips when unresolved regardless of attempt', () => {
    expect(shouldSkipTrigger(['coderabbit: unresolved'], 1)).toBe(true);
    expect(shouldSkipTrigger(['coderabbit: unresolved'], 3)).toBe(true);
  });

  it('skips when waiting + attempt 1 (duplicate trigger)', () => {
    expect(shouldSkipTrigger(['coderabbit: waiting'], 1)).toBe(true);
  });

  it('does NOT skip when waiting + attempt 2 (retry from check loop)', () => {
    expect(shouldSkipTrigger(['coderabbit: waiting'], 2)).toBe(false);
  });

  it('does NOT skip when waiting + attempt 5', () => {
    expect(shouldSkipTrigger(['coderabbit: waiting'], 5)).toBe(false);
  });

  it('does NOT skip when not-started + attempt 1 (fresh trigger)', () => {
    expect(shouldSkipTrigger(['coderabbit: not started'], 1)).toBe(false);
  });

  it('does NOT skip when rate-limited + attempt 1 (post-rate-limit retry)', () => {
    expect(shouldSkipTrigger(['coderabbit: rate-limited'], 1)).toBe(false);
  });

  it('does NOT skip when no label', () => {
    expect(shouldSkipTrigger([], 1)).toBe(false);
  });
});
