import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { findAirportByIcao, resolveAirportForLocation } from "../_shared/airports.ts";
import { cToF, dailyMaxFromMetars, fetchMetar, round1 } from "../_shared/metar.ts";
import { getTodayYmdInTimezone } from "../_shared/timezone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const SOURCE_LABEL = "NOAA Aviation Weather METAR";

interface ResolutionResult {
  currentTempF: number | null;
  currentTempC: number | null;
  observedHighF: number | null;
  observedHighC: number | null;
  observedLowF: number | null;
  observedLowC: number | null;
  isObserved: boolean;
  source: string;
  stationId: string | null;
  stationName: string | null;
  stationLat: number | null;
  stationLon: number | null;
  latestObsTime: string | null;
  error?: string;
}

function emptyResult(overrides: Partial<ResolutionResult> = {}): ResolutionResult {
  return {
    currentTempF: null,
    currentTempC: null,
    observedHighF: null,
    observedHighC: null,
    observedLowF: null,
    observedLowC: null,
    isObserved: false,
    source: SOURCE_LABEL,
    stationId: null,
    stationName: null,
    stationLat: null,
    stationLon: null,
    latestObsTime: null,
    ...overrides,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  // Fast connectivity check used by client hooks (no upstream fetch).
  if (req.method === "HEAD") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const icaoParam = (url.searchParams.get("icao") || "").trim().toUpperCase();
    const locationParam = (url.searchParams.get("location") || "").trim();
    const dateParam = (url.searchParams.get("date") || "").trim();
    const tzParam = (url.searchParams.get("tz") || "").trim();

    // Reject legacy WU URLs explicitly so stale clients can't silently scrape.
    if (url.searchParams.get("url")) {
      return new Response(
        JSON.stringify(
          emptyResult({
            error:
              "resolution-proxy now requires ?icao=<ICAO>&date=YYYY-MM-DD&tz=<IANA> (METAR-based). The legacy ?url= scraper has been removed.",
          }),
        ),
        { status: 400, headers: jsonHeaders },
      );
    }

    const airport = icaoParam
      ? findAirportByIcao(icaoParam)
      : locationParam
      ? resolveAirportForLocation(locationParam)
      : null;

    if (!airport) {
      return new Response(
        JSON.stringify(emptyResult({ error: "No airport station match found" })),
        { status: 200, headers: jsonHeaders },
      );
    }

    const tz = tzParam || airport.timezone;
    const dateYmd = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : getTodayYmdInTimezone(tz);

    // hours=36 covers a full local day in any timezone with margin for late-day METARs.
    let metars;
    try {
      metars = await fetchMetar(airport.icao, 36);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "METAR fetch failed";
      return new Response(
        JSON.stringify(
          emptyResult({
            stationId: airport.icao,
            stationName: airport.name,
            stationLat: airport.lat,
            stationLon: airport.lon,
            error: `No NOAA METAR observations available (${msg})`,
          }),
        ),
        { status: 200, headers: jsonHeaders },
      );
    }

    if (metars.length === 0) {
      return new Response(
        JSON.stringify(
          emptyResult({
            stationId: airport.icao,
            stationName: airport.name,
            stationLat: airport.lat,
            stationLon: airport.lon,
            error: "No NOAA METAR observations available",
          }),
        ),
        { status: 200, headers: jsonHeaders },
      );
    }

    const agg = dailyMaxFromMetars(metars, dateYmd, tz);

    const result: ResolutionResult = {
      currentTempC: agg.latestTempC !== null ? round1(agg.latestTempC) : null,
      currentTempF: agg.latestTempC !== null ? round1(cToF(agg.latestTempC)) : null,
      observedHighC: agg.highC !== null ? round1(agg.highC) : null,
      observedHighF: agg.highC !== null ? round1(cToF(agg.highC)) : null,
      observedLowC: agg.lowC !== null ? round1(agg.lowC) : null,
      observedLowF: agg.lowC !== null ? round1(cToF(agg.lowC)) : null,
      isObserved: agg.samples > 0,
      source: SOURCE_LABEL,
      stationId: airport.icao,
      // Prefer the API-supplied station name; fall back to the curated entry.
      stationName: agg.stationName ?? airport.name,
      stationLat: agg.stationLat ?? airport.lat,
      stationLon: agg.stationLon ?? airport.lon,
      latestObsTime: agg.latestObsTime,
    };

    if (agg.samples === 0) {
      result.error = `No NOAA METAR observations available for ${dateYmd} (${tz})`;
    }

    return new Response(JSON.stringify(result), { status: 200, headers: jsonHeaders });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify(emptyResult({ error: msg })),
      { status: 500, headers: jsonHeaders },
    );
  }
});
