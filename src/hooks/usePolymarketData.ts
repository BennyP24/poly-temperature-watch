import { useQuery } from "@tanstack/react-query";
import { fetchTemperatureEvents, type TemperatureEvent } from "@/lib/polymarket";

export function usePolymarketData(overrideIntervalMs?: number) {
  return useQuery<TemperatureEvent[]>({
    queryKey: ["polymarket-temperature"],
    queryFn: async () => {
      // #region agent log
      fetch('http://127.0.0.1:7858/ingest/c2b3a394-85aa-4e8d-a530-1fbc8eb60c4e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7152ff'},body:JSON.stringify({sessionId:'7152ff',runId:'initial',hypothesisId:'H6',location:'src/hooks/usePolymarketData.ts:7',message:'React Query invoking fetchTemperatureEvents',data:{overrideIntervalMs:overrideIntervalMs ?? null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      try {
        return await fetchTemperatureEvents();
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7858/ingest/c2b3a394-85aa-4e8d-a530-1fbc8eb60c4e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7152ff'},body:JSON.stringify({sessionId:'7152ff',runId:'initial',hypothesisId:'H6',location:'src/hooks/usePolymarketData.ts:12',message:'React Query observed fetchTemperatureEvents throw',data:{error:error instanceof Error ? error.message : String(error)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        throw error;
      }
    },
    refetchInterval: overrideIntervalMs ?? 5_000,
    refetchIntervalInBackground: true,
    staleTime: 3_000,
    retry: 2,
    placeholderData: (prev) => prev,
  });
}
