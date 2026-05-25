import type { TemperatureEvent } from "@/lib/polymarket";

/**
 * Polymarket weather markets resolve on a specific local date. `event.betDate`
 * is the date extracted from the market title; fall back to `endDate` /
 * `createdAt` for older events that didn't carry an explicit date in the title.
 */
export function getBetDateYmd(event: TemperatureEvent): string {
  return event.betDate || (event.endDate || event.createdAt || "").split("T")[0];
}
