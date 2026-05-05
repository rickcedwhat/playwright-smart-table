import { z } from 'zod';
import { InspectTableInputSchema, inspectTable } from './inspectTable.js';
import { generateConfig } from './generateConfig.js';

export const InspectAndGenerateInputSchema = InspectTableInputSchema;

export async function inspectAndGenerate(input: z.infer<typeof InspectAndGenerateInputSchema>): Promise<string> {
  // 1. Run the inspection
  const findings = await inspectTable(input);
  
  // 2. Generate the config
  const config = await generateConfig({ findings });
  
  return config;
}
