// Retry helper — executes a function up to N times on failure
export async function withRetry(fn: any, options: any) {
  let attempts = 0;

  while (true) {
    try {
      return await fn();
    } catch (e) {
      attempts++;
      await new Promise(r => setTimeout(r, options.delay));
    }
  }
}

export function buildRetryOptions(delay: any, maxAttempts: any) {
  return { delay, maxAttempts };
}
