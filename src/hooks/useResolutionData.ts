import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSupabaseFunctionUrl } from "@/lib/supabaseFunctions";
import { getSupabaseAuthHeaders } from "@/lib/supabaseAuth";

/**
 * One METAR-based temperature reading per Polymarket event.
 *
 * `source` is the constant label "NOAA Aviation Weather METAR" so the UI
 * can confidently brand the value (no silent fallback to OWM/Open-Meteo).
 * Station metadata mirrors what the edge function pulled back from
 * `aviationweather.gov/api/data/metar`.
 */
export interface ResolutionStatus {
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

/** Per-event request fed into the resolver. Built in the page from the airport lookup. */
export interface ResolutionInput {
  icao: string;
  /** Local calendar date (YYYY-MM-DD) the bet resolves on. */
  date: string;
  /** IANA timezone for `date` (typically `event.timezone` / airport timezone). */
  tz: string;
}

const RESOLUTION_SOURCE_LABEL = "NOAA Aviation Weather METAR";

function emptyStatus(overrides: Partial<ResolutionStatus> = {}): ResolutionStatus {
  return {
    currentTempF: null,
    currentTempC: null,
    observedHighF: null,
    observedHighC: null,
    observedLowF: null,
    observedLowC: null,
    isObserved: false,
    source: RESOLUTION_SOURCE_LABEL,
    stationId: null,
    stationName: null,
    stationLat: null,
    stationLon: null,
    latestObsTime: null,
    ...overrides,
  };
}

async function fetchResolutionStatus(input: ResolutionInput): Promise<ResolutionStatus> {
  const params = new URLSearchParams({
    icao: input.icao,
    date: input.date,
    tz: input.tz,
  });
  const fullUrl = `${getSupabaseFunctionUrl("resolution-proxy")}?${params.toString()}`;
  const response = await fetch(fullUrl, { headers: getSupabaseAuthHeaders() });
  if (!response.ok) throw new Error(`resolution-proxy HTTP ${response.status}`);
  const rawText = await response.text();
  if (!rawText) return emptyStatus({ stationId: input.icao });
  let data: ResolutionStatus;
  try {
    data = JSON.parse(rawText) as ResolutionStatus;
  } catch (parseErr) {
    throw parseErr instanceof Error ? parseErr : new Error("resolution-proxy: invalid JSON");
  }
  return {
    ...emptyStatus(),
    ...data,
    source: data.source || RESOLUTION_SOURCE_LABEL,
  };
}

export function useResolutionData(resolutionInputs: Record<string, ResolutionInput>) {
  const inputEntries = useMemo(
    () =>
      Object.entries(resolutionInputs).filter(
        ([, v]) => v && v.icao && v.date && v.tz,
      ),
    [resolutionInputs],
  );

  // ICAO + date + tz fully specify a METAR query, so they belong in the cache key.
  const cacheKey = useMemo(
    () =>
      inputEntries
        .map(([id, v]) => `${id}:${v.icao}:${v.date}:${v.tz}`)
        .sort()
        .join("|"),
    [inputEntries],
  );

  return useQuery<Record<string, ResolutionStatus>>({
    // v5-metar invalidates any cached WU-shape rows from previous client versions.
    queryKey: ["resolution-data", "v5-metar", cacheKey],
    queryFn: async () => {
      if (inputEntries.length === 0) return {};

      const results: Record<string, ResolutionStatus> = {};
      const batches: Promise<void>[] = [];

      for (const [eventId, input] of inputEntries) {
        batches.push(
          fetchResolutionStatus(input)
            .then((status) => {
              results[eventId] = status;
            })
            .catch((err) => {
              results[eventId] = emptyStatus({
                stationId: input.icao,
                error: err instanceof Error ? err.message : "Fetch failed",
              });
            }),
        );
      }

      await Promise.all(batches);
      return results;
    },
    refetchInterval: 120_000,
    staleTime: 60_000,
    retry: 1,
    enabled: inputEntries.length > 0,
  });
}
