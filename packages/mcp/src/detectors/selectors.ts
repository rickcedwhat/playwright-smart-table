import OpenAI from 'openai';
import type { DomSignals, InspectTableFindings, SelectorCandidates } from '../types.js';

/**
 * Uses an LLM to discover row, cell, and header selectors from a DOM snapshot.
 */
export async function discoverSelectors(
  findings: Omit<InspectTableFindings, 'selectorCandidates'>,
  snapshot: string,
  modelOverride?: string
): Promise<SelectorCandidates> {

  const apiKey = process.env.GITHUB_TOKEN || process.env.OPENAI_API_KEY;
  const baseURL = process.env.GITHUB_TOKEN 
    ? 'https://models.inference.ai.azure.com' 
    : undefined;

  if (!apiKey) {
    return { row: [], cell: [], header: [] };
  }

  const client = new OpenAI({ apiKey, baseURL });

  const prompt = `
You are an expert at identifying CSS selectors for table components.
We are using the 'playwright-smart-table' library.
Based on the following DOM snapshot and detection signals, identify the most robust selectors for:
1. Row element (the container for a single data row)
2. Cell element (the container for a single data cell, inside a row)
3. Header element (the container for a column header)

PRESET DETECTED: ${findings.preset.value || 'unknown'}
VIRTUALIZATION: ${JSON.stringify(findings.virtualization)}

DOM SNAPSHOT:
${snapshot}

RETURN ONLY A JSON OBJECT with this structure:
{
  "row": [{ "selector": "string", "confidence": 0-1, "reason": "string" }],
  "cell": [{ "selector": "string", "confidence": 0-1, "reason": "string" }],
  "header": [{ "selector": "string", "confidence": 0-1, "reason": "string" }]
}
Limit to top 3 candidates for each.
  `.trim();

  try {
    const model = modelOverride || process.env.LLM_MODEL || (process.env.GITHUB_TOKEN ? 'gpt-4o' : 'gpt-4o-mini');

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });


    if (!response.choices?.length || !response.choices[0].message?.content) {
      throw new Error(`LLM returned no choices (model=${model}, finish_reason=${response.choices?.[0]?.finish_reason ?? 'unknown'})`);
    }
    const content = response.choices[0].message.content;

    const result = JSON.parse(content);
    return {
      row: result.row || [],
      cell: result.cell || [],
      header: result.header || [],
    };
  } catch (err) {
    console.error('LLM Selector Discovery failed:', err);
    return { row: [], cell: [], header: [] };
  }
}
