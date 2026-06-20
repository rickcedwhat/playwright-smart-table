import type { AIProviderResponse, ReviewConfig, ReviewRound } from './types.js';
import type { Env } from '../index.js';

export interface ReviewContext {
  prNumber: number;
  prTitle: string;
  prBody: string;
  diff: string;
  contextFiles: Record<string, string>;
  config: ReviewConfig;
  history: ReviewRound[];
  headSha: string;
}

export interface PlanContext {
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
  contextFiles: Record<string, string>;
  config: ReviewConfig;
}

export interface AIProvider {
  generateReview(ctx: ReviewContext): Promise<AIProviderResponse>;
  generatePlan(ctx: PlanContext): Promise<AIProviderResponse>;
}

function buildReviewPrompt(ctx: ReviewContext): string {
  const { prNumber, prTitle, prBody, diff, contextFiles, config, history } = ctx;

  const focusSection = config.focus?.length
    ? `\n**Focus areas:**\n${config.focus.map(f => `- ${f}`).join('\n')}`
    : '';
  const ignoreSection = config.ignore?.length
    ? `\n**Ignore patterns:**\n${config.ignore.map(i => `- ${i}`).join('\n')}`
    : '';
  const checklistSection = config.checklist?.length
    ? `\n**Checklist items to verify:**\n${config.checklist.map(c => `- [ ] ${c}`).join('\n')}`
    : '';

  const contextFilesSection = Object.keys(contextFiles).length
    ? '\n\n## Context Files\n' + Object.entries(contextFiles)
        .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
        .join('\n\n')
    : '';

  const historySection = history.length
    ? '\n\n## Prior Review Rounds\n' + history
        .map(r => `**Round ${r.round}** (${r.timestamp.slice(0, 10)}, commit \`${r.commit_sha.slice(0, 7)}\`): ${r.summary}`)
        .join('\n')
    : '';

  return `You are a senior software engineer performing a code review on a pull request.

## Pull Request #${prNumber}: ${prTitle}

${prBody ? `### Description\n${prBody}\n` : ''}${focusSection}${ignoreSection}${checklistSection}${contextFilesSection}${historySection}

## Diff
\`\`\`diff
${diff}
\`\`\`

## Instructions
Review the diff above. Identify bugs, security issues, logic errors, and significant code quality problems. Skip minor style nits unless they affect correctness.

Format your response as GitHub-flavored markdown. Use a brief summary paragraph at the top, then list actionable issues (if any) with file+line references. End with a one-sentence verdict.

If you find actionable issues that block merging, include the phrase "**Actionable issues found**" somewhere in your response. If the PR looks good, include "**No blocking issues**".`;
}

function buildPlanPrompt(ctx: PlanContext): string {
  const { issueNumber, issueTitle, issueBody, contextFiles, config } = ctx;

  const focusSection = config.planning?.focus?.length
    ? `\n**Planning focus:**\n${config.planning.focus.map(f => `- ${f}`).join('\n')}`
    : '';

  const contextFilesSection = Object.keys(contextFiles).length
    ? '\n\n## Context Files\n' + Object.entries(contextFiles)
        .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
        .join('\n\n')
    : '';

  return `You are a senior software engineer tasked with creating an implementation plan for a GitHub issue.

## Issue #${issueNumber}: ${issueTitle}

### Description
${issueBody}
${focusSection}${contextFilesSection}

## Instructions
Create a detailed, actionable implementation plan. Break it down into phases/tasks with clear acceptance criteria. Include:
- What files need to be created or modified
- Key design decisions and rationale
- Potential risks or gotchas
- Testing considerations

Format as GitHub-flavored markdown with clear headers and checkboxes for tasks.`;
}

export class ClaudeProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, modelOverride?: string) {
    this.apiKey = apiKey;
    this.model = modelOverride ?? 'claude-sonnet-4-6';
  }

  async generateReview(ctx: ReviewContext): Promise<AIProviderResponse> {
    const model = ctx.config.model_override ?? this.model;
    return this.callAPI(buildReviewPrompt(ctx), model);
  }

  async generatePlan(ctx: PlanContext): Promise<AIProviderResponse> {
    return this.callAPI(buildPlanPrompt(ctx), this.model);
  }

  private async callAPI(prompt: string, model: string): Promise<AIProviderResponse> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Anthropic API error ${res.status}: ${text}`);
    }

    const data = await res.json() as {
      content: Array<{ type: string; text: string }>;
      usage: { input_tokens: number; output_tokens: number };
      model: string;
    };

    const review_body = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    return {
      review_body,
      input_tokens: data.usage.input_tokens,
      output_tokens: data.usage.output_tokens,
      model: data.model,
    };
  }
}

export class OpenAIProvider implements AIProvider {
  async generateReview(_ctx: ReviewContext): Promise<AIProviderResponse> {
    throw new Error('OpenAIProvider: not implemented');
  }
  async generatePlan(_ctx: PlanContext): Promise<AIProviderResponse> {
    throw new Error('OpenAIProvider: not implemented');
  }
}

export class GeminiProvider implements AIProvider {
  async generateReview(_ctx: ReviewContext): Promise<AIProviderResponse> {
    throw new Error('GeminiProvider: not implemented');
  }
  async generatePlan(_ctx: PlanContext): Promise<AIProviderResponse> {
    throw new Error('GeminiProvider: not implemented');
  }
}

export function createProvider(env: Env): AIProvider {
  const provider = (env.REVIEW_PROVIDER ?? 'claude').toLowerCase();
  if (provider === 'openai') return new OpenAIProvider();
  if (provider === 'gemini') return new GeminiProvider();
  return new ClaudeProvider(env.ANTHROPIC_API_KEY, env.REVIEW_MODEL_OVERRIDE);
}
