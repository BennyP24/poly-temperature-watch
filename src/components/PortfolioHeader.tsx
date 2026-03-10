import { useMemo } from "react";
import type { PaperTrade } from "@/hooks/usePaperTrading";
import type { TemperatureEvent } from "@/lib/polymarket";
import { DollarSign, TrendingUp, TrendingDown, Briefcase } from "lucide-react";

interface PortfolioHeaderProps {
  balance: number;
  openTrades: PaperTrade[];
  closedTrades: PaperTrade[];
  totalProfit: number;
  events?: TemperatureEvent[];
}

export function PortfolioHeader({ balance, openTrades, closedTrades, totalProfit, events }: PortfolioHeaderProps) {
  // Calculate mark-to-market value of open positions using live prices
  const { portfolioValue, unrealizedPnL } = useMemo(() => {
    let markToMarket = 0;

    for (const trade of openTrades) {
      // Find current market price from live events
      let currentPrice: number | null = null;
      if (events) {
        for (const event of events) {
          const market = event.markets.find(m => m.id === trade.market_id);
          if (market) {
            currentPrice = trade.side === "yes" ? market.yesPrice : market.noPrice;
            break;
          }
        }
      }
      // Value = shares * current price (or entry price if market not found)
      const price = currentPrice ?? trade.price;
      markToMarket += trade.shares * price;
    }

    const totalPortfolio = balance + markToMarket;
    const unrealized = markToMarket - openTrades.reduce((s, t) => s + t.amount, 0);
    return { portfolioValue: totalPortfolio, unrealizedPnL: unrealized };
  }, [balance, openTrades, events]);

  const totalPnL = totalProfit + unrealizedPnL;
  const wins = closedTrades.filter(t => t.status === "won").length;
  const losses = closedTrades.filter(t => t.status === "lost").length;

  return (
    <div className="rounded-md border border-border bg-card p-2 sm:p-3">
      <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
        {/* Portfolio Value */}
        <div className="flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5 text-primary" />
          <div className="flex flex-col">
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none">Portfolio</span>
            <span className="text-sm sm:text-base font-bold text-foreground tabular-nums">${portfolioValue.toFixed(2)}</span>
          </div>
        </div>

        <div className="h-6 w-px bg-border hidden sm:block" />

        {/* Cash */}
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none">Cash</span>
            <span className="text-xs font-semibold text-foreground tabular-nums">${balance.toFixed(2)}</span>
          </div>
        </div>

        {/* Total P&L */}
        <div className="flex items-center gap-1">
          {totalPnL >= 0 ? (
            <TrendingUp className="h-3 w-3 text-[hsl(var(--signal-resolved))]" />
          ) : (
            <TrendingDown className="h-3 w-3 text-destructive" />
          )}
          <div className="flex flex-col">
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none">P&L</span>
            <span className={`text-xs font-bold tabular-nums ${totalPnL >= 0 ? "text-[hsl(var(--signal-resolved))]" : "text-destructive"}`}>
              {totalPnL >= 0 ? "+" : ""}{totalPnL.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Unrealized */}
        {openTrades.length > 0 && (
          <div className="flex flex-col">
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none">Unrealized</span>
            <span className={`text-xs tabular-nums ${unrealizedPnL >= 0 ? "text-[hsl(var(--signal-resolved))]" : "text-destructive"}`}>
              {unrealizedPnL >= 0 ? "+" : ""}{unrealizedPnL.toFixed(2)}
            </span>
          </div>
        )}

        {/* W/L */}
        {(wins + losses > 0) && (
          <div className="flex flex-col ml-auto">
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none">Record</span>
            <span className="text-xs tabular-nums text-foreground">
              <span className="text-[hsl(var(--signal-resolved))]">{wins}W</span>
              {" / "}
              <span className="text-destructive">{losses}L</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
