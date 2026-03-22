/**
 * NOAA / NWS vs Wunderground daily high comparison (Madrid default coords).
 *
 * NWS api.weather.gov is US-only; Madrid typically has no stations → METAR LEMD fallback.
 * NWS requires a descriptive User-Agent: https://www.weather.gov/documentation/services-web-api
 * Aviation Weather Data API (METAR): https://aviationweather.gov/data/api/ — use a custom User-Agent.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" };

/** Required by NWS — identify this client. */
const NWS_USER_AGENT = "polymarket-bet-watch/1.0 (https://github.com/local; noaa-wu-compare)";

/** Aviation Weather Center recommends a descriptive User-Agent for automated clients. */
const AWC_USER_AGENT = "polymarket-bet-watch/1.0 (https://github.com/local; awc-metar)";

const awcFetch = (url: string) =>
  fetch(url, { headers: { Accept: "application/json", "User-Agent": AWC_USER_AGENT } });

const TZ_MADRID = "Europe/Madrid";
const MAX_STATION_KM = 50;
const PREFERRED_ICAO = "LEMD";

const nwsFetch = (url: string) =>
  fetch(url, { headers: { Accept: "application/geo+json, application/json", "User-Agent": NWS_USER_AGENT } });

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function localDateInTz(isoTimestamp: string, tz: string): string {
  return new Date(isoTimestamp).toLocaleDateString("en-CA", { timeZone: tz });
}

function todayInMadrid(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ_MADRID });
}

/** Normalize request date to YYYY-MM-DD (Europe/Madrid calendar meaning when user passes a plain date). */
function normalizeTargetDate(input: string | undefined, notes: string[]): string {
  if (!input || !String(input).trim()) return todayInMadrid();
  const s = String(input).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  notes.push(`Could not parse date "${s}", using today in ${TZ_MADRID}`);
  return todayInMadrid();
}

function tempToCelsius(value: number | null | undefined, unitCode: string | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  const u = unitCode ?? "";
  if (u.includes("degC")) return value;
  if (u.includes("degF")) return (value - 32) * (5 / 9);
  return value;
}

interface StationCandidate {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
}

function parseStationFeature(f: Record<string, unknown>, targetLat: number, targetLon: number): StationCandidate | null {
  const props = f.properties as Record<string, unknown> | undefined;
  const geom = f.geometry as { type?: string; coordinates?: number[] } | undefined;
  const idUrl = typeof f.id === "string" ? f.id : "";
  const fromUrl = idUrl.split("/").filter(Boolean).pop() ?? "";
  const stationId = String(props?.stationIdentifier ?? fromUrl ?? "").trim();
  if (!stationId) return null;
  const name = String(props?.name ?? stationId);
  const coords = geom?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lon = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const distanceKm = haversineKm(targetLat, targetLon, lat, lon);
  return { id: stationId, name, lat, lon, distanceKm };
}

function pickStation(candidates: StationCandidate[], notes: string[]): StationCandidate | null {
  const inRange = candidates.filter((c) => c.distanceKm <= MAX_STATION_KM);
  if (inRange.length === 0) {
    notes.push(`No stations within ${MAX_STATION_KM} km`);
    return null;
  }
  const lemd = inRange.find((c) => c.id.toUpperCase() === PREFERRED_ICAO);
  if (lemd) {
    notes.push(`Selected preferred station ${PREFERRED_ICAO}`);
    return lemd;
  }
  const icaoLike = inRange.filter((c) => /^[A-Z]{4}$/i.test(c.id));
  const pool = icaoLike.length > 0 ? icaoLike : inRange;
  pool.sort((a, b) => a.distanceKm - b.distanceKm);
  notes.push(`Selected nearest station: ${pool[0].id} (${pool[0].distanceKm.toFixed(1)} km)`);
  return pool[0];
}

