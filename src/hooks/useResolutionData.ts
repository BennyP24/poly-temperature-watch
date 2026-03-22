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
}

async function fetchResolutionStatus(url: string): Promise<ResolutionStatus> {
  const fullUrl = `${getSupabaseFunctionUrl("resolution-proxy")}?url=${encodeURIComponent(url)}`;
  const response = await fetch(fullUrl, { headers: getSupabaseAuthHeaders() });
  if (!response.ok) throw new Error(`Resolution proxy error: ${response.status}`);
  return response.json();
}

export function useResolutionData(resolutionUrls: Record<string, string>) {
  const urlEntries = Object.entries(resolutionUrls).filter(([, url]) => url.length > 0);
  const cacheKey = urlEntries.map(([id]) => id).sort().join(",");

  return useQuery<Record<string, ResolutionStatus>>({
    queryKey: ["resolution-data", cacheKey],
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
