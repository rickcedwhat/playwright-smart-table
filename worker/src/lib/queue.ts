import type { QueueState, QueuedPR, QueueLevel } from './types.js';

export const MAX_TOKENS = 1;

const DEFAULT_STATE: QueueState = {
  tokens: MAX_TOKENS,
  last_decremented_at: '',
  refill_qstash_id: '',
  refill_at: '',
  priority: [],
  normal: [],
  backburner: [],
  reviews_this_session: 0,
};

/**
 * Parses the <!-- cr-queue-state ... --> block from the Queue Issue body.
 * Returns safe default state if block is missing or malformed.
 */
export function parseQueueState(issueBody: string | null | undefined): QueueState {
  const body = issueBody ?? '';
  const m = body.match(/<!-- cr-queue-state\n([\s\S]*?)\n-->/);
  if (!m) return { ...DEFAULT_STATE };

  const block = m[1];
  try {
    const get = (key: string): string | null => {
      const line = block.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
      if (!line) return null;
      const val = line[1].trim();
      // '-' is the empty placeholder used by serializeQueueState
      return val === '-' ? '' : val;
    };

    const tokensRaw = get('tokens');
    const tokens = tokensRaw !== null ? parseInt(tokensRaw, 10) : MAX_TOKENS;

    const parseArr = (key: string): QueuedPR[] => {
      const raw = get(key);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    const reviewsRaw = get('reviews_this_session');
    const reviews_this_session = reviewsRaw !== null ? parseInt(reviewsRaw, 10) : 0;

    return {
      tokens: isNaN(tokens) ? MAX_TOKENS : Math.min(MAX_TOKENS, Math.max(0, tokens)),
      last_decremented_at: get('last_decremented_at') ?? '',
      refill_qstash_id: get('refill_qstash_id') ?? '',
      refill_at: (() => {
        const v = get('refill_at') ?? '';
        try { if (v) new Date(v).toISOString(); return v; } catch { return ''; }
      })(),
      priority: parseArr('priority'),
      normal: parseArr('normal'),
      backburner: parseArr('backburner'),
      reviews_this_session: isNaN(reviews_this_session) ? 0 : Math.max(0, reviews_this_session),
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/**
 * Regenerates the full Queue Issue body with machine-readable state block
 * AND human-readable markdown tables.
 */
export function serializeQueueState(
  state: QueueState,
  { inReview = 0, unresolved = 0 }: { inReview?: number; unresolved?: number } = {},
  liveItems: Array<{ pr: number; title: string; status: string; updated: string }> = [],
): string {
  const nowMs = Date.now();

  const pad = (v: string | number | null | undefined): string =>
    (v === '' || v == null || v === '-' || (typeof v === 'string' && v.trim() === '')) ? '-' : String(v);

  const stateBlock = [
    '<!-- cr-queue-state',
    `tokens: ${state.tokens}`,
    `last_decremented_at: ${pad(state.last_decremented_at)}`,
    `refill_qstash_id: ${pad(state.refill_qstash_id)}`,
    `refill_at: ${pad(state.refill_at)}`,
    `priority: ${JSON.stringify(state.priority)}`,
    `normal: ${JSON.stringify(state.normal)}`,
    `backburner: ${JSON.stringify(state.backburner)}`,
    `reviews_this_session: ${state.reviews_this_session || 0}`,
    '-->',
  ].join('\n');

  let nextRefillStr = '';
  if (state.refill_at) {
    try {
      const refillMs = new Date(state.refill_at).getTime();
      const diffMs = refillMs - nowMs;
      if (diffMs > 0) {
        const refillHHMM = new Date(refillMs).toISOString().slice(11, 16);
        nextRefillStr = `· Next refill: ~${refillHHMM} UTC`;
      }
    } catch { /* ignore */ }
  }
  const qstashStr = state.refill_qstash_id
    ? `· QStash: \`${state.refill_qstash_id}\``
    : '';
  const bucketLine = `🪣 **Token bucket: ${state.tokens} / ${MAX_TOKENS}** ${nextRefillStr} ${qstashStr}`.trim();

  const queuedCount = state.priority.length + state.normal.length + state.backburner.length;
  const statsLine = `📊 ${queuedCount} queued · ${inReview} in review · ${unresolved} unresolved · ${state.reviews_this_session || 0} reviews this session`;

  const safeTitle = (t: string | undefined): string => String(t ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|');

  const LEVEL_ICON: Record<QueueLevel, string> = {
    priority: '🔴 Priority',
    normal: '🟡 Normal',
    backburner: '⬜ Backburner',
  };

  const buildQueueTable = (): string => {
    const lines = ['### 📋 Review Queue'];
    lines.push('| Level | PR | Title | Queued |');
    lines.push('|---|---|---|---|');
    const allQueued = [
      ...state.priority.map(item => ({ ...item, level: 'priority' as QueueLevel })),
      ...state.normal.map(item => ({ ...item, level: 'normal' as QueueLevel })),
      ...state.backburner.map(item => ({ ...item, level: 'backburner' as QueueLevel })),
    ];
    if (allQueued.length === 0) {
      lines.push('| — | _empty_ | — | — |');
    } else {
      for (const item of allQueued) {
        lines.push(`| ${LEVEL_ICON[item.level]} | #${item.pr} | ${safeTitle(item.title)} | ${formatRelativeTime(item.queued_at, nowMs)} |`);
      }
    }
    return lines.join('\n');
  };

  const STATUS_ICON: Record<string, string> = {
    'coderabbit: waiting':     '⏳ Waiting',
    'coderabbit: unresolved':  '❌ Unresolved',
    'coderabbit: complete':    '✅ Complete',
    'coderabbit: not started': '🔲 Not started',
  };

  const STATUS_ORDER: Record<string, number> = {
    'coderabbit: waiting':     0,
    'coderabbit: unresolved':  1,
    'coderabbit: complete':    2,
    'coderabbit: not started': 3,
  };

  const THREE_DAYS_MS = 3 * 86_400_000;

  const buildLiveTable = (items: typeof liveItems): string | null => {
    if (!items || items.length === 0) return null;
    const sorted = [...items].sort((a, b) => {
      const ao = STATUS_ORDER[a.status] ?? 99;
      const bo = STATUS_ORDER[b.status] ?? 99;
      return ao - bo;
    });
    const lines = ['### 🔍 Active PRs'];
    lines.push('| Status | PR | Title | Updated |');
    lines.push('|---|---|---|---|');
    for (const item of sorted) {
      let icon = STATUS_ICON[item.status] ?? item.status;
      if (item.status === 'coderabbit: unresolved' && item.updated) {
        const updMs = new Date(item.updated).getTime();
        if (!isNaN(updMs) && (nowMs - updMs) > THREE_DAYS_MS) {
          icon = `⚠️ Unresolved`;
        }
      }
      lines.push(`| ${icon} | #${item.pr} | ${safeTitle(item.title)} | ${formatRelativeTime(item.updated, nowMs)} |`);
    }
    return lines.join('\n');
  };

  const liveTable = buildLiveTable(liveItems);

  const parts = [
    stateBlock,
    '',
    '## 🐰 CodeRabbit Review Queue',
    bucketLine,
    statsLine,
    '',
    buildQueueTable(),
  ];

  if (liveTable) {
    parts.push('', liveTable);
  }

  return parts.join('\n');
}

/**
 * Lazy bucket refill: min(3, stored_tokens + floor((nowMs - lastDecrMs) / 3600000))
 * Returns updated state with recalculated tokens. Does NOT mutate input.
 */
export function computeActualTokens(
  state: Pick<QueueState, 'tokens' | 'last_decremented_at'> & Partial<QueueState>,
  nowMs: number,
): QueueState {
  if (!state.last_decremented_at) return { ...DEFAULT_STATE, ...state } as QueueState;
  const lastDecrMs = new Date(state.last_decremented_at).getTime();
  if (isNaN(lastDecrMs)) return { ...DEFAULT_STATE, ...state } as QueueState;
  const hoursElapsed = Math.max(0, Math.floor((nowMs - lastDecrMs) / 3_600_000));
  const actualTokens = Math.min(MAX_TOKENS, state.tokens + hoursElapsed);
  return { ...DEFAULT_STATE, ...state, tokens: actualTokens } as QueueState;
}

/**
 * Priority selection:
 *   1. First item in priority[]
 *   2. First item in normal[]
 *   3. First item in backburner[] — ONLY if state.tokens === MAX_TOKENS
 *   4. null (nothing to trigger)
 */
export function pickNextPR(
  state: QueueState,
): (QueuedPR & { level: QueueLevel }) | null {
  if (state.priority.length > 0)
    return { ...state.priority[0], level: 'priority' };
  if (state.normal.length > 0)
    return { ...state.normal[0], level: 'normal' };
  if (state.backburner.length > 0 && state.tokens === MAX_TOKENS)
    return { ...state.backburner[0], level: 'backburner' };
  return null;
}

/**
 * Add a PR to the appropriate queue.
 * priority → unshift (front); normal/backburner → push (back)
 * Idempotent: does not add if PR is already in ANY queue.
 */
export function enqueue(
  state: QueueState,
  prInfo: QueuedPR,
  level: QueueLevel,
): QueueState {
  const inAny = [...state.priority, ...state.normal, ...state.backburner]
    .some(item => item.pr === prInfo.pr);
  if (inAny) return { ...state };

  const newState: QueueState = {
    ...state,
    priority: [...state.priority],
    normal: [...state.normal],
    backburner: [...state.backburner],
  };

  if (level === 'priority') {
    newState.priority.unshift(prInfo);
  } else if (level === 'normal') {
    newState.normal.push(prInfo);
  } else {
    newState.backburner.push(prInfo);
  }

  return newState;
}

/**
 * Remove a PR from all queues by pr number. Returns updated state.
 */
export function dequeue(state: QueueState, prNumber: number): QueueState {
  return {
    ...state,
    priority: state.priority.filter(item => item.pr !== prNumber),
    normal: state.normal.filter(item => item.pr !== prNumber),
    backburner: state.backburner.filter(item => item.pr !== prNumber),
  };
}

/**
 * Returns position info for a PR in the queues, or null if not found.
 */
export function findPRInQueues(
  state: QueueState,
  prNumber: number,
): { level: QueueLevel; position: number; total: number } | null {
  const queues: Array<{ level: QueueLevel; items: QueuedPR[] }> = [
    { level: 'priority', items: state.priority },
    { level: 'normal', items: state.normal },
    { level: 'backburner', items: state.backburner },
  ];
  for (const { level, items } of queues) {
    const idx = items.findIndex(item => item.pr === prNumber);
    if (idx !== -1) {
      return { level, position: idx + 1, total: items.length };
    }
  }
  return null;
}

/**
 * Returns human-readable relative time.
 */
export function formatRelativeTime(isoString: string, nowMs: number): string {
  if (!isoString) return '';
  const ms = new Date(isoString).getTime();
  if (isNaN(ms)) return '';
  const diffMs = nowMs - ms;
  if (diffMs < 60_000) return 'just now';
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMs / 3_600_000);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffMs / 86_400_000);
  return `${diffDays}d ago`;
}

/**
 * Increments reviews_this_session by 1. Does NOT mutate input.
 */
export function incrementReviewsThisSession(
  state: Pick<QueueState, 'reviews_this_session'> & Partial<QueueState>,
): QueueState {
  return { ...DEFAULT_STATE, ...state, reviews_this_session: (state.reviews_this_session || 0) + 1 } as QueueState;
}
