/**
 * Consolidated balance / equity math for the paper-trading ledger.
 *
 * The stored cash balance equals `initialDeposit + sum(realized profit)` once all
 * positions are closed, but the UI historically showed cash and realized P/L as two
 * separate numbers (e.g. "$1,000" + "+$100" instead of "$1,100"). These helpers derive
 * the consolidated figures straight from the trade ledger so the displayed equity always
 * reflects wins minus losses, and a closed-out account reads as a single number.
 */

export const DEFAULT_INITIAL_DEPOSIT = 1000;

export interface LedgerTrade {
  status: string;
  /** USD staked when the position was opened. */
  amount: number;
  /** Realized profit for closed trades (payout - amount). */
  profit: number;
  /** Shares held (used for marking open positions). */
  shares: number;
  /** Entry price per share (fallback mark when no live price). */
  price: number;
}

const CLOSED_STATUSES = new Set(["won", "lost", "sold"]);

/** Sum of realized profit across all closed (won/lost/sold) trades. */
export function realizedProfit(trades: LedgerTrade[]): number {
  return trades
    .filter((t) => CLOSED_STATUSES.has(t.status))
    .reduce((sum, t) => sum + (Number.isFinite(t.profit) ? t.profit : 0), 0);
}

/** Total USD currently staked in open positions. */
export function openStake(trades: LedgerTrade[]): number {
  return trades
    .filter((t) => t.status === "open")
    .reduce((sum, t) => sum + (Number.isFinite(t.amount) ? t.amount : 0), 0);
}

/**
 * Consolidated cash balance derived from the ledger: starting deposit plus all
 * realized P/L, minus cash still locked in open positions. With no open trades this
 * equals `initialDeposit + realizedProfit` (e.g. 1000 + 900 - 800 = 1100).
 */
export function computeConsolidatedBalance(
  trades: LedgerTrade[],
  initialDeposit: number = DEFAULT_INITIAL_DEPOSIT,
): number {
  return initialDeposit + realizedProfit(trades) - openStake(trades);
}

/**
 * Mark-to-market value of open positions given a per-trade current price resolver.
 * `markPriceFor` returns the current per-share price for the trade's side, or null
 * to fall back to the entry price.
 */
export function markToMarket(
  trades: LedgerTrade[],
  markPriceFor: (trade: LedgerTrade) => number | null,
): number {
  let total = 0;
  for (const t of trades) {
    if (t.status !== "open") continue;
    const price = markPriceFor(t);
    total += t.shares * (price ?? t.price);
  }
  return total;
}

export interface EquitySummary {
  /** Consolidated cash (deposit + realized P/L - open stake). */
  cash: number;
  /** Mark-to-market value of open positions. */
  openValue: number;
  /** cash + openValue: total account equity. */
  equity: number;
  /** Realized P/L only. */
  realized: number;
  /** Unrealized P/L on open positions (openValue - openStake). */
  unrealized: number;
  /** realized + unrealized. */
  totalPnL: number;
}

/**
 * Full equity breakdown for display. `equity` is the single consolidated number to
 * show as the account value; `cash` is the consolidated balance.
 */
export function computeEquity(
  trades: LedgerTrade[],
  markPriceFor: (trade: LedgerTrade) => number | null,
  initialDeposit: number = DEFAULT_INITIAL_DEPOSIT,
): EquitySummary {
  const realized = realizedProfit(trades);
  const stake = openStake(trades);
  const cash = initialDeposit + realized - stake;
  const openValue = markToMarket(trades, markPriceFor);
  const unrealized = openValue - stake;
  return {
    cash,
    openValue,
    equity: cash + openValue,
    realized,
    unrealized,
    totalPnL: realized + unrealized,
  };
}
