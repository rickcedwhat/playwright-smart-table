/** Returns the sum of an array of numbers. Returns 0 for empty arrays. */
export function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
