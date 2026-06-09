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
  getPriorityFromCheckbox,
  incrementReviewsThisSession,
} from '../../../.github/scripts/bot-queue.mjs';

// ── helpers ──────────────────────────────────────────────────────────────────

const ISO = '2026-06-09T10:00:00.000Z';
const NOW = new Date(ISO).getTime();

function makePR(pr: number, title = `PR ${pr}`, queued_at = ISO) {
  return { pr, title, queued_at };
}

function makeFullBody(overrides: Partial<{
  tokens: number;
  last_decremented_at: string;
  refill_qstash_id: string;
  refill_at: string;
  priority: object[];
  normal: object[];
  backburner: object[];
  reviews_this_session: number;
}> = {}) {
  const s = {
    tokens: 2,
    last_decremented_at: ISO,
    refill_qstash_id: 'msg_abc123',
    refill_at: new Date(NOW + 3_600_000).toISOString(),
    priority: [makePR(261, 'feat: auth')],
    normal: [makePR(262, 'fix: typo')],
    backburner: [],
    reviews_this_session: 0,
    ...overrides,
  };
  return [
    '<!-- cr-queue-state',
    `tokens: ${s.tokens}`,
    `last_decremented_at: ${s.last_decremented_at}`,
    `refill_qstash_id: ${s.refill_qstash_id}`,
    `refill_at: ${s.refill_at}`,
    `priority: ${JSON.stringify(s.priority)}`,
    `normal: ${JSON.stringify(s.normal)}`,
    `backburner: ${JSON.stringify(s.backburner)}`,
    `reviews_this_session: ${s.reviews_this_session}`,
    '-->',
    'Some body content',
  ].join('\n');
}

// ── parseQueueState ───────────────────────────────────────────────────────────

describe('parseQueueState', () => {
  it('parses a valid full state block', () => {
    const body = makeFullBody();
    const state = parseQueueState(body);
    expect(state.tokens).toBe(2);
    expect(state.last_decremented_at).toBe(ISO);
    expect(state.refill_qstash_id).toBe('msg_abc123');
    expect(state.priority).toHaveLength(1);
    expect(state.priority[0].pr).toBe(261);
    expect(state.normal).toHaveLength(1);
    expect(state.backburner).toHaveLength(0);
  });

  it('parses empty queues', () => {
    const body = makeFullBody({ priority: [], normal: [], backburner: [] });
    const state = parseQueueState(body);
    expect(state.priority).toEqual([]);
    expect(state.normal).toEqual([]);
    expect(state.backburner).toEqual([]);
  });

  it('returns safe defaults when block is missing', () => {
    const state = parseQueueState('No state block here');
    expect(state.tokens).toBe(3);
    expect(state.priority).toEqual([]);
    expect(state.normal).toEqual([]);
    expect(state.backburner).toEqual([]);
    expect(state.refill_qstash_id).toBe('');
  });

  it('returns safe defaults for null/undefined', () => {
    expect(parseQueueState(null).tokens).toBe(3);
    expect(parseQueueState(undefined).tokens).toBe(3);
  });

  it('returns safe defaults for malformed JSON in arrays', () => {
    const body = [
      '<!-- cr-queue-state',
      'tokens: 1',
      'last_decremented_at: ',
      'refill_qstash_id: ',
      'refill_at: ',
      'priority: not-valid-json',
      'normal: []',
      'backburner: []',
      '-->',
    ].join('\n');
    const state = parseQueueState(body);
    expect(state.priority).toEqual([]);
    expect(state.normal).toEqual([]);
  });

  it('clamps tokens to [0, 3]', () => {
    const body = makeFullBody({ tokens: 99 });
    const state = parseQueueState(body);
    expect(state.tokens).toBe(3);

    const body2 = makeFullBody({ tokens: -1 });
    const state2 = parseQueueState(body2);
    expect(state2.tokens).toBe(0);
  });
});

// ── serializeQueueState ───────────────────────────────────────────────────────

