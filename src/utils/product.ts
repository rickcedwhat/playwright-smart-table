/** Returns the product of an array of numbers. Returns 1 for empty arrays. */
export function product(values: number[]): number {
  return values.reduce((acc, v) => acc * v, 1);
}
