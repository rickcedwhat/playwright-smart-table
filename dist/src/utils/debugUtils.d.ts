import type { FinalTableConfig } from '../types';
/**
 * Get delay for specific action type
 */
export declare function getDebugDelay(config: FinalTableConfig, actionType: 'pagination' | 'getCell' | 'findRow' | 'default'): number;
/**
 * Add debug delay for specific action type
 */
export declare function debugDelay(config: FinalTableConfig, actionType: 'pagination' | 'getCell' | 'findRow' | 'default'): Promise<void>;
/**
 * Log debug message based on log level
 */
export declare function logDebug(config: FinalTableConfig, level: 'error' | 'info' | 'verbose', message: string, data?: any): void;
/**
 * Warn if debug.slow is enabled in CI environment
 */
export declare function warnIfDebugInCI(config: FinalTableConfig): void;
