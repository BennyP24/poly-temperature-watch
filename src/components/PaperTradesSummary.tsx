import { useMemo, useRef, type ChangeEvent } from "react";
import type { PaperTrade } from "@/hooks/usePaperTrading";
import type { TemperatureEvent } from "@/lib/polymarket";
import type { MarketPrice } from "@/hooks/useMarketPrices";
import {
  DollarSign,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Upload,
  Download,
  HandCoins,
} from "lucide-react";

interface PaperTradesSummaryProps {
  balance: number;
  totalProfit: number;
  openTrades: PaperTrade[];
  closedTrades: PaperTrade[];
  events?: TemperatureEvent[];
  realTimePrices?: Map<string, MarketPrice>;
  onReset: () => void;
  onResolve: (tradeId: string, won: boolean) => void | Promise<void>;
  onSell: (tradeId: string, bidPrice: number) => void | Promise<boolean>;
  onDownloadSession: () => void;
  onUploadSession: (file: File) => void | Promise<void>;
}

export function PaperTradesSummary({
  balance,
  totalProfit,
  openTrades,
  closedTrades,
  events,
  realTimePrices,
  onReset,
  onResolve,
  onSell,
  onDownloadSession,
  onUploadSession,
}: PaperTradesSummaryProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const wins = closedTrades.filter((t) => t.status === "won").length;
  const losses = closedTrades.filter((t) => t.status === "lost").length;

  const marketLookup = useMemo(() => {
    const lookup = new Map<string, { yesPrice: number; noPrice: number; url: string }>();

    for (const event of events ?? []) {
      for (const market of event.markets) {
        const rtPrice = realTimePrices?.get(market.id);
        lookup.set(market.id, {
          yesPrice: rtPrice?.yesPrice ?? market.yesPrice,
          noPrice: rtPrice?.noPrice ?? market.noPrice,
          url: event.polymarketUrl,
        });
      }
    }

    return lookup;
  }, [events, realTimePrices]);

  const handleUploadInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await onUploadSession(file);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-foreground">Paper Account</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={onDownloadSession}
              className="flex items-center gap-1 rounded-sm border border-border bg-secondary px-2 py-1 text-[10px] text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              <Download className="h-3 w-3" />
              Download Session
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 rounded-sm border border-border bg-secondary px-2 py-1 text-[10px] text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              <Upload className="h-3 w-3" />
              Upload Session
            </button>
            <button
              onClick={onReset}
              className="flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Reset to $1,000
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleUploadInput}
        />

        <div className="grid grid-cols-4 gap-3">
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Balance</span>
            <span className="text-lg font-bold text-foreground tabular-nums">${balance.toFixed(2)}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">P&L</span>
            <span className={`text-lg font-bold tabular-nums ${totalProfit >= 0 ? "text-primary" : "text-destructive"}`}>
              {totalProfit >= 0 ? "+" : ""}
              {totalProfit.toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Wins</span>
            <span className="text-lg font-bold text-primary tabular-nums">{wins}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Losses</span>
            <span className="text-lg font-bold text-destructive tabular-nums">{losses}</span>
          </div>
        </div>
      </div>

      {openTrades.length > 0 && (
        <div className="rounded-md border border-border bg-card p-3">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground">Open Trades ({openTrades.length})</h4>
          <div className="space-y-1.5">
            {openTrades.map((trade) => {
              const market = marketLookup.get(trade.market_id);
              const bidPrice = market
                ? trade.side === "yes"
                  ? market.yesPrice
                  : market.noPrice
                : null;
              const markValue = bidPrice === null ? null : trade.shares * bidPrice;
              const liveProfit = markValue === null ? null : markValue - trade.amount;

              return (
                <div key={trade.id} className="rounded-sm bg-muted/30 px-2 py-2">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[10px] text-muted-foreground">{trade.event_title}</p>
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-medium text-foreground">{trade.market_title}</p>
                        {market?.url && (
                          <a
                            href={market.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground transition-colors hover:text-primary"
                            title="Open this bet on Polymarket"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase ${trade.side === "yes" ? "text-primary" : "text-destructive"}`}>
                      {trade.side}
                    </span>
                  </div>

                  <div className="mb-2 grid grid-cols-2 gap-1 text-[10px] text-muted-foreground sm:grid-cols-5">
                    <span>Stake: <span className="tabular-nums text-foreground">${trade.amount.toFixed(2)}</span></span>
                    <span>Entry: <span className="tabular-nums text-foreground">{(trade.price * 100).toFixed(1)}¢</span></span>
                    <span>
                      Bid: <span className="tabular-nums text-foreground">{bidPrice === null ? "--" : `${(bidPrice * 100).toFixed(1)}¢`}</span>
                    </span>
                    <span className="sm:col-span-2">
                      Live P/L: <span className={`tabular-nums ${liveProfit === null ? "text-foreground" : liveProfit >= 0 ? "text-primary" : "text-destructive"}`}>
                        {liveProfit === null ? "--" : `${liveProfit >= 0 ? "+" : ""}${liveProfit.toFixed(2)}`}
                      </span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => bidPrice !== null && onSell(trade.id, bidPrice)}
                      disabled={bidPrice === null}
                      className="flex items-center gap-1 rounded-sm border border-border bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-secondary-foreground hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <HandCoins className="h-2.5 w-2.5" />
                      {bidPrice === null ? "SELL" : `SELL @ ${(bidPrice * 100).toFixed(1)}¢`}
                    </button>
                    <button
                      onClick={() => onResolve(trade.id, true)}
                      className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary hover:bg-primary/25"
                    >
                      WON
                    </button>
                    <button
                      onClick={() => onResolve(trade.id, false)}
                      className="rounded-sm bg-destructive/15 px-1.5 py-0.5 text-[9px] font-bold text-destructive hover:bg-destructive/25"
                    >
                      LOST
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {closedTrades.length > 0 && (
        <div className="rounded-md border border-border bg-card p-3">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground">Trade History ({closedTrades.length})</h4>
          <div className="space-y-1">
            {closedTrades.map((trade) => (
              <div key={trade.id} className="flex items-center justify-between rounded-sm bg-muted/30 px-2 py-1.5">
                <div className="mr-2 flex min-w-0 items-center gap-1.5">
                  {trade.profit >= 0 ? (
                    <TrendingUp className="h-3 w-3 shrink-0 text-primary" />
                  ) : (
                    <TrendingDown className="h-3 w-3 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{trade.market_title}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {trade.side.toUpperCase()} @ {(trade.price * 100).toFixed(1)}¢ · ${trade.amount.toFixed(2)} · {trade.status.toUpperCase()}
                    </p>
                  </div>
                </div>
                <span className={`shrink-0 text-xs font-bold tabular-nums ${trade.profit >= 0 ? "text-primary" : "text-destructive"}`}>
                  {trade.profit >= 0 ? "+" : ""}
                  {trade.profit.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {openTrades.length === 0 && closedTrades.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <DollarSign className="mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No trades yet</p>
          <p className="mt-1 text-[10px] text-muted-foreground">Place a trade from any bet card</p>
        </div>
      )}
    </div>
  );
}