describe('serializeQueueState', () => {
  it('round-trips through parse→serialize→parse', () => {
    const originalBody = makeFullBody();
    const state1 = parseQueueState(originalBody);
    const serialized = serializeQueueState(state1);
    const state2 = parseQueueState(serialized);
    expect(state2.tokens).toBe(state1.tokens);
    expect(state2.last_decremented_at).toBe(state1.last_decremented_at);
    expect(state2.refill_qstash_id).toBe(state1.refill_qstash_id);
    expect(state2.priority).toEqual(state1.priority);
    expect(state2.normal).toEqual(state1.normal);
    expect(state2.backburner).toEqual(state1.backburner);
  });

  it('shows _empty_ rows for empty queues', () => {
    const state = { tokens: 3, last_decremented_at: '', refill_qstash_id: '',
                    refill_at: '', priority: [], normal: [], backburner: [] };
    const body = serializeQueueState(state);
    expect(body).toContain('_empty_');
  });

  it('shows correct token count in bucket line', () => {
    const state = { tokens: 1, last_decremented_at: '', refill_qstash_id: '',
                    refill_at: '', priority: [], normal: [], backburner: [] };
    const body = serializeQueueState(state);
    expect(body).toContain('Token bucket: 1 / 3');
  });

  it('shows refill time in bucket line when refill_at is set', () => {
    const futureIso = new Date(Date.now() + 3_600_000).toISOString();
    const state = { tokens: 2, last_decremented_at: '', refill_qstash_id: 'msg_x',
                    refill_at: futureIso, priority: [], normal: [], backburner: [] };
    const body = serializeQueueState(state);
    expect(body).toContain('Next refill:');
    expect(body).toContain('msg_x');
  });

  it('includes PR entries in the right table sections', () => {
    const state = {
      tokens: 2,
      last_decremented_at: '',
      refill_qstash_id: '',
      refill_at: '',
      priority: [makePR(100, 'priority PR')],
      normal: [makePR(200, 'normal PR')],
      backburner: [makePR(300, 'backburner PR')],
    };
    const body = serializeQueueState(state);
    expect(body).toContain('#100');
    expect(body).toContain('#200');
    expect(body).toContain('#300');
    expect(body).toContain('🔴 Priority');
    expect(body).toContain('🟡 Normal');
    expect(body).toContain('⬜ Backburner');
  });
});

// ── computeActualTokens ───────────────────────────────────────────────────────

describe('computeActualTokens', () => {
  it('no change when no time elapsed', () => {
    const state = { tokens: 1, last_decremented_at: ISO };
    const result = computeActualTokens(state, NOW);
    expect(result.tokens).toBe(1);
  });

  it('+1 token after 1h elapsed', () => {
    const state = { tokens: 1, last_decremented_at: ISO };
    const result = computeActualTokens(state, NOW + 3_600_000);
    expect(result.tokens).toBe(2);
  });

  it('+1 only after full hour (59m → no change)', () => {
    const state = { tokens: 1, last_decremented_at: ISO };
    const result = computeActualTokens(state, NOW + 59 * 60_000);
    expect(result.tokens).toBe(1);
  });

  it('caps at 3 even after many hours', () => {
    const state = { tokens: 1, last_decremented_at: ISO };
    const result = computeActualTokens(state, NOW + 10 * 3_600_000);
    expect(result.tokens).toBe(3);
  });

  it('stays at 3 when already full', () => {
    const state = { tokens: 3, last_decremented_at: ISO };
    const result = computeActualTokens(state, NOW + 3_600_000);
    expect(result.tokens).toBe(3);
  });

  it('does not mutate input', () => {
    const state = { tokens: 1, last_decremented_at: ISO };
    computeActualTokens(state, NOW + 3_600_000);
    expect(state.tokens).toBe(1);
  });

  it('no change when last_decremented_at is empty', () => {
    const state = { tokens: 2, last_decremented_at: '' };
    const result = computeActualTokens(state, NOW + 5 * 3_600_000);
    expect(result.tokens).toBe(2);
  });
});

// ── pickNextPR ────────────────────────────────────────────────────────────────

