import { describe, it, expect } from "vitest";
import { normalizeBidLevels, walkSellAgainstBids, type BidLevel } from "./orderbookSell";

describe("normalizeBidLevels", () => {
  it("returns empty array for undefined input", () => {
    expect(normalizeBidLevels(undefined)).toEqual([]);
  });

  it("returns empty array for empty array input", () => {
    expect(normalizeBidLevels([])).toEqual([]);
  });

  it("parses string prices and sizes correctly", () => {
    const bids = [
      { price: "0.50", size: "100" },
      { price: "0.45", size: "200" },
    ];
    const result = normalizeBidLevels(bids);
    expect(result).toEqual([
      { price: 0.50, size: 100 },
      { price: 0.45, size: 200 },
    ]);
  });

  it("sorts bids by price descending (best bid first)", () => {
    const bids = [
      { price: "0.45", size: "100" },
      { price: "0.55", size: "50" },
      { price: "0.50", size: "75" },
    ];
    const result = normalizeBidLevels(bids);
    expect(result[0].price).toBe(0.55);
    expect(result[1].price).toBe(0.50);
    expect(result[2].price).toBe(0.45);
  });

  it("filters out invalid entries (non-finite prices/sizes, zero/negative sizes)", () => {
    const bids = [
      { price: "0.50", size: "100" },
      { price: "invalid", size: "100" },
      { price: "0.45", size: "0" },
      { price: "0.40", size: "-10" },
      { price: "0.35", size: "50" },
    ];
    const result = normalizeBidLevels(bids);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ price: 0.50, size: 100 });
    expect(result[1]).toEqual({ price: 0.35, size: 50 });
  });
});

describe("walkSellAgainstBids", () => {
  const sampleBids: BidLevel[] = [
    { price: 0.50, size: 100 },
    { price: 0.45, size: 200 },
    { price: 0.40, size: 150 },
  ];

  it("returns empty result for zero shares to sell", () => {
    const result = walkSellAgainstBids(sampleBids, 0);
    expect(result).toEqual({
      fills: [],
      filledShares: 0,
      totalUsd: 0,
      vwap: null,
      unfilledShares: 0,
    });
  });

  it("returns empty result for negative shares to sell", () => {
    const result = walkSellAgainstBids(sampleBids, -10);
    expect(result).toEqual({
      fills: [],
      filledShares: 0,
      totalUsd: 0,
      vwap: null,
      unfilledShares: 0,
    });
  });

  it("fills entirely from first level when shares < first level size", () => {
    const result = walkSellAgainstBids(sampleBids, 50);
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0]).toEqual({ price: 0.50, shares: 50, usd: 25 });
    expect(result.filledShares).toBe(50);
    expect(result.totalUsd).toBe(25);
    expect(result.vwap).toBe(0.50);
    expect(result.unfilledShares).toBe(0);
  });

  it("fills across multiple levels correctly", () => {
    const result = walkSellAgainstBids(sampleBids, 150);
    expect(result.fills).toHaveLength(2);
    expect(result.fills[0]).toEqual({ price: 0.50, shares: 100, usd: 50 });
    expect(result.fills[1]).toEqual({ price: 0.45, shares: 50, usd: 22.5 });
    expect(result.filledShares).toBe(150);
    expect(result.totalUsd).toBe(72.5);
    expect(result.vwap).toBeCloseTo(72.5 / 150, 10);
    expect(result.unfilledShares).toBe(0);
  });

  it("fills all available liquidity and reports unfilled shares", () => {
    const result = walkSellAgainstBids(sampleBids, 500);
    expect(result.fills).toHaveLength(3);
    expect(result.filledShares).toBe(450); // 100 + 200 + 150
    expect(result.totalUsd).toBe(100 * 0.50 + 200 * 0.45 + 150 * 0.40);
    expect(result.unfilledShares).toBe(50);
  });

  it("calculates VWAP correctly for partial fills", () => {
    const bids: BidLevel[] = [
      { price: 0.60, size: 100 },
      { price: 0.50, size: 100 },
    ];
    const result = walkSellAgainstBids(bids, 200);
    // VWAP = (100 * 0.60 + 100 * 0.50) / 200 = 110 / 200 = 0.55
    expect(result.vwap).toBe(0.55);
    expect(result.totalUsd).toBe(110);
  });

  it("handles empty bid levels", () => {
    const result = walkSellAgainstBids([], 100);
    expect(result.fills).toEqual([]);
    expect(result.filledShares).toBe(0);
    expect(result.totalUsd).toBe(0);
    expect(result.vwap).toBe(null);
    expect(result.unfilledShares).toBe(100);
  });

  it("handles exact fill at level boundary", () => {
    const result = walkSellAgainstBids(sampleBids, 100);
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0]).toEqual({ price: 0.50, shares: 100, usd: 50 });
    expect(result.filledShares).toBe(100);
    expect(result.unfilledShares).toBe(0);
  });

  it("preserves precision for small amounts", () => {
    const bids: BidLevel[] = [
      { price: 0.03, size: 1000 },
    ];
    const result = walkSellAgainstBids(bids, 833.33);
    expect(result.filledShares).toBeCloseTo(833.33, 2);
    expect(result.totalUsd).toBeCloseTo(833.33 * 0.03, 4);
    expect(result.vwap).toBe(0.03);
  });
});
