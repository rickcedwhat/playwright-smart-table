/**
 * Generates an array of integers from `start` (inclusive) to `end` (exclusive).
 *
 * @param start - First value in the range.
 * @param end - Upper bound (exclusive).
 * @returns Array of integers, or empty array if start >= end.
 *
 * @example
 * range(0, 5); // [0, 1, 2, 3, 4]
 * range(3, 3); // []
 */
export function range(start: number, end: number): number[] {
  if (start >= end) return [];
  return Array.from({ length: end - start }, (_, i) => start + i);
}
