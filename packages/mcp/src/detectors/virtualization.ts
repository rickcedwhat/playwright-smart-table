import type { DomSignals, VirtualizationFindings } from '../types.js';

/**
 * Detects row and column virtualization based on DOM signals.
 */
export function detectVirtualization(signals: DomSignals): VirtualizationFindings {
  const findings: VirtualizationFindings = {
    rows: { detected: false, confidence: 0, signals: [] },
    columns: { detected: false, confidence: 0, signals: [] },
  };

  // ── Row Virtualization ─────────────────────────────────────────────────────

  // Signal 1: transform: translateY(...)
  const hasTranslateY = signals.styles.transform?.some(t => t.includes('translateY'));
  if (hasTranslateY) {
    findings.rows.signals.push('transform: translateY(...) detected on elements ✓');
    findings.rows.confidence += 0.6;
  }

  // Signal 2: aria-rowcount > visible row count
  if (signals.ariaRowCount && signals.ariaRowCount > signals.visibleRowCount * 1.5) {
    findings.rows.signals.push(`aria-rowcount (${signals.ariaRowCount}) >> visible rows (${signals.visibleRowCount}) ✓`);
    findings.rows.confidence += 0.4;
  }

  // Signal 3: data-rowindex exists (often implies virtualization in MUI/RDG)
  if (signals.dataAttributes.has('data-rowindex')) {
    findings.rows.signals.push('data-rowindex present ✓');
    findings.rows.confidence += 0.2;
  }

  findings.rows.detected = findings.rows.confidence >= 0.5;
  findings.rows.confidence = Math.min(findings.rows.confidence, 1.0);

  // ── Column Virtualization ──────────────────────────────────────────────────

  // Signal 1: transform: translateX(...)
  const hasTranslateX = signals.styles.transform?.some(t => t.includes('translateX'));
  if (hasTranslateX) {
    findings.columns.signals.push('transform: translateX(...) detected on elements ✓');
    findings.columns.confidence += 0.6;
  }

  // Signal 2: aria-colcount > observed columns (heuristic: if ariaColCount is high)
  if (signals.ariaColCount && signals.ariaColCount > 10) {
    findings.columns.signals.push(`aria-colcount (${signals.ariaColCount}) detected ✓`);
    findings.columns.confidence += 0.3;
  }

  findings.columns.detected = findings.columns.confidence >= 0.5;
  findings.columns.confidence = Math.min(findings.columns.confidence, 1.0);

  return findings;
}
