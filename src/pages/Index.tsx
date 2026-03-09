import { useMemo, useState, useEffect } from "react";
import { usePolymarketData } from "@/hooks/usePolymarketData";
import { useWeatherData } from "@/hooks/useWeatherData";
import { useSavedBets } from "@/hooks/useSavedBets";
import { usePaperTrading } from "@/hooks/usePaperTrading";
import { StatusBar } from "@/components/StatusBar";
import { TemperatureBetCard } from "@/components/TemperatureBetCard";
import { PaperTradeDialog } from "@/components/PaperTradeDialog";
import { PaperTradesSummary } from "@/components/PaperTradesSummary";
import type { TemperatureEvent, TemperatureMarket } from "@/lib/polymarket";
import { Thermometer, RefreshCw, AlertTriangle, DollarSign } from "lucide-react";

const ASIAN_CITIES = ["seoul", "phnom penh", "bangkok", "ho chi minh", "tokyo", "beijing", "shanghai", "hong kong", "singapore", "manila", "jakarta", "kuala lumpur", "delhi", "mumbai", "dubai"];

type TabKey = "asian-past" | "asian-future" | "other-past" | "other-future" | "saved" | "trades";

const TABS: { key: TabKey; label: string; short: string }[] = [
  { key: "asian-past", label: "Asian Markets · Past", short: "Asia Past" },
  { key: "asian-future", label: "Asian Markets · Future", short: "Asia Future" },
  { key: "other-past", label: "Other Markets · Past", short: "Other Past" },
  { key: "other-future", label: "Other Markets · Future", short: "Other Future" },
  { key: "saved", label: "My Marked Trades", short: "Saved" },
  { key: "trades", label: "Paper Trades", short: "Trades" },
];

function isAsianCity(location: string): boolean {
  const lower = location.toLowerCase();
  return ASIAN_CITIES.some(c => lower.includes(c));
}

function getBetDate(event: TemperatureEvent): string {
  return (event.endDate || event.createdAt || "").split("T")[0];
}

