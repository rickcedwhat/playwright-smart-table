import { z } from 'zod';
import { getInspectTableInputSchema, inspectTable } from './inspectTable.js';
import { generateConfig } from './generateConfig.js';

export const getCompareModelsInputSchema = (models: string[], lastState: any) => {
  const base = getInspectTableInputSchema(models, lastState);
  return z.object({
    url: base.shape.url,
    testUrl: base.shape.testUrl,
    tableSelector: base.shape.tableSelector,
    options: base.shape.options,
    compareModels: z.array(z.enum(models as [string, ...string[]]))
      .describe('List of models to compare side-by-side')
      .default(['gpt-4o', 'gpt-4o-mini']),
  });
};

export async function compareModels(input: any): Promise<string> {
  const models = input.compareModels || ['gpt-4o', 'gpt-4o-mini'];
  
  const results = await Promise.all(
    models.map(async (model: string) => {
      try {
        const findings = await inspectTable({
          ...input,
          options: { ...input.options, model }
        });
        const config = await generateConfig({ findings });
        return { model, config, error: null };
      } catch (err) {
        return { model, config: '', error: String(err) };
      }
    })
  );

  let output = `# Model Comparison Report\n\n`;
  
  for (const res of results) {
    output += `## Model: ${res.model}\n`;
    if (res.error) {
      output += `❌ Error: ${res.error}\n\n`;
    } else {
      output += `\`\`\`typescript\n${res.config}\n\`\`\`\n\n`;
    }
    output += `---\n\n`;
  }

  return output;
}
