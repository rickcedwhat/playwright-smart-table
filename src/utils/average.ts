/**
 * Returns the arithmetic mean of an array of numbers.
 * Returns 0 for an empty array.
 *
 * @param values - The numbers to average.
 * @returns The mean, or 0 if `values` is empty.
 */
export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const v of values) {
    sum += v;
  }
  return sum / values.length;
}
