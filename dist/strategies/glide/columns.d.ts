import { StrategyContext } from '../../types';
/**
 * Primitive navigation functions for Glide Data Grid.
 * These define HOW to move, not WHEN to move.
 * The orchestration logic lives in _navigateToCell.
 */
export declare const glideGoUp: (context: StrategyContext) => Promise<void>;
export declare const glideGoDown: (context: StrategyContext) => Promise<void>;
export declare const glideGoLeft: (context: StrategyContext) => Promise<void>;
export declare const glideGoRight: (context: StrategyContext) => Promise<void>;
export declare const glideGoHome: (context: StrategyContext) => Promise<void>;
