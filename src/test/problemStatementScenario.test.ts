/**
 * Problem statement (Marketing Mix Optimizer) — encoded as executable checks.
 *
 * Scenario:
 * - 10 marketing channels; CMO monthly budget ₹50,00,000.
 * - ~3 years of daily rows per channel (spend, revenue, impressions, clicks, conversions, new customers).
 * - Model: non-linear (diminishing returns), weekday effects, seasonality (via optimizer pipeline).
 *
 * Deliverable numbers below use the same pipeline as the app: generateMockData → baselines →
 * computeCurrentMixForecast / computeRecommendedMix @ Base mode, 1 month horizon.
 */
import { describe, expect, it } from 'vitest';
import { generateMockData, CHANNELS } from '@/lib/mockData';
import {
  computeChannelBaselines,
  computeCurrentMixForecast,
  computeRecommendedMix,
  computeTimingEffects,
} from '@/lib/optimizer/calculations';

const MONTHLY_BUDGET_INR = 5_000_000; // ₹50 lakh

function fmt2(n: number): string {
  return n.toFixed(2);
}

describe('problem statement → optimizer pipeline', () => {
  it('validates input data shape (channels, horizon, metrics) and prints ₹50L Base-mode answers to 2 dp', () => {
    const records = generateMockData();

    // Unique calendar days in mock generator: 1095 (~3 years from 2023-01-01)
    const uniqueDays = new Set(records.map(r => r.date)).size;
    expect(uniqueDays).toBe(1095);

    // 10 channels × 1 row per channel per day
    expect(CHANNELS.length).toBe(10);
    expect(records.length).toBe(uniqueDays * CHANNELS.length);

    const sample = records[0];
    expect(sample).toMatchObject({
      channel: expect.any(String),
      spend: expect.any(Number),
      revenue: expect.any(Number),
      impressions: expect.any(Number),
      clicks: expect.any(Number),
      conversions: expect.any(Number),
      new_customers: expect.any(Number),
    });

    const baselines = computeChannelBaselines(records);
    expect(baselines.length).toBe(10);

    const timing = computeTimingEffects(records);

    const historicalAllocationPct: Record<string, number> = {};
    baselines.forEach(b => {
      historicalAllocationPct[b.channel] = b.historicalAllocationPct;
    });

    const current = computeCurrentMixForecast(
      historicalAllocationPct,
      MONTHLY_BUDGET_INR,
      baselines,
      { timingEffects: timing, planningMonth: 0 },
    );

    const recommended = computeRecommendedMix(
      baselines,
      MONTHLY_BUDGET_INR,
      'base',
      historicalAllocationPct,
      { timingEffects: timing, planningMonth: 0 },
    );

    const rec = recommended.forecast;

    // Primary “numerical answers” (rupees, 2 decimal places) — assignment-style field
    const currentMonthlyRevenue = current.totalRevenue;
    const recommendedMonthlyRevenue = rec.totalRevenue;

    const lines: string[] = [];
    lines.push('');
    lines.push('=== PROBLEM STATEMENT RUN (code) ===');
    lines.push(`Channels: ${CHANNELS.length}`);
    lines.push(`Daily history span: ${uniqueDays} days (~3 years)`);
    lines.push(`Monthly budget: ₹${fmt2(MONTHLY_BUDGET_INR)} INR`);
    lines.push('');
    lines.push('--- Your numerical answers (2 decimal places) ---');
    lines.push(`current_mix_monthly_revenue_inr:   ${fmt2(currentMonthlyRevenue)}`);
    lines.push(`recommended_mix_monthly_revenue_inr: ${fmt2(recommendedMonthlyRevenue)}`);
    lines.push(`recommended_blended_roas:          ${fmt2(rec.blendedROAS)}`);
    lines.push(`uplift_pct_vs_current:             ${fmt2(
      currentMonthlyRevenue > 0
        ? ((recommendedMonthlyRevenue - currentMonthlyRevenue) / currentMonthlyRevenue) * 100
        : 0,
    )}`);
    lines.push('');
    lines.push('--- Recommended allocation (% of budget) ---');
    for (const ch of CHANNELS) {
      const pct = recommended.allocationsPct[ch] ?? 0;
      lines.push(`  ${ch}: ${fmt2(pct)}%`);
    }
    lines.push('========================================');
    lines.push('');

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));

    expect(currentMonthlyRevenue).toBeGreaterThan(0);
    expect(recommendedMonthlyRevenue).toBeGreaterThan(0);
    expect(Math.abs(Object.values(recommended.allocationsPct).reduce((a, b) => a + b, 0) - 100)).toBeLessThan(0.05);

    // Accounting identities from computeCurrentMixForecast / recommended.forecast
    expect(current.blendedROAS).toBeCloseTo(currentMonthlyRevenue / MONTHLY_BUDGET_INR, 12);
    expect(rec.blendedROAS).toBeCloseTo(recommendedMonthlyRevenue / MONTHLY_BUDGET_INR, 12);
    expect(recommendedMonthlyRevenue).toBeCloseTo(
      CHANNELS.reduce((s, ch) => s + (rec.channels[ch]?.forecastRevenue ?? 0), 0),
      4,
    );
  });
});
