import { describe, it, expect } from "vitest";
import { isWundergroundSource, WUNDERGROUND_WARNING } from "./resolutionSource";

describe("isWundergroundSource", () => {
  it("detects wunderground in resolutionSource", () => {
    expect(isWundergroundSource({ resolutionSource: "https://www.wunderground.com/history/..." })).toBe(true);
    expect(isWundergroundSource({ resolutionSource: "Weather Underground KNYC" })).toBe(true);
  });

  it("detects wunderground in reference links", () => {
    expect(
      isWundergroundSource({
        resolutionSource: "",
        referenceLinks: ["https://noaa.gov", "https://www.wunderground.com/dashboard"],
      }),
    ).toBe(true);
  });

  it("is false for NOAA-only sources", () => {
    expect(
      isWundergroundSource({
        resolutionSource: "NOAA Aviation Weather METAR",
        referenceLinks: ["https://aviationweather.gov"],
      }),
    ).toBe(false);
  });

  it("handles missing fields gracefully", () => {
    expect(isWundergroundSource({})).toBe(false);
    expect(isWundergroundSource({ resolutionSource: null, referenceLinks: null })).toBe(false);
  });

  it("warning copy is uppercase and mentions both sources", () => {
    expect(WUNDERGROUND_WARNING).toContain("WUNDERGROUND");
    expect(WUNDERGROUND_WARNING).toContain("NOAA");
    expect(WUNDERGROUND_WARNING).toBe(WUNDERGROUND_WARNING.toUpperCase());
  });
});