describe('pickNextPR', () => {
  it('priority wins over normal and backburner', () => {
    const state = {
      tokens: 3,
      priority: [makePR(1)],
      normal: [makePR(2)],
      backburner: [makePR(3)],
    };
    const result = pickNextPR(state);
    expect(result?.pr).toBe(1);
    expect(result?.level).toBe('priority');
  });

  it('normal wins when priority empty', () => {
    const state = { tokens: 3, priority: [], normal: [makePR(2)], backburner: [makePR(3)] };
    const result = pickNextPR(state);
    expect(result?.pr).toBe(2);
    expect(result?.level).toBe('normal');
  });

  it('backburner triggers only when tokens===3', () => {
    const state = { tokens: 3, priority: [], normal: [], backburner: [makePR(3)] };
    const result = pickNextPR(state);
    expect(result?.pr).toBe(3);
    expect(result?.level).toBe('backburner');
  });

  it('backburner does NOT trigger when tokens < 3', () => {
    const state = { tokens: 2, priority: [], normal: [], backburner: [makePR(3)] };
    expect(pickNextPR(state)).toBeNull();
  });

  it('returns null when all queues empty', () => {
    const state = { tokens: 3, priority: [], normal: [], backburner: [] };
    expect(pickNextPR(state)).toBeNull();
  });

  it('selects normal PR regardless of token count (coordinator gates on tokens, not pickNextPR)', () => {
    // pickNextPR only gates on tokens===3 for backburner; priority/normal are
    // always selectable — the coordinator is responsible for checking tokens first.
    const state = { tokens: 0, priority: [], normal: [makePR(1)], backburner: [] };
    const result = pickNextPR(state);
    expect(result?.pr).toBe(1);
  });
});

// ── enqueue ───────────────────────────────────────────────────────────────────

describe('enqueue', () => {
  const emptyState = { tokens: 3, priority: [] as any[], normal: [] as any[], backburner: [] as any[] };

  it('inserts priority PR at the front', () => {
    let state = enqueue(emptyState, makePR(1), 'priority');
    state = enqueue(state, makePR(2), 'priority');
    expect(state.priority[0].pr).toBe(2); // newest at front
    expect(state.priority[1].pr).toBe(1);
  });

  it('appends normal PR at the back', () => {
    let state = enqueue(emptyState, makePR(1), 'normal');
    state = enqueue(state, makePR(2), 'normal');
    expect(state.normal[0].pr).toBe(1); // oldest first
    expect(state.normal[1].pr).toBe(2);
  });

  it('appends backburner PR at the back', () => {
    let state = enqueue(emptyState, makePR(1), 'backburner');
    state = enqueue(state, makePR(2), 'backburner');
    expect(state.backburner[0].pr).toBe(1);
    expect(state.backburner[1].pr).toBe(2);
  });

  it('is idempotent — does not add duplicate if PR already in queue', () => {
    let state = enqueue(emptyState, makePR(1), 'normal');
    state = enqueue(state, makePR(1), 'normal');
    expect(state.normal).toHaveLength(1);
  });

  it('does not add if PR already in a different queue', () => {
    let state = enqueue(emptyState, makePR(1), 'priority');
    state = enqueue(state, makePR(1), 'normal');
    expect(state.priority).toHaveLength(1);
    expect(state.normal).toHaveLength(0);
  });

  it('does not mutate input state', () => {
    const original = { ...emptyState, normal: [] };
    enqueue(original, makePR(1), 'normal');
    expect(original.normal).toHaveLength(0);
  });
});

// ── dequeue ───────────────────────────────────────────────────────────────────

describe('dequeue', () => {
  it('removes PR from priority queue', () => {
    const state = { tokens: 3, priority: [makePR(1)], normal: [], backburner: [] };
    const result = dequeue(state, 1);
    expect(result.priority).toHaveLength(0);
  });

  it('removes PR from normal queue', () => {
    const state = { tokens: 3, priority: [], normal: [makePR(2)], backburner: [] };
    const result = dequeue(state, 2);
    expect(result.normal).toHaveLength(0);
  });

  it('removes PR from backburner queue', () => {
    const state = { tokens: 3, priority: [], normal: [], backburner: [makePR(3)] };
    const result = dequeue(state, 3);
    expect(result.backburner).toHaveLength(0);
  });

  it('no-op when PR not found', () => {
    const state = { tokens: 3, priority: [makePR(1)], normal: [makePR(2)], backburner: [] };
    const result = dequeue(state, 999);
    expect(result.priority).toHaveLength(1);
    expect(result.normal).toHaveLength(1);
  });

  it('does not mutate input', () => {
    const state = { tokens: 3, priority: [makePR(1)], normal: [], backburner: [] };
    dequeue(state, 1);
    expect(state.priority).toHaveLength(1);
  });
});

