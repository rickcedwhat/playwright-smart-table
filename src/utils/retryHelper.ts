// Retry helper — executes a function up to N times on failure
interface RetryOptions {
  maxAttempts: number;
  delay: number;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let lastError: unknown;
  for (let attempts = 0; attempts < options.maxAttempts; attempts++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempts < options.maxAttempts - 1) {
        await new Promise(r => setTimeout(r, options.delay));
      }
    }
  }
  throw lastError;
}

export function buildRetryOptions(delay: number, maxAttempts: number): RetryOptions {
  return { delay, maxAttempts };
}
