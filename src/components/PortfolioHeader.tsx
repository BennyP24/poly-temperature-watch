import { useMemo } from "react";
import type { PaperTrade } from "@/hooks/usePaperTrading";
import type { TemperatureEvent } from "@/lib/polymarket";
import { DollarSign, TrendingUp, TrendingDown, Briefcase, Zap } from "lucide-react";

interface PortfolioHeaderProps {
  balance: number;
  openTrades: PaperTrade[];
  closedTrades: PaperTrade[];
  totalProfit: number;
  events?: TemperatureEvent[];
  label?: string;
}

export function PortfolioHeader({ balance, openTrades, closedTrades, totalProfit, events, label = "Paper" }: PortfolioHeaderProps) {
  const { portfolioValue, unrealizedPnL } = useMemo(() => {
    let markToMarket = 0;
    for (const trade of openTrades) {
      let currentPrice: number | null = null;
      if (events) {
        for (const event of events) {
          const market = event.markets.find(m => m.id === trade.market_id);
          if (market) { currentPrice = trade.side === "yes" ? market.yesPrice : market.noPrice; break; }
        }
      }
      markToMarket += trade.shares * (currentPrice ?? trade.price);
    }
    return { portfolioValue: balance + markToMarket, unrealizedPnL: markToMarket - openTrades.reduce((s, t) => s + t.amount, 0) };
  }, [balance, openTrades, events]);

  const totalPnL = totalProfit + unrealizedPnL;
  const wins = closedTrades.filter(t => t.status === "won").length;
  const losses = closedTrades.filter(t => t.status === "lost").length;
  const isMicro = label === "Micro";

  return (
    <div className={`rounded-md border bg-card p-2 sm:p-3 ${isMicro ? "border-accent/30" : "border-border"}`}>
      <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          {isMicro ? <Zap className="h-3.5 w-3.5 text-accent" /> : <Briefcase className="h-3.5 w-3.5 text-primary" />}
          <div className="flex flex-col">
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none">{label}</span>
            <span className="text-sm sm:text-base font-bold text-foreground tabular-nums">${portfolioValue.toFixed(2)}</span>
          </div>
        </div>

        <div className="h-6 w-px bg-border hidden sm:block" />

        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none">Cash</span>
            <span className="text-xs font-semibold text-foreground tabular-nums">${balance.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {totalPnL >= 0 ? <TrendingUp className="h-3 w-3 text-[hsl(var(--signal-resolved))]" /> : <TrendingDown className="h-3 w-3 text-destructive" />}
          <div className="flex flex-col">
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none">P&L</span>
            <span className={`text-xs font-bold tabular-nums ${totalPnL >= 0 ? "text-[hsl(var(--signal-resolved))]" : "text-destructive"}`}>
              {totalPnL >= 0 ? "+" : ""}{totalPnL.toFixed(2)}
            </span>
          </div>
        </div>

        {openTrades.length > 0 && (
          <div className="flex flex-col">
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none">Unrealized</span>
            <span className={`text-xs tabular-nums ${unrealizedPnL >= 0 ? "text-[hsl(var(--signal-resolved))]" : "text-destructive"}`}>
              {unrealizedPnL >= 0 ? "+" : ""}{unrealizedPnL.toFixed(2)}
            </span>
          </div>
        )}

        {(wins + losses > 0) && (
          <div className="flex flex-col ml-auto">
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none">Record</span>
            <span className="text-xs tabular-nums text-foreground">
              <span className="text-[hsl(var(--signal-resolved))]">{wins}W</span>{" / "}<span className="text-destructive">{losses}L</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
