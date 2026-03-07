import { useMemo, useState, useEffect } from "react";
import { usePolymarketData } from "@/hooks/usePolymarketData";
import { useWeatherData } from "@/hooks/useWeatherData";
import { useSavedBets } from "@/hooks/useSavedBets";
import { StatusBar } from "@/components/StatusBar";
import { TemperatureBetCard } from "@/components/TemperatureBetCard";
import { Thermometer, RefreshCw, AlertTriangle } from "lucide-react";

const Index = () => {
  const { data: events, isLoading, error, dataUpdatedAt, refetch, isFetching } = usePolymarketData();
  const [userTimezone, setUserTimezone] = useState("UTC");
  const { toggle, isSaved } = useSavedBets();

  useEffect(() => {
    try {
      setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      setUserTimezone("UTC");
    }
  }, []);

  const cities = useMemo(() => {
    if (!events) return [];
    const set = new Set(events.map((e) => e.location.toLowerCase().trim()));
    return Array.from(set);
  }, [events]);

  const { data: weatherData } = useWeatherData(cities);

  const newSignals = useMemo(() => events?.filter((e) => e.isNew).length ?? 0, [events]);
  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  const sortedEvents = useMemo(() => {
    if (!events || events.length === 0) return [];

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const yesterday = new Date(now.getTime() - 86400000);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    return [...events].sort((a, b) => {
      const aDate = (a.endDate || a.createdAt || "").split("T")[0];
      const bDate = (b.endDate || b.createdAt || "").split("T")[0];

      // Yesterday first, then today, then older
      const dateRank = (d: string) => d === yesterdayStr ? 0 : d === todayStr ? 1 : 2;
      const aRank = dateRank(aDate);
      const bRank = dateRank(bDate);
      if (aRank !== bRank) return aRank - bRank;

      // Within same date group, priority cities first (Seoul, Cambodia, Thailand, etc.)
      if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;

      // Then by end date descending
      return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
    });
  }, [events]);

  return (
    <div className="relative min-h-screen bg-background">
      <div className="scanline fixed inset-0 z-50 h-[200%]" />

      <div className="relative z-10 mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Thermometer className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold tracking-tight text-foreground truncate">
                POLYMARKET TEMP TRACKER
              </h1>
              <p className="text-[9px] sm:text-[11px] uppercase tracking-widest text-muted-foreground truncate">
                Daily Temperature Bets · Unfulfilled Only
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 sm:gap-2 rounded-md border border-border bg-secondary px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Status Bar */}
        <div className="mb-4 sm:mb-6">
          <StatusBar
            totalBets={events?.length ?? 0}
            newSignals={newSignals}
            lastRefresh={lastRefresh}
            userTimezone={userTimezone}
          />
        </div>

        {/* Content */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="mb-3 h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Scanning Polymarket for daily temperature bets...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertTriangle className="mb-3 h-6 w-6 text-destructive" />
            <p className="text-sm text-destructive">Failed to fetch data from Polymarket</p>
            <p className="mt-1 text-xs text-muted-foreground">Try refreshing in a moment.</p>
          </div>
        )}

        {!isLoading && !error && events && events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <Thermometer className="mb-3 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No unfulfilled daily temperature bets found</p>
          </div>
        )}

        {sortedEvents.length > 0 && (() => {
          const now = new Date();
          const todayStr = now.toISOString().split("T")[0];
          const yesterday = new Date(now.getTime() - 86400000);
          const yesterdayStr = yesterday.toISOString().split("T")[0];

          let lastDateLabel = "";
          return (
            <div className="space-y-3 sm:space-y-4">
              {sortedEvents.map((event) => {
                const dateStr = (event.endDate || event.createdAt || "").split("T")[0];
                let dateLabel = "";
                if (dateStr === yesterdayStr) dateLabel = "Yesterday's Bets";
                else if (dateStr === todayStr) dateLabel = "Today's Bets";
                else dateLabel = `Bets for ${dateStr}`;

                const showHeader = dateLabel !== lastDateLabel;
                lastDateLabel = dateLabel;

                return (
                  <div key={event.id}>
                    {showHeader && (
                      <h2 className="mb-2 mt-4 first:mt-0 text-xs sm:text-sm font-bold uppercase tracking-wider text-primary">
                        {dateLabel}
                      </h2>
                    )}
                    <TemperatureBetCard
                      event={event}
                      userTimezone={userTimezone}
                      weather={weatherData?.[event.location.toLowerCase().trim()]}
                      isSaved={isSaved(event.id)}
                      onToggleSave={() => toggle(event.id)}
                    />
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Footer */}
        <div className="mt-6 sm:mt-8 border-t border-border pt-3 sm:pt-4 text-center text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground">
          Data from Polymarket Gamma API · Auto-refreshes every 60s · Weather from Open-Meteo (2min refresh)
        </div>
      </div>
    </div>
  );
};

export default Index;
