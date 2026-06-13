import { describe, it, expect } from 'vitest';
import {
  isSkipOrRateLimitReview,
  isSkipComment,
  isRateLimitComment,
  parseRateLimitDuration,
  computeRateLimitDelay,
  parseActionableCount,
  parseNitpickCount,
  getCheckedLabel,
  getPriorityFromCheckbox,
  labelToStatus,
} from '../src/lib/coderabbit.js';

// ─── isSkipOrRateLimitReview ─────────────────────────────────────────────────

describe('isSkipOrRateLimitReview', () => {
  it('matches skip review auto-generated comment', () => {
    expect(isSkipOrRateLimitReview(
      '<!-- This is an auto-generated comment: skip review by coderabbit.ai -->'
    )).toBe(true);
  });

  it('matches rate limited auto-generated comment', () => {
    expect(isSkipOrRateLimitReview(
      '<!-- This is an auto-generated comment: rate limited by coderabbit.ai -->'
    )).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isSkipOrRateLimitReview(
      '<!-- auto-generated comment: SKIP REVIEW by coderabbit.ai -->'
    )).toBe(true);
  });

  it('does not match a real review body', () => {
    expect(isSkipOrRateLimitReview('**Actionable comments posted: 2**')).toBe(false);
  });

  it('does not match body that merely mentions rate limit in prose', () => {
    expect(isSkipOrRateLimitReview(
      'This function has no rate limit handling.'
    )).toBe(false);
  });

  it('handles null', () => {
    expect(isSkipOrRateLimitReview(null)).toBe(false);
  });

  it('handles undefined', () => {
    expect(isSkipOrRateLimitReview(undefined)).toBe(false);
  });

  it('handles empty string', () => {
    expect(isSkipOrRateLimitReview('')).toBe(false);
  });
});

// ─── isSkipComment ───────────────────────────────────────────────────────────

describe('isSkipComment', () => {
  it('matches the skip marker', () => {
    expect(isSkipComment('<!-- skip review by coderabbit.ai -->')).toBe(true);
  });

  it('matches when marker is embedded in larger body', () => {
    expect(isSkipComment('Some text <!-- skip review by coderabbit.ai --> more')).toBe(true);
  });

  it('does not match a real comment', () => {
    expect(isSkipComment('LGTM!')).toBe(false);
  });

  it('handles null/undefined', () => {
    expect(isSkipComment(null)).toBe(false);
    expect(isSkipComment(undefined)).toBe(false);
  });
});

// ─── isRateLimitComment ──────────────────────────────────────────────────────

describe('isRateLimitComment', () => {
  it('matches "exceeded" pattern', () => {
    expect(isRateLimitComment('You have exceeded the rate limit. Try again in 1 hour.')).toBe(true);
  });

  it('matches "try again in" pattern', () => {
    expect(isRateLimitComment('Please try again in 30 minutes.')).toBe(true);
  });

  it('matches "available in N" pattern', () => {
    expect(isRateLimitComment('Review will be available in 2 hours.')).toBe(true);
  });

  it('matches the CR marker string', () => {
    expect(isRateLimitComment('rate limited by coderabbit.ai')).toBe(true);
  });

  it('does not match a normal review comment', () => {
    expect(isRateLimitComment('**Actionable comments posted: 1**')).toBe(false);
  });

  it('handles null/undefined', () => {
    expect(isRateLimitComment(null)).toBe(false);
    expect(isRateLimitComment(undefined)).toBe(false);
  });
});

// ─── parseRateLimitDuration ──────────────────────────────────────────────────

