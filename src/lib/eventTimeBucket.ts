import { eventEndMs } from "@/lib/betTimeWindow";
import type { TemperatureEvent } from "@/lib/polymarket";

const MS_24H = 24 * 60 * 60 * 1000;

/** Sub-tab filters for market lists (wall-clock end vs calendar bet day). */
export type TimeSubTab = "last24h" | "current" | "future";

/**
 * last24h: market `endDate` in (now − 24h, now] — recently ended.
 * current: `betDate` equals today’s calendar string (page-local `todayStr`).
 * future: `betDate` after today.
 */
export function eventMatchesTimeBucket(
  event: { betDate: string; endDate: string },
  bucket: TimeSubTab,
  todayStr: string,
  nowMs: number,
): boolean {
  const endMs = eventEndMs(event);
  if (bucket === "last24h") {
    if (endMs === null) return false;
    return endMs > nowMs - MS_24H && endMs <= nowMs;
  }
  if (bucket === "current") return event.betDate === todayStr;
  return event.betDate > todayStr;
}

export function filterEventsByTimeBucket<T extends { betDate: string; endDate: string }>(
  items: T[],
  bucket: TimeSubTab,
  todayStr: string,
  nowMs: number,
): T[] {
  return items.filter((e) => eventMatchesTimeBucket(e, bucket, todayStr, nowMs));
}

type SearchableEvent = Pick<TemperatureEvent, "title" | "location"> & {
  markets?: { groupItemTitle: string }[];
};

/** Case-insensitive substring on title, location, and outcome labels. */
export function filterEventsBySearch<T extends SearchableEvent>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((e) => {
    if (e.title.toLowerCase().includes(q)) return true;
    if (e.location.toLowerCase().includes(q)) return true;
    for (const m of e.markets ?? []) {
      if (m.groupItemTitle.toLowerCase().includes(q)) return true;
    }
    return false;
  });
}
