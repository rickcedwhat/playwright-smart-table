import { describe, it, expect } from 'vitest';
import {
  parseQueueState,
  serializeQueueState,
  computeActualTokens,
  pickNextPR,
  enqueue,
  dequeue,
  findPRInQueues,
  formatRelativeTime,
  incrementReviewsThisSession,
  MAX_TOKENS,
} from '../src/lib/queue.js';
import type { QueueState } from '../src/lib/types.js';

// ─── helpers ────────────────────────────────────────────────────────────────

const EMPTY_STATE: QueueState = {
  tokens: MAX_TOKENS,
  last_decremented_at: '',
  refill_qstash_id: '',
  refill_at: '',
  priority: [],
  normal: [],
  backburner: [],
  reviews_this_session: 0,
};

function qpr(pr: number, title = `PR ${pr}`, queued_at = '2026-06-01T00:00:00.000Z') {
  return { pr, title, queued_at };
}

// ─── parseQueueState ─────────────────────────────────────────────────────────

describe('parseQueueState', () => {
  it('returns default state when body is null', () => {
    const s = parseQueueState(null);
    expect(s.tokens).toBe(MAX_TOKENS);
    expect(s.priority).toEqual([]);
    expect(s.normal).toEqual([]);
    expect(s.backburner).toEqual([]);
  });

  it('returns default state when body is undefined', () => {
    expect(parseQueueState(undefined).tokens).toBe(MAX_TOKENS);
  });

  it('returns default state when no state block present', () => {
    expect(parseQueueState('## Some issue body\nno block here').tokens).toBe(MAX_TOKENS);
  });

  it('parses tokens correctly', () => {
    const body = `<!-- cr-queue-state\ntokens: 1\nlast_decremented_at: -\nrefill_qstash_id: -\nrefill_at: -\npriority: []\nnormal: []\nbackburner: []\nreviews_this_session: 0\n-->`;
    expect(parseQueueState(body).tokens).toBe(1);
  });

  it('clamps tokens to [0, MAX_TOKENS]', () => {
    const make = (t: number) =>
      `<!-- cr-queue-state\ntokens: ${t}\nlast_decremented_at: -\nrefill_qstash_id: -\nrefill_at: -\npriority: []\nnormal: []\nbackburner: []\nreviews_this_session: 0\n-->`;
    expect(parseQueueState(make(99)).tokens).toBe(MAX_TOKENS);
    expect(parseQueueState(make(-1)).tokens).toBe(0);
  });

  it('parses queued PRs', () => {
    const pr = { pr: 42, title: 'Fix bug', queued_at: '2026-06-01T00:00:00.000Z' };
    const body = `<!-- cr-queue-state\ntokens: 2\nlast_decremented_at: -\nrefill_qstash_id: -\nrefill_at: -\npriority: []\nnormal: ${JSON.stringify([pr])}\nbackburner: []\nreviews_this_session: 3\n-->`;
    const s = parseQueueState(body);
    expect(s.normal).toEqual([pr]);
    expect(s.reviews_this_session).toBe(3);
  });

  it('treats "-" as empty string for string fields', () => {
    const body = `<!-- cr-queue-state\ntokens: 3\nlast_decremented_at: -\nrefill_qstash_id: -\nrefill_at: -\npriority: []\nnormal: []\nbackburner: []\nreviews_this_session: 0\n-->`;
    const s = parseQueueState(body);
    expect(s.last_decremented_at).toBe('');
    expect(s.refill_qstash_id).toBe('');
    expect(s.refill_at).toBe('');
  });

  it('roundtrips: serialize → parse preserves state', () => {
    const original: QueueState = {
      tokens: 1,
      last_decremented_at: '2026-06-01T10:00:00.000Z',
      refill_qstash_id: 'msg_abc',
      refill_at: '2026-06-01T11:00:00.000Z',
      priority: [qpr(10, 'Urgent fix')],
      normal: [qpr(20, 'Feature A'), qpr(21, 'Feature B')],
      backburner: [],
      reviews_this_session: 5,
    };
    const body = serializeQueueState(original);
    const parsed = parseQueueState(body);
    expect(parsed.tokens).toBe(original.tokens);
    expect(parsed.priority).toEqual(original.priority);
    expect(parsed.normal).toEqual(original.normal);
    expect(parsed.reviews_this_session).toBe(original.reviews_this_session);
    expect(parsed.refill_qstash_id).toBe(original.refill_qstash_id);
  });

  it('returns default state on malformed priority JSON', () => {
    const body = `<!-- cr-queue-state\ntokens: 1\nlast_decremented_at: -\nrefill_qstash_id: -\nrefill_at: -\npriority: not-json\nnormal: []\nbackburner: []\nreviews_this_session: 0\n-->`;
    const s = parseQueueState(body);
    expect(s.priority).toEqual([]);
    expect(s.tokens).toBe(1);
  });

  it('ignores invalid refill_at and returns empty string', () => {
    const body = `<!-- cr-queue-state\ntokens: 3\nlast_decremented_at: -\nrefill_qstash_id: -\nrefill_at: not-a-date\npriority: []\nnormal: []\nbackburner: []\nreviews_this_session: 0\n-->`;
    expect(parseQueueState(body).refill_at).toBe('');
  });
});

