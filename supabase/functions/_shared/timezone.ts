/**
 * Timezone helpers shared between the Vite frontend and Supabase edge functions.
 *
 * All public functions are pure and timezone-aware via `Intl.DateTimeFormat`.
 * Both V8 (Node/Deno) and modern browser engines ship full IANA tzdata.
 */

/** Calendar `YYYY-MM-DD` in the given IANA timezone (defaults to `now`). */
export function getTodayYmdInTimezone(timeZone: string, date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    /* invalid TZ */
  }
  return date.toISOString().split("T")[0];
}

/**
 * UTC offset (in minutes, east-of-UTC positive) experienced **at** `instant`
 * in `timeZone`. Uses Intl parts to compute the offset without relying on
 * non-standard helpers (matches what `Intl.DateTimeFormat({ timeZoneName })`
 * yields). The result accounts for DST at that exact moment.
 */
function getUtcOffsetMinutes(timeZone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/**
 * The `Date` representing the local wall-clock `YYYY-MM-DD HH:MM:SS` in
 * `timeZone`. Iterates twice to converge across DST transitions (the first
 * guess can over- or under-shoot by an hour on a transition day).
 */
function zonedDateToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const off1 = getUtcOffsetMinutes(timeZone, new Date(guess));
  const t1 = guess - off1 * 60_000;
  const off2 = getUtcOffsetMinutes(timeZone, new Date(t1));
  return new Date(guess - off2 * 60_000);
}

/**
 * UTC bounds for the local calendar day `dateYmd` in `timeZone`, i.e. the
 * inclusive `start` (local 00:00:00) and exclusive `end` (next local 00:00:00).
 * Use to filter timestamped observations (e.g. METARs) to a single bet day.
 *
 * @example
 *   localDayUtcWindow("2026-05-26", "Pacific/Auckland")
 *   // → start: 2026-05-25T12:00Z, end: 2026-05-26T12:00Z (NZST = UTC+12)
 */
export function localDayUtcWindow(
  dateYmd: string,
  timeZone: string,
): { start: Date; end: Date } | null {
  const m = dateYmd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const start = zonedDateToUtc(timeZone, y, mo, d, 0, 0, 0);
  const end = zonedDateToUtc(timeZone, y, mo, d + 1, 0, 0, 0);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
  return { start, end };
}
