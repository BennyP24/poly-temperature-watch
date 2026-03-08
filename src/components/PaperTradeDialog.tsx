import { useState } from "react";
import type { TemperatureMarket } from "@/lib/polymarket";
import { DollarSign, X } from "lucide-react";

interface PaperTradeDialogProps {
  market: TemperatureMarket;
  eventId: string;
  eventTitle: string;
  balance: number;
  onPlace: (params: {
    eventId: string;
    eventTitle: string;
    marketId: string;
    marketTitle: string;
    side: "yes" | "no";
    price: number;
    amount: number;
  }) => Promise<boolean>;
  onClose: () => void;
}

export function PaperTradeDialog({ market, eventId, eventTitle, balance, onPlace, onClose }: PaperTradeDialogProps) {
  const [amount, setAmount] = useState("");
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [placing, setPlacing] = useState(false);

  const price = side === "yes" ? market.yesPrice : market.noPrice;
  const shares = price > 0 ? parseFloat(amount || "0") / price : 0;
  const potentialPayout = shares;
  const potentialProfit = potentialPayout - parseFloat(amount || "0");

  const handlePlace = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || amt > balance) return;
    setPlacing(true);
    const ok = await onPlace({
      eventId,
      eventTitle,
      marketId: market.id,
      marketTitle: market.groupItemTitle,
      side,
      price,
      amount: amt,
    });
    setPlacing(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-md border border-border bg-card p-4 shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">Paper Trade</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <p className="text-xs text-muted-foreground mb-1 truncate">{eventTitle}</p>
        <p className="text-xs font-semibold text-foreground mb-3">{market.groupItemTitle}</p>

        {/* Side toggle */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setSide("yes")}
            className={`flex-1 rounded-sm py-1.5 text-xs font-bold transition-colors ${
              side === "yes" ? "bg-[hsl(var(--signal-resolved))] text-background" : "bg-muted text-muted-foreground"
            }`}
          >YES @ {(market.yesPrice * 100).toFixed(1)}¢</button>
          <button
            onClick={() => setSide("no")}
            className={`flex-1 rounded-sm py-1.5 text-xs font-bold transition-colors ${
              side === "no" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"
            }`}
          >NO @ {(market.noPrice * 100).toFixed(1)}¢</button>
        </div>

        {/* Amount */}
        <div className="mb-3">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Amount ($)</label>
          <div className="flex items-center gap-2">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={balance}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="flex-1 rounded-sm border border-border bg-muted px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary tabular-nums"
              placeholder="0.00"
            />
          </div>
          <div className="flex gap-1 mt-1">
            {[5, 10, 25, 50, 100].map(v => (
              <button
                key={v}
                onClick={() => setAmount(String(Math.min(v, balance)))}
                className="rounded-sm bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
              >${v}</button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-sm border border-border bg-muted/50 p-2 mb-3 space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Balance</span>
            <span className="text-foreground tabular-nums">${balance.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Shares</span>
            <span className="text-foreground tabular-nums">{shares.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Potential Payout</span>
            <span className="text-[hsl(var(--signal-resolved))] tabular-nums">${potentialPayout.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Potential Profit</span>
            <span className={`tabular-nums ${potentialProfit > 0 ? "text-[hsl(var(--signal-resolved))]" : "text-destructive"}`}>
              {potentialProfit >= 0 ? "+" : ""}{potentialProfit.toFixed(2)}
            </span>
          </div>
        </div>

        <button
          onClick={handlePlace}
          disabled={placing || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
          className="w-full rounded-sm bg-primary py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {placing ? "Placing..." : `Place ${side.toUpperCase()} Trade`}
        </button>
      </div>
    </div>
  );
}
