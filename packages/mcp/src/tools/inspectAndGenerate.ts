import { getInspectTableInputSchema, inspectTable } from './inspectTable.js';
import { generateConfig } from './generateConfig.js';

export const getInspectAndGenerateInputSchema = getInspectTableInputSchema;


export async function inspectAndGenerate(input: any, ctx?: any): Promise<string> {
  // 1. Run the inspection
  const findings = await inspectTable(input, ctx);
  
  // 2. Generate the config
  const config = await generateConfig({ findings });
  
  return config;
}


