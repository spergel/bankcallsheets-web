/**
 * Format a dollar value stored in thousands (as in Call Reports) to a
 * human-readable string, e.g. 83418 → "$83.4M"
 */
export function formatDollars(thousands: number): string {
  const v = thousands * 1000;
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3)  return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toLocaleString()}`;
}

/** Format a decimal ratio as a percentage string, e.g. 0.0125 → "1.25%" */
export function formatPct(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
