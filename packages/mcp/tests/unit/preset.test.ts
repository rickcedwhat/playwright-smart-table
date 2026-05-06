import { describe, it, expect } from 'vitest';
import { detectPreset } from '../../src/detectors/preset.js';
import type { DomSignals } from '../../src/types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSignals(overrides: Partial<{
  classes: string[];
  roles: string[];
  dataAttributes: string[];
  hasGlideCanvas: boolean;
  hasGlideInput: boolean;
  hasGlideClass: boolean;
}>): DomSignals {
  return {
    classes: new Set(overrides.classes ?? []),
    roles: new Set(overrides.roles ?? []),
    dataAttributes: new Set(overrides.dataAttributes ?? []),
    hasGlideCanvas: overrides.hasGlideCanvas ?? false,
    hasGlideInput: overrides.hasGlideInput ?? false,
    hasGlideClass: overrides.hasGlideClass ?? false,
    visibleRowCount: 0,
    ariaRowCount: null,
    ariaColCount: null,
    styles: { transform: [], display: [] },
    paginationTexts: [],
    paginationButtons: [],
  };
}

// ── MUI DataGrid ──────────────────────────────────────────────────────────────

describe('detectPreset — MUI DataGrid', () => {
  it('returns full confidence when all signals match', () => {
    const result = detectPreset(
      makeSignals({
        classes: ['MuiDataGrid-root', 'MuiDataGrid-row'],
        dataAttributes: ['data-rowindex'],
      }),
    );
    expect(result.value).toBe('mui-datagrid');
    expect(result.confidence).toBe(1.0);
    expect(result.signals).toContain('.MuiDataGrid-root ✓');
    expect(result.signals).toContain('.MuiDataGrid-row ✓');
    expect(result.signals).toContain('data-rowindex ✓');
  });

  it('returns partial confidence with only 2/3 signals', () => {
    const result = detectPreset(
      makeSignals({
        classes: ['MuiDataGrid-root', 'MuiDataGrid-row'],
        // no data-rowindex
      }),
    );
    expect(result.value).toBe('mui-datagrid');
    expect(result.confidence).toBeCloseTo(2 / 3);
    expect(result.signals).toContain('data-rowindex ✗');
  });

  it('signals show ✓/✗ correctly for partial match', () => {
    const result = detectPreset(
      makeSignals({ classes: ['MuiDataGrid-root'] }),
    );
    expect(result.signals).toContain('.MuiDataGrid-root ✓');
    expect(result.signals).toContain('.MuiDataGrid-row ✗');
  });
});

// ── MUI Table ─────────────────────────────────────────────────────────────────

describe('detectPreset — MUI Table', () => {
  it('returns full confidence when all signals match', () => {
    const result = detectPreset(
      makeSignals({
        classes: ['MuiTable-root', 'MuiTableRow-root'],
      }),
    );
    expect(result.value).toBe('mui-table');
    expect(result.confidence).toBe(1.0);
  });

  it('does not match MUI Table when only one signal present', () => {
    const result = detectPreset(makeSignals({ classes: ['MuiTable-root'] }));
    // 1/2 confidence for mui-table — still returns it as best match
    expect(result.value).toBe('mui-table');
    expect(result.confidence).toBeCloseTo(0.5);
  });
});

// ── RDG ───────────────────────────────────────────────────────────────────────

describe('detectPreset — RDG', () => {
  it('returns full confidence when all signals match', () => {
    const result = detectPreset(
      makeSignals({
        classes: ['rdg', 'rdg-row', 'rdg-cell'],
        roles: ['grid'],
        dataAttributes: ['aria-colindex'],
      }),
    );
    expect(result.value).toBe('rdg');
    expect(result.confidence).toBe(1.0);
  });

  it('matches rdg via rdg-cell fallback for aria-colindex signal', () => {
    const result = detectPreset(
      makeSignals({
        classes: ['rdg', 'rdg-row', 'rdg-cell'],
        roles: ['grid'],
      }),
    );
    expect(result.value).toBe('rdg');
    expect(result.confidence).toBe(1.0);
  });
});

// ── Glide ─────────────────────────────────────────────────────────────────────

describe('detectPreset — Glide', () => {
  it('returns full confidence when all signals match', () => {
    const result = detectPreset(
      makeSignals({ hasGlideCanvas: true, hasGlideInput: true, hasGlideClass: true }),
    );
    expect(result.value).toBe('glide');
    expect(result.confidence).toBe(1.0);
  });

  it('returns partial confidence with only canvas signal', () => {
    const result = detectPreset(makeSignals({ hasGlideCanvas: true }));
    expect(result.value).toBe('glide');
    expect(result.confidence).toBeCloseTo(0.333, 3);
  });
});


// ── Unknown / no match ────────────────────────────────────────────────────────

describe('detectPreset — unknown table', () => {
  it('returns null when no signals match any preset', () => {
    const result = detectPreset(makeSignals({}));
    expect(result.value).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.signals).toEqual([]);
  });

  it('returns null for a plain HTML table with no framework classes', () => {
    const result = detectPreset(
      makeSignals({ classes: ['table', 'table-striped'], roles: ['table'] }),
    );
    expect(result.value).toBeNull();
  });
});

// ── Disambiguation ────────────────────────────────────────────────────────────

describe('detectPreset — picks highest confidence preset', () => {
  it('prefers mui-datagrid over mui-table when both have partial signals', () => {
    // 2/3 datagrid signals vs 1/2 table signals
    const result = detectPreset(
      makeSignals({
        classes: ['MuiDataGrid-root', 'MuiDataGrid-row', 'MuiTable-root'],
      }),
    );
    expect(result.value).toBe('mui-datagrid');
    expect(result.confidence).toBeCloseTo(2 / 3);
  });
});
