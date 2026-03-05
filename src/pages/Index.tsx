import { useMemo, useState, useEffect } from "react";
import { usePolymarketData } from "@/hooks/usePolymarketData";
import { StatusBar } from "@/components/StatusBar";
import { TemperatureBetCard } from "@/components/TemperatureBetCard";
import { Thermometer, RefreshCw, AlertTriangle } from "lucide-react";

const Index = () => {
  const { data: bets, isLoading, error, dataUpdatedAt, refetch, isFetching } = usePolymarketData();
  const [userTimezone, setUserTimezone] = useState("UTC");

  useEffect(() => {
    try {
      setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      setUserTimezone("UTC");
    }
  }, []);

  const newSignals = useMemo(() => bets?.filter((b) => b.isNew).length ?? 0, [bets]);
  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  return (
    <div className="relative min-h-screen bg-background">
      {/* Scanline effect */}
      <div className="scanline fixed inset-0 z-50 h-[200%]" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <Thermometer className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                POLYMARKET TEMP TRACKER
              </h1>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Daily Temperature Bet Monitor
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Status Bar */}
        <div className="mb-6">
          <StatusBar
            totalBets={bets?.length ?? 0}
            newSignals={newSignals}
            lastRefresh={lastRefresh}
            userTimezone={userTimezone}
          />
        </div>

        {/* Content */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="mb-3 h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Scanning Polymarket for temperature bets...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertTriangle className="mb-3 h-6 w-6 text-destructive" />
            <p className="text-sm text-destructive">Failed to fetch data from Polymarket</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The API may be rate-limited or unavailable. Try refreshing.
            </p>
          </div>
        )}

        {!isLoading && !error && bets && bets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <Thermometer className="mb-3 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No active temperature bets found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              New temperature markets will appear here automatically when they go live.
            </p>
          </div>
        )}

        {bets && bets.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {bets.map((bet) => (
              <TemperatureBetCard key={bet.id} bet={bet} userTimezone={userTimezone} />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 border-t border-border pt-4 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
          Data sourced from Polymarket Gamma API · Auto-refreshes every 60s
        </div>
      </div>
    </div>
  );
};

export default Index;
