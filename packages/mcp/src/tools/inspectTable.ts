import type { Page } from '@playwright/test';
import { z } from 'zod';
import { launchBrowser, closeBrowser } from '../browser/launcher.js';
import { detectPreset } from '../detectors/preset.js';
import type {
  DomSignals,
  SerializableDomSignals,
  InspectTableFindings,
  InspectTableOptions,
  PaginationPrimitiveFindings,
} from '../types.js';

// ── Input schema ─────────────────────────────────────────────────────────────

export const InspectTableInputSchema = z.object({
  url: z.string().url('url must be a valid URL'),
  tableSelector: z.string().optional(),
  options: z
    .object({
      authMode: z.enum(['storageState', 'interactive']).optional(),
      storageStatePath: z.string().optional(),
      llm: z.boolean().optional(),
    })
    .optional(),
});

export type InspectTableInput = z.infer<typeof InspectTableInputSchema>;

// ── DOM signal collection ─────────────────────────────────────────────────────

/**
 * Runs inside the browser via page.evaluate().
 * Collects DOM signals needed for preset fingerprinting.
 * Returns a plain object (must be JSON-serialisable).
 */
async function collectDomSignals(
  page: Page,
  tableSelector: string | undefined,
): Promise<SerializableDomSignals> {
  return page.evaluate<SerializableDomSignals, string | undefined>((selector) => {
    const root = selector
      ? (document.querySelector(selector) ?? document.body)
      : document.body;

    const classes = new Set<string>();
    const roles = new Set<string>();
    const dataAttributes = new Set<string>();

    // Walk all elements inside root, collect class names, roles, and data-* attrs
    root.querySelectorAll('*').forEach((el) => {
      // Classes
      el.classList.forEach((cls) => classes.add(cls));

      // Role
      const role = el.getAttribute('role');
      if (role) roles.add(role);

      // data-* attributes
      for (const attr of el.getAttributeNames()) {
        if (attr.startsWith('data-') || attr.startsWith('aria-')) {
          dataAttributes.add(attr);
        }
      }
    });

    // Glide-specific checks - more robust matching
    const dvnElements = Array.from(root.querySelectorAll('*')).filter(el => 
      Array.from(el.classList).some(cls => cls.startsWith('dvn-'))
    );
    const hasGlideCanvas = dvnElements.some(el => el.querySelector('canvas') !== null);
    
    const hasGlideInput = 
      root.querySelector('textarea[class*="gdg-"]') !== null ||
      document.querySelector('textarea[class*="gdg-"]') !== null;
      
    const hasGlideClass = Array.from(classes).some(cls => cls.startsWith('gdg-') || cls.startsWith('dvn-'));

    // Best-effort visible row count — count [role="row"] or <tr> elements
    const rowCount =
      root.querySelectorAll('[role="row"]').length ||
      root.querySelectorAll('tr').length;

    // aria-rowcount / aria-colcount on grid root
    const gridEl = root.querySelector('[role="grid"]') ?? root.querySelector('[role="treegrid"]');
    const ariaRowCount = gridEl
      ? parseInt(gridEl.getAttribute('aria-rowcount') ?? '', 10) || null
      : null;
    const ariaColCount = gridEl
      ? parseInt(gridEl.getAttribute('aria-colcount') ?? '', 10) || null
      : null;

    return {
      classes: [...classes],
      roles: [...roles],
      dataAttributes: [...dataAttributes],
      hasGlideCanvas,
      hasGlideInput,
      hasGlideClass,
      visibleRowCount: rowCount,
      ariaRowCount,
      ariaColCount,
    };
  }, tableSelector);
}

// ── Stub helpers ──────────────────────────────────────────────────────────────

function emptyPrimitive(): PaginationPrimitiveFindings {
  return { selector: null, confidence: 0 };
}

function stubFindings(): Omit<InspectTableFindings, 'preset'> {
  return {
    virtualization: {
      rows: { detected: false, confidence: 0, signals: [] },
      columns: { detected: false, confidence: 0, signals: [] },
    },
    pagination: {
      type: { value: 'none', confidence: 0 },
      signals: [],
      primitives: {
        goNext: emptyPrimitive(),
        goPrevious: emptyPrimitive(),
        goNextBulk: emptyPrimitive(),
        goPreviousBulk: emptyPrimitive(),
        goToFirst: emptyPrimitive(),
        goToLast: emptyPrimitive(),
        goToPage: emptyPrimitive(),
        getTotalPages: emptyPrimitive(),
        detectCurrentPage: emptyPrimitive(),
      },
    },
    loading: {
      isTableLoading: { detected: false, confidence: 0, signal: null },
      isRowLoading: { detected: false, confidence: 0, signal: null },
      isHeaderLoading: { detected: false, confidence: 0, signal: null },
    },
    selectorCandidates: {
      row: [],
      cell: [],
      header: [],
    },
  };
}

// ── Tool handler ──────────────────────────────────────────────────────────────

/**
 * Core logic for the inspect_table MCP tool.
 * Step 1: preset detection only. All other sections return stubs.
 */
export async function inspectTable(
  input: InspectTableInput,
  _options?: InspectTableOptions,
): Promise<InspectTableFindings> {
  const { url, tableSelector } = input;

  // Input validation: storageState mode requires a path
  if (input.options?.authMode === 'storageState' && !input.options.storageStatePath) {
    throw new Error(
      'authMode "storageState" requires storageStatePath to be provided.',
    );
  }

  const launched = await launchBrowser({ headless: true });
  try {
    const page = await launched.context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });

    const rawSignals = await collectDomSignals(page, tableSelector);

    // Re-hydrate arrays into Sets for the pure detector function
    const signals: DomSignals = {
      classes: new Set(rawSignals.classes),
      roles: new Set(rawSignals.roles),
      dataAttributes: new Set(rawSignals.dataAttributes),
      hasGlideCanvas: rawSignals.hasGlideCanvas,
      hasGlideInput: rawSignals.hasGlideInput,
      hasGlideClass: rawSignals.hasGlideClass,
      visibleRowCount: rawSignals.visibleRowCount,

      ariaRowCount: rawSignals.ariaRowCount,
      ariaColCount: rawSignals.ariaColCount,
    };

    const preset = detectPreset(signals);

    return {
      preset,
      ...stubFindings(),
    };
  } finally {
    await closeBrowser(launched);
  }
}
