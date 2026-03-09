import type { PaperTrade } from "@/hooks/usePaperTrading";
import { DollarSign, RotateCcw, TrendingUp, TrendingDown } from "lucide-react";

interface PaperTradesSummaryProps {
  balance: number;
  totalProfit: number;
  openTrades: PaperTrade[];
  closedTrades: PaperTrade[];
  onReset: () => void;
  onResolve: (tradeId: string, won: boolean) => void | Promise<void>;
}

export function PaperTradesSummary({ balance, totalProfit, openTrades, closedTrades, onReset }: PaperTradesSummaryProps) {
  const wins = closedTrades.filter(t => t.status === "won").length;
  const losses = closedTrades.filter(t => t.status === "lost").length;

  return (
    <div className="space-y-4">
      {/* Account Summary */}
      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">Paper Account</h3>
          <button
            onClick={onReset}
            className="flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to $1,000
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Balance</span>
            <span className="text-lg font-bold text-foreground tabular-nums">${balance.toFixed(2)}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">P&L</span>
            <span className={`text-lg font-bold tabular-nums ${totalProfit >= 0 ? "text-[hsl(var(--signal-resolved))]" : "text-destructive"}`}>
              {totalProfit >= 0 ? "+" : ""}{totalProfit.toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Wins</span>
            <span className="text-lg font-bold text-[hsl(var(--signal-resolved))] tabular-nums">{wins}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Losses</span>
            <span className="text-lg font-bold text-destructive tabular-nums">{losses}</span>
          </div>
        </div>
      </div>

      {/* Open Trades */}
      {openTrades.length > 0 && (
        <div className="rounded-md border border-border bg-card p-3">
          <h4 className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider">Open Trades ({openTrades.length})</h4>
          <div className="space-y-1">
            {openTrades.map(t => (
              <div key={t.id} className="flex items-center justify-between rounded-sm bg-muted/30 px-2 py-1.5">
                <div className="min-w-0 mr-2">
                  <p className="text-[10px] text-muted-foreground truncate">{t.event_title}</p>
                  <p className="text-xs font-medium text-foreground truncate">{t.market_title}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-bold uppercase ${t.side === "yes" ? "text-[hsl(var(--signal-resolved))]" : "text-destructive"}`}>
                    {t.side}
                  </span>
                  <span className="text-xs tabular-nums text-foreground">${t.amount.toFixed(2)}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">@{(t.price * 100).toFixed(1)}¢</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Closed Trades */}
      {closedTrades.length > 0 && (
        <div className="rounded-md border border-border bg-card p-3">
          <h4 className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider">Trade History ({closedTrades.length})</h4>
          <div className="space-y-1">
            {closedTrades.map(t => (
              <div key={t.id} className="flex items-center justify-between rounded-sm bg-muted/30 px-2 py-1.5">
                <div className="flex items-center gap-1.5 min-w-0 mr-2">
                  {t.status === "won" ? (
                    <TrendingUp className="h-3 w-3 text-[hsl(var(--signal-resolved))] shrink-0" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-destructive shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{t.market_title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{t.side.toUpperCase()} @ {(t.price * 100).toFixed(1)}¢ · ${t.amount.toFixed(2)}</p>
                  </div>
                </div>
                <span className={`text-xs font-bold tabular-nums shrink-0 ${
                  t.profit >= 0 ? "text-[hsl(var(--signal-resolved))]" : "text-destructive"
                }`}>
                  {t.profit >= 0 ? "+" : ""}{t.profit.toFixed(2)}
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
          <p className="text-[10px] text-muted-foreground mt-1">Place a trade from any bet card</p>
        </div>
      )}
    </div>
  );
}
