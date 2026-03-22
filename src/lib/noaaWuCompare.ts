import { getSupabaseFunctionUrl } from "@/lib/supabaseFunctions";
import { getSupabaseAuthHeaders } from "@/lib/supabaseAuth";

export interface NoaaWuCompareRequest {
  /** Default 40.45 (Madrid area) */
  lat?: number;
  /** Default -3.58 */
  lon?: number;
  /** Wunderground daily high in °C for the same location/day */
  wundergroundDailyHighC: number;
  /** Local calendar day in `Europe/Madrid` as `YYYY-MM-DD`; omit for “today” there */
  date?: string;
}

export interface NoaaWuCompareResponse {
  noaaStationId: string | null;
  noaaStationName: string | null;
  stationLat: number | null;
  stationLon: number | null;
  distanceKm: number | null;
  noaaDailyMaxC: number | null;
  wundergroundDailyHighC: number;
  differenceC: number | null;
  source: "nws" | "metar_lemd" | "none";
  notes: string[];
  targetLocalDate: string;
  timezone: string;
  requestCoords: { lat: number; lon: number };
  summary: string;
}

/** POST to Edge Function `noaa-wu-compare`: NWS station TMAX vs supplied WU high (METAR LEMD fallback for Madrid). */
export async function fetchNoaaWuCompare(body: NoaaWuCompareRequest): Promise<NoaaWuCompareResponse> {
  const response = await fetch(getSupabaseFunctionUrl("noaa-wu-compare"), {
    method: "POST",
    headers: { ...getSupabaseAuthHeaders() },
    body: JSON.stringify(body),
  });
  const rawText = await response.text();
  let data: unknown;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (parseErr) {
    throw parseErr instanceof Error ? parseErr : new Error("noaa-wu-compare: invalid JSON");
  }
  if (!response.ok) {
    const err = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : response.statusText;
    throw new Error(err);
  }
  return data as NoaaWuCompareResponse;
}
