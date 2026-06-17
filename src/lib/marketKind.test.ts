import { describe, it, expect } from "vitest";
import { detectTempKind, isHighestTempEvent, isLowestTempEvent } from "./marketKind";

describe("detectTempKind", () => {
  it("detects highest-temperature markets", () => {
    expect(detectTempKind({ title: "Highest temperature in NYC on June 16?" })).toBe("highest");
    expect(detectTempKind({ title: "Hottest day in London this week" })).toBe("highest");
    expect(detectTempKind({ title: "Daily high temp in Tokyo" })).toBe("highest");
    expect(detectTempKind({ title: "Max temperature Paris" })).toBe("highest");
  });

  it("detects lowest-temperature markets", () => {
    expect(detectTempKind({ title: "Lowest temperature in Chicago today?" })).toBe("lowest");
    expect(detectTempKind({ title: "Coldest morning in Berlin" })).toBe("lowest");
    expect(detectTempKind({ title: "Overnight low in Denver" })).toBe("lowest");
    expect(detectTempKind({ title: "Minimum temperature Moscow" })).toBe("lowest");
  });

  it("prefers lowest when both could match weakly", () => {
    expect(detectTempKind({ title: "Lowest high temp confusion" })).toBe("lowest");
  });

  it("returns unknown by default when no keyword present", () => {
    expect(detectTempKind({ title: "Temperature in Miami on Friday" })).toBe("unknown");
  });

  it("can default unknown to highest", () => {
    expect(
      detectTempKind({ title: "Temperature in Miami" }, { defaultToHighest: true }),
    ).toBe("highest");
  });

  it("falls back to description", () => {
    expect(
      detectTempKind({ title: "NYC weather", description: "Resolves to the lowest recorded temp" }),
    ).toBe("lowest");
  });
});

describe("is* helpers", () => {
  it("isHighestTempEvent defaults unknown to highest", () => {
    expect(isHighestTempEvent({ title: "Temperature in Miami" })).toBe(true);
    expect(isHighestTempEvent({ title: "Lowest temp Miami" })).toBe(false);
  });

  it("isLowestTempEvent only true for explicit low", () => {
    expect(isLowestTempEvent({ title: "Lowest temp Miami" })).toBe(true);
    expect(isLowestTempEvent({ title: "Temperature in Miami" })).toBe(false);
  });
});
