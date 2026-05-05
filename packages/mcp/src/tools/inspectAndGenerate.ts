import { getInspectTableInputSchema, inspectTable } from './inspectTable.js';
import { generateConfig } from './generateConfig.js';

export const getInspectAndGenerateInputSchema = getInspectTableInputSchema;


export async function inspectAndGenerate(input: any): Promise<string> {

  // 1. Run the inspection
  const findings = await inspectTable(input);
  
  // 2. Generate the config
  const config = await generateConfig({ findings });
  
  return config;
}
