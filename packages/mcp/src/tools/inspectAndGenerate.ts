import { getInspectTableInputSchema, inspectTable } from './inspectTable.js';
import { generateConfig } from './generateConfig.js';

export const getInspectAndGenerateInputSchema = getInspectTableInputSchema;


export async function inspectAndGenerate(input: any): Promise<string> {
  const models = input.options?.models || [(process.env.GITHUB_TOKEN ? 'gpt-4o' : 'gpt-4o-mini')];

  
  if (models.length === 1) {
    const findings = await inspectTable({ ...input, options: { ...input.options, model: models[0] } });
    return await generateConfig({ findings });
  }

  // Multi-model mode
  const results = await Promise.all(
    models.map(async (model: string) => {
      try {
        const findings = await inspectTable({ ...input, options: { ...input.options, model } });
        const config = await generateConfig({ findings });
        return { model, config };
      } catch (err) {
        return { model, config: `Error: ${err}` };
      }
    })
  );

  let output = `# Multi-Model Comparison\n\n`;
  for (const res of results) {
    output += `## Model: ${res.model}\n\`\`\`typescript\n${res.config}\n\`\`\`\n\n---\n\n`;
  }

  if (results.length > 1) {
    output += `## All-in-One (Copy Both)\n\`\`\`typescript\n`;
    for (const res of results) {
      output += `// --- MODEL: ${res.model} ---\n${res.config}\n\n`;
    }
    output += `\`\`\`\n`;
  }

  return output;

}

