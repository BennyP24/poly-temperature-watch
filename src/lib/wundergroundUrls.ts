import type { TemperatureEvent } from "@/lib/polymarket";

const WU_HOST = /^(www\.)?wunderground\.com$/i;

export function getBetDateYmd(event: TemperatureEvent): string {
  return event.betDate || (event.endDate || event.createdAt || "").split("T")[0];
}

/** First YYYY-MM-DD from an ISO date string (event.betDate, etc.). */
export function normalizeBetDateYmd(d: string | undefined): string | null {
  if (!d || d.length < 10) return null;
  const m = d.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** Calendar date YYYY-MM-DD in a specific IANA timezone (e.g. market location). */
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
 * From a WU "weather" station URL, build the daily history URL for that station and calendar day.
 * Example: /weather/cn/beijing/ZBAA + 2026-03-23 → /history/daily/cn/beijing/ZBAA/date/2026-3-23
 */
export function buildWuHistoryDailyUrl(weatherPageUrl: string, betDateYmd: string): string | null {
  try {
    const norm = normalizeBetDateYmd(betDateYmd);
    if (!norm) return null;
    const u = new URL(weatherPageUrl);
    if (!WU_HOST.test(u.hostname)) return null;
    const path = u.pathname.replace(/\/$/, "");
    const m = path.match(/^\/weather\/(.+)$/i);
    if (!m) return null;
    const rest = m[1];
    const [y, mo, da] = norm.split("-").map((x) => parseInt(x, 10));
    const dateSeg = `${y}-${mo}-${da}`;
    return `https://${u.hostname}/history/daily/${rest}/date/${dateSeg}`;
  } catch {
    return null;
  }
}

/**
 * URL to scrape for WU resolution: past bet days use daily history (final calendar high);
 * today and future use the live weather page.
 *
 * `marketTimezone` should be the bet location’s IANA zone (e.g. Asia/Shanghai for Beijing) so
 * “today” matches the local calendar at the station, not the viewer’s browser date.
 */
export function resolutionSourceForWuScrape(
  resolutionSource: string,
  betDate: string | undefined,
  marketTimezone: string,
  now: Date = new Date(),
): string {
  if (!resolutionSource.includes("wunderground.com")) return resolutionSource;
  if (/wunderground\.com\/history\/daily\//i.test(resolutionSource)) return resolutionSource;
  const norm = normalizeBetDateYmd(betDate);
  const todayYmd = getTodayYmdInTimezone(marketTimezone, now);
  if (!norm || norm >= todayYmd) return resolutionSource;
  const hist = buildWuHistoryDailyUrl(resolutionSource, norm);
  return hist ?? resolutionSource;
}

/** Link shown to users (same rules as {@link resolutionSourceForWuScrape}). */
export function wuResolutionDisplayUrl(
  resolutionSource: string,
  betDate: string | undefined,
  marketTimezone: string,
  now: Date = new Date(),
): string {
  return resolutionSourceForWuScrape(resolutionSource, betDate, marketTimezone, now);
}
