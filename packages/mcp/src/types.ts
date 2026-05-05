/**
 * Types for the playwright-smart-table MCP Inspector.
 * These represent the structured findings returned by the inspect_table tool.
 */

export type PresetName = 'mui-datagrid' | 'mui-table' | 'rdg' | 'glide';

export interface PresetFindings {
  value: PresetName | null;
  /** Ratio of matched signals to total expected signals for the best matching preset. */
  confidence: number;
  /** Human-readable list of matched/unmatched signals, e.g. [".MuiDataGrid-root ✓", "data-rowindex ✗"] */
  signals: string[];
}

export interface VirtualizationAxisFindings {
  detected: boolean;
  confidence: number;
  signals: string[];
}

export interface VirtualizationFindings {
  rows: VirtualizationAxisFindings;
  columns: VirtualizationAxisFindings;
}

export interface SelectorCandidate {
  selector: string;
  confidence: number;
  reason: string;
}

export interface PaginationPrimitiveFindings {
  selector: string | null;
  confidence: number;
}

export interface PaginationFindings {
  type: { value: 'buttons' | 'infinite-scroll' | 'none'; confidence: number };
  signals: string[];
  primitives: {
    goNext: PaginationPrimitiveFindings;
    goPrevious: PaginationPrimitiveFindings;
    goNextBulk: PaginationPrimitiveFindings;
    goPreviousBulk: PaginationPrimitiveFindings;
    goToFirst: PaginationPrimitiveFindings;
    goToLast: PaginationPrimitiveFindings;
    goToPage: PaginationPrimitiveFindings;
    getTotalPages: PaginationPrimitiveFindings;
    detectCurrentPage: PaginationPrimitiveFindings;
  };
}

export interface LoadingSignalFindings {
  detected: boolean;
  confidence: number;
  signal: string | null;
}

export interface LoadingFindings {
  isTableLoading: LoadingSignalFindings;
  isRowLoading: LoadingSignalFindings;
  isHeaderLoading: LoadingSignalFindings;
}

export interface SelectorCandidates {
  /** Top 3 ranked candidates for rowSelector */
  row: SelectorCandidate[];
  /** Top 3 ranked candidates for cellSelector */
  cell: SelectorCandidate[];
  /** Top 3 ranked candidates for headerSelector */
  header: SelectorCandidate[];
}

/** Full structured findings returned by inspect_table */
export interface InspectTableFindings {
  preset: PresetFindings;
  virtualization: VirtualizationFindings;
  pagination: PaginationFindings;
  loading: LoadingFindings;
  selectorCandidates: SelectorCandidates;
  /** Cleaned DOM fragment for LLM analysis */
  snapshot?: string;
}


/** Options accepted by both MCP tools */
export interface InspectTableOptions {
  authMode?: 'storageState' | 'interactive';
  /** Required when authMode === 'storageState' */
  storageStatePath?: string;
  /** Default: true. Set false to skip GitHub Models LLM call. */
  llm?: boolean;
}

/** Raw DOM signals collected from the page via page.evaluate() */
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
  /** Total visible row count (best guess from heuristics) */

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

/**
 * JSON-serializable version of DomSignals returned from page.evaluate().
 * Sets become arrays for cross-context serialization.
 */
export interface SerializableDomSignals {
  classes: string[];
  roles: string[];
  dataAttributes: string[];
  hasGlideCanvas: boolean;
  hasGlideInput: boolean;
  hasGlideClass: boolean;
  visibleRowCount: number;
  ariaRowCount: number | null;
  ariaColCount: number | null;
  styles: Record<string, string[]>;
  paginationTexts: string[];
  paginationButtons: Array<{ label: string | null; icon: string | null; classes: string[] }>;
  snapshot?: string;
}

