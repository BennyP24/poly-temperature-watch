import { useMemo, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { usePolymarketData } from "@/hooks/usePolymarketData";
import { useWeatherData } from "@/hooks/useWeatherData";
import { useResolutionData } from "@/hooks/useResolutionData";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useSavedBets } from "@/hooks/useSavedBets";
import { usePaperTrading, type ImportedPaperTrade } from "@/hooks/usePaperTrading";
import { StatusBar } from "@/components/StatusBar";
import { TemperatureBetCard } from "@/components/TemperatureBetCard";
import { PortfolioHeader } from "@/components/PortfolioHeader";
import { PaperTradeDialog } from "@/components/PaperTradeDialog";
import { PaperTradesSummary } from "@/components/PaperTradesSummary";
import { useToast } from "@/components/ui/use-toast";
import type { TemperatureEvent, TemperatureMarket } from "@/lib/polymarket";
import { Thermometer, RefreshCw, AlertTriangle, ArrowLeft, Briefcase } from "lucide-react";

type TabKey = "ready" | "monitoring" | "saved" | "trades";

const TABS: { key: TabKey; label: string; short: string }[] = [
  { key: "ready", label: "Ready to Trade", short: "Ready" },
  { key: "monitoring", label: "Monitoring", short: "Monitor" },
  { key: "saved", label: "Saved Bets", short: "Saved" },
  { key: "trades", label: "Paper Trades", short: "Trades" },
];

interface SessionBackupFile {
  version: 1;
  exportedAt: string;
  paperTrading: { balance: number; trades: ImportedPaperTrade[] };
  savedBetIds: string[];
}

function getBetDate(event: TemperatureEvent): string {
  return (event.endDate || event.createdAt || "").split("T")[0];
}

