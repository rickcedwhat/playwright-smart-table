import { Redis } from '@upstash/redis/cloudflare';
import type { QueueState, QueuedPR } from './types.js';
import { MAX_TOKENS } from './queue.js';

const KEYS = {
  tokens: 'cr:tokens',
  lastDecremented: 'cr:last_decremented',
  refillQstashId: 'cr:refill_qstash_id',
  refillAt: 'cr:refill_at',
  queuePriority: 'cr:queue:priority',
  queueNormal: 'cr:queue:normal',
  queueBackburner: 'cr:queue:backburner',
  reviewsSession: 'cr:reviews_session',
} as const;


export class StateManager {
  private redis: Redis;

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }

  async getState(): Promise<QueueState> {
    const [
      tokensRaw,
      lastDecrRaw,
      refillQstashId,
      refillAt,
      priorityRaw,
      normalRaw,
      backburnerRaw,
      reviewsRaw,
    ] = await Promise.all([
      this.redis.get<number>(KEYS.tokens),
      this.redis.get<string>(KEYS.lastDecremented),
      this.redis.get<string>(KEYS.refillQstashId),
      this.redis.get<string>(KEYS.refillAt),
      this.redis.get<string>(KEYS.queuePriority),
      this.redis.get<string>(KEYS.queueNormal),
      this.redis.get<string>(KEYS.queueBackburner),
      this.redis.get<number>(KEYS.reviewsSession),
    ]);

    const storedTokens = tokensRaw ?? MAX_TOKENS;
    const lastDecrMs = lastDecrRaw ? new Date(lastDecrRaw).getTime() : NaN;
    const nowMs = Date.now();

    // Lazy refill: add 1 token per elapsed hour since last decrement
    let tokens = storedTokens;
    if (!isNaN(lastDecrMs)) {
      const hoursElapsed = Math.max(0, Math.floor((nowMs - lastDecrMs) / 3_600_000));
      tokens = Math.min(MAX_TOKENS, storedTokens + hoursElapsed);
    }
    tokens = Math.max(0, Math.min(MAX_TOKENS, tokens));

    const parseQueue = (raw: string | null): QueuedPR[] => {
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    return {
      tokens,
      last_decremented_at: lastDecrRaw ?? '',
      refill_qstash_id: refillQstashId ?? '',
      refill_at: refillAt ?? '',
      priority: parseQueue(priorityRaw),
      normal: parseQueue(normalRaw),
      backburner: parseQueue(backburnerRaw),
      reviews_this_session: reviewsRaw ?? 0,
    };
  }

  async saveState(state: QueueState): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.set(KEYS.tokens, state.tokens);
    pipeline.set(KEYS.lastDecremented, state.last_decremented_at || '');
    pipeline.set(KEYS.refillQstashId, state.refill_qstash_id || '');
    pipeline.set(KEYS.refillAt, state.refill_at || '');
    pipeline.set(KEYS.queuePriority, JSON.stringify(state.priority));
    pipeline.set(KEYS.queueNormal, JSON.stringify(state.normal));
    pipeline.set(KEYS.queueBackburner, JSON.stringify(state.backburner));
    pipeline.set(KEYS.reviewsSession, state.reviews_this_session);
    await pipeline.exec();
  }

  async decrementToken(): Promise<number> {
    // Pipeline both ops so decr and timestamp update succeed or fail together
    const now = new Date().toISOString();
    const pipeline = this.redis.pipeline();
    pipeline.decr(KEYS.tokens);
    pipeline.set(KEYS.lastDecremented, now);
    const results = await pipeline.exec();
    return (results[0] as number) ?? 0;
  }

  async incrementToken(): Promise<number> {
    const newVal = await this.redis.incr(KEYS.tokens);
    // Cap at MAX_TOKENS
    if (newVal > MAX_TOKENS) {
      await this.redis.set(KEYS.tokens, MAX_TOKENS);
      return MAX_TOKENS;
    }
    return newVal;
  }
}