// ── findPRInQueues ────────────────────────────────────────────────────────────

describe('findPRInQueues', () => {
  it('finds PR in priority queue', () => {
    const state = { priority: [makePR(1), makePR(2)], normal: [], backburner: [] };
    const result = findPRInQueues(state, 1);
    expect(result).toEqual({ level: 'priority', position: 1, total: 2 });
  });

  it('finds PR at position 2 in normal queue', () => {
    const state = { priority: [], normal: [makePR(1), makePR(2)], backburner: [] };
    const result = findPRInQueues(state, 2);
    expect(result).toEqual({ level: 'normal', position: 2, total: 2 });
  });

  it('finds PR in backburner queue', () => {
    const state = { priority: [], normal: [], backburner: [makePR(5)] };
    const result = findPRInQueues(state, 5);
    expect(result).toEqual({ level: 'backburner', position: 1, total: 1 });
  });

  it('returns null when PR not in any queue', () => {
    const state = { priority: [makePR(1)], normal: [], backburner: [] };
    expect(findPRInQueues(state, 999)).toBeNull();
  });

  it('returns null for empty queues', () => {
    const state = { priority: [], normal: [], backburner: [] };
    expect(findPRInQueues(state, 1)).toBeNull();
  });
});

// ── formatRelativeTime ────────────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  it('"just now" for < 60s', () => {
    const iso = new Date(NOW - 30_000).toISOString();
    expect(formatRelativeTime(iso, NOW)).toBe('just now');
  });

  it('"5m ago" for 5 minutes', () => {
    const iso = new Date(NOW - 5 * 60_000).toISOString();
    expect(formatRelativeTime(iso, NOW)).toBe('5m ago');
  });

  it('"2h ago" for 2 hours', () => {
    const iso = new Date(NOW - 2 * 3_600_000).toISOString();
    expect(formatRelativeTime(iso, NOW)).toBe('2h ago');
  });

  it('"3d ago" for 3 days', () => {
    const iso = new Date(NOW - 3 * 86_400_000).toISOString();
    expect(formatRelativeTime(iso, NOW)).toBe('3d ago');
  });

  it('"59m ago" just before the hour boundary', () => {
    const iso = new Date(NOW - 59 * 60_000).toISOString();
    expect(formatRelativeTime(iso, NOW)).toBe('59m ago');
  });

  it('returns empty string for empty input', () => {
    expect(formatRelativeTime('', NOW)).toBe('');
  });

  it('returns empty string for invalid ISO', () => {
    expect(formatRelativeTime('not-a-date', NOW)).toBe('');
  });
});

// ── getPriorityFromCheckbox ───────────────────────────────────────────────────

describe('getPriorityFromCheckbox', () => {
  it('detects 🔴 checked → priority', () => {
    expect(getPriorityFromCheckbox('- [x] 🔴 Priority review')).toBe('priority');
  });

  it('detects 🟡 checked → normal', () => {
    expect(getPriorityFromCheckbox('- [x] 🟡 Normal review')).toBe('normal');
  });

  it('detects ⬜ checked → backburner', () => {
    expect(getPriorityFromCheckbox('- [x] ⬜ Backburner review')).toBe('backburner');
  });

  it('falls back to Full review → normal (backward compat)', () => {
    expect(getPriorityFromCheckbox('- [x] Full review\n- [ ] Incremental review')).toBe('normal');
  });

  it('returns null when nothing checked', () => {
    expect(getPriorityFromCheckbox(
      '- [ ] 🔴 Priority review\n- [ ] 🟡 Normal review\n- [ ] ⬜ Backburner review'
    )).toBeNull();
  });

  it('returns null for old-style unchecked Full review', () => {
    expect(getPriorityFromCheckbox('- [ ] Full review\n- [ ] Incremental review')).toBeNull();
  });

  it('handles null/undefined gracefully', () => {
    expect(getPriorityFromCheckbox(null)).toBeNull();
    expect(getPriorityFromCheckbox(undefined)).toBeNull();
  });

  it('ignores unchecked emoji boxes even with checked Incremental review', () => {
    const body = '- [ ] 🔴 Priority review\n- [ ] 🟡 Normal review\n- [ ] ⬜ Backburner review\n- [x] Incremental review';
    // Incremental review is not a priority checkbox, so returns null (no priority/normal/backburner checkbox checked)
    expect(getPriorityFromCheckbox(body)).toBeNull();
  });
});