const TempAccount = () => {
  const { data: events, isLoading, error, dataUpdatedAt, refetch, isFetching } = usePolymarketData();
  const [userTimezone, setUserTimezone] = useState("UTC");
  const { toggle, isSaved, savedIds, replaceSaved } = useSavedBets();
  const paper = usePaperTrading("paper");
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("ready");
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

  // Resolution source URLs for all events
  const resolutionUrls = useMemo(() => {
    const urls: Record<string, string> = {};
    for (const event of events ?? []) {
      if (event.resolutionSource) urls[event.id] = event.resolutionSource;
    }
    return urls;
  }, [events]);

  const { data: resolutionData } = useResolutionData(resolutionUrls);

  // Real-time BID for open positions
  const openMarketIds = useMemo(
    () => paper.openTrades.map(t => t.market_id),
    [paper.openTrades]
  );
  const { data: realTimePrices } = useMarketPrices(openMarketIds);

  const newSignals = useMemo(() => events?.filter(e => e.isNew).length ?? 0, [events]);
  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  const now = useMemo(() => new Date(), [dataUpdatedAt]);
  const todayStr = now.toISOString().split("T")[0];

  const categorized = useMemo(() => {
    if (!events) return { ready: [], monitoring: [], saved: [], trades: [] } as Record<TabKey, (TemperatureEvent & { betDate: string; isObs: boolean })[]>;

    const result: Record<TabKey, (TemperatureEvent & { betDate: string; isObs: boolean })[]> = {
      ready: [], monitoring: [], saved: [], trades: [],
    };

    const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString().split("T")[0];
    const twoDaysAhead = new Date(now.getTime() + 2 * 86400000).toISOString().split("T")[0];

    for (const event of events) {
      const betDate = getBetDate(event);
      const isObs = betDate <= todayStr;
      const enriched = { ...event, betDate, isObs };

      if (betDate < twoDaysAgo) continue;
      if (betDate > twoDaysAhead) continue;

      if (isSaved(event.id)) result.saved.push(enriched);

      // Check observed cooling
      const cityKey = event.location.toLowerCase().trim();
      const cityWeather = weatherData?.[cityKey];
      const dateW = cityWeather?.dates?.[betDate];
      const coolingConfirmed = dateW?.observedCoolingConfirmed ?? (isObs && dateW?.isPast) ?? false;
      const resConfirmed = resolutionData?.[event.id]?.isObserved ?? false;

      if (isObs && (coolingConfirmed || resConfirmed)) {
        result.ready.push(enriched);
      } else {
        result.monitoring.push(enriched);
      }
    }

    const sortEvents = (arr: typeof result.ready) =>
      arr.sort((a, b) => {
        if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
        return a.betDate.localeCompare(b.betDate);
      });

    sortEvents(result.ready);
    sortEvents(result.monitoring);
    sortEvents(result.saved);

    return result;
  }, [events, todayStr, isSaved, now, weatherData, resolutionData]);

  const handleDownloadSession = useCallback(() => {
    const payload: SessionBackupFile = {
      version: 1, exportedAt: new Date().toISOString(),
      paperTrading: {
        balance: paper.balance,
        trades: paper.trades.map((t) => ({
          event_id: t.event_id, event_title: t.event_title, market_id: t.market_id, market_title: t.market_title,
          side: t.side, price: t.price, amount: t.amount, shares: t.shares,
          status: t.status, payout: t.payout, profit: t.profit, created_at: t.created_at, resolved_at: t.resolved_at,
        })),
      },
      savedBetIds: savedIds,
    };
    const formattedDate = payload.exportedAt.replace(/[:.]/g, "-");
    const filename = `paper-session-${formattedDate}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
    URL.revokeObjectURL(url);
    toast({ title: "Session downloaded", description: `Saved as ${filename}` });
  }, [paper.balance, paper.trades, savedIds, toast]);

  const handleUploadSession = useCallback(
    async (file: File) => {
      try {
        const raw = await file.text();
        const parsed = JSON.parse(raw) as Partial<SessionBackupFile>;
        const balance = Number(parsed.paperTrading?.balance);
        const trades = Array.isArray(parsed.paperTrading?.trades) ? (parsed.paperTrading.trades as ImportedPaperTrade[]) : [];
        const restoredSavedIds = Array.isArray(parsed.savedBetIds) ? parsed.savedBetIds.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
        if (!Number.isFinite(balance) || balance < 0) throw new Error("Invalid session file.");
        const restored = await paper.restoreSession({ balance, trades });
        if (!restored) throw new Error("Could not restore paper trades.");
        replaceSaved(restoredSavedIds);
        toast({ title: "Session restored", description: `Loaded ${trades.length} trades and ${restoredSavedIds.length} saved bets.` });
      } catch (uploadError) {
        toast({ title: "Upload failed", description: uploadError instanceof Error ? uploadError.message : "Invalid backup file." });
      }
    },
    [paper, replaceSaved, toast]
  );

  const tabCounts = useMemo(() => ({
    ready: categorized.ready.length,
    monitoring: categorized.monitoring.length,
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
              resolutionStatus={resolutionData?.[event.id]}
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
            <Link to="/" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Briefcase className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold tracking-tight text-foreground truncate">NORMAL TEMP ACCOUNT</h1>
              <p className="text-[9px] sm:text-[11px] uppercase tracking-widest text-muted-foreground truncate">
                Observed Cooling Signals · Paper Trading
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => refetch()} disabled={isFetching}
              className="flex items-center gap-1.5 sm:gap-2 rounded-md border border-border bg-secondary px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50 shrink-0">
              <RefreshCw className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Portfolio */}
        <div className="mb-4 sm:mb-6">
          <PortfolioHeader balance={paper.balance} openTrades={paper.openTrades} closedTrades={paper.closedTrades} totalProfit={paper.totalProfit} events={events} label="Paper" />
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
              className={`flex-1 min-w-[70px] rounded-sm px-1.5 py-1.5 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider transition-colors ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.short}</span>
              {tabCounts[tab.key] > 0 && (
                <span className={`ml-1 text-[8px] ${activeTab === tab.key ? "opacity-70" : "text-muted-foreground"}`}>
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
            balance={paper.balance} totalProfit={paper.totalProfit}
            openTrades={paper.openTrades} closedTrades={paper.closedTrades}
            events={events} realTimePrices={realTimePrices}
            onReset={paper.resetBalance} onResolve={paper.resolveTrade}
            onSell={paper.sellTrade} onDownloadSession={handleDownloadSession} onUploadSession={handleUploadSession}
          />
        )}

        {!isLoading && !error && activeTab !== "trades" && renderEvents(categorized[activeTab])}

        {/* Paper Trade Dialog */}
        {tradeTarget && (
          <PaperTradeDialog
            market={tradeTarget.market} eventId={tradeTarget.event.id} eventTitle={tradeTarget.event.title}
            balance={paper.balance} onPlace={paper.placeTrade} onClose={() => setTradeTarget(null)}
          />
        )}

        {/* Footer */}
        <div className="mt-6 sm:mt-8 border-t border-border pt-3 sm:pt-4 text-center text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground">
          Data from Polymarket Gamma API · Auto-refreshes every 5s · Weather scans every 30s · Resolution source verified
        </div>
      </div>
    </div>
  );
};

export default TempAccount;
