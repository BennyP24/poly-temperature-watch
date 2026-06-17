import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { usePolymarketData } from "@/hooks/usePolymarketData";
import { useWeatherData } from "@/hooks/useWeatherData";
import { useResolutionData, type ResolutionInput } from "@/hooks/useResolutionData";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useMarketMidpoints } from "@/hooks/useMarketMidpoints";
import { useSavedBets } from "@/hooks/useSavedBets";
import { usePaperTrading, type ImportedPaperTrade } from "@/hooks/usePaperTrading";
import { useAutoSell } from "@/hooks/useAutoSell";
import { StatusBar } from "@/components/StatusBar";
import { TemperatureBetCard } from "@/components/TemperatureBetCard";
import { PortfolioHeader } from "@/components/PortfolioHeader";
import { PaperTradeDialog } from "@/components/PaperTradeDialog";
import { PaperTradesSummary } from "@/components/PaperTradesSummary";
import { WalletBar } from "@/components/WalletBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/components/ui/use-toast";
import { EventSearchBar } from "@/components/EventSearchBar";
import { TimeSubTabBar } from "@/components/TimeSubTabBar";
import { filterEventsBySearch, filterEventsByTimeBucket, type TimeSubTab } from "@/lib/eventTimeBucket";
import {
  compareEventsByBetDateAscending,
  compareReadyEventsByDateThenCloseTime,
} from "@/lib/betTimeWindow";
import { isAsianLocation, normalizeMarketId, type TemperatureEvent, type TemperatureMarket } from "@/lib/polymarket";
import { detectTempKind, type TempKind } from "@/lib/marketKind";
import { getBetDateYmd } from "@/lib/eventDates";
import { resolveAirportForLocation } from "@/lib/airports";
import { Thermometer, RefreshCw, AlertTriangle, ArrowLeft, Briefcase } from "lucide-react";

type Region = "asian" | "israel" | "usa" | "europe" | "other";
type HighLowTab = "highest" | "lowest";
type TopTab = HighLowTab | "ready" | "saved" | "trades";

const REGIONS: { key: Region; label: string }[] = [
  { key: "asian", label: "Asian" },
  { key: "israel", label: "Israel" },
  { key: "usa", label: "USA" },
  { key: "europe", label: "Europe" },
  { key: "other", label: "Other" },
];

const TOP_TABS: { key: TopTab; label: string }[] = [
  { key: "highest", label: "Highest Temp" },
  { key: "lowest", label: "Lowest Temp" },
  { key: "ready", label: "Ready" },
  { key: "saved", label: "Saved" },
  { key: "trades", label: "Trades" },
];

const ISRAEL_CITIES = [
  "tel aviv", "jerusalem", "haifa", "beer sheva", "beersheba", "eilat",
  "netanya", "ashdod", "rishon lezion", "petah tikva", "holon", "bnei brak",
  "ramat gan", "ashkelon", "rehovot", "bat yam", "herzliya", "kfar saba",
  "modiin", "nazareth", "lod", "ramla", "israel",
];

const USA_CITIES = [
  "new york", "nyc", "chicago", "los angeles", "miami", "houston", "dallas",
  "phoenix", "denver", "seattle", "san francisco", "boston", "atlanta",
  "washington", "las vegas", "austin", "detroit", "portland", "salt lake city",
  "anchorage", "honolulu", "toronto", "vancouver", "calgary", "montreal", "ottawa",
  "minneapolis", "philadelphia", "charlotte", "nashville", "memphis", "orlando",
  "san diego", "san antonio", "tampa", "sacramento", "kansas city", "indianapolis",
];

const EUROPE_CITIES = [
  "london", "paris", "berlin", "munich", "rome", "madrid", "amsterdam",
  "zurich", "moscow", "milan", "warsaw", "vienna", "prague", "lisbon",
  "barcelona", "dublin", "stockholm", "oslo", "copenhagen", "helsinki",
  "brussels", "budapest", "bucharest", "athens", "belgrade", "zagreb",
  "kyiv", "kiev", "manchester", "birmingham", "frankfurt", "hamburg",
];

function getRegion(location: string): Region {
  const lower = location.toLowerCase().trim();
  if (ISRAEL_CITIES.some(c => lower.includes(c))) return "israel";
  if (isAsianLocation(location)) return "asian";
  if (USA_CITIES.some(c => lower.includes(c))) return "usa";
  if (EUROPE_CITIES.some(c => lower.includes(c))) return "europe";
  return "other";
}

function emptyRegions(): Record<Region, EnrichedEvent[]> {
  return { asian: [], israel: [], usa: [], europe: [], other: [] };
}

interface SessionBackupFile {
  version: 1;
  exportedAt: string;
  paperTrading: { balance: number; trades: ImportedPaperTrade[] };
  savedBetIds: string[];
}

