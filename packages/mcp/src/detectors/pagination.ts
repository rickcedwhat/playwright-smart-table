import type { DomSignals, PaginationFindings, PaginationPrimitiveFindings } from '../types.js';

function findButton(signals: DomSignals, pattern: RegExp): PaginationPrimitiveFindings {
  const btn = signals.paginationButtons.find(b => b.label?.match(pattern));
  if (btn) {
    return { selector: `[aria-label="${btn.label}"]`, confidence: 0.9 };
  }
  return { selector: null, confidence: 0 };
}

/**
 * Detects pagination type and primitives (next/prev buttons, etc).
 */
export function detectPagination(signals: DomSignals): PaginationFindings {
  const findings: PaginationFindings = {
    type: { value: 'none', confidence: 0 },
    signals: [],
    primitives: {
      goNext: findButton(signals, /next/i),
      goPrevious: findButton(signals, /prev/i),
      goNextBulk: { selector: null, confidence: 0 },
      goPreviousBulk: { selector: null, confidence: 0 },
      goToFirst: findButton(signals, /first/i),
      goToLast: findButton(signals, /last/i),
      goToPage: { selector: null, confidence: 0 },
      getTotalPages: { selector: null, confidence: 0 },
      detectCurrentPage: { selector: null, confidence: 0 },
    },
  };

  // Signal 1: "X-Y of Z" text
  if (signals.paginationTexts.length > 0) {
    findings.signals.push(`Pagination text detected: "${signals.paginationTexts[0]}" ✓`);
    findings.type.value = 'buttons';
    findings.type.confidence += 0.7;
  }

  // Signal 2: Next/Prev buttons
  if (findings.primitives.goNext.selector || findings.primitives.goPrevious.selector) {
    findings.signals.push('Next/Previous buttons detected ✓');
    findings.type.value = 'buttons';
    findings.type.confidence += 0.5;
  }

  // TODO: Infinite scroll detection (looking for sentinels/loading spinners at bottom)

  findings.type.confidence = Math.min(findings.type.confidence, 1.0);
  if (findings.type.confidence < 0.3) {
    findings.type.value = 'none';
  }

  return findings;
}
