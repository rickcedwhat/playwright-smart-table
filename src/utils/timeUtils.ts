/**
 * Formats a duration in milliseconds to a human-readable string.
 *
 * @param ms - Duration in milliseconds (non-negative)
 * @returns Formatted string such as "1h 23m 45s" or "< 1s"
 *
 * @example
 * formatDuration(0)       // "< 1s"
 * formatDuration(90000)   // "1m 30s"
 * formatDuration(3661000) // "1h 1m 1s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return '< 1s';
  const totalSeconds = Math.floor(ms / 1000);
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours   > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}