type EnrichedEvent = TemperatureEvent & {
  betDate: string;
  isObs: boolean;
  kind: HighLowTab;
  region: Region;
  almostReady?: boolean;
};

const TempAccount = () => {
  const { data: events, isLoading, error, dataUpdatedAt, refetch, isFetching } = usePolymarketData();
  const [userTimezone, setUserTimezone] = useState("UTC");
  const { toggle, isSaved, savedIds, replaceSaved } = useSavedBets();
  const paper = usePaperTrading("paper");
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TopTab>("highest");
  const [activeRegion, setActiveRegion] = useState<Region>("usa");
  const [timeSub, setTimeSub] = useState<TimeSubTab>("current");
  const [search, setSearch] = useState("");
  const [tradeTarget, setTradeTarget] = useState<{ market: TemperatureMarket; event: TemperatureEvent } | null>(null);
  const autoSettleRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try { setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { setUserTimezone("UTC"); }
  }, []);

  const cities = useMemo(() => {
    if (!events) return [];
    const set = new Set(events.map(e => e.location.toLowerCase().trim()));
    return Array.from(set);
  }, [events]);

  const { data: weatherData } = useWeatherData(cities);

  const now = useMemo(() => new Date(), [dataUpdatedAt]);
  const todayStr = now.toLocaleDateString("en-CA");

  const resolutionInputs = useMemo(() => {
    const inputs: Record<string, ResolutionInput> = {};
    for (const event of events ?? []) {
      const airport = resolveAirportForLocation(event.location);
      if (!airport) continue;
      const betDate = getBetDateYmd(event);
      if (!betDate) continue;
      inputs[event.id] = {
        icao: airport.icao,
        date: betDate,
        tz: event.timezone || airport.timezone,
      };
    }
    return inputs;
  }, [events]);

  const { data: resolutionData } = useResolutionData(resolutionInputs);

  const openMarketIds = useMemo(
    () => paper.openTrades.map(t => t.market_id),
    [paper.openTrades]
  );
  const { data: marketPricesData } = useMarketPrices(openMarketIds);
  const realTimePrices = marketPricesData?.prices;
  const orderBooksByMarketId = marketPricesData?.orderBooksByMarketId;

  const autoSell = useAutoSell({
    openTrades: paper.openTrades,
    realTimePrices,
    orderBooksByMarketId,
    onSell: paper.sellTrade,
  });

  const newSignals = useMemo(() => events?.filter(e => e.isNew).length ?? 0, [events]);
  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  // Auto-settle open trades when market resolves.
  useEffect(() => {
    if (!events || paper.openTrades.length === 0) return;
    const allMarkets = new Map<string, { yesPrice: number; noPrice: number; closed: boolean }>();
    for (const event of events) {
      for (const m of event.markets) {
        allMarkets.set(normalizeMarketId(m.id), { yesPrice: m.yesPrice, noPrice: m.noPrice, closed: m.closed });
      }
    }
    for (const trade of paper.openTrades) {
      if (autoSettleRef.current.has(trade.id)) continue;
      const market = allMarkets.get(normalizeMarketId(trade.market_id));
      if (!market) continue;
      const yesResolved = market.yesPrice >= 0.95;
      const noResolved = market.noPrice >= 0.95;
      if (yesResolved || noResolved) {
        autoSettleRef.current.add(trade.id);
        const won = (trade.side === "yes" && yesResolved) || (trade.side === "no" && noResolved);
        paper.resolveTrade(trade.id, won);
      }
    }
  }, [events, paper.openTrades, paper.resolveTrade]);

  const categorized = useMemo(() => {
    const byKind: Record<HighLowTab, Record<Region, EnrichedEvent[]>> = {
      highest: emptyRegions(),
      lowest: emptyRegions(),
    };
    const ready: EnrichedEvent[] = [];
    const saved: EnrichedEvent[] = [];
    if (!events) return { byKind, ready, saved };

    for (const event of events) {
      const betDate = event.betDate;
      const isObs = betDate <= todayStr;
      const kindRaw: TempKind = detectTempKind(event, { defaultToHighest: true });
      const kind: HighLowTab = kindRaw === "lowest" ? "lowest" : "highest";
      const region = getRegion(event.location);
      const enriched: EnrichedEvent = { ...event, betDate, isObs, kind, region };

      byKind[kind][region].push(enriched);

      if (isSaved(event.id)) saved.push(enriched);

      const cityKey = event.location.toLowerCase().trim();
      const cityWeather = weatherData?.[cityKey];
      const dateW = cityWeather?.dates?.[betDate];
      const coolingConfirmed = dateW?.observedCoolingConfirmed ?? (isObs && dateW?.isPast) ?? false;
      const coolingProgress = dateW?.coolingProgress ?? 0;
      const resConfirmed = resolutionData?.[event.id]?.isObserved ?? false;
      const highTemp = resolutionData?.[event.id]?.observedHighF ?? null;
      const lowTemp = resolutionData?.[event.id]?.observedLowF ?? null;
      const settleTemp = kind === "lowest" ? lowTemp : highTemp;
      const closesInMs = event.endDate ? new Date(event.endDate).getTime() - Date.now() : 0;

      const isReady =
        (coolingConfirmed || resConfirmed) &&
        event.markets.length > 0 &&
        closesInMs >= 3600000 &&
        settleTemp !== null;

      const isAlmostReady =
        !isReady &&
        isObs &&
        coolingProgress === 1 &&
        event.markets.length > 0 &&
        closesInMs >= 3600000;

      if (isReady) {
        ready.push(enriched);
      } else if (isAlmostReady) {
        ready.push({ ...enriched, almostReady: true });
      }
    }

    ready.sort((a, b) => {
      if (a.almostReady && !b.almostReady) return 1;
      if (!a.almostReady && b.almostReady) return -1;
      return compareReadyEventsByDateThenCloseTime(a, b);
    });
    for (const kind of ["highest", "lowest"] as HighLowTab[]) {
      for (const r of REGIONS) byKind[kind][r.key].sort(compareEventsByBetDateAscending);
    }
    saved.sort(compareEventsByBetDateAscending);

    return { byKind, ready, saved };
  }, [events, todayStr, weatherData, resolutionData, isSaved]);

  const nowMsForFilter = useMemo(() => now.getTime(), [now]);

  const visibleList = useMemo(() => {
    if (activeTab === "trades") return null;
    let raw: EnrichedEvent[];
    let useTime = true;
    if (activeTab === "highest" || activeTab === "lowest") {
      raw = categorized.byKind[activeTab][activeRegion];
    } else if (activeTab === "ready") {
      raw = categorized.ready;
    } else {
      raw = categorized.saved;
      useTime = false; // saved shows all regardless of date
    }
    const bucketed = useTime
      ? filterEventsByTimeBucket(raw, timeSub, todayStr, nowMsForFilter)
      : raw;
    const display = filterEventsBySearch(bucketed, search);
    return { bucketed, display };
  }, [categorized, activeTab, activeRegion, timeSub, search, todayStr, nowMsForFilter]);

  // Fetch live midpoints for the markets currently on screen so the displayed
  // odds match the Polymarket platform.
  const midpointTokenIds = useMemo(() => {
    const ids: string[] = [];
    for (const e of visibleList?.display ?? []) {
      for (const m of e.markets) {
        if (m.yesTokenId) ids.push(m.yesTokenId);
        if (m.noTokenId) ids.push(m.noTokenId);
      }
    }
    return ids;
  }, [visibleList]);
  const { data: midpoints } = useMarketMidpoints(midpointTokenIds);

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

  const kindTotals = useMemo(() => {
    const sumKind = (k: HighLowTab) => REGIONS.reduce((s, r) => s + categorized.byKind[k][r.key].length, 0);
    return { highest: sumKind("highest"), lowest: sumKind("lowest") };
  }, [categorized]);

  const tabCounts: Record<TopTab, number> = {
    highest: kindTotals.highest,
    lowest: kindTotals.lowest,
    ready: categorized.ready.length,
    saved: categorized.saved.length,
    trades: paper.openTrades.length + paper.closedTrades.length,
  };

  const regionCounts = useMemo(() => {
    if (activeTab !== "highest" && activeTab !== "lowest") return null;
    const counts: Record<Region, number> = { asian: 0, israel: 0, usa: 0, europe: 0, other: 0 };
    for (const r of REGIONS) counts[r.key] = categorized.byKind[activeTab][r.key].length;
    return counts;
  }, [categorized, activeTab]);

  let refCounter = 0;

  const renderEvents = (items: EnrichedEvent[], hideClocks = false) => {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Thermometer className="mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No bets in this category</p>
        </div>
      );
    }

    const readyEvents = items.filter(e => !e.almostReady);
    const almostReadyEvents = items.filter(e => e.almostReady);

    const gridClass = "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 items-start";

    return (
      <div className="space-y-3 sm:space-y-4">
        <div className={gridClass}>
          {readyEvents.map(event => {
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
                hideClocks={hideClocks}
                midpoints={midpoints}
              />
            );
          })}
        </div>

        {almostReadyEvents.length > 0 && (
          <>
            <div className="flex items-center gap-2 pt-2 pb-1">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] uppercase tracking-wider text-orange-500 font-bold">
                Almost Ready ({almostReadyEvents.length}) — 1 cooling decline observed
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className={gridClass}>
              {almostReadyEvents.map(event => {
                refCounter++;
                return (
                  <div key={event.id} className="relative">
                    <div className="absolute -left-1 top-0 bottom-0 z-10 w-1 bg-orange-500 rounded-full" />
                    <TemperatureBetCard
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
                      hideClocks={hideClocks}
                      midpoints={midpoints}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  const showRegionBar = activeTab === "highest" || activeTab === "lowest";
  const showListControls = !isLoading && !error && activeTab !== "trades";

  return (
    <div className="relative min-h-screen bg-background">
      <div className="relative z-10 mx-auto max-w-[120rem] px-2 sm:px-4 py-3 sm:py-6">
        {/* Header */}
        <div className="mb-3 sm:mb-6 flex items-center justify-between gap-2">
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
            <ThemeToggle />
            <button onClick={() => refetch()} disabled={isFetching}
              className="flex items-center gap-1.5 sm:gap-2 rounded-md border border-border bg-secondary px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50 shrink-0">
              <RefreshCw className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Wallet / multi-account */}
        <div className="mb-3 sm:mb-6">
          <WalletBar />
        </div>

        {/* Portfolio */}
        <div className="mb-3 sm:mb-6">
          <PortfolioHeader balance={paper.consolidatedBalance} openTrades={paper.openTrades} closedTrades={paper.closedTrades} totalProfit={paper.totalProfit} events={events} realTimePrices={realTimePrices ?? undefined} label="Paper" />
        </div>

        {/* Status Bar */}
        <div className="mb-3 sm:mb-6">
          <StatusBar totalBets={events?.length ?? 0} newSignals={newSignals} lastRefresh={lastRefresh} userTimezone={userTimezone} />
        </div>

        {/* Top tabs */}
        <div className="mb-2 overflow-x-auto scrollbar-none">
          <div className="flex gap-1 rounded-md border border-border bg-card p-1 min-w-max">
            {TOP_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap rounded-sm px-2 sm:px-3 py-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  activeTab === tab.key
                    ? tab.key === "lowest"
                      ? "bg-blue-500 text-white"
                      : tab.key === "highest"
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-primary text-primary-foreground"
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

        {/* Region subtabs (inside Highest/Lowest) */}
        {showRegionBar && regionCounts && (
          <div className="mb-2 overflow-x-auto scrollbar-none">
            <div className="flex gap-1 rounded-md border border-border bg-muted/40 p-1 min-w-max">
              {REGIONS.map(r => (
                <button
                  key={r.key}
                  onClick={() => setActiveRegion(r.key)}
                  className={`whitespace-nowrap rounded-sm px-2 sm:px-3 py-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    activeRegion === r.key
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {r.label}
                  {regionCounts[r.key] > 0 && (
                    <span className="ml-1 text-[8px] opacity-70">({regionCounts[r.key]})</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search + time subtabs */}
        {showListControls && (
          <div className="mb-3 space-y-2">
            <EventSearchBar value={search} onChange={setSearch} id="temp-search" />
            {activeTab !== "saved" && (
              <TimeSubTabBar value={timeSub} onChange={setTimeSub} />
            )}
          </div>
        )}

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
            balance={paper.consolidatedBalance} totalProfit={paper.totalProfit}
            openTrades={paper.openTrades} closedTrades={paper.closedTrades}
            events={events} realTimePrices={realTimePrices ?? undefined}
            orderBooksByMarketId={orderBooksByMarketId}
            onReset={paper.resetBalance} onResolve={paper.resolveTrade}
            onSell={paper.sellTrade} onSellPartial={paper.sellTradePartial}
            onDownloadSession={handleDownloadSession} onUploadSession={handleUploadSession}
            autoSellConfig={autoSell.config}
            autoSellTargets={autoSell.stats.targets}
            onToggleAutoSell={autoSell.toggleEnabled}
            getAutoSellTarget={autoSell.getTarget}
          />
        )}

        {!isLoading && !error && visibleList && activeTab !== "trades" && (
          visibleList.display.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Thermometer className="mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center px-4">
                {visibleList.bucketed.length === 0
                  ? "No bets in this time range."
                  : "No bets match your search."}
              </p>
            </div>
          ) : (
            renderEvents(visibleList.display, activeTab === "ready")
          )
        )}

        {tradeTarget && (
          <PaperTradeDialog
            market={tradeTarget.market} eventId={tradeTarget.event.id} eventTitle={tradeTarget.event.title}
            balance={paper.consolidatedBalance} onPlace={paper.placeTrade} onClose={() => setTradeTarget(null)}
          />
        )}

        <div className="mt-6 sm:mt-8 border-t border-border pt-3 sm:pt-4 text-center text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground">
          Data from Polymarket Gamma API · Auto-refreshes every 5s · Weather scans every 30s
        </div>
      </div>
    </div>
  );
};

export default TempAccount;
