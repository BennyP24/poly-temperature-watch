import { useMemo, useState } from "react";
import type { PaperTrade } from "@/hooks/usePaperTrading";
import type { MarketSideBooks } from "@/hooks/useMarketPrices";
import { normalizeBidLevels, walkSellAgainstLevel, clampSellQuantity } from "@/lib/orderbookSell";
import { HandCoins, X } from "lucide-react";

interface SellOrderDialogProps {
  trade: PaperTrade;
  sides: MarketSideBooks | undefined;
  onClose: () => void;
  onSellPartial: (tradeId: string, shares: number, payoutUsd: number) => Promise<boolean> | boolean;
}

/**
 * Place a sell order for a chosen quantity of an open position into a specific
 * resting buy order (bid level). Mirrors the real flow: pick which buy order to
 * sell into, then choose how many shares (capped by what you hold and what that
 * level can absorb).
 */
export function SellOrderDialog({ trade, sides, onClose, onSellPartial }: SellOrderDialogProps) {
  const levels = useMemo(() => {
    const book = trade.side === "yes" ? sides?.yesBook : sides?.noBook;
    return normalizeBidLevels(book?.bids);
  }, [trade.side, sides]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedLevel = levels[selectedIndex];

  const maxShares = clampSellQuantity(trade.shares, trade.shares, selectedLevel?.size);
  const [qty, setQty] = useState<string>(() => maxShares.toFixed(2));
  const [selling, setSelling] = useState(false);

  const requested = parseFloat(qty || "0");
  const sellable = clampSellQuantity(requested, trade.shares, selectedLevel?.size);
  const fill = walkSellAgainstLevel(selectedLevel, sellable);
  const costBasis = trade.shares > 0 ? trade.amount * (fill.shares / trade.shares) : 0;
  const profit = fill.usd - costBasis;
  const canSell = fill.shares > 0 && fill.price !== null;

  const selectLevel = (i: number) => {
    setSelectedIndex(i);
    const lvl = levels[i];
    setQty(clampSellQuantity(trade.shares, trade.shares, lvl?.size).toFixed(2));
  };

  const handleSell = async () => {
    if (!canSell) return;
    setSelling(true);
    const ok = await onSellPartial(trade.id, fill.shares, fill.usd);
    setSelling(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-md border border-border bg-card p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Place Sell Order</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <p className="mb-1 truncate text-xs text-muted-foreground">{trade.event_title}</p>
        <p className="mb-3 text-xs font-semibold text-foreground">
          {trade.market_title}{" "}
          <span className={`ml-1 uppercase ${trade.side === "yes" ? "text-primary" : "text-destructive"}`}>{trade.side}</span>
        </p>

        <div className="mb-3 grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-sm bg-muted/50 px-2 py-1.5">
            <span className="text-muted-foreground">Shares held</span>
            <div className="tabular-nums text-foreground font-semibold">{trade.shares.toFixed(2)}</div>
          </div>
          <div className="rounded-sm bg-muted/50 px-2 py-1.5">
            <span className="text-muted-foreground">Entry</span>
            <div className="tabular-nums text-foreground font-semibold">{(trade.price * 100).toFixed(1)}¢</div>
          </div>
        </div>

        {/* Buy orders (bid levels) to sell into */}
        <div className="mb-3">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
            Sell into buy order
          </label>
          {levels.length === 0 ? (
            <p className="rounded-sm border border-border bg-muted/40 px-2 py-2 text-[10px] text-muted-foreground">
              No resting buy orders available on the {trade.side.toUpperCase()} book right now.
            </p>
          ) : (
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {levels.map((lvl, i) => (
                <button
                  key={`${lvl.price}-${i}`}
                  onClick={() => selectLevel(i)}
                  className={`flex w-full items-center justify-between rounded-sm border px-2 py-1.5 text-[10px] transition-colors ${
                    i === selectedIndex
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="tabular-nums font-semibold">{(lvl.price * 100).toFixed(1)}¢</span>
                  <span className="tabular-nums">{lvl.size.toFixed(2)} sh</span>
                  <span className="tabular-nums">${(lvl.price * lvl.size).toFixed(2)} max</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quantity */}
        {levels.length > 0 && (
          <div className="mb-3">
            <label className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Quantity (shares)</span>
              <button
                onClick={() => setQty(maxShares.toFixed(2))}
                className="rounded-sm bg-muted px-1.5 py-0.5 text-[9px] normal-case text-muted-foreground hover:text-foreground"
              >
                Max {maxShares.toFixed(2)}
              </button>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              max={maxShares}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full rounded-sm border border-border bg-muted px-2 py-1.5 text-xs tabular-nums text-foreground outline-none focus:border-primary"
            />
            <input
              type="range"
              min="0"
              max={maxShares}
              step="0.01"
              value={Math.min(requested || 0, maxShares)}
              onChange={(e) => setQty(e.target.value)}
              className="mt-2 w-full accent-primary"
            />
          </div>
        )}

        {/* Summary */}
        <div className="mb-3 space-y-1 rounded-sm border border-border bg-muted/50 p-2">
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Selling</span>
            <span className="tabular-nums text-foreground">{fill.shares.toFixed(2)} sh @ {selectedLevel ? (selectedLevel.price * 100).toFixed(1) : "--"}¢</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Proceeds</span>
            <span className="tabular-nums text-[hsl(var(--signal-resolved))]">${fill.usd.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Realized P/L</span>
            <span className={`tabular-nums ${profit >= 0 ? "text-[hsl(var(--signal-resolved))]" : "text-destructive"}`}>
              {profit >= 0 ? "+" : ""}{profit.toFixed(2)}
            </span>
          </div>
          {fill.shares < trade.shares - 1e-9 && fill.shares > 0 && (
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Remaining open</span>
              <span className="tabular-nums text-foreground">{(trade.shares - fill.shares).toFixed(2)} sh</span>
            </div>
          )}
        </div>

        <button
          onClick={handleSell}
          disabled={!canSell || selling}
          className="flex w-full items-center justify-center gap-1.5 rounded-sm bg-primary py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <HandCoins className="h-3.5 w-3.5" />
          {selling ? "Placing..." : canSell ? `Sell ${fill.shares.toFixed(2)} shares` : "Select an order"}
        </button>
      </div>
    </div>
  );
}
