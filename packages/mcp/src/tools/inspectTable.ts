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

export const getInspectTableInputSchema = (models: string[], lastState: any) => z.object({
  url: z.string().url('url must be a valid URL').optional().default(lastState.url),
  testUrl: z.enum([
    'https://mui.com/x/react-data-grid/',
    'https://grid.glideapps.com/',
    'https://adazzle.github.io/react-data-grid/',
    'local-fixture'
  ]).optional(),
  tableSelector: z.string().optional().default(lastState.tableSelector),

  options: z
    .object({
      authMode: z.enum(['storageState', 'interactive']).optional().default(lastState.options?.authMode),
      storageStatePath: z.string().optional().default(lastState.options?.storageStatePath),
      llm: z.boolean().optional().default(lastState.options?.llm ?? true),
      model1: z.enum(models as [string, ...string[]])
        .describe('Primary model for selector discovery')
        .optional()
        .default(lastState.options?.model1 || 'gpt-4o'),
      model2: z.enum(models as [string, ...string[]])
        .describe('Secondary model for comparison')
        .optional()
        .default(lastState.options?.model2),
      generateSnapshot: z.boolean().optional().default(lastState.options?.generateSnapshot ?? true),
      verbosity: z.enum(['mini', 'full']).optional().default(lastState.options?.verbosity || 'full'),
      headless: z.boolean().optional().default(lastState.options?.headless ?? true),
      interactive: z.boolean().optional().default(lastState.options?.interactive ?? false),
    })
    .optional().default(lastState.options || {}),
});




