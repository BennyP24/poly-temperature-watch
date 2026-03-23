import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { usePolymarketData } from "@/hooks/usePolymarketData";
import { useWeatherData } from "@/hooks/useWeatherData";
import { useResolutionData } from "@/hooks/useResolutionData";
import { useNoaaWuCompare } from "@/hooks/useNoaaWuCompare";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { usePaperTrading } from "@/hooks/usePaperTrading";
import { useMicroAutoTrade } from "@/hooks/useMicroAutoTrade";
import { useMidnightBoost } from "@/hooks/useMidnightBoost";
import { useSavedBets } from "@/hooks/useSavedBets";
import { StatusBar } from "@/components/StatusBar";
import { TemperatureBetCard } from "@/components/TemperatureBetCard";
import { PortfolioHeader } from "@/components/PortfolioHeader";
import { MicroTradesSummary } from "@/components/MicroTradesSummary";
import { compareEventsByBetDateAscending } from "@/lib/betTimeWindow";
import { normalizeMarketId, type TemperatureEvent } from "@/lib/polymarket";
import { Zap, RefreshCw, AlertTriangle, ArrowLeft, Thermometer } from "lucide-react";

type TabKey = "active" | "upcoming" | "history";

const TABS: { key: TabKey; label: string; short: string }[] = [
  { key: "active", label: "Active Positions", short: "Active" },
  { key: "upcoming", label: "Upcoming", short: "Upcoming" },
  { key: "history", label: "Trade History", short: "History" },
];

const MICRO_AUTO_KEY = "micro-auto-enabled";