describe('parseRateLimitDuration', () => {
  it('parses hours', () => {
    expect(parseRateLimitDuration('Try again in 2 hours')).toBe(2 * 3_600_000);
  });

  it('parses minutes', () => {
    expect(parseRateLimitDuration('Available in 30 minutes')).toBe(30 * 60_000);
  });

  it('parses seconds', () => {
    expect(parseRateLimitDuration('Wait 90 seconds')).toBe(90_000);
  });

  it('combines hours + minutes', () => {
    expect(parseRateLimitDuration('Wait 1 hour and 30 minutes'))
      .toBe(1 * 3_600_000 + 30 * 60_000);
  });

  it('falls back to 30 minutes when nothing matches', () => {
    expect(parseRateLimitDuration('Please wait a while')).toBe(30 * 60_000);
  });

  it('falls back to 30 minutes for empty string', () => {
    expect(parseRateLimitDuration('')).toBe(30 * 60_000);
  });
});

// ─── computeRateLimitDelay ───────────────────────────────────────────────────

describe('computeRateLimitDelay', () => {
  const nowMs = new Date('2026-06-01T12:00:00.000Z').getTime();

  it('anchors to comment timestamp when available', () => {
    // Comment was posted 10 seconds ago, duration = 1 hour
    const commentedAt = new Date(nowMs - 10_000).toISOString();
    const delay = computeRateLimitDelay('Try again in 1 hour', commentedAt, nowMs);
    // Expected: (commentedAt + 1h - nowMs) / 1000 + 60s buffer
    // = (nowMs - 10s + 1h - nowMs) / 1000 + 60 = (3600000 - 10000)/1000 + 60 = 3590 + 60 = 3650
    expect(delay).toBe(3650);
  });

  it('anchors to now when no commentedAt provided', () => {
    const delay = computeRateLimitDelay('Try again in 1 hour', null, nowMs);
    // = (nowMs + 1h - nowMs) / 1000 + 60 = 3600 + 60 = 3660
    expect(delay).toBe(3660);
  });

  it('anchors to now when commentedAt is invalid', () => {
    const delay = computeRateLimitDelay('Try again in 1 hour', 'bad-date', nowMs);
    expect(delay).toBe(3660);
  });

  it('returns minimum of 30s when duration already elapsed', () => {
    // Comment was 2 hours ago, but duration was only 1 hour (already past)
    const commentedAt = new Date(nowMs - 2 * 3_600_000).toISOString();
    const delay = computeRateLimitDelay('Try again in 1 hour', commentedAt, nowMs);
    expect(delay).toBe(30 + 60); // Math.max(30, ...) + 60
  });

  it('always adds 60s safety buffer', () => {
    const delay = computeRateLimitDelay('Try again in 30 minutes', null, nowMs);
    const rawMs = 30 * 60_000;
    const expectedRaw = Math.ceil(rawMs / 1_000);
    expect(delay).toBe(expectedRaw + 60);
  });
});

// ─── parseActionableCount ────────────────────────────────────────────────────

describe('parseActionableCount', () => {
  it('parses count from CR review body', () => {
    expect(parseActionableCount('**Actionable comments posted: 5**')).toBe(5);
  });

  it('returns 0 when no match', () => {
    expect(parseActionableCount('No comments here')).toBe(0);
  });

  it('handles null/undefined', () => {
    expect(parseActionableCount(null)).toBe(0);
    expect(parseActionableCount(undefined)).toBe(0);
  });

  it('is case-insensitive', () => {
    expect(parseActionableCount('actionable comments posted: 3')).toBe(3);
  });
});

// ─── parseNitpickCount ───────────────────────────────────────────────────────

describe('parseNitpickCount', () => {
  it('parses count from CR review body', () => {
    expect(parseNitpickCount('Nitpick comments (4)')).toBe(4);
  });

  it('returns 0 when no match', () => {
    expect(parseNitpickCount('Nothing here')).toBe(0);
  });

  it('handles null/undefined', () => {
    expect(parseNitpickCount(null)).toBe(0);
    expect(parseNitpickCount(undefined)).toBe(0);
  });
});

// ─── getCheckedLabel ─────────────────────────────────────────────────────────

