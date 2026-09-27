import type { SmartRow } from '../types';
import type { NavigationBarrier } from './navigationBarrier';

/**
 * Library-private state stored on SmartRow instances. Not part of the public `SmartRow` type.
 */
export interface SmartRowInternals {
  /** Row re-resolves itself from the `resolveRowIndex` selector on every use (DOM recycling). */
  _selfHealing?: boolean;
  /** Row is being processed inside a batch (map/forEach/filter or findRows). */
  _inBatch?: boolean;
  /** Barrier coordinating column scrolls across rows in `synchronized` iteration. */
  _barrier?: NavigationBarrier;
}

export function internals(row: SmartRow<any>): SmartRowInternals {
  return row as unknown as SmartRowInternals;
}