const Index = () => {
  const { data: events, isLoading, error, dataUpdatedAt, refetch, isFetching } = usePolymarketData();
  const [userTimezone, setUserTimezone] = useState("UTC");
  const { toggle, isSaved } = useSavedBets();
  const paper = usePaperTrading();
  const [activeTab, setActiveTab] = useState<TabKey>("asian-past");
  const [tradeTarget, setTradeTarget] = useState<{ market: TemperatureMarket; event: TemperatureEvent } | null>(null);

  useEffect(() => {
    try { setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { setUserTimezone("UTC"); }
  }, []);

  const cities = useMemo(() => {
    if (!events) return [];
    const set = new Set(events.map(e => e.location.toLowerCase().trim()));
    return Array.from(set);
  }, [events]);

  const { data: weatherData } = useWeatherData(cities);

  const newSignals = useMemo(() => events?.filter(e => e.isNew).length ?? 0, [events]);
  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  const now = useMemo(() => new Date(), [dataUpdatedAt]);
  const todayStr = now.toISOString().split("T")[0];

  // Categorize events into tabs
  const categorized = useMemo(() => {
    if (!events) return { "asian-past": [], "asian-future": [], "other-past": [], "other-future": [], saved: [], trades: [] } as Record<TabKey, (TemperatureEvent & { betDate: string; isObs: boolean })[]>;

    const result: Record<TabKey, (TemperatureEvent & { betDate: string; isObs: boolean })[]> = {
      "asian-past": [],
      "asian-future": [],
      "other-past": [],
      "other-future": [],
      saved: [],
      trades: [],
    };

    const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString().split("T")[0];
    const twoDaysAhead = new Date(now.getTime() + 2 * 86400000).toISOString().split("T")[0];

    for (const event of events) {
      const betDate = getBetDate(event);
      const isObs = betDate <= todayStr;
      const asian = isAsianCity(event.location);
      const enriched = { ...event, betDate, isObs };

      if (isSaved(event.id)) {
        result.saved.push(enriched);
      }

      if (isObs) {
        // Past (including today): within last 2 days
        if (betDate >= twoDaysAgo) {
          if (asian) result["asian-past"].push(enriched);
          else result["other-past"].push(enriched);
        }
      } else {
        // Future: within next 2 days
        if (betDate <= twoDaysAhead) {
          if (asian) result["asian-future"].push(enriched);
          else result["other-future"].push(enriched);
        }
      }
    }

    // Sort: priority cities first, then by date
    const sortEvents = (arr: typeof result["asian-past"]) =>
      arr.sort((a, b) => {
        if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
        return a.betDate.localeCompare(b.betDate);
      });

    sortEvents(result["asian-past"]);
    sortEvents(result["asian-future"]);
    sortEvents(result["other-past"]);
    sortEvents(result["other-future"]);
    sortEvents(result.saved);

    return result;
  }, [events, todayStr, isSaved, now]);

  const tabCounts = useMemo(() => ({
    "asian-past": categorized["asian-past"].length,
    "asian-future": categorized["asian-future"].length,
    "other-past": categorized["other-past"].length,
    "other-future": categorized["other-future"].length,
    saved: categorized.saved.length,
    trades: paper.openTrades.length + paper.closedTrades.length,
  }), [categorized, paper.openTrades, paper.closedTrades]);

  let refCounter = 0;

  const renderEvents = (items: (TemperatureEvent & { betDate: string; isObs: boolean })[]) => {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Thermometer className="mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No bets in this category</p>
        </div>
      );
    }

    return (
      <div className="space-y-3 sm:space-y-4">
        {items.map(event => {
          refCounter++;
          return (
            <TemperatureBetCard
              key={event.id}
              event={event}
              userTimezone={userTimezone}
              weather={weatherData?.[event.location.toLowerCase().trim()]}
              isSaved={isSaved(event.id)}
              onToggleSave={() => toggle(event.id)}
              refNumber={refCounter}
              isObservation={event.isObs}
              betDate={event.betDate}
              onPlaceTrade={(market) => setTradeTarget({ market, event })}
            />
          );
        })}
      </div>
    );
  };

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
                Daily Temperature Bets · Resolution Source Data
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Balance display */}
            <div className="hidden sm:flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1">
              <DollarSign className="h-3 w-3 text-accent" />
              <span className="text-xs font-bold text-accent tabular-nums">{paper.balance.toFixed(2)}</span>
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
        </div>

        {/* Status Bar */}
        <div className="mb-4 sm:mb-6">
          <StatusBar totalBets={events?.length ?? 0} newSignals={newSignals} lastRefresh={lastRefresh} userTimezone={userTimezone} />
        </div>

        {/* Tabs */}
        <div className="mb-4 sm:mb-6 flex flex-wrap gap-1 rounded-md border border-border bg-card p-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 min-w-[80px] rounded-sm px-2 py-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-colors ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.short}</span>
              {tabCounts[tab.key] > 0 && (
                <span className={`ml-1 text-[8px] ${activeTab === tab.key ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  ({tabCounts[tab.key]})
                </span>
              )}
            </button>
          ))}
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
          </div>
        )}

        {!isLoading && !error && activeTab === "trades" && (
          <PaperTradesSummary
            balance={paper.balance}
            totalProfit={paper.totalProfit}
            openTrades={paper.openTrades}
            closedTrades={paper.closedTrades}
            onReset={paper.resetBalance}
            onResolve={paper.resolveTrade}
          />
        )}

        {!isLoading && !error && activeTab !== "trades" && renderEvents(categorized[activeTab])}

        {/* Paper Trade Dialog */}
        {tradeTarget && (
          <PaperTradeDialog
            market={tradeTarget.market}
            eventId={tradeTarget.event.id}
            eventTitle={tradeTarget.event.title}
            balance={paper.balance}
            onPlace={paper.placeTrade}
            onClose={() => setTradeTarget(null)}
          />
        )}

        {/* Footer */}
        <div className="mt-6 sm:mt-8 border-t border-border pt-3 sm:pt-4 text-center text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground">
          Data from Polymarket Gamma API · Auto-refreshes every 60s · Weather from Resolution Source (2min refresh) · Rounding: ≥0.5 → up
        </div>
      </div>
    </div>
  );
};

export default Index;
