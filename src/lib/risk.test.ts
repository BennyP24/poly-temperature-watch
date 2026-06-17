import { describe, it, expect } from "vitest";
import { computeRisk, hoursUntil, riskTextClass, riskBgClass } from "./risk";

const NOW = new Date("2026-06-16T12:00:00Z").getTime();

function inHours(h: number): string {
  return new Date(NOW + h * 3_600_000).toISOString();
}

describe("hoursUntil", () => {
  it("returns null for missing or invalid dates", () => {
    expect(hoursUntil(undefined, NOW)).toBeNull();
    expect(hoursUntil("not-a-date", NOW)).toBeNull();
  });

  it("returns fractional hours until the date", () => {
    expect(hoursUntil(inHours(2.5), NOW)).toBeCloseTo(2.5, 6);
    expect(hoursUntil(inHours(-1), NOW)).toBeCloseTo(-1, 6);
  });
});

describe("computeRisk", () => {
  it("flags closed when already resolved", () => {
    const r = computeRisk({ endDate: inHours(-0.5), now: NOW });
    expect(r.level).toBe("closed");
    expect(r.label).toBe("CLOSED");
  });

  it("flags HIGH below 2 hours", () => {
    const r = computeRisk({ endDate: inHours(1), now: NOW });
    expect(r.level).toBe("high");
    expect(r.label).toBe("HIGH RISK");
    expect(r.hoursLeft).toBe(1);
  });

  it("treats just under 2h as HIGH", () => {
    expect(computeRisk({ endDate: inHours(1.99), now: NOW }).level).toBe("high");
  });

  it("flags RISKY in the 2h-3h window", () => {
    expect(computeRisk({ endDate: inHours(2), now: NOW }).level).toBe("risky");
    expect(computeRisk({ endDate: inHours(2.5), now: NOW }).level).toBe("risky");
    expect(computeRisk({ endDate: inHours(3), now: NOW }).level).toBe("risky");
    expect(computeRisk({ endDate: inHours(2.5), now: NOW }).label).toBe("RISKY");
  });

  it("flags elevated above 3h when cooling unconfirmed", () => {
    const r = computeRisk({ endDate: inHours(5), now: NOW, coolingConfirmed: false });
    expect(r.level).toBe("elevated");
    expect(r.label).toBe("MED RISK");
  });

  it("is low above 3h when cooling confirmed", () => {
    const r = computeRisk({ endDate: inHours(5), now: NOW, coolingConfirmed: true });
    expect(r.level).toBe("low");
    expect(r.label).toBe("LOW RISK");
  });

  it("is low above 3h when cooling not specified", () => {
    expect(computeRisk({ endDate: inHours(5), now: NOW }).level).toBe("low");
  });

  it("returns low with null label when endDate missing", () => {
    const r = computeRisk({ endDate: undefined, now: NOW });
    expect(r.level).toBe("low");
    expect(r.hoursLeft).toBeNull();
  });
});

describe("risk class helpers", () => {
  it("maps levels to classes", () => {
    expect(riskTextClass("high")).toContain("destructive");
    expect(riskTextClass("risky")).toContain("orange");
    expect(riskTextClass("low")).toContain("emerald");
    expect(riskBgClass("high")).toContain("destructive");
    expect(riskBgClass("low")).toContain("emerald");
  });
});
