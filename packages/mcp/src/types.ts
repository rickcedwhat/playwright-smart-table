export type PresetName = 'mui-datagrid' | 'mui-table' | 'rdg' | 'glide';

export interface PresetFindings {
  value: PresetName | null;
  /** Weighted fraction of matched fingerprint signals; not a calibrated probability. */
  confidence: number;
  /** Human-readable list of matched/unmatched signals, e.g. [".MuiDataGrid-root ✓", "data-rowindex ✗"] */
  signals: string[];
}

export interface DomSignals {
  /** All class names present on any element in the table root (or full page if no root found) */
  classes: Set<string>;
  /** All role attribute values present */
  roles: Set<string>;
  /** All data-* and aria-* attribute names present (just the names, not values) */
  dataAttributes: Set<string>;
  /** Whether a canvas element exists inside .dvn-scroll-container */
  hasGlideCanvas: boolean;
  /** Whether a gdg-input textarea exists */
  hasGlideInput: boolean;
  /** Whether any class starting with dvn- or gdg- exists */
  hasGlideClass: boolean;
  /** Legacy name for the mounted row count; this does not establish viewport visibility */

  visibleRowCount: number;
  /** aria-rowcount value on the grid root, if present */
  ariaRowCount: number | null;
  /** aria-colcount value on the grid root, if present */
  ariaColCount: number | null;
  /** Inline styles found on elements (key=style property, value=set of observed values) */
  styles: Record<string, string[]>;
  /** Text content of potential pagination indicators (e.g. "1-25 of 100") */
  paginationTexts: string[];
  /** Attributes of potential pagination buttons (aria-labels, etc.) */
  paginationButtons: Array<{ label: string | null; icon: string | null; classes: string[] }>;
}