async function fetchAllObservationFeatures(stationId: string, notes: string[]): Promise<Record<string, unknown>[]> {
  let url: string | null =
    `https://api.weather.gov/stations/${encodeURIComponent(stationId)}/observations?limit=500`;
  const all: Record<string, unknown>[] = [];
  let pages = 0;
  while (url && pages < 25) {
    pages++;
    const res = await nwsFetch(url);
    if (!res.ok) {
      notes.push(`NWS observations HTTP ${res.status}`);
      break;
    }
    const data = (await res.json()) as Record<string, unknown>;
    const features = Array.isArray(data.features) ? data.features : [];
    for (const feat of features) all.push(feat as Record<string, unknown>);
    const next = data.pagination as { next?: string } | undefined;
    url = typeof next?.next === "string" ? next.next : null;
  }
  return all;
}

function nwsDailyMaxC(
  features: Record<string, unknown>[],
  targetYmd: string,
  notes: string[],
): number | null {
  const temps: number[] = [];
  for (const feat of features) {
    const props = feat.properties as Record<string, unknown> | undefined;
    if (!props) continue;
    const ts = props.timestamp as string | undefined;
    if (!ts) continue;
    const localDay = localDateInTz(ts, TZ_MADRID);
    if (localDay !== targetYmd) continue;
    const tempObj = props.temperature as Record<string, unknown> | undefined;
    const val = tempObj?.value as number | null | undefined;
    const unitCode = tempObj?.unitCode as string | undefined;
    const c = tempToCelsius(val ?? null, unitCode);
    if (c != null && Number.isFinite(c)) temps.push(c);
  }
  if (temps.length === 0) {
    notes.push("No NWS observations with temperature for target local date");
    return null;
  }
  return Math.max(...temps);
}

/** Parse temperature °C from METAR raw text (first TT/Td group after wind/visibility). */
function parseMetarTempC(raw: string): number | null {
  const m = raw.match(/\s(M?\d{2})\/(M?\d{2})(?=\s|$)/);
  if (!m) return null;
  const parseT = (s: string) => {
    if (s.startsWith("M")) return -parseInt(s.slice(1), 10);
    return parseInt(s, 10);
  };
  return parseT(m[1]);
}

/** Aviation Weather Data API METAR JSON row (see /api/data/metar?format=json). */
interface AwcMetarRow {
  reportTime?: string;
  temp?: number;
  rawOb?: string;
}

