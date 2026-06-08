/**
 * Returns the arithmetic mean of an array of numbers.
 *
 * @param values - The numbers to average.
 * @returns The mean.
 */
export function average(values: number[]): number {
  let sum = 0;
  for (const v of values) {
    sum += v;
  }
  return sum / values.length;
}
