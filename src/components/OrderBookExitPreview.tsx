import type { PaperTrade } from "@/hooks/usePaperTrading";
import type { MarketSideBooks } from "@/hooks/useMarketPrices";
import { normalizeBidLevels, walkSellAgainstBids } from "@/lib/orderbookSell";

export function computeSellWalkForTrade(trade: Pick<PaperTrade, "side" | "shares">, sides: MarketSideBooks | undefined) {
  const book = trade.side === "yes" ? sides?.yesBook : sides?.noBook;
  const levels = normalizeBidLevels(book?.bids);
  const walk = walkSellAgainstBids(levels, trade.shares);
  const hasBook = levels.length > 0;
  return { levels, walk, hasBook };
}

interface OrderBookExitPreviewProps {
  trade: Pick<PaperTrade, "side" | "shares">;
  sides: MarketSideBooks | undefined;
}

/** Compact bid depth + VWAP for selling an open position against the CLOB. */
export function OrderBookExitPreview({ trade, sides }: OrderBookExitPreviewProps) {
  const { levels, walk, hasBook } = computeSellWalkForTrade(trade, sides);

  if (!hasBook) {
    return (
      <p className="mt-1.5 text-[9px] leading-snug text-muted-foreground">
        Order book depth unavailable — Sell @ uses best-bid estimate from the feed.
      </p>
    );
  }

  const best = levels[0];

  return (
    <div className="mt-1.5 space-y-1 rounded-sm border border-border/60 bg-background/50 px-2 py-1.5 text-[9px] leading-snug text-muted-foreground">
      <p className="font-semibold text-foreground">Bid book (sell {trade.side.toUpperCase()})</p>
      {best && (
        <p className="tabular-nums">
          Best bid: <span className="text-foreground font-medium">{(best.price * 100).toFixed(1)}¢</span>
          {" — "}
          {best.size.toFixed(2)} shares available at this price
          {" "}
          (<span className="text-foreground">${(best.price * best.size).toFixed(2)}</span> if filled)
        </p>
      )}
      {walk.fills.map((f, i) => (
        <div key={`${f.price}-${i}`} className="flex flex-wrap gap-x-2 tabular-nums pl-1 border-l border-border/40">
          <span>
            Your fill: {(f.price * 100).toFixed(1)}¢ × {f.shares.toFixed(2)} sh
          </span>
          <span className="text-foreground">${f.usd.toFixed(2)}</span>
        </div>
      ))}
      {walk.vwap !== null && (
        <p className="pt-0.5 border-t border-border/50 text-foreground">
          VWAP to exit (filled): <span className="font-bold">{(walk.vwap * 100).toFixed(2)}¢</span>
          {" · "}
          Total: <span className="font-bold">${walk.totalUsd.toFixed(2)}</span>
        </p>
      )}
      {walk.unfilledShares > 0 && (
        <p className="text-amber-600 dark:text-amber-500">
          Only {walk.filledShares.toFixed(2)} of {trade.shares.toFixed(2)} shares match current bids; {walk.unfilledShares.toFixed(2)} shares unmatched.
        </p>
      )}
    </div>
  );
}
