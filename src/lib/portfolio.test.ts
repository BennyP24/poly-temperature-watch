import { describe, it, expect } from "vitest";
import {
  computeConsolidatedBalance,
  computeEquity,
  realizedProfit,
  openStake,
  markToMarket,
  type LedgerTrade,
} from "./portfolio";

function trade(partial: Partial<LedgerTrade>): LedgerTrade {
  return { status: "open", amount: 0, profit: 0, shares: 0, price: 0, ...partial };
}

describe("realizedProfit / openStake", () => {
  it("sums realized profit over closed trades only", () => {
    const trades = [
      trade({ status: "won", profit: 900 }),
      trade({ status: "lost", profit: -800 }),
      trade({ status: "open", profit: 0, amount: 50 }),
      trade({ status: "cancelled", profit: 12 }),
    ];
    expect(realizedProfit(trades)).toBe(100);
  });

  it("sums stake over open trades only", () => {
    const trades = [
      trade({ status: "open", amount: 50 }),
      trade({ status: "open", amount: 25 }),
      trade({ status: "won", amount: 999 }),
    ];
    expect(openStake(trades)).toBe(75);
  });
});

describe("computeConsolidatedBalance", () => {
  it("reflects the 1000 -> +900 -> -800 = 1100 scenario", () => {
    const trades = [
      trade({ status: "won", amount: 100, profit: 900 }),
      trade({ status: "lost", amount: 800, profit: -800 }),
    ];
    expect(computeConsolidatedBalance(trades)).toBe(1100);
  });

  it("subtracts cash locked in open positions", () => {
    const trades = [
      trade({ status: "won", amount: 100, profit: 900 }),
      trade({ status: "open", amount: 200, shares: 400, price: 0.5 }),
    ];
    // 1000 + 900 realized - 200 still staked = 1700 cash
    expect(computeConsolidatedBalance(trades)).toBe(1700);
  });

  it("honors a custom initial deposit", () => {
    expect(computeConsolidatedBalance([], 500)).toBe(500);
  });
});

describe("markToMarket / computeEquity", () => {
  it("marks open positions at provided price, falling back to entry", () => {
    const trades = [
      trade({ status: "open", shares: 100, price: 0.4 }),
      trade({ status: "open", shares: 50, price: 0.2 }),
    ];
    const value = markToMarket(trades, (t) => (t.price === 0.4 ? 0.6 : null));
    // first marked at 0.6 -> 60; second falls back to entry 0.2 -> 10
    expect(value).toBe(70);
  });

  it("computes full equity breakdown", () => {
    const trades = [
      trade({ status: "won", amount: 100, profit: 900 }),
      trade({ status: "open", amount: 200, shares: 400, price: 0.5 }),
    ];
    const eq = computeEquity(trades, () => 0.6);
    expect(eq.realized).toBe(900);
    expect(eq.cash).toBe(1700); // 1000 + 900 - 200
    expect(eq.openValue).toBe(240); // 400 * 0.6
    expect(eq.unrealized).toBeCloseTo(40, 6); // 240 - 200
    expect(eq.equity).toBe(1940); // 1700 + 240
    expect(eq.totalPnL).toBeCloseTo(940, 6); // 900 + 40
  });

  it("equity equals deposit when there are no trades", () => {
    const eq = computeEquity([], () => null);
    expect(eq.equity).toBe(1000);
    expect(eq.totalPnL).toBe(0);
  });
});