export type InspectTableInput = z.infer<ReturnType<typeof getInspectTableInputSchema>>;


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
  ctx?: { page?: Page; tableSelector?: string; manualOverrides?: any },
): Promise<InspectTableFindings> {
  const startTime = performance.now();
  let url = input.url;

  if (input.testUrl && !input.url) {
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

  const launched = ctx?.page ? null : await launchBrowser({
    headless: input.options?.headless ?? true,
    storageStatePath: input.options?.authMode === 'storageState' ? input.options.storageStatePath : undefined,
  });
  try {
    const page = ctx?.page || await launched!.context.newPage();
    if (!ctx?.page) {
      await page.goto(url, { waitUntil: 'networkidle' });
    }

    // Step 1: Guided Discovery (if requested)
    let finalSelector = ctx?.tableSelector || input.tableSelector;
    let manualPagination: Record<string, string> = {};
    
    if (!ctx?.manualOverrides && input.options?.interactive && !input.options?.headless) {
      console.error('[Inspector] Starting Discovery Dashboard...');
      const wizardResult = await page.evaluate(async () => {
        return new Promise<{ table: string; pagination: Record<string, string> }>((resolve) => {
          const canvas = document.createElement('canvas');
          canvas.style.position = 'fixed';
          canvas.style.top = '0'; canvas.style.left = '0';
          canvas.style.width = '100%'; canvas.style.height = '100%';
          canvas.style.zIndex = '999998'; canvas.style.cursor = 'crosshair';
          canvas.style.display = 'none';
          document.body.appendChild(canvas);

          const gctx = canvas.getContext('2d')!;
          canvas.width = window.innerWidth; canvas.height = window.innerHeight;

          const sidebar = document.createElement('div');
          sidebar.style.position = 'fixed';
          sidebar.style.top = '20px'; sidebar.style.right = '20px';
          sidebar.style.width = '320px'; sidebar.style.height = 'calc(100vh - 40px)';
          sidebar.style.zIndex = '999999'; sidebar.style.padding = '24px';
          sidebar.style.background = '#0f172a'; sidebar.style.color = 'white';
          sidebar.style.boxShadow = '0 20px 50px rgba(0,0,0,0.5)';
          sidebar.style.fontFamily = 'system-ui, sans-serif';
          sidebar.style.display = 'flex'; sidebar.style.flexDirection = 'column';
          sidebar.style.gap = '20px'; sidebar.style.borderRadius = '16px';
          sidebar.style.border = '1px solid #334155';
          document.body.appendChild(sidebar);

          // Dragging logic
          let isDraggingSidebar = false;
          let sidebarStartX = 0, sidebarStartY = 0;
          let sidebarInitialLeft = 0, sidebarInitialTop = 0;

          const title = document.createElement('div');
          title.style.cursor = 'move';
          title.innerHTML = '<div style="color: #3b82f6; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; pointer-events: none;">Smart Table</div><div style="font-size: 18px; font-weight: 800; pointer-events: none;">Discovery Dashboard</div>';
          sidebar.appendChild(title);

          title.onmousedown = (e) => {
            isDraggingSidebar = true;
            sidebarStartX = e.clientX; sidebarStartY = e.clientY;
            const rect = sidebar.getBoundingClientRect();
            sidebarInitialLeft = rect.left; sidebarInitialTop = rect.top;
            sidebar.style.transition = 'none';
          };

          window.addEventListener('mousemove', (e) => {
            if (!isDraggingSidebar) return;
            const dx = e.clientX - sidebarStartX;
            const dy = e.clientY - sidebarStartY;
            sidebar.style.left = `${sidebarInitialLeft + dx}px`;
            sidebar.style.top = `${sidebarInitialTop + dy}px`;
            sidebar.style.right = 'auto'; sidebar.style.height = 'auto'; sidebar.style.maxHeight = '90vh';
          });

          window.addEventListener('mouseup', () => {
            isDraggingSidebar = false;
          });

          // Canvas resize handler
          window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            draw();
          });

          const sections = document.createElement('div');
          sections.style.flex = '1'; sections.style.overflowY = 'auto';
          sections.style.display = 'flex'; sections.style.flexDirection = 'column';
          sections.style.gap = '24px';
          sidebar.appendChild(sections);

          let selections: Record<string, string> = {};
          let paginationType = 'none';
          let currentPicking: string | null = null;
          const highlightOverlay = document.createElement('div');
          highlightOverlay.style.position = 'fixed'; highlightOverlay.style.zIndex = '999997';
          highlightOverlay.style.border = '2px solid #3b82f6'; highlightOverlay.style.background = 'rgba(59, 130, 246, 0.2)';
          highlightOverlay.style.pointerEvents = 'none'; highlightOverlay.style.display = 'none';
          highlightOverlay.style.borderRadius = '4px';
          document.body.appendChild(highlightOverlay);

          const getUniqueSelector = (el: Element): string => {
            if (el.id && !/^\d/.test(el.id)) return `#${el.id}`;
            const testId = el.getAttribute('data-testid');
            if (testId) return `[data-testid="${testId}"]`;
            const ariaLabel = el.getAttribute('aria-label');
            if (ariaLabel) return `[aria-label="${ariaLabel}"]`;
            const classes = Array.from(el.classList).filter(c => !c.includes('active') && !c.includes('hover'));
            for (const c of classes) {
              const sel = `.${c}`;
              if (document.querySelectorAll(sel).length === 1) return sel;
            }
            const tag = el.tagName.toLowerCase();
            for (const c of classes) {
              const sel = `${tag}.${c}`;
              if (document.querySelectorAll(sel).length === 1) return sel;
            }
            return tag;
          };

          let activeHighlightUpdate: any = null;
          const showHighlight = (sel: string) => {
            try {
              const el = document.querySelector(sel);
              if (el) {
                const updatePos = () => {
                  const r = el.getBoundingClientRect();
                  highlightOverlay.style.top = `${r.top}px`; highlightOverlay.style.left = `${r.left}px`;
                  highlightOverlay.style.width = `${r.width}px`; highlightOverlay.style.height = `${r.height}px`;
                  highlightOverlay.style.display = 'block';
                };
                updatePos();
                el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
                window.addEventListener('scroll', updatePos, { passive: true });
                activeHighlightUpdate = updatePos;
              }
            } catch (e) {}
          };
          const hideHighlight = () => {
            highlightOverlay.style.display = 'none';
            if (activeHighlightUpdate) {
              window.removeEventListener('scroll', activeHighlightUpdate);
              activeHighlightUpdate = null;
            }
          };

          const createSection = (id: string, label: string, desc: string, parent: HTMLElement = sections) => {
            const container = document.createElement('div');
            container.style.display = 'flex'; container.style.flexDirection = 'column'; container.style.gap = '8px';
            container.style.padding = '12px'; container.style.borderRadius = '12px';
            container.style.cursor = 'pointer'; container.style.transition = 'background 0.2s';
            container.onmouseenter = () => container.style.background = '#1e293b';
            container.onmouseleave = () => container.style.background = 'transparent';
            container.onclick = () => startPicking(id);
            
            const head = document.createElement('div');
            head.style.display = 'flex'; head.style.justifyContent = 'space-between'; head.style.alignItems = 'center';
            
            const text = document.createElement('div');
            text.innerHTML = `<div style="font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px;">${label} <span class="status-dot" style="width: 6px; height: 6px; border-radius: 50%; background: #334155;"></span></div><div style="font-size: 11px; opacity: 0.6;">${desc}</div>`;
            head.appendChild(text);
            
            container.appendChild(head);
            
            const val = document.createElement('div');
            val.style.fontSize = '10px'; val.style.color = '#94a3b8'; val.style.padding = '8px 10px';
            val.style.background = '#1e293b50'; val.style.borderRadius = '8px'; val.style.display = 'none';
            val.style.wordBreak = 'break-all'; val.style.cursor = 'help'; val.style.border = '1px solid #334155';
            val.style.marginTop = '4px';
            val.onmouseenter = (e) => { e.stopPropagation(); showHighlight(val.innerText); };
            val.onmouseleave = hideHighlight;
            container.appendChild(val);
            
            parent.appendChild(container);
            return { container, val };
          };

          const tableUI = createSection('table', 'Main Table', 'Target the root container');

          const pagSection = document.createElement('div');
          pagSection.style.display = 'flex'; pagSection.style.flexDirection = 'column'; pagSection.style.gap = '12px';
          pagSection.innerHTML = '<div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase;">Pagination Strategy</div>';
          sections.appendChild(pagSection);

          const pagTypeSelect = document.createElement('select');
          pagTypeSelect.style.width = '100%'; pagTypeSelect.style.padding = '8px'; pagTypeSelect.style.background = '#1e293b';
          pagTypeSelect.style.color = 'white'; pagTypeSelect.style.border = '1px solid #334155'; pagTypeSelect.style.borderRadius = '8px';
          pagTypeSelect.style.fontSize = '12px';
          pagTypeSelect.innerHTML = '<option value="none">None / Auto-detect</option><option value="buttons">Pagination Buttons</option><option value="infinite">Infinite Scroll</option>';
          pagSection.appendChild(pagTypeSelect);

          const pagSubFields = document.createElement('div');
          pagSubFields.style.display = 'none'; pagSubFields.style.flexDirection = 'column'; pagSubFields.style.gap = '16px';
          pagSubFields.style.paddingLeft = '12px'; pagSubFields.style.borderLeft = '2px solid #334155';
          pagSection.appendChild(pagSubFields);

          const nextUI = createSection('goNext', 'Next Button', 'Next page', pagSubFields);
          const prevUI = createSection('goPrevious', 'Prev Button', 'Previous page', pagSubFields);
          const firstUI = createSection('goToFirst', 'First Button', 'Go to first', pagSubFields);
          const lastUI = createSection('goToLast', 'Last Button', 'Go to last', pagSubFields);

          pagTypeSelect.onchange = () => {
            paginationType = pagTypeSelect.value;
            pagSubFields.style.display = paginationType === 'buttons' ? 'flex' : 'none';
          };

          const startPicking = (id: string) => {
            currentPicking = id;
            rect = { x: 0, y: 0, w: 0, h: 0 };
            draw();
            canvas.style.display = 'block';
            sidebar.style.pointerEvents = 'none';
          };

          let startX = 0, startY = 0, isDrawing = false;
          let rect = { x: 0, y: 0, w: 0, h: 0 };

          const draw = () => {
            gctx.clearRect(0, 0, canvas.width, canvas.height);
            gctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            gctx.fillRect(0, 0, canvas.width, canvas.height);
            if (isDrawing || rect.w > 0) {
              gctx.clearRect(rect.x, rect.y, rect.w, rect.h);
              gctx.strokeStyle = '#3b82f6'; gctx.lineWidth = 3;
              gctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
            }
          };

          canvas.onmousedown = (e) => {
            startX = e.clientX; startY = e.clientY; isDrawing = true;
          };
          window.addEventListener('mousemove', (e) => {
            if (!isDrawing) return;
            rect.x = Math.min(e.clientX, startX); rect.y = Math.min(e.clientY, startY);
            rect.w = Math.abs(e.clientX - startX); rect.h = Math.abs(e.clientY - startY);
            draw();
          });
          window.addEventListener('mouseup', () => {
            if (!isDrawing) return;
            isDrawing = false;
            if (rect.w > 2 && rect.h > 2) {
              confirmPick();
            }
          });

          const confirmPick = () => {
            const elements = Array.from(document.querySelectorAll('*'));
            let bestEl: Element | null = null;
            let maxArea = 0;
            for (const el of elements) {
              if (el === canvas || el === sidebar || sidebar.contains(el)) continue;
              const r = el.getBoundingClientRect();
              if (r.left >= rect.x - 2 && r.top >= rect.y - 2 && r.right <= rect.x + rect.w + 2 && r.bottom <= rect.y + rect.h + 2) {
                const area = r.width * r.height;
                if (area > maxArea) { maxArea = area; bestEl = el; }
              }
            }
            
            if (bestEl && currentPicking) {
              const htmlEl = bestEl as HTMLElement;
              const sel = getUniqueSelector(htmlEl);
              selections[currentPicking] = sel;
              
              // Update UI
              const ui = currentPicking === 'table' ? tableUI : currentPicking === 'goNext' ? nextUI : currentPicking === 'goPrevious' ? prevUI : currentPicking === 'goToFirst' ? firstUI : lastUI;
              ui.val.innerText = sel;
              ui.val.style.display = 'block';
              const dot = ui.container.querySelector('.status-dot') as HTMLElement;
              if (dot) dot.style.background = '#10b981';
            }
            
            // Reset
            canvas.style.display = 'none';
            sidebar.style.pointerEvents = 'all';
            rect = { x: 0, y: 0, w: 0, h: 0 };
            currentPicking = null;
          };

          const finishBtn = document.createElement('button');
          finishBtn.innerText = 'Finish & Generate Config';
          finishBtn.style.width = '100%'; finishBtn.style.padding = '14px'; finishBtn.style.background = '#3b82f6';
          finishBtn.style.color = 'white'; finishBtn.style.border = 'none'; finishBtn.style.borderRadius = '12px';
          finishBtn.style.fontWeight = 'bold'; finishBtn.style.cursor = 'pointer';
          sidebar.appendChild(finishBtn);

          finishBtn.onclick = () => {
            document.body.removeChild(canvas); document.body.removeChild(sidebar);
            resolve(selections as any);
          };
        });
      });
      finalSelector = wizardResult.table || input.tableSelector || 'table';
      manualPagination = wizardResult as any;
      console.error(`[Inspector] Guided Discovery finished. Selections: ${JSON.stringify(manualPagination)}`);
    }

    const rawSignals = await collectDomSignals(
      page,
      finalSelector,
      input.options?.generateSnapshot ?? true,
    );
    
    // Override pagination signals if user picked an area
    if (Object.keys(manualPagination).length > 0) {
      console.error(`[Inspector] Using manual pagination overrides: ${JSON.stringify(manualPagination)}`);
    }

    // Logging for debugging (shows up in inspector-server.log)
    console.error(`[Inspector] Collected signals for ${url}:`);
    console.error(`  - Classes: ${rawSignals.classes.length}`);
    console.error(`  - Roles: ${rawSignals.roles.length}`);
    console.error(`  - Glide Canvas: ${rawSignals.hasGlideCanvas}`);
    console.error(`  - Glide Input: ${rawSignals.hasGlideInput}`);
    console.error(`  - Glide Class: ${rawSignals.hasGlideClass}`);
    console.error(`  - Visible Rows: ${rawSignals.visibleRowCount}`);
    if (rawSignals.classes.includes('MuiDataGrid-root')) {
      console.error(`  - FOUND MuiDataGrid-root ✓`);
    } else {
      console.error(`  - MISSING MuiDataGrid-root ✗`);
    }



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
    const selectedModel = (input.options as any)?.model || (process.env.GITHUB_TOKEN ? 'gpt-4o' : 'gpt-4o-mini');

    if (rawSignals.snapshot && (input.options?.llm !== false)) {
      selectorCandidates = await discoverSelectors(
        { preset, virtualization, pagination, loading: stubFindings().loading },
        rawSignals.snapshot,
        selectedModel
      );
    }




    const findings: InspectTableFindings = {

      preset,
      virtualization,
      pagination,
      loading: stubFindings().loading,
      selectorCandidates,
      manualOverrides: manualPagination,
      visibleRowCount: rawSignals.visibleRowCount,
      ariaRowCount: rawSignals.ariaRowCount,
      snapshot: rawSignals.snapshot,
    };

    if (input.options?.verbosity === 'mini') {
      if (findings.snapshot) {
        findings.snapshot = findings.snapshot.slice(0, 500) + '... [TRUNCATED]';
      }
      findings.preset.signals = [];
      findings.virtualization.rows.signals = [];
      findings.virtualization.columns.signals = [];
      findings.pagination.signals = [];
    }

    findings.metadata = {
      generationTimeMs: Math.round(performance.now() - startTime),
      model: selectedModel,
    };




    return findings;





  } finally {
    if (launched) await closeBrowser(launched);
  }
}
