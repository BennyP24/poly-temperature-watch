/**
 * Duration-based risk model for temperature bets.
 *
 * Risk is driven by how long until the market resolves (its `endDate`), not by a
 * fixed assumption that every bet closes in 3 hours. The 2h-3h window is treated
 * as the explicitly "risky" band (outcome still uncertain, little time to react),
 * while anything under 2h is high risk. Cooling that has not been confirmed nudges
 * the risk upward. Thresholds live here so they can be tuned in one place.
 */

export type RiskLevel = "closed" | "high" | "risky" | "elevated" | "low";

/** Hours-until-close thresholds (inclusive upper bounds where noted). */
export const RISK_HIGH_MAX_HOURS = 2; // strictly below this => HIGH
export const RISK_RISKY_MAX_HOURS = 3; // at/below this (and >= HIGH) => RISKY

export interface RiskInput {
  /** Market resolution time (ISO string). */
  endDate: string | undefined;
  /** Reference time in ms (defaults to Date.now()). */
  now?: number;
  /** Whether observed cooling has been confirmed for this bet. */
  coolingConfirmed?: boolean;
}

export interface RiskResult {
  level: RiskLevel;
  /** Whole hours until close (floored). Null when endDate missing/invalid. */
  hoursLeft: number | null;
  /** Fractional hours until close (more precise). Null when missing/invalid. */
  exactHoursLeft: number | null;
  /** Short uppercase label for display, or null when no badge should show. */
  label: string | null;
}

/** Hours (fractional) until `endDate`, or null when missing/invalid. */
export function hoursUntil(endDate: string | undefined, now: number = Date.now()): number | null {
  if (!endDate) return null;
  const end = new Date(endDate).getTime();
  if (!Number.isFinite(end)) return null;
  const diffMs = end - now;
  return diffMs / 3_600_000;
}

/**
 * Classify a bet's risk from its time-to-resolution.
 *
 * - closed: already resolved (<= 0h left)
 * - high: < 2h left
 * - risky: 2h-3h left (the explicit risky window)
 * - elevated: > 3h left but cooling not yet confirmed
 * - low: > 3h left and cooling confirmed (or not an observation bet)
 */
export function computeRisk(input: RiskInput): RiskResult {
  const now = input.now ?? Date.now();
  const exact = hoursUntil(input.endDate, now);

  if (exact === null) {
    return { level: "low", hoursLeft: null, exactHoursLeft: null, label: null };
  }

  const hoursLeft = Math.max(0, Math.floor(exact));

  if (exact <= 0) {
    return { level: "closed", hoursLeft: 0, exactHoursLeft: exact, label: "CLOSED" };
  }

  if (exact < RISK_HIGH_MAX_HOURS) {
    return { level: "high", hoursLeft, exactHoursLeft: exact, label: "HIGH RISK" };
  }

  if (exact <= RISK_RISKY_MAX_HOURS) {
    return { level: "risky", hoursLeft, exactHoursLeft: exact, label: "RISKY" };
  }

  // More than the risky window away: elevated while cooling is unconfirmed, otherwise low.
  // A label is always returned so the card always surfaces a visible risk level.
  if (input.coolingConfirmed === false) {
    return { level: "elevated", hoursLeft, exactHoursLeft: exact, label: "MED RISK" };
  }

  return { level: "low", hoursLeft, exactHoursLeft: exact, label: "LOW RISK" };
}

/** Tailwind text color class for a risk level. */
export function riskTextClass(level: RiskLevel): string {
  switch (level) {
    case "high":
      return "text-destructive";
    case "risky":
      return "text-orange-500";
    case "elevated":
      return "text-amber-500";
    case "low":
      return "text-emerald-500";
    default:
      return "text-muted-foreground";
  }
}

/** Tailwind background tint class for a risk level. */
export function riskBgClass(level: RiskLevel): string {
  switch (level) {
    case "high":
      return "bg-destructive/20";
    case "risky":
      return "bg-orange-500/20";
    case "elevated":
      return "bg-amber-500/15";
    case "low":
      return "bg-emerald-500/10";
    default:
      return "bg-muted/40";
  }
}
