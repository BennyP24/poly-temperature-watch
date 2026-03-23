import { useQuery } from "@tanstack/react-query";
import { getSupabaseFunctionUrl } from "@/lib/supabaseFunctions";
import { getSupabaseAuthHeaders } from "@/lib/supabaseAuth";

export interface ResolutionStatus {
  currentTempF: number | null;
  currentTempC: number | null;
  observedHighF: number | null;
  observedHighC: number | null;
  isObserved: boolean;
  source: string;
  error?: string;
  /** Set when WU high is from embedded JSON/heuristics (not guaranteed official daily max). */
  highIsEstimate?: boolean;
}

async function fetchResolutionStatus(url: string): Promise<ResolutionStatus> {
  const fullUrl = `${getSupabaseFunctionUrl("resolution-proxy")}?url=${encodeURIComponent(url)}`;
  const response = await fetch(fullUrl, { headers: getSupabaseAuthHeaders() });
  if (!response.ok) throw new Error(`Resolution proxy error: ${response.status}`);
  const rawText = await response.text();
  let data: ResolutionStatus;
  try {
    data = (rawText ? JSON.parse(rawText) : {}) as ResolutionStatus;
  } catch (parseErr) {
    throw parseErr instanceof Error ? parseErr : new Error("resolution-proxy: invalid JSON");
  }
  return data;
}

export function useResolutionData(resolutionUrls: Record<string, string>) {
  const urlEntries = Object.entries(resolutionUrls).filter(([, url]) => url.length > 0);
  // Must include URLs: past bets switch /weather/ → /history/daily/.../date/... — same event IDs
  // would otherwise reuse cached resolution rows and look like "nothing changed".
  const cacheKey = urlEntries
    .map(([id, url]) => `${id}:${url}`)
    .sort()
    .join("|");

  return useQuery<Record<string, ResolutionStatus>>({
    // Bump when resolution-proxy semantics change so clients drop stale cached highs.
    queryKey: ["resolution-data", "v4-primary-calendar-block", cacheKey],
    queryFn: async () => {
      if (urlEntries.length === 0) return {};

      const results: Record<string, ResolutionStatus> = {};
      const batches: Promise<void>[] = [];

      for (const [eventId, url] of urlEntries) {
        batches.push(
          fetchResolutionStatus(url)
            .then((status) => { results[eventId] = status; })
            .catch(() => {
              results[eventId] = {
                currentTempF: null,
                currentTempC: null,
                observedHighF: null,
                observedHighC: null,
                isObserved: false,
                source: url,
                error: "Fetch failed",
              };
            })
        );
      }

      await Promise.all(batches);
      return results;
    },
    refetchInterval: 120_000,
    staleTime: 60_000,
    retry: 1,
    enabled: urlEntries.length > 0,
  });
}
