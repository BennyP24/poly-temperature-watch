import { describe, it, expect } from "vitest";
import { parseMidpointResponse, midpointFromBook, type MidpointMap } from "./useMarketMidpoints";

describe("parseMidpointResponse", () => {
  it("parses token->price object into a numeric map", () => {
    const map: MidpointMap = new Map();
    parseMidpointResponse({ tokA: "0.55", tokB: "0.12" }, map);
    expect(map.get("tokA")).toBeCloseTo(0.55, 6);
    expect(map.get("tokB")).toBeCloseTo(0.12, 6);
  });

  it("ignores non-numeric values", () => {
    const map: MidpointMap = new Map();
    parseMidpointResponse({ tokA: "0.5", tokBad: "n/a" }, map);
    expect(map.has("tokA")).toBe(true);
    expect(map.has("tokBad")).toBe(false);
  });

  it("handles null/non-object input gracefully", () => {
    const map: MidpointMap = new Map();
    parseMidpointResponse(null, map);
    parseMidpointResponse("nope", map);
    expect(map.size).toBe(0);
  });

  it("merges into an existing map", () => {
    const map: MidpointMap = new Map([["existing", 0.9]]);
    parseMidpointResponse({ tokA: "0.3" }, map);
    expect(map.get("existing")).toBe(0.9);
    expect(map.get("tokA")).toBe(0.3);
  });

  it("ignores an error payload (old proxy response)", () => {
    const map: MidpointMap = new Map();
    parseMidpointResponse({ error: "Expected { tokenIds: string[] }" }, map);
    expect(map.size).toBe(0);
  });

  it("ignores array input (books shape is not a midpoint object)", () => {
    const map: MidpointMap = new Map();
    parseMidpointResponse([{ asset_id: "x", bids: [] }], map);
    expect(map.size).toBe(0);
  });
});

describe("midpointFromBook", () => {
  it("returns (best bid + best ask) / 2", () => {
    const mid = midpointFromBook({
      bids: [{ price: "0.08", size: "75" }, { price: "0.14", size: "1" }, { price: "0.12", size: "5" }],
      asks: [{ price: "0.20", size: "30" }, { price: "0.16", size: "125" }, { price: "0.18", size: "5" }],
    });
    expect(mid).toBeCloseTo(0.15, 6); // best bid 0.14, best ask 0.16
  });

  it("falls back to the only side present", () => {
    expect(midpointFromBook({ bids: [{ price: "0.84" }], asks: [] })).toBeCloseTo(0.84, 6);
    expect(midpointFromBook({ bids: [], asks: [{ price: "0.86" }] })).toBeCloseTo(0.86, 6);
  });

  it("returns null for empty/undefined books", () => {
    expect(midpointFromBook(undefined)).toBeNull();
    expect(midpointFromBook({ bids: [], asks: [] })).toBeNull();
  });

  it("ignores non-numeric levels", () => {
    expect(midpointFromBook({ bids: [{ price: "n/a" }], asks: [{ price: "0.5" }] })).toBeCloseTo(0.5, 6);
  });
});
