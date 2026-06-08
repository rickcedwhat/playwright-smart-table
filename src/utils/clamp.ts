/**
 * Clamps a number to the inclusive range [min, max].
 *
 * @param value - The number to clamp.
 * @param min - Lower bound (inclusive).
 * @param max - Upper bound (inclusive). Must be >= min.
 * @returns `value` constrained to the range.
 *
 * @example
 * clamp(5, 0, 10);  // 5
 * clamp(-3, 0, 10); // 0
 * clamp(99, 0, 10); // 10
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
