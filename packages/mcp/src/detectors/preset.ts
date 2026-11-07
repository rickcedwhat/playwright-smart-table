import type { DomSignals, PresetFindings, PresetName } from '../types.js';

interface PresetSpec {
  name: PresetName;
  /** Each signal is a { label, check, weight } triplet. Root signals should have higher weight. */
  signals: Array<{ label: string; check: (s: DomSignals) => boolean; weight?: number }>;
}

const PRESET_SPECS: PresetSpec[] = [
  {
    name: 'mui-datagrid',
    signals: [
      {
        label: '.MuiDataGrid-root',
        check: (s) => s.classes.has('MuiDataGrid-root'),
        weight: 5, // High weight for root class
      },
      {
        label: '.MuiDataGrid-row',
        check: (s) => s.classes.has('MuiDataGrid-row'),
        weight: 2,
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
        weight: 5,
      },
      {
        label: '.MuiTableRow-root',
        check: (s) => s.classes.has('MuiTableRow-root'),
        weight: 2,
      },
    ],
  },
  {
    name: 'rdg',
    signals: [
      {
        label: '[role="grid"].rdg',
        check: (s) => s.roles.has('grid') && s.classes.has('rdg'),
        weight: 5,
      },
      {
        label: '.rdg-row',
        check: (s) => s.classes.has('rdg-row'),
        weight: 2,
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
        weight: 3,
      },
      {
        label: 'gdg-* textarea',
        check: (s) => s.hasGlideInput,
        weight: 3,
      },
      {
        label: 'dvn- or gdg- class prefix',
        check: (s) => s.hasGlideClass,
        weight: 1,
      },
    ],
  },

];

/**
 * Pure function: given DOM signals collected from the page, identifies which
 * preset best matches and returns structured findings.
 *
 * Scores all presets using weighted signals and returns the highest-confidence 
 * match if above 0, otherwise returns { value: null }.
 */
export function detectPreset(signals: DomSignals): PresetFindings {
  let best: PresetFindings = {
    value: null,
    confidence: 0,
    signals: [],
  };

  for (const spec of PRESET_SPECS) {
    let totalWeight = 0;
    let matchedWeight = 0;
    
    const results = spec.signals.map((s) => {
      const matched = s.check(signals);
      const weight = s.weight ?? 1;
      totalWeight += weight;
      if (matched) matchedWeight += weight;
      
      return {
        label: s.label,
        matched,
      };
    });

    const confidence = totalWeight > 0 ? matchedWeight / totalWeight : 0;

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
