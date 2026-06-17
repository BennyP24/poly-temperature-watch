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

/**
 * Clamp a requested sell quantity to what is actually sellable: never more than
 * the shares held, and (when a target bid level is chosen) never more than that
 * level's available size. Returns a non-negative, finite number of shares.
 */
export function clampSellQuantity(
  requestedShares: number,
  heldShares: number,
  levelSize?: number,
): number {
  if (!Number.isFinite(requestedShares) || requestedShares <= 0) return 0;
  let max = Number.isFinite(heldShares) && heldShares > 0 ? heldShares : 0;
  if (levelSize != null && Number.isFinite(levelSize)) {
    max = Math.min(max, Math.max(0, levelSize));
  }
  return Math.min(requestedShares, max);
}

export interface SellAgainstLevelResult {
  /** Shares actually sold into the chosen level. */
  shares: number;
  /** Proceeds in USD (shares * level price). */
  usd: number;
  /** Per-share price (the level price), or null when nothing sold. */
  price: number | null;
}

/**
 * Sell up to `sharesToSell` shares into a single chosen bid level, capped at the
 * level's available size. Models the "sell into one specific resting buy order
 * for a chosen quantity" flow.
 */
export function walkSellAgainstLevel(
  level: BidLevel | undefined,
  sharesToSell: number,
): SellAgainstLevelResult {
  if (!level || !Number.isFinite(sharesToSell) || sharesToSell <= 0) {
    return { shares: 0, usd: 0, price: null };
  }
  const shares = Math.min(sharesToSell, Math.max(0, level.size));
  if (shares <= 0) return { shares: 0, usd: 0, price: null };
  return { shares, usd: shares * level.price, price: level.price };
}