// ─── serializeQueueState ─────────────────────────────────────────────────────

describe('serializeQueueState', () => {
  it('includes the machine-readable state block', () => {
    const body = serializeQueueState(EMPTY_STATE);
    expect(body).toContain('<!-- cr-queue-state');
    expect(body).toContain(`tokens: ${MAX_TOKENS}`);
    expect(body).toContain('-->');
  });

  it('shows empty queue row when all queues empty', () => {
    const body = serializeQueueState(EMPTY_STATE);
    expect(body).toContain('_empty_');
  });

  it('shows queued PRs in the table', () => {
    const state: QueueState = { ...EMPTY_STATE, normal: [qpr(55, 'My feature')] };
    const body = serializeQueueState(state);
    expect(body).toContain('#55');
    expect(body).toContain('My feature');
    expect(body).toContain('🟡 Normal');
  });

  it('shows stats line', () => {
    const state: QueueState = { ...EMPTY_STATE, normal: [qpr(1), qpr(2)], reviews_this_session: 7 };
    const body = serializeQueueState(state, { inReview: 1, unresolved: 2 });
    expect(body).toContain('2 queued');
    expect(body).toContain('1 in review');
    expect(body).toContain('2 unresolved');
    expect(body).toContain('7 reviews this session');
  });

  it('shows live table when liveItems provided', () => {
    const liveItems = [{ pr: 99, title: 'Live PR', status: 'coderabbit: waiting', updated: '2026-06-01T00:00:00.000Z' }];
    const body = serializeQueueState(EMPTY_STATE, {}, liveItems);
    expect(body).toContain('Active PRs');
    expect(body).toContain('#99');
    expect(body).toContain('⏳ Waiting');
  });

  it('omits live table when liveItems is empty', () => {
    const body = serializeQueueState(EMPTY_STATE, {}, []);
    expect(body).not.toContain('Active PRs');
  });

  it('shows aging warning for unresolved PRs older than 3 days', () => {
    const old = new Date(Date.now() - 4 * 86_400_000).toISOString();
    const liveItems = [{ pr: 7, title: 'Old PR', status: 'coderabbit: unresolved', updated: old }];
    const body = serializeQueueState(EMPTY_STATE, {}, liveItems);
    expect(body).toContain('⚠️ Unresolved');
  });

  it('does NOT show aging warning for unresolved PRs within 3 days', () => {
    const recent = new Date(Date.now() - 1 * 86_400_000).toISOString();
    const liveItems = [{ pr: 8, title: 'Recent PR', status: 'coderabbit: unresolved', updated: recent }];
    const body = serializeQueueState(EMPTY_STATE, {}, liveItems);
    expect(body).not.toContain('⚠️ Unresolved');
    expect(body).toContain('❌ Unresolved');
  });

  it('escapes pipe characters in PR titles', () => {
    const state: QueueState = { ...EMPTY_STATE, normal: [qpr(1, 'feat: A | B')] };
    const body = serializeQueueState(state);
    expect(body).toContain('feat: A \\| B');
  });

  it('shows QStash ID in bucket line', () => {
    const state: QueueState = { ...EMPTY_STATE, refill_qstash_id: 'msg_xyz' };
    const body = serializeQueueState(state);
    expect(body).toContain('QStash: `msg_xyz`');
  });

  it('sorts live items: waiting first, then unresolved, then complete', () => {
    const nowMs = Date.now();
    const upd = new Date(nowMs - 60_000).toISOString();
    const liveItems = [
      { pr: 3, title: 'C', status: 'coderabbit: complete', updated: upd },
      { pr: 1, title: 'U', status: 'coderabbit: unresolved', updated: upd },
      { pr: 2, title: 'W', status: 'coderabbit: waiting', updated: upd },
    ];
    const body = serializeQueueState(EMPTY_STATE, {}, liveItems);
    const waitPos = body.indexOf('#2');
    const unresPos = body.indexOf('#1');
    const complPos = body.indexOf('#3');
    expect(waitPos).toBeLessThan(unresPos);
    expect(unresPos).toBeLessThan(complPos);
  });
});