const MicroAccount = () => {
  const midnightBoost = useMidnightBoost();
  const { data: events, isLoading, error, dataUpdatedAt, refetch, isFetching } = usePolymarketData(midnightBoost.recommendedPollMs);
  const [userTimezone, setUserTimezone] = useState("UTC");
  const micro = usePaperTrading("micro");
  const { toggle: toggleMicroSave, isSaved: isMicroSaved } = useSavedBets("micro-saved-bets");
  const [activeTab, setActiveTab] = useState<TabKey>("active");
  const autoSettleRef = useRef<Set<string>>(new Set());

  const [microAutoEnabled, setMicroAutoEnabled] = useState(() => {
    try { return localStorage.getItem(MICRO_AUTO_KEY) === "true"; } catch { return false; }
  });

  useMicroAutoTrade({
    events,
    accountId: micro.accountId,
    balance: micro.balance,
    placeTrade: micro.placeTrade,
    enabled: microAutoEnabled,
  });

  const toggleMicroAuto = useCallback(() => {
    setMicroAutoEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem(MICRO_AUTO_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    try { setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { setUserTimezone("UTC"); }
  }, []);

  // Auto-settle open trades when market resolves
  useEffect(() => {
    if (!events || micro.openTrades.length === 0) return;
    const allMarkets = new Map<string, { yesPrice: number; noPrice: number; closed: boolean }>();
    for (const event of events) {
      for (const m of event.markets) {
        allMarkets.set(m.id, { yesPrice: m.yesPrice, noPrice: m.noPrice, closed: m.closed });
      }
    }
    for (const trade of micro.openTrades) {
      if (autoSettleRef.current.has(trade.id)) continue;
      const market = allMarkets.get(normalizeMarketId(trade.market_id));
      if (!market) continue;
      const yesResolved = market.yesPrice >= 0.95;
      const noResolved = market.noPrice >= 0.95;
      if (yesResolved || noResolved) {
        autoSettleRef.current.add(trade.id);
        const won = (trade.side === "yes" && yesResolved) || (trade.side === "no" && noResolved);
        micro.resolveTrade(trade.id, won);
      }
    }
  }, [events, micro.openTrades, micro.resolveTrade]);

  const cities = useMemo(() => {
    if (!events) return [];
    const set = new Set(events.map(e => e.location.toLowerCase().trim()));
    return Array.from(set);
  }, [events]);

  const { data: weatherData } = useWeatherData(cities);

  const resolutionUrls = useMemo(() => {
    const urls: Record<string, string> = {};
    for (const event of events ?? []) {
      if (event.resolutionSource) urls[event.id] = event.resolutionSource;
    }
    return urls;
  }, [events]);

  const { data: resolutionData } = useResolutionData(resolutionUrls);
  const { data: noaaCompareByEvent, isLoading: noaaCompareLoading } = useNoaaWuCompare(events, resolutionData);

  // Real-time BID for micro positions
  const openMarketIds = useMemo(
    () => micro.openTrades.map(t => t.market_id),
    [micro.openTrades]
  );
  const { data: marketPricesData } = useMarketPrices(openMarketIds);
  const realTimePrices = marketPricesData?.prices;
  const orderBooksByMarketId = marketPricesData?.orderBooksByMarketId;

  const newSignals = useMemo(() => events?.filter(e => e.isNew).length ?? 0, [events]);
  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  const now = useMemo(() => new Date(), [dataUpdatedAt]);
  const todayStr = now.toLocaleDateString("en-CA");

  // Events we have active trades in
  const activeEventIds = useMemo(() => {
    const ids = new Set(micro.openTrades.map(t => t.event_id));
    return ids;
  }, [micro.openTrades]);

  const upcoming = useMemo(() => {
    if (!events) return [];
    return events
      .filter(e => e.betDate > todayStr)
      .map(e => ({ ...e, betDate: e.betDate, isObs: false as const }))
      .sort(compareEventsByBetDateAscending);
  }, [events, todayStr]);

  const activeEvents = useMemo(() => {
    if (!events) return [];
    return events
      .filter(e => activeEventIds.has(e.id))
      .map(e => ({ ...e, betDate: e.betDate, isObs: e.betDate <= todayStr }))
      .sort(compareEventsByBetDateAscending);
  }, [events, activeEventIds, todayStr]);

  const tabCounts = useMemo(() => ({
    active: activeEvents.length,
    upcoming: upcoming.length,
    history: micro.closedTrades.length,
  }), [activeEvents, upcoming, micro.closedTrades]);

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
              isSaved={false}
              onToggleSave={() => {}}
              isMicroSaved={isMicroSaved(event.id)}
              onToggleMicroSave={() => toggleMicroSave(event.id)}
              refNumber={refCounter}
              isObservation={event.isObs}
              betDate={event.betDate}
              resolutionStatus={resolutionData?.[event.id]}
              noaaCompare={noaaCompareByEvent?.[event.id]}
              noaaCompareLoading={noaaCompareLoading}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative min-h-screen bg-background">
      <div className="scanline fixed inset-0 z-50 h-[200%]" />

      <div className="relative z-10 mx-auto max-w-6xl px-2 sm:px-4 py-3 sm:py-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link to="/" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-md bg-accent/10">
              <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold tracking-tight text-foreground truncate">MICRO-TRADES ACCOUNT</h1>
              <p className="text-[9px] sm:text-[11px] uppercase tracking-widest text-muted-foreground truncate">
                Auto-Buy ≤3¢ · YES Only · Fast Reaction
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {midnightBoost.isBoostActive && (
              <span className="flex items-center gap-1 rounded-md bg-destructive px-2 py-1 text-[10px] font-bold text-destructive-foreground animate-pulse">
                BOOST MODE
              </span>
            )}
            <button onClick={() => refetch()} disabled={isFetching}
              className="flex items-center gap-1.5 sm:gap-2 rounded-md border border-border bg-secondary px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50 shrink-0">
              <RefreshCw className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Portfolio */}
        <div className="mb-4 sm:mb-6">
          <PortfolioHeader balance={micro.balance} openTrades={micro.openTrades} closedTrades={micro.closedTrades} totalProfit={micro.totalProfit} events={events} realTimePrices={realTimePrices ?? undefined} label="Micro" />
        </div>

        {/* Status Bar */}
        <div className="mb-4 sm:mb-6">
          <StatusBar totalBets={events?.length ?? 0} newSignals={newSignals} lastRefresh={lastRefresh} userTimezone={userTimezone} />
        </div>

        {/* Tabs -- scrollable on mobile */}
        <div className="mb-3 sm:mb-6 overflow-x-auto scrollbar-none">
          <div className="flex gap-1 rounded-md border border-border bg-card p-1 min-w-max">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap rounded-sm px-2 sm:px-3 py-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  activeTab === tab.key
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {tab.label}
                {tabCounts[tab.key] > 0 && (
                  <span className={`ml-1 text-[8px] ${activeTab === tab.key ? "opacity-70" : "text-muted-foreground"}`}>
                    ({tabCounts[tab.key]})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="mb-3 h-6 w-6 animate-spin text-accent" />
            <p className="text-sm text-muted-foreground">Scanning Polymarket for daily temperature bets...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertTriangle className="mb-3 h-6 w-6 text-destructive" />
            <p className="text-sm text-destructive">Failed to fetch data from Polymarket</p>
          </div>
        )}

        {!isLoading && !error && activeTab === "active" && renderEvents(activeEvents)}
        {!isLoading && !error && activeTab === "upcoming" && renderEvents(upcoming)}

        {!isLoading && !error && activeTab === "history" && (
          <MicroTradesSummary
            balance={micro.balance} totalProfit={micro.totalProfit}
            openTrades={micro.openTrades} closedTrades={micro.closedTrades}
            events={events} realTimePrices={realTimePrices ?? undefined}
            orderBooksByMarketId={orderBooksByMarketId}
            onReset={micro.resetBalance} onResolve={micro.resolveTrade}
            onSell={micro.sellTrade} autoTradeEnabled={microAutoEnabled} onToggleAutoTrade={toggleMicroAuto}
            midnightCountdown={midnightBoost}
          />
        )}

        {/* Footer */}
        <div className="mt-6 sm:mt-8 border-t border-border pt-3 sm:pt-4 text-center text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground">
          Polymarket Gamma API · Open positions ~2s · Auto-buy ≤3¢ YES · $25 per position
        </div>
      </div>
    </div>
  );
};

export default MicroAccount;
