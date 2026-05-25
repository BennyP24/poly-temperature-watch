/**
 * NOAA Aviation Weather Data API METAR client + daily-max aggregator.
 *
 * Endpoint: `https://aviationweather.gov/api/data/metar?ids=<ICAO>&format=json&hours=<N>`
 *
 * Returns the canonical observation rows that drive temperature resolution
 * for Polymarket weather markets (instead of WU scraping or OWM forecasts).
 *
 * Designed to run in both Deno (Supabase edge) and the browser (only used
 * server-side today; pure module so it's safe to import client-side too).
 */

import { localDayUtcWindow } from "./timezone.ts";

const METAR_BASE = "https://aviationweather.gov/api/data/metar";
const DEFAULT_USER_AGENT =
  "polymarket-bet-watch/1.0 (educational paper-trading; weather temperature resolution)";

/** Subset of fields we consume from the AWC `format=json` METAR response. */
export interface MetarObs {
  icaoId: string;
  /** ISO 8601 timestamp string (UTC) from `reportTime`. */
  reportTime: string;
  /** Temperature in °C parsed from the `temp` field (or raw METAR as fallback). */
  tempC: number | null;
  stationName: string | null;
  lat: number | null;
  lon: number | null;
  rawOb: string | null;
}

interface AwcMetarRow {
  icaoId?: string;
  reportTime?: string;
  obsTime?: number;
  temp?: number;
  name?: string;
  lat?: number;
  lon?: number;
  rawOb?: string;
}

/**
 * Parse `TT/DD` temperature group from a raw METAR string (e.g. `"M03/M07"`).
 * Used only when the JSON `temp` field is missing.
 */
export function parseMetarTempC(raw: string): number | null {
  const m = raw.match(/\s(M?\d{2})\/(M?\d{2})(?=\s|$)/);
  if (!m) return null;
  const s = m[1];
  const v = s.startsWith("M") ? -parseInt(s.slice(1), 10) : parseInt(s, 10);
  return Number.isFinite(v) ? v : null;
}

function normalizeRow(row: AwcMetarRow): MetarObs | null {
  const reportTime = typeof row.reportTime === "string" ? row.reportTime : null;
  if (!reportTime) return null;
  let tempC: number | null = null;
  if (typeof row.temp === "number" && Number.isFinite(row.temp)) {
    tempC = row.temp;
  } else if (typeof row.rawOb === "string") {
    tempC = parseMetarTempC(row.rawOb);
  }
  return {
    icaoId: typeof row.icaoId === "string" ? row.icaoId : "",
    reportTime,
    tempC,
    stationName: typeof row.name === "string" ? row.name : null,
    lat: typeof row.lat === "number" ? row.lat : null,
    lon: typeof row.lon === "number" ? row.lon : null,
    rawOb: typeof row.rawOb === "string" ? row.rawOb : null,
  };
}

/**
 * Fetch recent METARs for a single ICAO station. Returns the parsed rows
 * (newest first as the API delivers them). Throws on non-2xx or malformed
 * JSON so the caller can surface a clear `"No NOAA METAR observations
 * available"` error to the UI.
 */
export async function fetchMetar(
  icao: string,
  hours: number,
  fetchImpl: typeof fetch = fetch,
): Promise<MetarObs[]> {
  if (!icao) throw new Error("fetchMetar: icao is required");
  const params = new URLSearchParams({
    ids: icao.toUpperCase(),
    format: "json",
    hours: String(Math.max(1, Math.min(72, Math.floor(hours)))),
  });
  const url = `${METAR_BASE}?${params.toString()}`;
  const resp = await fetchImpl(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": DEFAULT_USER_AGENT,
    },
  });
  if (!resp.ok) {
    throw new Error(`Aviation Weather METAR HTTP ${resp.status}`);
  }
  const text = await resp.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    throw new Error("Aviation Weather METAR returned invalid JSON");
  }
  if (!Array.isArray(data)) return [];
  const out: MetarObs[] = [];
  for (const row of data as AwcMetarRow[]) {
    const norm = normalizeRow(row);
    if (norm) out.push(norm);
  }
  return out;
}

export interface DailyMax {
  /** Highest `temp_c` over METARs in the local-day window, or null when no samples. */
  highC: number | null;
  /** Number of in-window samples that contributed to `highC`. */
  samples: number;
  /** ISO timestamp of the most recent observation in the window (or overall most recent if none in window). */
  latestObsTime: string | null;
  /** Temperature of the most recent observation overall (used for the "current" display). */
  latestTempC: number | null;
  /** Station metadata from the most recent observation that carries it. */
  stationName: string | null;
  stationLat: number | null;
  stationLon: number | null;
}

/**
 * Aggregate METAR observations into a daily-max for the local calendar date
 * `dateYmd` in `tz`. The most recent METAR overall (regardless of window)
 * supplies the "current" temperature / observation time so the UI can keep
 * showing a live reading on days before/after the target.
 */
export function dailyMaxFromMetars(
  metars: MetarObs[],
  dateYmd: string,
  tz: string,
): DailyMax {
  const window = localDayUtcWindow(dateYmd, tz);
  const empty: DailyMax = {
    highC: null,
    samples: 0,
    latestObsTime: null,
    latestTempC: null,
    stationName: null,
    stationLat: null,
    stationLon: null,
  };
  if (!window || metars.length === 0) return { ...empty, ...latestFrom(metars) };

  const { start, end } = window;
  let highC: number | null = null;
  let samples = 0;
  for (const obs of metars) {
    const t = Date.parse(obs.reportTime);
    if (!Number.isFinite(t)) continue;
    if (t < start.getTime() || t >= end.getTime()) continue;
    if (obs.tempC == null) continue;
    samples += 1;
    if (highC === null || obs.tempC > highC) highC = obs.tempC;
  }

  return {
    highC,
    samples,
    ...latestFrom(metars),
  };
}

function latestFrom(metars: MetarObs[]): Pick<
  DailyMax,
  "latestObsTime" | "latestTempC" | "stationName" | "stationLat" | "stationLon"
> {
  let latest: MetarObs | null = null;
  let latestTs = -Infinity;
  for (const obs of metars) {
    const t = Date.parse(obs.reportTime);
    if (!Number.isFinite(t)) continue;
    if (t > latestTs) {
      latestTs = t;
      latest = obs;
    }
  }
  const stationCarrier = metars.find((o) => o.stationName || o.lat != null) ?? latest;
  return {
    latestObsTime: latest?.reportTime ?? null,
    latestTempC: latest?.tempC ?? null,
    stationName: stationCarrier?.stationName ?? null,
    stationLat: stationCarrier?.lat ?? null,
    stationLon: stationCarrier?.lon ?? null,
  };
}

export function cToF(c: number): number {
  return c * (9 / 5) + 32;
}

export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