async function metarLemdDailyMaxC(targetYmd: string, notes: string[]): Promise<{
  max: number | null;
  samples: number;
}> {
  const params = new URLSearchParams({
    ids: PREFERRED_ICAO,
    format: "json",
    hours: "72",
  });
  const url = `https://aviationweather.gov/api/data/metar?${params.toString()}`;
  const res = await awcFetch(url);
  if (!res.ok) {
    notes.push(`Aviation Weather METAR HTTP ${res.status}`);
    return { max: null, samples: 0 };
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    notes.push("Aviation Weather METAR response was not valid JSON");
    return { max: null, samples: 0 };
  }
  const list = Array.isArray(data) ? (data as AwcMetarRow[]) : [];
  if (list.length === 0) {
    notes.push("Aviation Weather METAR returned no rows for LEMD");
    return { max: null, samples: 0 };
  }
  const temps: number[] = [];
  for (const row of list) {
    const tIso = row.reportTime;
    if (!tIso) continue;
    if (localDateInTz(tIso, TZ_MADRID) !== targetYmd) continue;
    let c: number | null = null;
    if (typeof row.temp === "number" && Number.isFinite(row.temp)) c = row.temp;
    else if (typeof row.rawOb === "string") c = parseMetarTempC(row.rawOb);
    if (c != null && Number.isFinite(c)) temps.push(c);
  }
  if (temps.length === 0) {
    notes.push(
      `METAR Data API: ${list.length} recent LEMD observation(s) in window, none for local date ${targetYmd} (rolling hours=72; not full archive)`,
    );
    return { max: null, samples: 0 };
  }
  notes.push(`METAR fallback: ${temps.length} temperature samples for ${targetYmd} (${TZ_MADRID})`);
  return { max: Math.max(...temps), samples: temps.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST JSON body required" }), {
        status: 405,
        headers: jsonHeaders,
      });
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const notes: string[] = [];

    const lat = typeof body.lat === "number" ? body.lat : 40.45;
    const lon = typeof body.lon === "number" ? body.lon : -3.58;
    const wu = body.wundergroundDailyHighC;
    if (typeof wu !== "number" || !Number.isFinite(wu)) {
      return new Response(JSON.stringify({ error: "wundergroundDailyHighC (number, \u00b0C) is required" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const targetYmd = normalizeTargetDate(typeof body.date === "string" ? body.date : undefined, notes);

    let source: "nws" | "metar_lemd" | "none" = "none";
    let noaaStationId: string | null = null;
    let noaaStationName: string | null = null;
    let stationLat: number | null = null;
    let stationLon: number | null = null;
    let distanceKm: number | null = null;
    let noaaDailyMaxC: number | null = null;

    const pointsUrl = `https://api.weather.gov/points/${lat},${lon}`;
    const pointsRes = await nwsFetch(pointsUrl);

    if (pointsRes.ok) {
      const pointsData = (await pointsRes.json()) as Record<string, unknown>;
      const props = pointsData.properties as Record<string, unknown> | undefined;
      const stationsUrl = props?.observationStations as string | undefined;

      if (stationsUrl) {
        const stationsRes = await nwsFetch(stationsUrl);
        if (stationsRes.ok) {
          const gj = (await stationsRes.json()) as Record<string, unknown>;
          const features = Array.isArray(gj.features) ? gj.features : [];
          const candidates: StationCandidate[] = [];
          for (const feat of features) {
            const c = parseStationFeature(feat as Record<string, unknown>, lat, lon);
            if (c) candidates.push(c);
          }
          const picked = pickStation(candidates, notes);
          if (picked) {
            noaaStationId = picked.id;
            noaaStationName = picked.name;
            stationLat = picked.lat;
            stationLon = picked.lon;
            distanceKm = picked.distanceKm;
            const obsFeatures = await fetchAllObservationFeatures(picked.id, notes);
            noaaDailyMaxC = nwsDailyMaxC(obsFeatures, targetYmd, notes);
            if (noaaDailyMaxC != null) source = "nws";
          }
        } else {
          notes.push(`NWS observationStations list HTTP ${stationsRes.status}`);
        }
      } else {
        notes.push("NWS points response missing properties.observationStations");
      }
    } else {
      notes.push(`NWS /points HTTP ${pointsRes.status} (expected outside US for Madrid)`);
    }

    if (noaaDailyMaxC == null) {
      notes.push("Falling back to NOAA Aviation Weather METAR (ICAO LEMD)");
      const met = await metarLemdDailyMaxC(targetYmd, notes);
      noaaDailyMaxC = met.max;
      if (noaaDailyMaxC != null) {
        source = "metar_lemd";
        noaaStationId = PREFERRED_ICAO;
        noaaStationName = "Madrid-Barajas Adolfo Su\u00e1rez Airport (METAR)";
        stationLat = 40.4719;
        stationLon = -3.5626;
        distanceKm = haversineKm(lat, lon, stationLat, stationLon);
      } else {
        source = "none";
      }
    }

    let differenceC: number | null = null;
    if (noaaDailyMaxC != null) {
      differenceC = Math.round((noaaDailyMaxC - wu) * 1000) / 1000;
    }

    const payload = {
      noaaStationId,
      noaaStationName,
      stationLat,
      stationLon,
      distanceKm: distanceKm != null ? Math.round(distanceKm * 1000) / 1000 : null,
      noaaDailyMaxC: noaaDailyMaxC != null ? Math.round(noaaDailyMaxC * 1000) / 1000 : null,
      wundergroundDailyHighC: Math.round(wu * 1000) / 1000,
      differenceC,
      source,
      notes,
      targetLocalDate: targetYmd,
      timezone: TZ_MADRID,
      requestCoords: { lat, lon },
      summary:
        noaaDailyMaxC != null
          ? `NOAA-side max ${noaaDailyMaxC.toFixed(2)}\u00b0C vs WU ${wu.toFixed(2)}\u00b0C \u2192 \u0394 ${differenceC?.toFixed(3)}\u00b0C (${source})`
          : `No NOAA/METAR max for ${targetYmd}; WU reference ${wu.toFixed(2)}\u00b0C`,
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: jsonHeaders,
    });
  } catch (e) {
    const errNotes = [e instanceof Error ? e.message : String(e)];
    return new Response(JSON.stringify({ error: "noaa-wu-compare failed", notes: errNotes }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
