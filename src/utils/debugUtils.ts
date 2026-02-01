import type { Locator } from '@playwright/test';
import type { FinalTableConfig } from '../types';

/**
 * Get delay for specific action type
 */
export function getDebugDelay(
    config: FinalTableConfig,
    actionType: 'pagination' | 'getCell' | 'findRow' | 'default'
): number {
    if (!config.debug?.slow) return 0;

    if (typeof config.debug.slow === 'number') {
        return config.debug.slow;
    }

    return config.debug.slow[actionType] ?? config.debug.slow.default ?? 0;
}

/**
 * Add debug delay for specific action type
 */
export async function debugDelay(
    config: FinalTableConfig,
    actionType: 'pagination' | 'getCell' | 'findRow' | 'default'
) {
    const delay = getDebugDelay(config, actionType);
    if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

/**
 * Log debug message based on log level
 */
export function logDebug(
    config: FinalTableConfig,
    level: 'error' | 'info' | 'verbose',
    message: string,
    data?: any
) {
    const logLevel = config.debug?.logLevel ?? 'none';
    const levels = { none: 0, error: 1, info: 2, verbose: 3 };

    if (levels[logLevel] >= levels[level]) {
        const prefix = level === 'error' ? '❌' : level === 'info' ? 'ℹ️' : '🔍';
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        console.log(`${prefix} [${timestamp}] [SmartTable] ${message}`, data ?? '');
    }
}

/**
 * Warn if debug.slow is enabled in CI environment
 */
export function warnIfDebugInCI(config: FinalTableConfig) {
    if (process.env.CI === 'true' && config.debug?.slow) {
        console.warn(
            '⚠️  [SmartTable] Warning: debug.slow is enabled in CI environment.\n' +
            '   This will significantly slow down test execution.\n' +
            '   Consider disabling debug mode in CI.'
        );
    }
}
