import type { Page } from '@playwright/test';
import { z } from 'zod';
import { launchBrowser, closeBrowser } from '../browser/launcher.js';
import { detectPreset } from '../detectors/preset.js';
import { detectVirtualization } from '../detectors/virtualization.js';
import { detectPagination } from '../detectors/pagination.js';
import { discoverSelectors } from '../detectors/selectors.js';
import type {

  DomSignals,

  SerializableDomSignals,
  InspectTableFindings,
  InspectTableOptions,
  PaginationPrimitiveFindings,
} from '../types.js';

// ── Input schema ─────────────────────────────────────────────────────────────

export const InspectTableInputSchema = z.object({
  url: z.string().url('url must be a valid URL').optional(),
  testUrl: z.enum([
    'https://mui.com/x/react-data-grid/',
    'https://grid.glideapps.com/',
    'https://adazzle.github.io/react-data-grid/',
    'local-fixture'
  ]).optional(),
  tableSelector: z.string().optional(),

  options: z
    .object({
      authMode: z.enum(['storageState', 'interactive']).optional(),
      storageStatePath: z.string().optional(),
      llm: z.boolean().optional(),
      generateSnapshot: z.boolean().optional().default(true),
      verbosity: z.enum(['mini', 'full']).optional().default('full'),
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
  generateSnapshot: boolean = false,
): Promise<SerializableDomSignals> {
  return page.evaluate<SerializableDomSignals, [string | undefined, boolean]>(
    ([selector, wantSnapshot]) => {
      const root = selector

      ? (document.querySelector(selector) ?? document.body)
      : document.body;

    const classes = new Set<string>();
    const roles = new Set<string>();
    const dataAttributes = new Set<string>();
    const styles: Record<string, Set<string>> = { transform: new Set(), display: new Set() };
    const paginationTexts: string[] = [];
    const paginationButtons: Array<{ label: string | null; icon: string | null; classes: string[] }> = [];

    // Walk root and all descendants
    const elements = [root, ...Array.from(root.querySelectorAll('*'))];
    elements.forEach((el) => {
      const element = el as HTMLElement;

      // Classes
      element.classList.forEach((cls) => classes.add(cls));

      // Role
      const role = element.getAttribute('role');
      if (role) roles.add(role);

      // data-* and aria-* attributes
      for (const attr of element.getAttributeNames()) {
        if (attr.startsWith('data-') || attr.startsWith('aria-')) {
          dataAttributes.add(attr);
        }
      }

      // Styles (virtualization signals)
      const style = element.style;
      if (style.transform) styles.transform.add(style.transform);
      if (style.display) styles.display.add(style.display);

      // Pagination indicators (e.g. "1-25 of 100")
      if (element.children.length === 0 && element.innerText?.match(/\d+[-–]\d+\s+of\s+\d+/i)) {
        paginationTexts.push(element.innerText.trim());
      }

      // Pagination buttons
      if (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button') {
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel?.match(/next|prev|first|last/i)) {
          paginationButtons.push({
            label: ariaLabel,
            icon: element.querySelector('svg, i')?.tagName || null,
            classes: Array.from(element.classList),
          });
        }
      }
    });

    // Glide-specific checks - more robust matching
    const dvnElements = elements.filter(el => 
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
    const gridEl = (root.querySelector('[role="grid"]') ?? root.querySelector('[role="treegrid"]')) as HTMLElement | null;
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
      styles: {
        transform: [...styles.transform],
        display: [...styles.display],
      },
      paginationTexts,
      paginationButtons,
      snapshot: wantSnapshot ? generateDomSnapshot(root) : undefined,
    };

    function generateDomSnapshot(el: Element): string {
      const MAX_LENGTH = 20000;
      let output = '';

      function walk(node: Node, depth: number) {
        if (output.length > MAX_LENGTH) return;
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent?.trim();
          if (text) output += text + ' ';
          return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const element = node as Element;
        const tag = element.tagName.toLowerCase();

        // Skip noise
        if (['script', 'style', 'svg', 'path', 'noscript', 'link'].includes(tag)) return;
        
        // Skip hidden
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') return;

        output += `<${tag}`;
        
        // Keep key attributes
        for (const attr of element.getAttributeNames()) {
          if (['class', 'role', 'id'].includes(attr) || attr.startsWith('data-') || attr.startsWith('aria-')) {
            output += ` ${attr}="${element.getAttribute(attr)}"`;
          }
        }
        
        // Keep transform style for virtualization
        const htmlElement = element as HTMLElement;
        if (htmlElement.style?.transform) {
          output += ` style="transform: ${htmlElement.style.transform}"`;
        }


        output += '>';
        
        for (const child of Array.from(element.childNodes)) {
          walk(child, depth + 1);
        }
        
        output += `</${tag}>`;
      }

      walk(el, 0);
      return output.slice(0, MAX_LENGTH);
    }
  }, [tableSelector, generateSnapshot]);
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
  let url = input.url;

  if (input.testUrl) {
    if (input.testUrl === 'local-fixture') {
      const { fileURLToPath } = await import('url');
      const { join, dirname } = await import('path');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      // dist/tools/inspectTable.js -> ../../tests/fixtures/...
      url = `file://${join(__dirname, '../../tests/fixtures/mui-datagrid-mock.html')}`;
    } else {
      url = input.testUrl;
    }
  }

  if (!url) {
    throw new Error('Either "url" or "testUrl" must be provided.');
  }

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

    const rawSignals = await collectDomSignals(
      page,
      input.tableSelector,
      input.options?.generateSnapshot ?? true,
    );



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
      styles: rawSignals.styles,
      paginationTexts: rawSignals.paginationTexts,
      paginationButtons: rawSignals.paginationButtons,
    };

    const preset = detectPreset(signals);
    const virtualization = detectVirtualization(signals);
    const pagination = detectPagination(signals);

    // Step 3: LLM Selector Discovery (if snapshot was requested and llm enabled)
    let selectorCandidates = stubFindings().selectorCandidates;
    if (rawSignals.snapshot && (input.options?.llm !== false)) {
      selectorCandidates = await discoverSelectors(
        { preset, virtualization, pagination, loading: stubFindings().loading },
        rawSignals.snapshot
      );
    }

    const findings: InspectTableFindings = {

      preset,
      virtualization,
      pagination,
      loading: stubFindings().loading,
      selectorCandidates,
      snapshot: rawSignals.snapshot,
    };

    if (input.options?.verbosity === 'mini') {
      if (findings.snapshot) {
        findings.snapshot = findings.snapshot.slice(0, 500) + '... [TRUNCATED]';
      }
      // Remove signals to keep it mini
      (findings.preset as any).signals = undefined;
      (findings.virtualization.rows as any).signals = undefined;
      (findings.virtualization.columns as any).signals = undefined;
      (findings.pagination as any).signals = undefined;
    }

    return findings;




  } finally {
    await closeBrowser(launched);
  }
}
