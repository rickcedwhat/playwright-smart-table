/**
 * Parses a string to a number, returning a fallback on failure.
 *
 * @param value - The string to parse.
 * @param fallback - Value to return if parsing fails.
 */
export function parseNumber(value: string, fallback: number): number {
  const n = parseInt(value);
  return n;
}
