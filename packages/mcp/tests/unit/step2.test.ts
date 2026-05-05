import { describe, it, expect } from 'vitest';
import { detectVirtualization } from '../../src/detectors/virtualization.js';
import { detectPagination } from '../../src/detectors/pagination.js';
import type { DomSignals } from '../../src/types.js';

function makeSignals(overrides: Partial<DomSignals>): DomSignals {
  return {
    classes: new Set(),
    roles: new Set(),
    dataAttributes: new Set(),
    hasGlideCanvas: false,
    hasGlideInput: false,
    hasGlideClass: false,
    visibleRowCount: 10,
    ariaRowCount: null,
    ariaColCount: null,
    styles: { transform: [], display: [] },
    paginationTexts: [],
    paginationButtons: [],
    ...overrides,
  };
}

describe('detectVirtualization', () => {
  it('detects row virtualization from translateY', () => {
    const signals = makeSignals({
      styles: { transform: ['translateY(100px)', 'translateY(200px)'], display: [] }
    });
    const result = detectVirtualization(signals);
    expect(result.rows.detected).toBe(true);
    expect(result.rows.confidence).toBeGreaterThan(0.5);
    expect(result.rows.signals).toContain('transform: translateY(...) detected on elements ✓');
  });

  it('detects row virtualization from aria-rowcount disparity', () => {
    const signals = makeSignals({
      ariaRowCount: 1000,
      visibleRowCount: 10,
      dataAttributes: new Set(['data-rowindex'])
    });
    const result = detectVirtualization(signals);
    expect(result.rows.detected).toBe(true);
    expect(result.rows.confidence).toBeGreaterThan(0.5);
  });


  it('detects column virtualization from translateX', () => {
    const signals = makeSignals({
      styles: { transform: ['translateX(50px)'], display: [] }
    });
    const result = detectVirtualization(signals);
    expect(result.columns.detected).toBe(true);
    expect(result.columns.signals).toContain('transform: translateX(...) detected on elements ✓');
  });
});

describe('detectPagination', () => {
  it('detects button pagination from aria-labels', () => {
    const signals = makeSignals({
      paginationButtons: [
        { label: 'Go to next page', icon: 'svg', classes: [] },
        { label: 'Go to previous page', icon: 'svg', classes: [] }
      ]
    });
    const result = detectPagination(signals);
    expect(result.type.value).toBe('buttons');
    expect(result.primitives.goNext.selector).toBe('[aria-label="Go to next page"]');
    expect(result.primitives.goPrevious.selector).toBe('[aria-label="Go to previous page"]');
  });

  it('detects pagination from "X-Y of Z" text', () => {
    const signals = makeSignals({
      paginationTexts: ['1–25 of 100']
    });
    const result = detectPagination(signals);
    expect(result.type.value).toBe('buttons');
    expect(result.signals).toContain('Pagination text detected: "1–25 of 100" ✓');
  });
});
