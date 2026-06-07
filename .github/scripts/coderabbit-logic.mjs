/**
 * Pure functions for CodeRabbit bot logic.
 * Imported by bot-cr-*.yml workflows via dynamic import,
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
 * Returns true if the comment body contains the CR skip marker.
 * Used by bot-cr-watch.yml to detect "no files to review" responses.
 * @param {string|null|undefined} body
 */
export function isSkipComment(body) {
  return (body ?? '').includes('<!-- skip review by coderabbit.ai -->');
}

/**
 * Returns true if the comment body contains rate-limit language from CodeRabbit.
 * Used by bot-cr-watch.yml to detect rate-limit responses.
 * @param {string|null|undefined} body
 */
export function isRateLimitComment(body) {
  return /exceeded|try again in/i.test(body ?? '');
}

/**
 * Maps the current label set to a commit status to post.
 * Updated for new label set (no queued label).
 * @param {string[]} labelNames
 * @returns {{ state: string, description: string }}
 */
export function labelToStatus(labelNames) {
  if (labelNames.includes('coderabbit: complete'))
    return { state: 'success', description: 'CodeRabbit review passed' };
  if (labelNames.includes('coderabbit: unresolved'))
    return { state: 'failure', description: 'CodeRabbit review has open comments' };
  if (labelNames.includes('coderabbit: rate-limited'))
    return { state: 'pending', description: 'CodeRabbit rate-limited · retry scheduled' };
  if (labelNames.includes('coderabbit: waiting'))
    return { state: 'pending', description: 'CodeRabbit review in progress' };
  // not started or no label
  return { state: 'pending', description: 'CodeRabbit review not yet requested' };
}

/**
 * Returns the checkbox line for the HQ CR section based on the current HQ body.
 * Preserves whichever checkbox was previously selected; defaults to neither.
 * @param {string|null|undefined} hqBody
 */
export function getCheckedLabel(hqBody) {
  if (/- \[x\] Full review/i.test(hqBody ?? ''))
    return '- [x] Full review';
  return '- [ ] Full review';
}

// ── Retired functions kept for backward compatibility with existing tests ──────

/**
 * Given the current label names and the count of unresolved CR threads,
 * decides what label transition the gate should perform.
 *
 * @deprecated Replaced by per-workflow logic in bot-cr-gate.yml.
 * Kept so existing unit tests continue passing.
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
 * @deprecated Replaced by label guard in bot-cr-retry.yml.
 * @param {string[]} labelNames
 */
export function shouldSkipRetry(labelNames) {
  return !labelNames.includes('coderabbit: rate-limited');
}

/**
 * Returns true if the coderabbit-trigger job should skip.
 * @deprecated Replaced by label guard in bot-cr-trigger.yml.
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

/**
 * Returns true if the HQ comment body contains a nitpick section with at least
 * one unchecked checkbox. Used by bot-cr-gate.yml before flipping to complete,
 * and by bot-cr-nitpick-gate.yml to decide whether all nitpicks are addressed.
 *
 * @param {string|null|undefined} hqBody
 * @returns {boolean}
 */
export function hasUncheckedNitpicks(hqBody) {
  const body = hqBody ?? '';
  if (!body.includes('<!-- nitpick-section-start -->')) return false;
  return /- \[ \] <!-- cr-id:/.test(body);
}

/**
 * Parses a CR review body for a named section (e.g. "🧹 Nitpick comments" or
 * "⚠️ Outside diff range comments") and returns structured comment objects.
 *
 * The CR review body uses this HTML structure for each section:
 *
 * <details>
 * <summary>SECTION_TITLE (N)</summary><blockquote>
 *   <details>
 *   <summary>FILENAME (N)</summary><blockquote>
 *     `LINE-LINE`: ...
 *     **TITLE**
 *     <!-- cr-comment:v1:HASH -->
 *   </blockquote></details>
 * </blockquote></details>
 *
 * @param {string} body - The full review body text
 * @param {string} sectionTitle - e.g. '🧹 Nitpick comments' or '⚠️ Outside diff range comments'
 * @returns {Array<{ hash: string, file: string, lines: string, title: string }>}
 */
