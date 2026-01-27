import type { Page } from '@playwright/test';
/**
 * Add a custom trace event to Playwright's trace viewer
 * Uses page.evaluate to log events that appear in the trace
 */
export declare function addTraceEvent(page: Page, type: string, data?: Record<string, any>): Promise<void>;
/**
 * Check if tracing is currently enabled
 * Used for conditional trace logic
 */
export declare function isTracingEnabled(page: Page): Promise<boolean>;
