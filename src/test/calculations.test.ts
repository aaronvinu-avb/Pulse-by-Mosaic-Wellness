import { describe, expect, it } from "vitest";
import { getOptimalAllocationNonLinear, getTimeFrameMonths, type SaturationModel } from "@/lib/calculations";
import type { MarketingRecord } from "@/lib/mockData";

describe("calculations helpers", () => {
  it("returns normalized allocation fractions", () => {
    const models: SaturationModel[] = [
      { channel: "Meta Ads", alpha: 10, scatterPoints: [], saturationPoint: 9 },
      { channel: "Google Search", alpha: 8, scatterPoints: [], saturationPoint: 7 },
    ];

    const fractions = getOptimalAllocationNonLinear(models, 1_000_000);
    const sum = Object.values(fractions).reduce((acc, value) => acc + value, 0);

    expect(sum).toBeCloseTo(1, 6);
    expect(fractions["Meta Ads"]).toBeGreaterThan(0);
    expect(fractions["Google Search"]).toBeGreaterThan(0);
  });

  it("estimates timeframe months from unique daily records", () => {
    const days: MarketingRecord[] = Array.from({ length: 61 }, (_, idx) => ({
      date: `2025-01-${String((idx % 31) + 1).padStart(2, "0")}`,
      day_of_week: "Mon",
      channel: "Meta Ads",
      spend: 100,
      revenue: 250,
      roas: 2.5,
      impressions: 1000,
      clicks: 50,
      conversions: 5,
      new_customers: 3,
      ctr: 5,
      cpc: 2,
      cpa: 20,
      aov: 50,
    }));

    const months = getTimeFrameMonths(days);
    expect(months).toBeGreaterThan(1);
  });
});
