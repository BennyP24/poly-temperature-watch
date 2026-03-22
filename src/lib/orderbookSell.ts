/** One bid level on the outcome token (price in 0–1 dollars, size in shares). */
export interface BidLevel {
  price: number;
  size: number;
}

export interface SellWalkFill {
  price: number;
  shares: number;
  usd: number;
}

export interface WalkSellAgainstBidsResult {
  fills: SellWalkFill[];
  filledShares: number;
  totalUsd: number;
  /** Volume-weighted average price for filled size (dollars per share). */
  vwap: number | null;
  /** Shares that could not be matched against remaining bids. */
  unfilledShares: number;
}

/**
 * Parse CLOB bid rows and sort by price descending (best bid first).
 */
export function normalizeBidLevels(bids: { price?: string; size?: string }[] | undefined): BidLevel[] {
  if (!bids?.length) return [];
  const levels: BidLevel[] = [];
  for (const b of bids) {
    const price = parseFloat(String(b.price));
    const size = parseFloat(String(b.size));
    if (!Number.isFinite(price) || !Number.isFinite(size) || size <= 0) continue;
    levels.push({ price, size });
  }
  levels.sort((a, b) => b.price - a.price);
  return levels;
}

/**
 * Walk the bid ladder to sell `sharesToSell` shares (highest bids first).
 */
export function walkSellAgainstBids(levels: BidLevel[], sharesToSell: number): WalkSellAgainstBidsResult {
  if (!Number.isFinite(sharesToSell) || sharesToSell <= 0) {
    return { fills: [], filledShares: 0, totalUsd: 0, vwap: null, unfilledShares: 0 };
  }
  let remaining = sharesToSell;
  const fills: SellWalkFill[] = [];
  let totalUsd = 0;

  for (const level of levels) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, level.size);
    const usd = take * level.price;
    fills.push({ price: level.price, shares: take, usd });
    totalUsd += usd;
    remaining -= take;
  }

  const filledShares = sharesToSell - remaining;
  const vwap = filledShares > 0 ? totalUsd / filledShares : null;

  return {
    fills,
    filledShares,
    totalUsd,
    vwap,
    unfilledShares: remaining,
  };
}
