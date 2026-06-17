import { describe, expect, it } from "vitest";
import {
  cToF,
  dailyMaxFromMetars,
  parseMetarTempC,
  round1,
  type MetarObs,
} from "../../supabase/functions/_shared/metar";
import { localDayUtcWindow } from "../../supabase/functions/_shared/timezone";

function obs(reportTime: string, tempC: number | null): MetarObs {
  return {
    icaoId: "NZWN",
    reportTime,
    tempC,
    stationName: "Wellington International Airport",
    lat: -41.327,
    lon: 174.805,
    rawOb: null,
  };
}

describe("dailyMaxFromMetars", () => {
  it("returns null highC when there are no METARs", () => {
    const r = dailyMaxFromMetars([], "2026-05-26", "Pacific/Auckland");
    expect(r.highC).toBeNull();
    expect(r.samples).toBe(0);
  });

  it("takes max across observations inside the local-day window (Wellington, May 26 NZST = UTC+12)", () => {
    // Local 2026-05-26 in Pacific/Auckland (NZST = UTC+12) spans
    //   UTC 2026-05-25 12:00:00 -> 2026-05-26 12:00:00
    const metars = [
      obs("2026-05-25T11:30:00Z", 99), // BEFORE window, must be excluded
      obs("2026-05-25T13:00:00Z", 11), // local 2026-05-26 01:00 NZST
      obs("2026-05-26T01:00:00Z", 17), // local 2026-05-26 13:00 NZST (peak)
      obs("2026-05-26T06:00:00Z", 14), // local 2026-05-26 18:00 NZST
      obs("2026-05-26T12:00:00Z", 99), // AT exclusive end (UTC noon = NZST midnight 27th), excluded
    ];
    const r = dailyMaxFromMetars(metars, "2026-05-26", "Pacific/Auckland");
    expect(r.highC).toBe(17);
    expect(r.samples).toBe(3);
  });

  it("exposes the latest observation as 'current' even when it falls outside the window", () => {
    const metars = [
      obs("2026-05-26T01:00:00Z", 17),
      obs("2026-05-26T23:00:00Z", 9), // outside Wellington 5/26 local window but latest
    ];
    const r = dailyMaxFromMetars(metars, "2026-05-26", "Pacific/Auckland");
    expect(r.latestObsTime).toBe("2026-05-26T23:00:00Z");
    expect(r.latestTempC).toBe(9);
    expect(r.highC).toBe(17);
    expect(r.stationName).toBe("Wellington International Airport");
    expect(r.stationLat).toBeCloseTo(-41.327, 2);
    expect(r.stationLon).toBeCloseTo(174.805, 2);
  });

  it("ignores observations without tempC", () => {
    const metars = [
      obs("2026-05-26T01:00:00Z", null),
      obs("2026-05-26T02:00:00Z", 10),
    ];
    const r = dailyMaxFromMetars(metars, "2026-05-26", "Pacific/Auckland");
    expect(r.highC).toBe(10);
    expect(r.samples).toBe(1);
  });

  it("takes min across observations inside the window for lowC", () => {
    const metars = [
      obs("2026-05-25T11:30:00Z", -99), // BEFORE window, excluded
      obs("2026-05-25T13:00:00Z", 11),
      obs("2026-05-26T01:00:00Z", 17),
      obs("2026-05-26T06:00:00Z", 8), // lowest in window
      obs("2026-05-26T12:00:00Z", -99), // AT exclusive end, excluded
    ];
    const r = dailyMaxFromMetars(metars, "2026-05-26", "Pacific/Auckland");
    expect(r.lowC).toBe(8);
    expect(r.highC).toBe(17);
    expect(r.samples).toBe(3);
  });

  it("returns null lowC when there are no METARs", () => {
    const r = dailyMaxFromMetars([], "2026-05-26", "Pacific/Auckland");
    expect(r.lowC).toBeNull();
  });
});

describe("localDayUtcWindow", () => {
  it("computes Wellington May 26 window as 2026-05-25T12Z -> 2026-05-26T12Z", () => {
    const w = localDayUtcWindow("2026-05-26", "Pacific/Auckland");
    expect(w?.start.toISOString()).toBe("2026-05-25T12:00:00.000Z");
    expect(w?.end.toISOString()).toBe("2026-05-26T12:00:00.000Z");
  });

  it("computes UTC day as itself", () => {
    const w = localDayUtcWindow("2026-05-26", "UTC");
    expect(w?.start.toISOString()).toBe("2026-05-26T00:00:00.000Z");
    expect(w?.end.toISOString()).toBe("2026-05-27T00:00:00.000Z");
  });

  it("handles US Eastern day (UTC-4 in May, EDT)", () => {
    const w = localDayUtcWindow("2026-05-26", "America/New_York");
    expect(w?.start.toISOString()).toBe("2026-05-26T04:00:00.000Z");
    expect(w?.end.toISOString()).toBe("2026-05-27T04:00:00.000Z");
  });

  it("returns null for malformed dates", () => {
    expect(localDayUtcWindow("bad", "UTC")).toBeNull();
  });
});

describe("parseMetarTempC", () => {
  it("parses positive temp (KLAX 25C)", () => {
    expect(parseMetarTempC(" 25/M02 ")).toBe(25);
  });

  it("parses negative temp (M03/M07)", () => {
    expect(parseMetarTempC(" M03/M07 ")).toBe(-3);
  });

  it("returns null when no group is present", () => {
    expect(parseMetarTempC("KLAX 261853Z")).toBeNull();
  });
});

describe("cToF / round1", () => {
  it("converts Celsius to Fahrenheit", () => {
    expect(round1(cToF(0))).toBe(32);
    expect(round1(cToF(100))).toBe(212);
    expect(round1(cToF(25))).toBe(77);
  });
});
