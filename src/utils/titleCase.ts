/**
 * Converts a string to Title Case (first letter of each word capitalized).
 *
 * @param input - The string to convert.
 * @returns The title-cased string.
 */
export function titleCase(input: string): string {
  return input
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
