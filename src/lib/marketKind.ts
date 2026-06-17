/**
 * Detect whether a Polymarket weather event is about the HIGHEST or LOWEST
 * temperature of the day. Polymarket phrases these differently ("highest
 * temperature", "high temp", "hottest", "max" vs "lowest", "low temp",
 * "coldest", "min"), so we match on keywords in the event title (falling back
 * to description). Used for tab routing and for choosing blue (low) vs red
 * (high) accents.
 */

export type TempKind = "highest" | "lowest" | "unknown";

const LOWEST_PATTERNS: RegExp[] = [
  /\blowest\b/i,
  /\bcoldest\b/i,
  /\blow\s+temp/i,
  /\bminimum\b/i,
  /\bmin\.?\s+temp/i,
  /\bovernight\s+low\b/i,
  /\bdaily\s+low\b/i,
];

const HIGHEST_PATTERNS: RegExp[] = [
  /\bhighest\b/i,
  /\bhottest\b/i,
  /\bhigh\s+temp/i,
  /\bmaximum\b/i,
  /\bmax\.?\s+temp/i,
  /\bdaily\s+high\b/i,
];

function matchAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

/**
 * Classify an event by its temperature kind. Lowest patterns are checked first
 * because "low" is the more specific signal; a title with neither keyword
 * defaults to "highest" (the historical assumption for these markets) only when
 * `defaultToHighest` is true, otherwise "unknown".
 */
export function detectTempKind(
  event: { title?: string; description?: string },
  options: { defaultToHighest?: boolean } = {},
): TempKind {
  const text = `${event.title ?? ""} ${event.description ?? ""}`;
  if (matchAny(text, LOWEST_PATTERNS)) return "lowest";
  if (matchAny(text, HIGHEST_PATTERNS)) return "highest";
  return options.defaultToHighest ? "highest" : "unknown";
}

/** True when the event is (or defaults to) a highest-temperature market. */
export function isHighestTempEvent(event: { title?: string; description?: string }): boolean {
  return detectTempKind(event, { defaultToHighest: true }) === "highest";
}

/** True when the event is a lowest-temperature market. */
export function isLowestTempEvent(event: { title?: string; description?: string }): boolean {
  return detectTempKind(event) === "lowest";
}