// ── parseQueueState — reviews_this_session ────────────────────────────────────

describe('parseQueueState — reviews_this_session', () => {
  it('reads reviews_this_session correctly when present', () => {
    const body = makeFullBody({ reviews_this_session: 7 });
    const state = parseQueueState(body);
    expect(state.reviews_this_session).toBe(7);
  });

  it('defaults to 0 when reviews_this_session is missing from block', () => {
    // Build a body without reviews_this_session line
    const body = [
      '<!-- cr-queue-state',
      'tokens: 2',
      'last_decremented_at: -',
      'refill_qstash_id: -',
      'refill_at: -',
      'priority: []',
      'normal: []',
      'backburner: []',
      '-->',
    ].join('\n');
    const state = parseQueueState(body);
    expect(state.reviews_this_session).toBe(0);
  });

  it('defaults to 0 when block is missing entirely', () => {
    const state = parseQueueState('no state block');
    expect(state.reviews_this_session).toBe(0);
  });
});

// ── serializeQueueState — stats line ─────────────────────────────────────────

describe('serializeQueueState — stats line', () => {
  it('includes stats line with correct queued count', () => {
    const state = {
      tokens: 2,
      last_decremented_at: '',
      refill_qstash_id: '',
      refill_at: '',
      priority: [makePR(1)],
      normal: [makePR(2), makePR(3)],
      backburner: [],
      reviews_this_session: 5,
    };
    const body = serializeQueueState(state);
    // 3 queued total (1 priority + 2 normal + 0 backburner)
    expect(body).toContain('3 queued');
    expect(body).toContain('5 reviews this session');
  });

  it('includes inReview and unresolved counts when passed', () => {
    const state = {
      tokens: 1,
      last_decremented_at: '',
      refill_qstash_id: '',
      refill_at: '',
      priority: [],
      normal: [],
      backburner: [],
      reviews_this_session: 0,
    };
    const body = serializeQueueState(state, { inReview: 2, unresolved: 3 });
    expect(body).toContain('2 in review');
    expect(body).toContain('3 unresolved');
  });

  it('defaults inReview and unresolved to 0 when second arg omitted', () => {
    const state = {
      tokens: 3,
      last_decremented_at: '',
      refill_qstash_id: '',
      refill_at: '',
      priority: [],
      normal: [],
      backburner: [],
      reviews_this_session: 0,
    };
    const body = serializeQueueState(state);
    expect(body).toContain('0 in review');
    expect(body).toContain('0 unresolved');
  });

  it('round-trips reviews_this_session through parse→serialize→parse', () => {
    const state = {
      tokens: 2,
      last_decremented_at: ISO,
      refill_qstash_id: 'msg_x',
      refill_at: new Date(NOW + 3_600_000).toISOString(),
      priority: [makePR(1)],
      normal: [],
      backburner: [],
      reviews_this_session: 12,
    };
    const serialized = serializeQueueState(state);
    const parsed = parseQueueState(serialized);
    expect(parsed.reviews_this_session).toBe(12);
  });
});

// ── incrementReviewsThisSession ───────────────────────────────────────────────

describe('incrementReviewsThisSession', () => {
  it('increments from 0 to 1', () => {
    const state = { reviews_this_session: 0 };
    const result = incrementReviewsThisSession(state);
    expect(result.reviews_this_session).toBe(1);
  });

  it('increments from N to N+1', () => {
    const state = { reviews_this_session: 5 };
    const result = incrementReviewsThisSession(state);
    expect(result.reviews_this_session).toBe(6);
  });

  it('treats missing reviews_this_session as 0', () => {
    const state = {};
    const result = incrementReviewsThisSession(state);
    expect(result.reviews_this_session).toBe(1);
  });

  it('does not mutate input state', () => {
    const state = { reviews_this_session: 3 };
    incrementReviewsThisSession(state);
    expect(state.reviews_this_session).toBe(3);
  });
});
