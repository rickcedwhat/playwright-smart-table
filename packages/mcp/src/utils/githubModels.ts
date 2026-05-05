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

    if (!response.ok) return ['gpt-4o', 'gpt-4o-mini'];

    const data = await response.json() as any[];
    // Filter for chat/completion models and take the first few
    const models = data
      .filter(m => m.task === 'chat' || m.task === 'completion')
      .map(m => m.name)
      .slice(0, 10);

    return models.length > 0 ? models : ['gpt-4o', 'gpt-4o-mini'];
  } catch (err) {
    console.error('Failed to fetch GitHub models:', err);
    return ['gpt-4o', 'gpt-4o-mini'];
  }
}

export function getLastModel(): string {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return state.lastModel || 'gpt-4o';
    }
  } catch {}
  return 'gpt-4o';
}

export function saveLastModel(model: string) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ lastModel: model }, null, 2));
  } catch {}
}
