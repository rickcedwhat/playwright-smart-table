import type { DomSignals, PresetFindings, PresetName } from '../types.js';

interface PresetSpec {
  name: PresetName;
  /** Each signal is a { label, check } pair. All must pass for full confidence. */
  signals: Array<{ label: string; check: (s: DomSignals) => boolean }>;
}

const PRESET_SPECS: PresetSpec[] = [
  {
    name: 'mui-datagrid',
    signals: [
      {
        label: '.MuiDataGrid-root',
        check: (s) => s.classes.has('MuiDataGrid-root'),
      },
      {
        label: '.MuiDataGrid-row',
        check: (s) => s.classes.has('MuiDataGrid-row'),
      },
      {
        label: 'data-rowindex',
        check: (s) => s.dataAttributes.has('data-rowindex'),
      },
    ],
  },
  {
    name: 'mui-table',
    signals: [
      {
        label: '.MuiTable-root',
        check: (s) => s.classes.has('MuiTable-root'),
      },
      {
        label: '.MuiTableRow-root',
        check: (s) => s.classes.has('MuiTableRow-root'),
      },
    ],
  },
  {
    name: 'rdg',
    signals: [
      {
        label: '[role="grid"].rdg',
        check: (s) => s.roles.has('grid') && s.classes.has('rdg'),
      },
      {
        label: '.rdg-row',
        check: (s) => s.classes.has('rdg-row'),
      },
      {
        label: '[aria-colindex]',
        check: (s) => s.dataAttributes.has('aria-colindex') || s.classes.has('rdg-cell'),
      },
    ],
  },
  {
    name: 'glide',
    signals: [
      {
        label: 'canvas inside dvn-* element',
        check: (s) => s.hasGlideCanvas,
      },
      {
        label: 'gdg-* textarea',
        check: (s) => s.hasGlideInput,
      },
      {
        label: 'dvn- or gdg- class prefix',
        check: (s) => s.hasGlideClass,
      },
    ],
  },

];

/**
 * Pure function: given DOM signals collected from the page, identifies which
 * preset best matches and returns structured findings.
 *
 * Scores all presets and returns the highest-confidence match if above 0,
 * otherwise returns { value: null }.
 */
export function detectPreset(signals: DomSignals): PresetFindings {
  let best: PresetFindings = {
    value: null,
    confidence: 0,
    signals: [],
  };

  for (const spec of PRESET_SPECS) {
    const results = spec.signals.map((s) => ({
      label: s.label,
      matched: s.check(signals),
    }));

    const matchedCount = results.filter((r) => r.matched).length;
    const confidence = matchedCount / spec.signals.length;

    if (confidence > best.confidence) {
      best = {
        value: spec.name,
        confidence,
        signals: results.map((r) => `${r.label} ${r.matched ? '✓' : '✗'}`),
      };
    }
  }

  return best;
}
