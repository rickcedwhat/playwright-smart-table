import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '../../.mcp-state.json');

export async function fetchGitHubModels(): Promise<string[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return ['gpt-4o', 'gpt-4o-mini'];
  }

  try {
    const response = await fetch('https://models.github.ai/catalog/models', {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (!response.ok) return ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o1-mini'];

    const data = await response.json() as any[];
    // Take reasoning, coding, and conversation models
    const models = data
      .filter(m => 
        m.tags?.some((t: string) => ['conversation', 'reasoning', 'coding', 'summarization', 'logic'].includes(t.toLowerCase())) ||
        m.id.includes('gpt') || m.id.includes('llama') || m.id.includes('phi')
      )
      .map(m => m.id)
      .slice(0, 30); // Grab a bigger chunk

    return models.length > 0 ? models : ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o1-mini'];

  } catch (err) {
    console.error('Failed to fetch GitHub models:', err);
    return ['gpt-4o', 'gpt-4o-mini'];
  }
}

export function getLastState(): any {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

export function saveLastState(state: any) {
  try {
    // Only save serializable fields
    const toSave = { ...state };
    fs.writeFileSync(STATE_FILE, JSON.stringify(toSave, null, 2));
  } catch {}
}