// ─── computeActualTokens ─────────────────────────────────────────────────────

describe('computeActualTokens', () => {
  it('returns stored tokens unchanged when no last_decremented_at', () => {
    // No decrement has happened yet — trust stored value as-is
    const s = computeActualTokens({ tokens: 1, last_decremented_at: '' }, Date.now());
    expect(s.tokens).toBe(1);
  });

  it('returns stored tokens when not enough time has elapsed', () => {
    const lastDecr = new Date(Date.now() - 30 * 60_000).toISOString(); // 30 min ago
    const s = computeActualTokens({ tokens: 0, last_decremented_at: lastDecr }, Date.now());
    expect(s.tokens).toBe(0);
  });

  it('refills 1 token per hour', () => {
    const lastDecr = new Date(Date.now() - 1 * 3_600_000).toISOString(); // 1 hour ago
    const s = computeActualTokens({ tokens: 0, last_decremented_at: lastDecr }, Date.now());
    expect(s.tokens).toBe(1);
  });

  it('caps tokens at MAX_TOKENS', () => {
    const lastDecr = new Date(Date.now() - 5 * 3_600_000).toISOString(); // 5 hours ago
    const s = computeActualTokens({ tokens: 0, last_decremented_at: lastDecr }, Date.now());
    expect(s.tokens).toBe(MAX_TOKENS);
  });

  it('returns stored tokens unchanged on invalid date', () => {
    const s = computeActualTokens({ tokens: 1, last_decremented_at: 'bad-date' }, Date.now());
    expect(s.tokens).toBe(1);
  });
});

// ─── pickNextPR ──────────────────────────────────────────────────────────────

describe('pickNextPR', () => {
  it('returns null when all queues empty', () => {
    expect(pickNextPR(EMPTY_STATE)).toBeNull();
  });

  it('picks priority first', () => {
    const s: QueueState = { ...EMPTY_STATE, priority: [qpr(1)], normal: [qpr(2)] };
    const result = pickNextPR(s);
    expect(result?.pr).toBe(1);
    expect(result?.level).toBe('priority');
  });

  it('picks normal when priority empty', () => {
    const s: QueueState = { ...EMPTY_STATE, normal: [qpr(5)], backburner: [qpr(6)] };
    const result = pickNextPR(s);
    expect(result?.pr).toBe(5);
    expect(result?.level).toBe('normal');
  });

  it('picks backburner only when tokens === MAX_TOKENS (bucket full)', () => {
    const full: QueueState = { ...EMPTY_STATE, tokens: MAX_TOKENS, backburner: [qpr(9)] };
    expect(pickNextPR(full)?.pr).toBe(9);

    const empty_tokens: QueueState = { ...EMPTY_STATE, tokens: 0, backburner: [qpr(9)] };
    expect(pickNextPR(empty_tokens)).toBeNull();
  });

  it('returns first item in each queue (FIFO)', () => {
    const s: QueueState = { ...EMPTY_STATE, normal: [qpr(10), qpr(20)] };
    expect(pickNextPR(s)?.pr).toBe(10);
  });
});

// ─── enqueue ─────────────────────────────────────────────────────────────────

describe('enqueue', () => {
  it('adds to normal queue', () => {
    const s = enqueue(EMPTY_STATE, qpr(1), 'normal');
    expect(s.normal).toHaveLength(1);
    expect(s.normal[0].pr).toBe(1);
  });

  it('adds priority to front (unshift)', () => {
    const s0 = enqueue(EMPTY_STATE, qpr(1), 'priority');
    const s1 = enqueue(s0, qpr(2), 'priority');
    expect(s1.priority[0].pr).toBe(2);
    expect(s1.priority[1].pr).toBe(1);
  });

  it('adds normal/backburner to back (push)', () => {
    const s0 = enqueue(EMPTY_STATE, qpr(1), 'normal');
    const s1 = enqueue(s0, qpr(2), 'normal');
    expect(s1.normal[0].pr).toBe(1);
    expect(s1.normal[1].pr).toBe(2);
  });

  it('is idempotent — does not double-enqueue', () => {
    const s0 = enqueue(EMPTY_STATE, qpr(5), 'normal');
    const s1 = enqueue(s0, qpr(5), 'priority'); // already in normal
    expect(s1.normal).toHaveLength(1);
    expect(s1.priority).toHaveLength(0);
  });

  it('does not mutate input state', () => {
    const before = JSON.stringify(EMPTY_STATE);
    enqueue(EMPTY_STATE, qpr(1), 'normal');
    expect(JSON.stringify(EMPTY_STATE)).toBe(before);
  });
});

