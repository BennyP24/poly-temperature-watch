import { describe, expect, it } from "vitest";
import { findAirportByIcao, resolveAirportForLocation } from "@/lib/airports";

describe("resolveAirportForLocation", () => {
  it("maps Wellington to NZWN", () => {
    const a = resolveAirportForLocation("Wellington");
    expect(a?.icao).toBe("NZWN");
    expect(a?.iata).toBe("WLG");
    expect(a?.city).toBe("Wellington");
    expect(a?.country).toBe("NZ");
    expect(a?.timezone).toBe("Pacific/Auckland");
    expect(a?.lat).toBeCloseTo(-41.327, 2);
    expect(a?.lon).toBeCloseTo(174.805, 2);
  });

  it("maps Tel Aviv to LLBG", () => {
    expect(resolveAirportForLocation("Tel Aviv")?.icao).toBe("LLBG");
  });

  it("maps Israeli alias cities (Jerusalem, Haifa, Ben Gurion) to LLBG", () => {
    expect(resolveAirportForLocation("Jerusalem")?.icao).toBe("LLBG");
    expect(resolveAirportForLocation("Haifa")?.icao).toBe("LLBG");
    expect(resolveAirportForLocation("Ben Gurion")?.icao).toBe("LLBG");
  });

  it("maps New York / NYC / New York City to KLGA", () => {
    expect(resolveAirportForLocation("New York")?.icao).toBe("KLGA");
    expect(resolveAirportForLocation("NYC")?.icao).toBe("KLGA");
    expect(resolveAirportForLocation("New York City")?.icao).toBe("KLGA");
  });

  it("normalizes diacritics (São Paulo → SBGR)", () => {
    expect(resolveAirportForLocation("São Paulo")?.icao).toBe("SBGR");
    expect(resolveAirportForLocation("Sao Paulo")?.icao).toBe("SBGR");
  });

  it("returns null for unknown locations", () => {
    expect(resolveAirportForLocation("Atlantis")).toBeNull();
    expect(resolveAirportForLocation("")).toBeNull();
  });

  it("findAirportByIcao is case-insensitive", () => {
    expect(findAirportByIcao("nzwn")?.icao).toBe("NZWN");
    expect(findAirportByIcao("LLBG")?.iata).toBe("TLV");
    expect(findAirportByIcao("XXXX")).toBeNull();
  });
});