export function parseReviewSection(body, sectionTitle) {
  if (!body) return [];

  // Find the outer <details> block whose <summary> starts with sectionTitle.
  // We need to find the right <details> tag and extract everything within it.
  // Use a pattern that captures from the opening tag through nested content.
  const escapedTitle = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionPattern = new RegExp(
    `<details>[\\s\\S]*?<summary>${escapedTitle}[\\s\\S]*?</details>(?:\\s*</blockquote></details>)?`,
    'i'
  );

  // Find the section by locating the summary line first, then extracting the enclosing details block
  const summaryPattern = new RegExp(`<summary>${escapedTitle}`, 'i');
  const summaryIdx = body.search(summaryPattern);
  if (summaryIdx === -1) return [];

  // Walk back to find the opening <details> tag before this summary
  const beforeSummary = body.slice(0, summaryIdx);
  const lastDetailsIdx = beforeSummary.lastIndexOf('<details>');
  if (lastDetailsIdx === -1) return [];

  // Now we need to find the matching closing tag. We'll track nesting depth.
  let depth = 0;
  let pos = lastDetailsIdx;
  const sectionStart = lastDetailsIdx;
  let sectionEnd = -1;

  while (pos < body.length) {
    const openIdx = body.indexOf('<details>', pos);
    const closeIdx = body.indexOf('</details>', pos);

    if (closeIdx === -1) break;

    if (openIdx !== -1 && openIdx < closeIdx) {
      depth++;
      pos = openIdx + 9; // '<details>'.length
    } else {
      depth--;
      if (depth === 0) {
        sectionEnd = closeIdx + 10; // '</details>'.length
        break;
      }
      pos = closeIdx + 10;
    }
  }

  if (sectionEnd === -1) return [];
  const section = body.slice(sectionStart, sectionEnd);

  // Find all cr-comment markers in this section
  const markerPattern = /<!-- cr-comment:v1:([a-f0-9]+) -->/g;
  const results = [];
  let match;

  while ((match = markerPattern.exec(section)) !== null) {
    const hash = match[1];
    const markerPos = match.index;

    // Extract the text before this marker (within the section) to find file/lines/title
    const before = section.slice(0, markerPos);

    // Find the nearest enclosing <summary>FILENAME</summary> above this marker.
    // These are inner <summary> tags (not the outer section summary).
    // We want the last <summary>...</summary> that is NOT the section title.
    const summaryMatches = [...before.matchAll(/<summary>([\s\S]*?)<\/summary>/g)];
    let file = '';
    for (let i = summaryMatches.length - 1; i >= 0; i--) {
      const candidate = summaryMatches[i][1].trim();
      // Skip the outer section summary (starts with sectionTitle)
      if (candidate.startsWith(sectionTitle)) continue;
      // Strip trailing count like " (3)"
      file = candidate.replace(/\s*\(\d+\)\s*$/, '').trim();
      break;
    }

    // Find `` `LINE-LINE`: `` pattern in the text before the marker.
    // Look for the last occurrence of a backtick-wrapped line range.
    const linesMatch = [...before.matchAll(/`(\d+(?:-\d+)?)`:/g)];
    const lines = linesMatch.length > 0
      ? linesMatch[linesMatch.length - 1][1]
      : '';

    // Find the first **BOLD** line after the lines pattern (or just before the marker).
    // Search within a reasonable window before the marker.
    const window = before.slice(Math.max(0, before.lastIndexOf('`' + lines + '`:')));
    const boldMatch = window.match(/\*\*([^*]+)\*\*/);
    const title = boldMatch
      ? boldMatch[1].replace(/\*\*/g, '').trim().slice(0, 80)
      : '';

    results.push({ hash, file, lines, title });
  }

  return results;
}
