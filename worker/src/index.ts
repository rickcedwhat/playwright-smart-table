import { Hono } from 'hono';
import { Receiver } from '@upstash/qstash';
import { GitHubClient } from './lib/github.js';
import { StateManager } from './lib/state.js';
import { handlePullRequest, handleIssueComment, handlePullRequestReview } from './handlers/webhook.js';
import { handleCoordinator } from './handlers/coordinator.js';

export interface Env {
  BOT_PAT: string;
  WEBHOOK_SECRET: string;
  QSTASH_TOKEN: string;
  QSTASH_CURRENT_SIGNING_KEY: string;
  QSTASH_NEXT_SIGNING_KEY: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  GITHUB_REPO: string;
  QUEUE_ISSUE_NUMBER: string;
}

async function verifyGitHubSignature(secret: string, body: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expected = 'sha256=' + Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return signature === expected;
}

async function verifyQStashSignature(
  currentKey: string,
  nextKey: string,
  body: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader) return false;
  // Upstash-Signature is a JWT — use the official Receiver which validates
  // the JWT signature, iss/sub/exp/nbf claims, and body hash correctly.
  const receiver = new Receiver({ currentSigningKey: currentKey, nextSigningKey: nextKey });
  try {
    await receiver.verify({ signature: signatureHeader, body });
    return true;
  } catch {
    return false;
  }
}

const app = new Hono<{ Bindings: Env }>();

app.get('/health', (c) => {
  return c.json({ ok: true, version: '0.1.0' });
});

app.post('/webhook', async (c) => {
  const body = await c.req.text();
  const signature = c.req.header('X-Hub-Signature-256') ?? '';
  const event = c.req.header('X-GitHub-Event') ?? '';

  const valid = await verifyGitHubSignature(c.env.WEBHOOK_SECRET, body, signature);
  if (!valid) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const github = new GitHubClient(c.env.BOT_PAT, c.env.GITHUB_REPO);
  const state = new StateManager(c.env.UPSTASH_REDIS_REST_URL, c.env.UPSTASH_REDIS_REST_TOKEN);

  const ctx = { github, state, env: c.env, event, payload };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = payload as any;
    const action: string = p.action ?? '';

    if (event === 'pull_request' && (action === 'opened' || action === 'synchronize')) {
      await handlePullRequest(ctx);
    } else if (event === 'issue_comment' && (action === 'created' || action === 'edited')) {
      await handleIssueComment(ctx);
    } else if (event === 'pull_request_review' && action === 'submitted') {
      await handlePullRequestReview(ctx);
    }
    // All others: 200 OK (ignored)

    return c.json({ ok: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return c.json({ error: 'Internal error' }, 500);
  }
});

app.post('/coordinator', async (c) => {
  const body = await c.req.text();
  const signatureHeader = c.req.header('Upstash-Signature');

  const valid = await verifyQStashSignature(
    c.env.QSTASH_CURRENT_SIGNING_KEY,
    c.env.QSTASH_NEXT_SIGNING_KEY,
    body,
    signatureHeader ?? null,
  );
  if (!valid) {
    return c.json({ error: 'Invalid QStash signature' }, 401);
  }

  const github = new GitHubClient(c.env.BOT_PAT, c.env.GITHUB_REPO);
  const state = new StateManager(c.env.UPSTASH_REDIS_REST_URL, c.env.UPSTASH_REDIS_REST_TOKEN);

  try {
    await handleCoordinator({ github, state, env: c.env });
    return c.json({ ok: true });
  } catch (err) {
    console.error('Coordinator error:', err);
    return c.json({ error: 'Internal error' }, 500);
  }
});

export default app;
