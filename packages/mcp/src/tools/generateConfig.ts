import { z } from 'zod';
import type { InspectTableFindings } from '../types.js';

function escapeSingleQuoted(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export const GenerateConfigInputSchema = z.object({
  findings: z.any(), // Type checked manually inside
});

export type GenerateConfigInput = z.infer<typeof GenerateConfigInputSchema>;

export async function generateConfig(input: GenerateConfigInput): Promise<string> {
  const findings = input.findings as InspectTableFindings;
  
  const presetValue = findings.preset.value;
  const selectors = findings.selectorCandidates;
  const pagination = findings.pagination;
  const virtualization = findings.virtualization;

  let imports = ["useTable", "Strategies"];
  let configLines: string[] = [];
  let rootSelector = 'table';

  // 1. Preset Handling
  if (presetValue) {
    imports.push("presets");
    const presetVar = presetValue === 'mui-datagrid' ? 'muiDataGrid' : 
                    presetValue === 'rdg' ? 'rdg' : 
                    presetValue === 'glide' ? 'glide' : 'muiTable';
    configLines.push(`    ...presets.${presetVar},`);
    
    // Attempt to find a better root selector from signals
    const rootSignal = findings.preset.signals.find(s => s.includes('.MuiDataGrid-root') || s.includes('.rdg') || s.includes('.dvn-'));
    if (rootSignal) {
      rootSelector = rootSignal.split(' ')[0].replace(' ✓', '').replace(' ✗', '');
    }

    // Add suggested selectors as comments for customisation
    const rowSelector = selectors.row[0]?.selector;
    const cellSelector = selectors.cell[0]?.selector;
    if (rowSelector || cellSelector) {
      configLines.push(`\n    // Custom overrides (detected):`);
      if (rowSelector) configLines.push(`    // rowSelector: '${escapeSingleQuoted(rowSelector)}',`);
      if (cellSelector) configLines.push(`    // cellSelector: '${escapeSingleQuoted(cellSelector)}',`);
    }
  } else {
    // 2. Manual Selectors (only if no preset)
    const rowSelector = selectors.row[0]?.selector || 'tr';
    const cellSelector = selectors.cell[0]?.selector || 'td';
    const headerSelector = selectors.header[0]?.selector || 'th';
    configLines.push(`    rowSelector: '${escapeSingleQuoted(rowSelector)}',`);
    configLines.push(`    cellSelector: '${escapeSingleQuoted(cellSelector)}',`);
    configLines.push(`    headerSelector: '${escapeSingleQuoted(headerSelector)}',`);
  }

  // 3. Virtualization Config
  if (virtualization.rows.detected || virtualization.columns.detected) {
    configLines.push(`\n    // Optimized for virtualization`);
    configLines.push(`    rowVirtualization: ${virtualization.rows.detected},`);
    if (virtualization.columns.detected) {
      configLines.push(`    columnVirtualization: true,`);
    }
  }

  // 4. Pagination Strategy
  const manual = findings.manualOverrides || {};
  if (manual.table) rootSelector = manual.table;

  const next = manual.goNext || (pagination.type.value === 'buttons' ? pagination.primitives.goNext.selector : null);
  const prev = manual.goPrevious || (pagination.type.value === 'buttons' ? pagination.primitives.goPrevious.selector : null);
  const last = manual.goToLast || (pagination.type.value === 'buttons' ? pagination.primitives.goToLast.selector : null);
  const first = manual.goToFirst || (pagination.type.value === 'buttons' ? pagination.primitives.goToFirst.selector : null);

  if ((next || prev || last || first) && !presetValue) {
    configLines.push(`\n    strategies: {`);
    configLines.push(`        pagination: Strategies.pagination.click({`);
    if (next) configLines.push(`            next: '${escapeSingleQuoted(next)}',`);
    if (prev) configLines.push(`            previous: '${escapeSingleQuoted(prev)}',`);
    if (last) configLines.push(`            last: '${escapeSingleQuoted(last)}',`);
    if (first) configLines.push(`            first: '${escapeSingleQuoted(first)}',`);
    configLines.push(`        }),`);
    configLines.push(`    },`);
  }

  // 5. Build discovery insights comment
  const insights: string[] = [];
  if (findings.preset.value) insights.push(`- Identified as ${findings.preset.value} (${Math.round(findings.preset.confidence * 100)}% confidence)`);
  if (findings.visibleRowCount) insights.push(`- Found ${findings.visibleRowCount} visible rows`);
  if (findings.ariaRowCount) insights.push(`- aria-rowcount: ${findings.ariaRowCount}`);
  if (virtualization.rows.detected) insights.push(`- Row virtualization detected`);
  if (Object.keys(manual).length > 0) insights.push(`- Applied ${Object.keys(manual).length} manual selector overrides`);
  
  const insightBlock = insights.length > 0 
    ? `\n  /**\n   * Discovery Insights:\n   * ${insights.join('\n   * ')}\n   */\n` 
    : '';

  const metadataComment = findings.metadata 
    ? `/** Generated in ${findings.metadata.generationTimeMs}ms via ${findings.metadata.model} */\n` 
    : '';

  const code = `${metadataComment}import { ${imports.join(', ')} } from 'playwright-smart-table';

const table = useTable(page.locator('${rootSelector}'), {${insightBlock}${configLines.join('\n')}
});

// Example usage:
// const rows = await table.getAllRows();
// console.log(await rows[0].asJSON());`;

  return code;
}

