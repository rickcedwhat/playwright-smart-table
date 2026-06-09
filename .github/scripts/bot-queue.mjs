/**
 * Pure functions for CodeRabbit review queue management.
 * Imported by coordinator/trigger/watch workflows via dynamic import,
 * and tested by tests/unit/bot/bot-queue.test.ts.
 */

const DEFAULT_STATE = {
  tokens: 3,
  last_decremented_at: '',
  refill_qstash_id: '',
  refill_at: '',
  priority: [],
  normal: [],
  backburner: [],
};

/**
 * Parses the <!-- cr-queue-state ... --> block from the Queue Issue body.
 * Returns safe default state if block is missing or malformed.
 *
 * @param {string|null|undefined} issueBody
 * @returns {{ tokens: number, last_decremented_at: string, refill_qstash_id: string,
 *             refill_at: string, priority: Array, normal: Array, backburner: Array }}
 */
export function parseQueueState(issueBody) {
  const body = issueBody ?? '';
  const m = body.match(/<!-- cr-queue-state\n([\s\S]*?)\n-->/);
  if (!m) return { ...DEFAULT_STATE };

  const block = m[1];
  try {
    const get = (key) => {
      const line = block.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
      if (!line) return null;
      const val = line[1].trim();
      // '-' is the empty placeholder used by serializeQueueState to prevent
      // GitHub from stripping trailing whitespace and corrupting the next line.
      return val === '-' ? '' : val;
    };

    const tokensRaw = get('tokens');
    const tokens = tokensRaw !== null ? parseInt(tokensRaw, 10) : 3;

    const parseArr = (key) => {
      const raw = get(key);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    return {
      tokens: isNaN(tokens) ? 3 : Math.min(3, Math.max(0, tokens)),
      last_decremented_at: get('last_decremented_at') ?? '',
      refill_qstash_id: get('refill_qstash_id') ?? '',
      // Validate refill_at is a real ISO string — discard garbage values that
      // would cause new Date(refill_at).toISOString() to throw RangeError.
      refill_at: (() => { const v = get('refill_at') ?? ''; try { if (v) new Date(v).toISOString(); return v; } catch { return ''; } })(),
      priority: parseArr('priority'),
      normal: parseArr('normal'),
      backburner: parseArr('backburner'),
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/**
 * Regenerates the full Queue Issue body with machine-readable state block
 * AND human-readable markdown tables.
 *
 * @param {{ tokens: number, last_decremented_at: string, refill_qstash_id: string,
 *           refill_at: string, priority: Array, normal: Array, backburner: Array }} state
 * @returns {string}
 */
export function serializeQueueState(state) {
  const nowMs = Date.now();

  // Use '-' for empty string values. GitHub strips trailing whitespace from
  // issue body lines on save, which causes empty values to merge with the next
  // line's key. A non-whitespace placeholder survives the round-trip.
  // The parser treats '-' as empty when reading back.
  const pad = (v) => (v === '' || v == null || v === '-' || (typeof v === 'string' && v.trim() === '')) ? '-' : String(v);
  const stateBlock = [
    '<!-- cr-queue-state',
    `tokens: ${state.tokens}`,
    `last_decremented_at: ${pad(state.last_decremented_at)}`,
    `refill_qstash_id: ${pad(state.refill_qstash_id)}`,
    `refill_at: ${pad(state.refill_at)}`,
    `priority: ${JSON.stringify(state.priority)}`,
    `normal: ${JSON.stringify(state.normal)}`,
    `backburner: ${JSON.stringify(state.backburner)}`,
    '-->',
  ].join('\n');

  // Bucket line
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
  const bucketLine = `🪣 **Token bucket: ${state.tokens} / 3** ${nextRefillStr} ${qstashStr}`.trim();

  const buildTable = (items, label) => {
    const lines = [];
    lines.push(`### ${label}`);
    if (items.length === 0) {
      lines.push('| PR | Title | Queued |');
      lines.push('|---|---|---|');
      lines.push('| — | _empty_ | — |');
    } else {
      lines.push('| PR | Title | Queued |');
      lines.push('|---|---|---|');
      for (const item of items) {
        // Escape backslashes first, then pipes, and strip newlines so titles
        // don't break the markdown table (CodeQL: complete the escape sequence).
        const safeTitle = String(item.title ?? '')
          .replace(/\r?\n/g, ' ')
          .replace(/\\/g, '\\\\')
          .replace(/\|/g, '\\|');
        lines.push(`| #${item.pr} | ${safeTitle} | ${formatRelativeTime(item.queued_at, nowMs)} |`);
      }
    }
    return lines.join('\n');
  };

  const body = [
    stateBlock,
    '',
    '## 🐰 CodeRabbit Review Queue',
    bucketLine,
    '',
    buildTable(state.priority, '🔴 Priority'),
    '',
    buildTable(state.normal, '🟡 Normal'),
    '',
    buildTable(state.backburner, '⬜ Backburner _(triggers only when bucket is full)_'),
  ].join('\n');

  return body;
}

/**
 * Lazy bucket refill: min(3, stored_tokens + floor((nowMs - lastDecrMs) / 3600000))
 * Returns updated state with recalculated tokens. Does NOT mutate input.
 *
 * @param {{ tokens: number, last_decremented_at: string }} state
 * @param {number} nowMs
 * @returns {typeof state}
 */
export function computeActualTokens(state, nowMs) {
  if (!state.last_decremented_at) return { ...state };
  const lastDecrMs = new Date(state.last_decremented_at).getTime();
  if (isNaN(lastDecrMs)) return { ...state };
  const hoursElapsed = Math.max(0, Math.floor((nowMs - lastDecrMs) / 3_600_000));
  const actualTokens = Math.min(3, state.tokens + hoursElapsed);
  return { ...state, tokens: actualTokens };
}

/**
 * Priority selection:
 *   1. First item in priority[]
 *   2. First item in normal[]
 *   3. First item in backburner[] — ONLY if state.tokens === 3
 *   4. null (nothing to trigger)
 *
 * @param {{ tokens: number, priority: Array, normal: Array, backburner: Array }} state
 * @returns {{ pr: number, title: string, queued_at: string, level: string }|null}
 */
export function pickNextPR(state) {
  if (state.priority.length > 0)
    return { ...state.priority[0], level: 'priority' };
  if (state.normal.length > 0)
    return { ...state.normal[0], level: 'normal' };
  if (state.backburner.length > 0 && state.tokens === 3)
    return { ...state.backburner[0], level: 'backburner' };
  return null;
}

/**
 * Add a PR to the appropriate queue.
 * priority → unshift (front); normal/backburner → push (back)
 * Idempotent: does not add if PR is already in ANY queue.
 *
 * @param {{ priority: Array, normal: Array, backburner: Array }} state
 * @param {{ pr: number, title: string, queued_at: string }} prInfo
 * @param {'priority'|'normal'|'backburner'} level
 * @returns {typeof state}
 */
export function enqueue(state, prInfo, level) {
  // Check all queues for duplicate
  const inAny = [...state.priority, ...state.normal, ...state.backburner]
    .some(item => item.pr === prInfo.pr);
  if (inAny) return { ...state };

  const newState = {
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
 *
 * @param {{ priority: Array, normal: Array, backburner: Array }} state
 * @param {number} prNumber
 * @returns {typeof state}
 */
export function dequeue(state, prNumber) {
  return {
    ...state,
    priority: state.priority.filter(item => item.pr !== prNumber),
    normal: state.normal.filter(item => item.pr !== prNumber),
    backburner: state.backburner.filter(item => item.pr !== prNumber),
  };
}

/**
 * Returns position info for a PR in the queues, or null if not found.
 *
 * @param {{ priority: Array, normal: Array, backburner: Array }} state
 * @param {number} prNumber
 * @returns {{ level: string, position: number, total: number }|null}
 */
export function findPRInQueues(state, prNumber) {
  const queues = [
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
 *
 * @param {string} isoString
 * @param {number} nowMs
 * @returns {string}
 */
export function formatRelativeTime(isoString, nowMs) {
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
 * Extract priority level from HQ comment body checkbox state.
 * Checks for: '- [x] 🔴', '- [x] 🟡', '- [x] ⬜' (new style)
 * Falls back to '- [x] Full review' → 'normal' (backward compat)
 * Returns 'priority' | 'normal' | 'backburner' | null
 *
 * @param {string|null|undefined} hqBody
 * @returns {'priority'|'normal'|'backburner'|null}
 */
export function getPriorityFromCheckbox(hqBody) {
  const body = hqBody ?? '';
  if (/- \[x\] 🔴/u.test(body)) return 'priority';
  if (/- \[x\] 🟡/u.test(body)) return 'normal';
  if (/- \[x\] ⬜/u.test(body)) return 'backburner';
  if (/- \[x\] Full review/i.test(body)) return 'normal'; // backward compat
  return null;
}
