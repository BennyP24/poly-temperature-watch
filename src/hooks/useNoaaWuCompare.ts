import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TemperatureEvent } from "@/lib/polymarket";
import { fetchNoaaWuCompare, type NoaaWuCompareRequest, type NoaaWuCompareResponse } from "@/lib/noaaWuCompare";
import { getApproxCoordsForWuResolutionUrl } from "@/lib/wuIcaoCoords";
import type { ResolutionStatus } from "@/hooks/useResolutionData";

/**
 * For each event with a WU observed daily high and a resolvable station URL, POST `noaa-wu-compare`
 * (NWS Tmax vs WU high, METAR LEMD fallback outside US for Madrid-area coords).
 */
export function useNoaaWuCompare(
  events: TemperatureEvent[] | undefined,
  resolutionByEventId: Record<string, ResolutionStatus> | undefined,
) {
  const inputs = useMemo(() => {
    if (!events?.length || !resolutionByEventId) return [] as { id: string; body: NoaaWuCompareRequest }[];
    const list: { id: string; body: NoaaWuCompareRequest }[] = [];
    for (const e of events) {
      const rs = resolutionByEventId[e.id];
      if (!e.resolutionSource?.trim() || !rs) continue;
      const highF = rs.observedHighF;
      if (highF == null || !Number.isFinite(highF)) continue;
      const wuC =
        rs.observedHighC != null && Number.isFinite(rs.observedHighC)
          ? rs.observedHighC
          : (highF - 32) * (5 / 9);
      const coords = getApproxCoordsForWuResolutionUrl(e.resolutionSource);
      if (!coords) continue;
      const date = e.betDate?.trim() || e.endDate.split("T")[0];
      list.push({
        id: e.id,
        body: {
          lat: coords.lat,
          lon: coords.lon,
          wundergroundDailyHighC: wuC,
          date,
        },
      });
    }
    return list;
  }, [events, resolutionByEventId]);

  const cacheKey = useMemo(
    () => inputs.map(({ id, body }) => `${id}:${body.lat}:${body.lon}:${body.wundergroundDailyHighC}:${body.date ?? ""}`).sort().join("|"),
    [inputs],
  );

  return useQuery<Record<string, NoaaWuCompareResponse>>({
    queryKey: ["noaa-wu-compare", cacheKey],
    queryFn: async () => {
      const out: Record<string, NoaaWuCompareResponse> = {};
      await Promise.all(
        inputs.map(async ({ id, body }) => {
          try {
            out[id] = await fetchNoaaWuCompare(body);
          } catch {
            /* per-event failure: omit */
          }
        }),
      );
      return out;
    },
    enabled: inputs.length > 0,
    staleTime: 120_000,
    refetchInterval: 180_000,
    retry: 1,
  });
}
