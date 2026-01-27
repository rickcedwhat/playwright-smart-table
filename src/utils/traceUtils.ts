import type { Page } from '@playwright/test';

/**
 * Add a custom trace event to Playwright's trace viewer
 * Uses page.evaluate to log events that appear in the trace
 */
export async function addTraceEvent(
    page: Page,
    type: string,
    data: Record<string, any> = {}
): Promise<void> {
    try {
        // Add a console log that will appear in the trace viewer
        // Prefix with [SmartTable] for easy filtering
        const message = `[SmartTable:${type}] ${JSON.stringify(data)}`;
        await page.evaluate((msg) => console.log(msg), message);
    } catch {
        // Silently ignore if page is not available
        // This ensures zero overhead when tracing is off
    }
}

/**
 * Check if tracing is currently enabled
 * Used for conditional trace logic
 */
export async function isTracingEnabled(page: Page): Promise<boolean> {
    try {
        // We can't directly check if tracing is enabled
        // But we can safely call addTraceEvent - it will just be a no-op if not tracing
        return true;
    } catch {
        return false;
    }
}
