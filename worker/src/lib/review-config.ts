import type { GitHubClient } from './github.js';
import type { ReviewConfig } from './types.js';

const DEFAULT_CONFIG: ReviewConfig = {
  focus: [],
  ignore: [],
  context_files: [],
  checklist: [],
};

function parseYaml(text: string): ReviewConfig {
  const result: ReviewConfig = { ...DEFAULT_CONFIG };

  const parseStringList = (key: string): string[] | undefined => {
    const blockMatch = text.match(new RegExp(`^${key}:\\s*\\n((?:\\s+-[^\\n]+\\n?)+)`, 'm'));
    if (blockMatch) {
      return blockMatch[1]
        .split('\n')
        .map(l => l.replace(/^\s+-\s*/, '').trim())
        .filter(Boolean);
    }
    const inlineMatch = text.match(new RegExp(`^${key}:\\s*\\[([^\\]]*)\\]`, 'm'));
    if (inlineMatch) {
      return inlineMatch[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    }
    return undefined;
  };

  const focus = parseStringList('focus');
  if (focus !== undefined) result.focus = focus;

  const ignore = parseStringList('ignore');
  if (ignore !== undefined) result.ignore = ignore;

  const context_files = parseStringList('context_files');
  if (context_files !== undefined) result.context_files = context_files;

  const checklist = parseStringList('checklist');
  if (checklist !== undefined) result.checklist = checklist;

  const modelMatch = text.match(/^model_override:\s*['"]?([^'"\n]+)['"]?\s*$/m);
  if (modelMatch) result.model_override = modelMatch[1].trim();

  const planningMatch = text.match(/^planning:/m);
  if (planningMatch) {
    result.planning = {};
    const enabledMatch = text.match(/^  enabled:\s*(true|false)/m);
    if (enabledMatch) result.planning.enabled = enabledMatch[1] === 'true';
    const planFocus = parseStringList('  focus');
    if (planFocus !== undefined) result.planning.focus = planFocus;
  }

  return result;
}

export async function fetchReviewConfig(
  github: GitHubClient,
  ref: string,
): Promise<ReviewConfig> {
  try {
    const content = await github.getFileContent('.bot-review.yaml', ref);
    if (!content) return { ...DEFAULT_CONFIG };
    return parseYaml(content);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function getContextFiles(
  github: GitHubClient,
  config: ReviewConfig,
  ref: string,
): Promise<Record<string, string>> {
  if (!config.context_files?.length) return {};

  const entries = await Promise.all(
    config.context_files.map(async (path) => {
      try {
        const content = await github.getFileContent(path, ref);
        return content ? [path, content] as const : null;
      } catch {
        return null;
      }
    }),
  );

  return Object.fromEntries(entries.filter((e): e is [string, string] => e !== null));
}