describe('getCheckedLabel', () => {
  it('returns all unchecked when no checkbox checked', () => {
    const body = '- [ ] 🔴 Priority\n- [ ] 🟡 Normal\n- [ ] ⬜ Backburner';
    const result = getCheckedLabel(body);
    expect(result).not.toContain('[x]');
  });

  it('preserves priority checkbox selection', () => {
    const body = '- [x] 🔴 Priority review _(skips to front)_';
    const result = getCheckedLabel(body);
    expect(result).toContain('- [x] 🔴');
    expect(result).toContain('- [ ] 🟡');
    expect(result).toContain('- [ ] ⬜');
  });

  it('preserves normal checkbox selection', () => {
    const body = '- [x] 🟡 Normal review _(standard queue)_';
    const result = getCheckedLabel(body);
    expect(result).toContain('- [ ] 🔴');
    expect(result).toContain('- [x] 🟡');
    expect(result).toContain('- [ ] ⬜');
  });

  it('preserves backburner checkbox selection', () => {
    const body = '- [x] ⬜ Backburner review _(triggers only when bucket is full)_';
    const result = getCheckedLabel(body);
    expect(result).toContain('- [ ] 🔴');
    expect(result).toContain('- [ ] 🟡');
    expect(result).toContain('- [x] ⬜');
  });

  it('handles null/undefined gracefully', () => {
    const result = getCheckedLabel(null);
    expect(result).not.toContain('[x]');
  });
});

// ─── getPriorityFromCheckbox ─────────────────────────────────────────────────

describe('getPriorityFromCheckbox', () => {
  it('returns "priority" for 🔴 checked', () => {
    expect(getPriorityFromCheckbox('- [x] 🔴 Priority review')).toBe('priority');
  });

  it('returns "normal" for 🟡 checked', () => {
    expect(getPriorityFromCheckbox('- [x] 🟡 Normal review')).toBe('normal');
  });

  it('returns "backburner" for ⬜ checked', () => {
    expect(getPriorityFromCheckbox('- [x] ⬜ Backburner review')).toBe('backburner');
  });

  it('returns "normal" for legacy "Full review" checkbox (backward compat)', () => {
    expect(getPriorityFromCheckbox('- [x] Full review')).toBe('normal');
  });

  it('returns null when no checkbox checked', () => {
    expect(getPriorityFromCheckbox('- [ ] 🔴\n- [ ] 🟡\n- [ ] ⬜')).toBeNull();
  });

  it('returns null for empty/null body', () => {
    expect(getPriorityFromCheckbox(null)).toBeNull();
    expect(getPriorityFromCheckbox('')).toBeNull();
  });
});

// ─── labelToStatus ───────────────────────────────────────────────────────────

describe('labelToStatus', () => {
  it('maps complete → success', () => {
    const r = labelToStatus(['coderabbit: complete', 'enhancement']);
    expect(r.state).toBe('success');
    expect(r.description).toContain('passed');
  });

  it('maps unresolved → failure', () => {
    const r = labelToStatus(['coderabbit: unresolved']);
    expect(r.state).toBe('failure');
    expect(r.description).toContain('open comments');
  });

  it('maps rate-limited → pending', () => {
    const r = labelToStatus(['coderabbit: rate-limited']);
    expect(r.state).toBe('pending');
    expect(r.description).toContain('rate-limited');
  });

  it('maps waiting → pending', () => {
    const r = labelToStatus(['coderabbit: waiting']);
    expect(r.state).toBe('pending');
    expect(r.description).toContain('in progress');
  });

  it('maps not started → pending (default)', () => {
    const r = labelToStatus(['coderabbit: not started']);
    expect(r.state).toBe('pending');
    expect(r.description).toContain('not yet requested');
  });

  it('returns pending for unrecognized label set', () => {
    const r = labelToStatus(['bug', 'enhancement']);
    expect(r.state).toBe('pending');
  });

  it('prefers complete over other labels', () => {
    const r = labelToStatus(['coderabbit: complete', 'coderabbit: waiting']);
    expect(r.state).toBe('success');
  });
});
