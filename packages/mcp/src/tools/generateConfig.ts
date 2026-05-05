import { z } from 'zod';
import type { InspectTableFindings } from '../types.js';

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
  } else {
    // 2. Manual Selectors (only if no preset)
    const rowSelector = selectors.row[0]?.selector || 'tr';
    const cellSelector = selectors.cell[0]?.selector || 'td';
    const headerSelector = selectors.header[0]?.selector || 'th';
    configLines.push(`    rowSelector: '${rowSelector}',`);
    configLines.push(`    cellSelector: '${cellSelector}',`);
    configLines.push(`    headerSelector: '${headerSelector}',`);
  }

  // 3. Pagination Strategy
  if (pagination.type.value === 'buttons' && !presetValue) {
    const next = pagination.primitives.goNext.selector;
    const prev = pagination.primitives.goPrevious.selector;
    if (next || prev) {
      configLines.push(`    strategies: {`);
      configLines.push(`        pagination: Strategies.pagination.click({`);
      if (next) configLines.push(`            next: '${next}',`);
      if (prev) configLines.push(`            previous: '${prev}',`);
      configLines.push(`        }),`);
      configLines.push(`    },`);
    }
  }

  const metadataComment = findings.metadata 
    ? `/** Generated in ${findings.metadata.generationTimeMs}ms via ${findings.metadata.model} */\n` 
    : '';


  const virtualizationComment = `    // Virtualization detected: ${virtualization.rows.detected ? 'Rows (Yes)' : 'Rows (No)'}, ${virtualization.columns.detected ? 'Cols (Yes)' : 'Cols (No)'}`;

  const code = `${metadataComment}import { ${imports.join(', ')} } from 'playwright-smart-table';

const table = useTable(page.locator('${rootSelector}'), {
${configLines.join('\n')}
${virtualizationComment}
});

// Example usage:
// const rows = await table.getAllRows();
// console.log(await rows[0].asJSON());`;

  return code;
}

