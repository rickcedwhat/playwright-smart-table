import type { ReviewRound } from './types.js';

const HISTORY_START = '<!-- ai-review-history-start';
const HISTORY_END = '-->';

export function parseReviewHistory(hqBody: string): ReviewRound[] {
  const start = hqBody.indexOf(HISTORY_START);
  if (start === -1) return [];
  const end = hqBody.indexOf(HISTORY_END, start + HISTORY_START.length);
  if (end === -1) return [];
  const json = hqBody.slice(start + HISTORY_START.length, end).trim();
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addReviewRound(history: ReviewRound[], round: ReviewRound): ReviewRound[] {
  return [...history, round];
}

export function serializeReviewHistory(rounds: ReviewRound[]): string {
  if (rounds.length === 0) return '';

  const machineReadable = `${HISTORY_START}\n${JSON.stringify(rounds, null, 2)}\n${HISTORY_END}`;

  const humanReadable = rounds
    .map(r => {
      const date = r.timestamp.slice(0, 10);
      const sha = r.commit_sha.slice(0, 7);
      return `| ${r.round} | ${date} | \`${sha}\` | ${r.input_tokens.toLocaleString()} | ${r.output_tokens.toLocaleString()} | $${r.cost.toFixed(4)} | ${r.summary} |`;
    })
    .join('\n');

  return `<details>
<summary><strong>Review History (${rounds.length} round${rounds.length === 1 ? '' : 's'})</strong></summary>

| Round | Date | Commit | In Tokens | Out Tokens | Cost | Summary |
|---|---|---|---|---|---|---|
${humanReadable}

${machineReadable}
</details>`;
}
