/**
 * Detect when a Polymarket event resolves via Weather Underground (Wunderground).
 *
 * Wunderground station data frequently differs from NOAA METAR (the source this
 * app observes), so bets that Polymarket settles against Wunderground carry extra
 * risk of a mismatch. The UI surfaces a prominent warning when this is detected.
 * We inspect the Gamma `resolutionSource` field and any reference links.
 */

const WUNDERGROUND_PATTERNS: RegExp[] = [
  /wunderground/i,
  /weather\s*underground/i,
  /\bwund\b/i,
  /\bwu\.com\b/i,
];

export interface ResolutionSourceLike {
  resolutionSource?: string | null;
  referenceLinks?: string[] | null;
}

function textMatches(text: string | null | undefined): boolean {
  if (!text) return false;
  return WUNDERGROUND_PATTERNS.some((re) => re.test(text));
}

/** True when the event's resolution source or any reference link points to Wunderground. */
export function isWundergroundSource(event: ResolutionSourceLike): boolean {
  if (textMatches(event.resolutionSource)) return true;
  for (const link of event.referenceLinks ?? []) {
    if (textMatches(link)) return true;
  }
  return false;
}

/** Fixed, prominent warning copy. */
export const WUNDERGROUND_WARNING =
  "RESOLVES VIA WUNDERGROUND \u2014 MAY DIFFER FROM NOAA";
