import { z } from 'zod';
import type { InspectTableFindings } from '../types.js';

export const GenerateConfigInputSchema = z.object({
  findings: z.any(), // Type checked manually inside
});

export type GenerateConfigInput = z.infer<typeof GenerateConfigInputSchema>;

export async function generateConfig(input: GenerateConfigInput): Promise<string> {
  const findings = input.findings as InspectTableFindings;
  
  const preset = findings.preset.value;
  const selectors = findings.selectorCandidates;
  const pagination = findings.pagination;
  const virtualization = findings.virtualization;

  let strategyImport = '';
  let strategyConfig = '';

  if (preset === 'mui-datagrid') {
    strategyImport = "import { MuiDataGridStrategy } from 'playwright-smart-table';\n";
    strategyConfig = "    strategy: new MuiDataGridStrategy(),\n";
  } else if (preset === 'rdg') {
    strategyImport = "import { RdgStrategy } from 'playwright-smart-table';\n";
    strategyConfig = "    strategy: new RdgStrategy(),\n";
  } else if (preset === 'glide') {
    strategyImport = "import { GlideStrategy } from 'playwright-smart-table';\n";
    strategyConfig = "    strategy: new GlideStrategy(),\n";
  }

  const rowSelector = selectors.row[0]?.selector || 'TR_OR_DIV_SELECTOR';
  const cellSelector = selectors.cell[0]?.selector || 'TD_OR_DIV_SELECTOR';
  const headerSelector = selectors.header[0]?.selector || 'TH_OR_DIV_SELECTOR';

  const metadataComment = findings.metadata 
    ? `/** Generated in ${findings.metadata.generationTimeMs}ms */\n` 
    : '';

  let paginationSnippet = '';

  if (pagination.type.value === 'buttons') {
    paginationSnippet = `    pagination: {
      type: 'buttons',
      nextSelector: '${pagination.primitives.goNext.selector}',
      prevSelector: '${pagination.primitives.goPrevious.selector}',
    },\n`;
  }

  let code = `${metadataComment}${strategyImport}import { useTable } from 'playwright-smart-table';


const table = useTable(page.locator('YOUR_TABLE_ROOT_SELECTOR'), {
${strategyConfig}    rowSelector: '${rowSelector}',
    cellSelector: '${cellSelector}',
    headerSelector: '${headerSelector}',
${paginationSnippet}    // Virtualization detected: ${virtualization.rows.detected ? 'Rows (Yes)' : 'Rows (No)'}, ${virtualization.columns.detected ? 'Cols (Yes)' : 'Cols (No)'}
});

// Example usage:
// const rows = await table.getAllRows();
// console.log(await rows[0].asJSON());`;

  return code;
}
