import { Redis } from '@upstash/redis/cloudflare';
import type { SpendLimits, SpendStatus } from './types.js';
import type { Env } from '../index.js';

// Anthropic Sonnet pricing ($/million tokens)
const PRICE_INPUT_PER_MTOK = 3.0;
const PRICE_OUTPUT_PER_MTOK = 15.0;

export function calculateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * PRICE_INPUT_PER_MTOK +
         (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_MTOK;
}

function dailyKey(repo: string): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `spend:daily:${date}:${repo}`;
}

function globalDailyKey(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `spend:daily:${date}:global`;
}

function globalMonthlyKey(): string {
  const ym = new Date().toISOString().slice(0, 7); // YYYY-MM
  return `spend:monthly:${ym}:global`;
}

const TTL_DAILY_SECS = 48 * 3600;
const TTL_MONTHLY_SECS = 62 * 24 * 3600;

export class SpendGuard {
  private redis: Redis;
  private limits: SpendLimits;

  constructor(env: Env) {
    this.redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
    this.limits = {
      repo_daily: parseFloat(env.SPEND_LIMIT_REPO_DAILY ?? '1'),
      global_daily: parseFloat(env.SPEND_LIMIT_GLOBAL_DAILY ?? '5'),
      global_monthly: parseFloat(env.SPEND_LIMIT_GLOBAL_MONTHLY ?? '10'),
    };
  }

  async checkLimits(repo: string): Promise<{ allowed: boolean; reason?: string }> {
    const [repoDay, globalDay, globalMonth] = await Promise.all([
      this.redis.get<number>(dailyKey(repo)),
      this.redis.get<number>(globalDailyKey()),
      this.redis.get<number>(globalMonthlyKey()),
    ]);

    const rd = repoDay ?? 0;
    const gd = globalDay ?? 0;
    const gm = globalMonth ?? 0;

    if (rd >= this.limits.repo_daily) {
      return { allowed: false, reason: `repo daily limit ($${this.limits.repo_daily.toFixed(2)}) reached — current: $${rd.toFixed(2)}` };
    }
    if (gd >= this.limits.global_daily) {
      return { allowed: false, reason: `global daily limit ($${this.limits.global_daily.toFixed(2)}) reached — current: $${gd.toFixed(2)}` };
    }
    if (gm >= this.limits.global_monthly) {
      return { allowed: false, reason: `global monthly limit ($${this.limits.global_monthly.toFixed(2)}) reached — current: $${gm.toFixed(2)}` };
    }

    return { allowed: true };
  }

  async recordSpend(repo: string, cost: number): Promise<void> {
    const pipeline = this.redis.pipeline();
    const rk = dailyKey(repo);
    const gdk = globalDailyKey();
    const gmk = globalMonthlyKey();

    pipeline.incrbyfloat(rk, cost);
    pipeline.expire(rk, TTL_DAILY_SECS);
    pipeline.incrbyfloat(gdk, cost);
    pipeline.expire(gdk, TTL_DAILY_SECS);
    pipeline.incrbyfloat(gmk, cost);
    pipeline.expire(gmk, TTL_MONTHLY_SECS);

    await pipeline.exec();
  }

  async getSpendStatus(repo: string): Promise<SpendStatus> {
    const [repoDay, globalDay, globalMonth] = await Promise.all([
      this.redis.get<number>(dailyKey(repo)),
      this.redis.get<number>(globalDailyKey()),
      this.redis.get<number>(globalMonthlyKey()),
    ]);

    return {
      repo_daily: repoDay ?? 0,
      global_daily: globalDay ?? 0,
      global_monthly: globalMonth ?? 0,
      limits: { ...this.limits },
    };
  }
}