// ─── dequeue ─────────────────────────────────────────────────────────────────

describe('dequeue', () => {
  it('removes from priority queue', () => {
    const s = { ...EMPTY_STATE, priority: [qpr(1), qpr(2)] };
    expect(dequeue(s, 1).priority).toEqual([qpr(2)]);
  });

  it('removes from normal queue', () => {
    const s = { ...EMPTY_STATE, normal: [qpr(10)] };
    expect(dequeue(s, 10).normal).toEqual([]);
  });

  it('removes from backburner queue', () => {
    const s = { ...EMPTY_STATE, backburner: [qpr(99)] };
    expect(dequeue(s, 99).backburner).toEqual([]);
  });

  it('is a no-op when PR not found', () => {
    const s = { ...EMPTY_STATE, normal: [qpr(5)] };
    expect(dequeue(s, 999).normal).toEqual([qpr(5)]);
  });

  it('does not mutate input state', () => {
    const s = { ...EMPTY_STATE, normal: [qpr(1)] };
    const before = JSON.stringify(s);
    dequeue(s, 1);
    expect(JSON.stringify(s)).toBe(before);
  });
});

// ─── findPRInQueues ──────────────────────────────────────────────────────────

describe('findPRInQueues', () => {
  it('finds PR in priority queue', () => {
    const s: QueueState = { ...EMPTY_STATE, priority: [qpr(1), qpr(2)] };
    const r = findPRInQueues(s, 2);
    expect(r).toEqual({ level: 'priority', position: 2, total: 2 });
  });

  it('finds PR in normal queue', () => {
    const s: QueueState = { ...EMPTY_STATE, normal: [qpr(10), qpr(20)] };
    const r = findPRInQueues(s, 10);
    expect(r).toEqual({ level: 'normal', position: 1, total: 2 });
  });

  it('finds PR in backburner queue', () => {
    const s: QueueState = { ...EMPTY_STATE, backburner: [qpr(7)] };
    expect(findPRInQueues(s, 7)).toEqual({ level: 'backburner', position: 1, total: 1 });
  });

  it('returns null when PR not in any queue', () => {
    expect(findPRInQueues(EMPTY_STATE, 42)).toBeNull();
  });
});

// ─── formatRelativeTime ──────────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  const nowMs = new Date('2026-06-01T12:00:00.000Z').getTime();

  it('returns empty string for empty input', () => {
    expect(formatRelativeTime('', nowMs)).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(formatRelativeTime('not-a-date', nowMs)).toBe('');
  });

  it('returns "just now" for < 1 minute ago', () => {
    const ts = new Date(nowMs - 30_000).toISOString();
    expect(formatRelativeTime(ts, nowMs)).toBe('just now');
  });

  it('returns minutes ago', () => {
    const ts = new Date(nowMs - 45 * 60_000).toISOString();
    expect(formatRelativeTime(ts, nowMs)).toBe('45m ago');
  });

  it('returns hours ago', () => {
    const ts = new Date(nowMs - 5 * 3_600_000).toISOString();
    expect(formatRelativeTime(ts, nowMs)).toBe('5h ago');
  });

  it('returns days ago', () => {
    const ts = new Date(nowMs - 3 * 86_400_000).toISOString();
    expect(formatRelativeTime(ts, nowMs)).toBe('3d ago');
  });
});

// ─── incrementReviewsThisSession ─────────────────────────────────────────────

describe('incrementReviewsThisSession', () => {
  it('increments from 0 to 1', () => {
    expect(incrementReviewsThisSession(EMPTY_STATE).reviews_this_session).toBe(1);
  });

  it('increments from existing count', () => {
    const s = { ...EMPTY_STATE, reviews_this_session: 4 };
    expect(incrementReviewsThisSession(s).reviews_this_session).toBe(5);
  });

  it('does not mutate input', () => {
    const s = { ...EMPTY_STATE, reviews_this_session: 2 };
    incrementReviewsThisSession(s);
    expect(s.reviews_this_session).toBe(2);
  });
});
