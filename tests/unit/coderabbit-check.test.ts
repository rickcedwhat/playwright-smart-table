import { describe, it, expect } from 'vitest';
import {
  isCR,
  getUnresolvedCRThreads,
  getCRNitpickReviews,
  getReviewOutcome,
} from '../../scripts/coderabbit-check-logic.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function thread(login: string, isResolved: boolean) {
  return { isResolved, comments: { nodes: [{ author: { login } }] } };
}

function review(login: string, state: string, submittedAt: string, body: string) {
  return { author: { login }, state, submittedAt, body };
}

const TRIGGER = '2026-05-18T19:17:23Z';
const AFTER   = '2026-05-18T19:19:53Z'; // 2m 30s after trigger
const BEFORE  = '2026-05-18T19:15:00Z'; // 2m 23s before trigger

// ---------------------------------------------------------------------------
// isCR
// ---------------------------------------------------------------------------

describe('isCR', () => {
  it('matches the GraphQL login format (no [bot] suffix)', () => {
    expect(isCR('coderabbitai')).toBe(true);
  });

  it('matches the REST API login format (with [bot] suffix)', () => {
    expect(isCR('coderabbitai[bot]')).toBe(true);
  });

  it('does not match unrelated bot logins', () => {
    expect(isCR('dependabot[bot]')).toBe(false);
    expect(isCR('github-actions[bot]')).toBe(false);
    expect(isCR('rickcedwhat')).toBe(false);
    expect(isCR('rickcedwhat-ai')).toBe(false);
  });

  it('handles null and undefined safely', () => {
    expect(isCR(null)).toBe(false);
    expect(isCR(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getUnresolvedCRThreads
// ---------------------------------------------------------------------------

describe('getUnresolvedCRThreads', () => {
  it('returns unresolved CR threads', () => {
    const threads = [thread('coderabbitai', false)];
    expect(getUnresolvedCRThreads(threads)).toHaveLength(1);
  });

  it('excludes resolved CR threads', () => {
    const threads = [thread('coderabbitai', true)];
    expect(getUnresolvedCRThreads(threads)).toHaveLength(0);
  });

  it('excludes unresolved threads from other authors', () => {
    const threads = [thread('rickcedwhat', false)];
    expect(getUnresolvedCRThreads(threads)).toHaveLength(0);
  });

  it('handles both REST and GraphQL CR login formats', () => {
    const threads = [
      thread('coderabbitai',       false), // GraphQL format
      thread('coderabbitai[bot]',  false), // REST format
    ];
    expect(getUnresolvedCRThreads(threads)).toHaveLength(2);
  });

  it('returns only the unresolved CR threads from a mixed set', () => {
    const threads = [
      thread('coderabbitai', false),  // unresolved CR       → included
      thread('coderabbitai', true),   // resolved CR         → excluded
      thread('rickcedwhat',  false),  // unresolved non-CR   → excluded
      thread('dependabot[bot]', false), // unresolved non-CR → excluded
    ];
    expect(getUnresolvedCRThreads(threads)).toHaveLength(1);
  });

  it('returns empty array for no threads', () => {
    expect(getUnresolvedCRThreads([])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getCRNitpickReviews
// ---------------------------------------------------------------------------

describe('getCRNitpickReviews', () => {
  it('detects a COMMENTED CR review with body after trigger_time', () => {
    const reviews = [review('coderabbitai', 'COMMENTED', AFTER, '🧹 Nitpick comments (1)')];
    expect(getCRNitpickReviews(reviews, TRIGGER)).toHaveLength(1);
  });

  it('excludes CR COMMENTED reviews submitted before trigger_time', () => {
    const reviews = [review('coderabbitai', 'COMMENTED', BEFORE, '🧹 Nitpick comments (1)')];
    expect(getCRNitpickReviews(reviews, TRIGGER)).toHaveLength(0);
  });

  it('excludes CR COMMENTED reviews with empty body', () => {
    const reviews = [review('coderabbitai', 'COMMENTED', AFTER, '   ')];
    expect(getCRNitpickReviews(reviews, TRIGGER)).toHaveLength(0);
  });

  it('excludes CR APPROVED reviews even with body after trigger_time', () => {
    const reviews = [review('coderabbitai', 'APPROVED', AFTER, 'looks good')];
    expect(getCRNitpickReviews(reviews, TRIGGER)).toHaveLength(0);
  });

  it('excludes CR CHANGES_REQUESTED reviews (those create threads instead)', () => {
    const reviews = [review('coderabbitai', 'CHANGES_REQUESTED', AFTER, 'must fix this')];
    expect(getCRNitpickReviews(reviews, TRIGGER)).toHaveLength(0);
  });

  it('excludes COMMENTED reviews from non-CR authors', () => {
    const reviews = [review('rickcedwhat', 'COMMENTED', AFTER, 'some feedback')];
    expect(getCRNitpickReviews(reviews, TRIGGER)).toHaveLength(0);
  });

  it('handles both REST and GraphQL CR login formats', () => {
    const reviews = [
      review('coderabbitai',      'COMMENTED', AFTER, 'nitpick 1'),
      review('coderabbitai[bot]', 'COMMENTED', AFTER, 'nitpick 2'),
    ];
    expect(getCRNitpickReviews(reviews, TRIGGER)).toHaveLength(2);
  });

  it('returns empty array for no reviews', () => {
    expect(getCRNitpickReviews([], TRIGGER)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getReviewOutcome
// ---------------------------------------------------------------------------

describe('getReviewOutcome', () => {
  it('returns complete when there are no threads or nitpick reviews', () => {
    const { label } = getReviewOutcome([], []);
    expect(label).toBe('coderabbit: complete');
  });

  it('returns unresolved when there is 1 unresolved thread', () => {
    const threads = [thread('coderabbitai', false)];
    const { label, detail } = getReviewOutcome(threads, []);
    expect(label).toBe('coderabbit: unresolved');
    expect(detail).toBe('1 unresolved thread');
  });

  it('pluralises the thread count correctly', () => {
    const threads = [thread('coderabbitai', false), thread('coderabbitai', false)];
    const { detail } = getReviewOutcome(threads, []);
    expect(detail).toBe('2 unresolved threads');
  });

  it('returns unresolved with "nitpick comments" when only nitpick reviews exist', () => {
    const nitpick = [review('coderabbitai', 'COMMENTED', AFTER, '🧹 Nitpick comments (1)')];
    const { label, detail } = getReviewOutcome([], nitpick);
    expect(label).toBe('coderabbit: unresolved');
    expect(detail).toBe('nitpick comments');
  });

  it('prefers thread count in detail when both threads and nitpick reviews exist', () => {
    const threads = [thread('coderabbitai', false)];
    const nitpick = [review('coderabbitai', 'COMMENTED', AFTER, 'nitpick')];
    const { label, detail } = getReviewOutcome(threads, nitpick);
    expect(label).toBe('coderabbit: unresolved');
    expect(detail).toBe('1 unresolved thread');
  });

  it('complete result has empty detail string', () => {
    const { label, detail } = getReviewOutcome([], []);
    expect(label).toBe('coderabbit: complete');
    expect(detail).toBe('');
  });
});
