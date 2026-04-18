import { useMemo, useState, useCallback, useEffect } from 'react';
import { useMarketingData } from '@/hooks/useMarketingData';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { ChannelName } from '@/components/ChannelName';
import {
  getChannelSummaries,
  getChannelSaturationModels,
  getSeasonalityMetrics,
  getDayOfWeekMetrics,
  generateChannelInsights,
  getTimeFrameMonths,
  buildMonthRange,
  buildMonthlyPlanFromData,
  getChannelCapsFromData,
} from '@/lib/calculations';
import {
  Sliders,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Download,
  Scissors,
  Pause,
  Clock,
  AlertTriangle,
  Sparkles
} from "lucide-react";

import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import { CHANNELS, CHANNEL_COLORS } from '@/lib/mockData';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line, ReferenceLine,
} from 'recharts';
import { exportToCSV } from '@/lib/exportData';

type PlanningPeriod = '1m' | '1q' | '6m' | '1y' | 'custom';
type PlanningMode = 'conservative' | 'target' | 'aggressive';

const BUDGET_SCENARIOS = [
  { label: 'Conservative ₹30L', value: 3000000, color: '#60A5FA' },
  { label: 'Current ₹50L', value: 5000000, color: '#FBBF24' },
  { label: 'Aggressive ₹75L', value: 7500000, color: '#34D399' },
];

const PRIORITY_COLORS = { high: '#F87171', medium: '#FBBF24', low: '#60A5FA' };
const PRIORITY_BG = { high: 'rgba(248,113,113,0.08)', medium: 'rgba(251,191,36,0.08)', low: 'rgba(96,165,250,0.08)' };
const TYPE_ICONS = { 
  boost: TrendingUp, 
  cut: Scissors, 
  pause: Pause, 
  timing: Clock, 
  saturated: AlertTriangle 
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)',
    borderRadius: 10, padding: '10px 14px', fontFamily: 'Plus Jakarta Sans', fontSize: 12, boxShadow: 'var(--shadow-sm)'
  },
  itemStyle: { color: 'var(--text-primary)' },
  labelStyle: { color: 'var(--text-secondary)' },
};

export default function MixOptimizer() {
  const { data, aggregate, globalAggregate, isLoading } = useMarketingData({ includeGlobalAggregate: true });
  const timelineStartYear = 2023;
  const timelineEndYear = 2027;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const timelineMonths = useMemo(
    () =>
      Array.from({ length: (timelineEndYear - timelineStartYear + 1) * 12 }, (_, idx) => {
        const year = timelineStartYear + Math.floor(idx / 12);
        const month = idx % 12;
        return { key: `${year}-${String(month + 1).padStart(2, '0')}`, year, month };
      }),
    [timelineStartYear, timelineEndYear]
  );
  const defaultStartKey = '2025-01';
  const defaultEndKey = '2025-12';
  const [budget, setBudget] = useState(5000000);
  const [hasSetInitialBudget, setHasSetInitialBudget] = useState(false);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [paused, setPaused] = useState<Set<string>>(new Set());
  const [selectedChannel, setSelectedChannel] = useState<string>(CHANNELS[0]);
  const [activeTab, setActiveTab] = useState<'optimizer' | 'insights' | 'curves'>('optimizer');
  const [planningPeriod, setPlanningPeriod] = useState<PlanningPeriod>('1y');
  const [planningMode, setPlanningMode] = useState<PlanningMode>('target');
  const [customStartMonth, setCustomStartMonth] = useState(defaultStartKey);
  const [customEndMonth, setCustomEndMonth] = useState(defaultEndKey);
  const safeBudget = Number.isFinite(budget) ? Math.max(0, budget) : 0;

  // ── Data derivations ──────────────────────────────────────────────────────
  const summaries = useMemo(() => (aggregate || data) ? getChannelSummaries(aggregate || data!) : [], [data, aggregate]);
  const models = useMemo(() => (globalAggregate || data) ? getChannelSaturationModels(globalAggregate || data!) : [], [data, globalAggregate]);
  const summaryByChannel = useMemo(() => {
    const map: Record<string, (typeof summaries)[number] | undefined> = {};
    summaries.forEach((summary) => {
      map[summary.channel] = summary;
    });
    return map;
  }, [summaries]);
  const seasonality = useMemo(() => (globalAggregate || data) ? getSeasonalityMetrics(globalAggregate || data!) : [], [data, globalAggregate]);
  const dowMetrics = useMemo(() => (aggregate || data) ? getDayOfWeekMetrics(aggregate || data!) : [], [data, aggregate]);
  const timeFrameMonths = useMemo(() => getTimeFrameMonths(aggregate || data || []), [aggregate, data]);

  const avgMonthlySpend = useMemo(() => {
    if (summaries.length === 0) return 5000000;
    const totalSpend = summaries.reduce((s, ch) => s + ch.totalSpend, 0);
    return Math.round(totalSpend / (timeFrameMonths || 1));
  }, [summaries, timeFrameMonths]);

  useEffect(() => {
    if (avgMonthlySpend !== 5000000 && !hasSetInitialBudget) {
      setBudget(avgMonthlySpend);
      setHasSetInitialBudget(true);
    }
  }, [avgMonthlySpend, hasSetInitialBudget]);

  const currentFractions = useMemo(() => {
    const totalSpend = summaries.reduce((sum, channel) => sum + channel.totalSpend, 0);
    const fractions: Record<string, number> = {};
    CHANNELS.forEach((channel) => {
      const summary = summaryByChannel[channel];
      fractions[channel] = totalSpend > 0 ? (summary?.totalSpend || 0) / totalSpend : 0.1;
    });
    return fractions;
  }, [summaries, summaryByChannel]);

  const selectedRange = useMemo(() => {
    return buildMonthRange(timelineMonths, defaultStartKey, planningPeriod, customStartMonth, customEndMonth);
  }, [customEndMonth, customStartMonth, defaultStartKey, planningPeriod, timelineMonths]);

  const durationMonthCount = selectedRange.length || 1;
  const totalPlannedBudget = safeBudget * durationMonthCount;
  const modeMultiplier = planningMode === 'conservative' ? 0.8 : planningMode === 'aggressive' ? 1.2 : 1.0;
  const channelCaps = useMemo(() => getChannelCapsFromData(globalAggregate || data || []), [globalAggregate, data]);
  const channelCapByName = useMemo(() => {
    const map: Record<string, (typeof channelCaps)[number] | undefined> = {};
    channelCaps.forEach((entry) => {
      map[entry.channel] = entry;
    });
    return map;
  }, [channelCaps]);

  // Initial equal split
  const alloc = useMemo(() => {
    if (Object.keys(allocations).length > 0) return allocations;
    const eq: Record<string, number> = {};
    CHANNELS.forEach(ch => (eq[ch] = 0.1));
    return eq;
  }, [allocations]);

  const activeChannels = CHANNELS.filter(ch => !paused.has(ch));

  // Effective alloc redistributes paused channels' share among active
  const effectiveAlloc = useMemo(() => {
    const eff: Record<string, number> = {};
    const pausedTotal = CHANNELS.filter(ch => paused.has(ch)).reduce((s, ch) => s + (alloc[ch] || 0), 0);
    const activeTotal = activeChannels.reduce((s, ch) => s + (alloc[ch] || 0), 0);
    for (const ch of CHANNELS) {
      if (paused.has(ch)) { eff[ch] = 0; continue; }
      eff[ch] = activeTotal > 0 ? (alloc[ch] || 0) / activeTotal * (activeTotal + pausedTotal) : 0;
    }
    const sum = Object.values(eff).reduce((s, v) => s + v, 0);
    if (sum > 0) for (const k of Object.keys(eff)) eff[k] = eff[k] / sum;
    return eff;
  }, [alloc, paused, activeChannels]);

  // Recommended plan = AI-optimal allocation (ROAS-weighted, no manual overrides)
  const recommendedPlan = useMemo(() => buildMonthlyPlanFromData({
    data: globalAggregate || data || [],
    selectedMonths: selectedRange,
    monthlyBudget: safeBudget,
    modeMultiplier,
  }), [globalAggregate, data, selectedRange, safeBudget, modeMultiplier]);

  const optimalFractions = useMemo(() => ({ ...recommendedPlan.channelShares }), [recommendedPlan.channelShares]);

  // Projected plan = manual slider allocation (or current historical baseline if no sliders touched)
  const projectedPlan = useMemo(() => buildMonthlyPlanFromData({
    data: globalAggregate || data || [],
    selectedMonths: selectedRange,
    monthlyBudget: safeBudget,
    modeMultiplier,
    allocationShares: effectiveAlloc,
  }), [globalAggregate, data, selectedRange, safeBudget, modeMultiplier, effectiveAlloc]);

  // Baseline plan = what happens with even 10% split — used to show the gap vs optimal
  const baselinePlan = useMemo(() => {
    const evenSplit: Record<string, number> = {};
    CHANNELS.forEach(ch => (evenSplit[ch] = 1 / CHANNELS.length));
    return buildMonthlyPlanFromData({
      data: globalAggregate || data || [],
      selectedMonths: selectedRange,
      monthlyBudget: safeBudget,
      modeMultiplier,
      allocationShares: evenSplit,
    });
  }, [globalAggregate, data, selectedRange, safeBudget, modeMultiplier]);

  const scenarioResults = useMemo(() => {
    return BUDGET_SCENARIOS.map((scenario) => {
      const monthlyScenarioBudget = scenario.value;
      const plan = buildMonthlyPlanFromData({
        data: globalAggregate || data || [],
        selectedMonths: selectedRange,
        monthlyBudget: monthlyScenarioBudget,
        modeMultiplier,
      });
      return {
        budget: monthlyScenarioBudget * durationMonthCount,
        revenue: plan.totalRevenue,
        roas: plan.totalSpend > 0 ? plan.totalRevenue / plan.totalSpend : 0,
        fractions: plan.channelShares,
      };
    });
  }, [globalAggregate, data, selectedRange, modeMultiplier, durationMonthCount]);

  const projectedRevenue = projectedPlan.totalRevenue;

  const projectedROAS = totalPlannedBudget > 0 ? projectedRevenue / totalPlannedBudget : 0;
  const optimalRevenue = recommendedPlan.totalRevenue;

  // True gap = AI optimal vs even/manual allocation — shows real opportunity
  const isManualAllocation = Object.keys(allocations).length > 0;
  const revenueGap = Math.max(0, optimalRevenue - (isManualAllocation ? projectedRevenue : baselinePlan.totalRevenue));
  const durationLabel = useMemo(() => {
    if (planningPeriod === '1m') return 'this month';
    if (planningPeriod === '1q') return 'this quarter';
    if (planningPeriod === '6m') return 'this half-year';
    if (planningPeriod === '1y') return 'this year';
    return selectedRange.length > 1 ? 'this selected period' : 'this month';
  }, [planningPeriod, selectedRange.length]);
  const scenarioBudgetLabel = useMemo(() => {
    if (planningPeriod === '1m') return 'Monthly Budget';
    if (planningPeriod === '1q') return 'Quarterly Budget';
    if (planningPeriod === '6m') return 'Half-Year Budget';
    if (planningPeriod === '1y') return 'Annual Budget';
    return 'Period Budget';
  }, [planningPeriod]);
  const totalPct = useMemo(() => CHANNELS.reduce((s, ch) => s + (alloc[ch] || 0), 0), [alloc]);

  // ── Insight generation ────────────────────────────────────────────────────
  const insights = useMemo(() =>
    summaries.length > 0 && models.length > 0
      ? generateChannelInsights(summaries, models, seasonality, dowMetrics, safeBudget, optimalFractions, effectiveAlloc)
      : [],
  [summaries, models, seasonality, dowMetrics, safeBudget, optimalFractions, effectiveAlloc]);

  // ── Per-channel reasoning (data-driven, for "Why this allocation" panel) ──
  const channelReasons = useMemo(() => {
    if (summaries.length === 0 || models.length === 0) return {};
    const avgROAS = summaries.reduce((s, c) => s + c.roas, 0) / (summaries.length || 1);
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const DOW_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const reasons: Record<string, string> = {};
    for (const ch of CHANNELS) {
      const summary = summaries.find(s => s.channel === ch);
      const model = models.find(m => m.channel === ch);
      const sea = seasonality.find(s => s.channel === ch);
      const dow = dowMetrics.find(d => d.channel === ch);
      const cap = channelCapByName[ch];
      if (!summary || !model) { reasons[ch] = `${ch} — insufficient data.`; continue; }
      const optPct = Math.round((optimalFractions[ch] || 0) * 100);
      const currentSpend = (optimalFractions[ch] || 0) * safeBudget;
      const marginalNow = model.alpha > 0 ? model.alpha / (currentSpend + 1) : 0;
      const isSaturated = marginalNow < 1.0 && currentSpend > 100000;
      const isHighROAS = summary.roas > avgROAS * 1.2;
      const isLowROAS = summary.roas < avgROAS * 0.8;
      const peakMonthName = sea ? MONTH_NAMES[sea.peakMonth] : '';
      const bestDayName = dow ? DOW_NAMES[dow.bestDay] : '';
      const hasCap = cap && Number.isFinite(cap.capSpend);
      let reason = '';
      if (isSaturated && hasCap) {
        reason = `${ch} gets ${optPct}% — capped at ${formatINRCompact(cap!.capSpend)}/mo because ROAS drops sharply above this level (high-bucket ROAS ${cap!.bucketROAS.high.toFixed(1)}x vs blended ${cap!.blendedROAS.toFixed(1)}x). Extra spend yields diminishing returns.`;
      } else if (isHighROAS && !isSaturated) {
        reason = `${ch} gets ${optPct}% — best-performing channel at ${summary.roas.toFixed(1)}x ROAS (${Math.round((summary.roas/avgROAS-1)*100)}% above portfolio average). Still below saturation; each extra rupee continues to generate strong returns.`;
      } else if (isLowROAS) {
        reason = `${ch} gets ${optPct}% — below-average ROAS of ${summary.roas.toFixed(1)}x (portfolio avg ${avgROAS.toFixed(1)}x). Budget held back to avoid diluting overall portfolio return. Suitable for brand awareness.`;
      } else if (sea && sea.peakBoost > 0.12) {
        reason = `${ch} gets ${optPct}% — seasonality-adjusted. Peaks in ${peakMonthName} (+${Math.round(sea.peakBoost*100)}% ROAS uplift). Budget weighted toward peak months automatically by the model.`;
      } else if (dow && dow.weekendBias !== 'neutral') {
        reason = `${ch} gets ${optPct}% — ${summary.roas.toFixed(1)}x ROAS, in line with portfolio average. Strongest on ${bestDayName}s; bid concentration on those days improves efficiency without increasing total spend.`;
      } else {
        reason = `${ch} gets ${optPct}% — ${summary.roas.toFixed(1)}x ROAS (near portfolio average of ${avgROAS.toFixed(1)}x). Allocation reflects proportional historical return with no observed saturation or strong seasonal pattern.`;
      }
      reasons[ch] = reason;
    }
    return reasons;
  }, [summaries, models, seasonality, dowMetrics, optimalFractions, safeBudget, channelCapByName]);

  // ── Seasonal peaks and Best-day tables for Insights tab ──────────────────
  const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DOW_NAMES_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const seasonalityTableData = useMemo(() => {
    return CHANNELS.map(ch => {
      const sea = seasonality.find(s => s.channel === ch);
      if (!sea) return { channel: ch, peakMonth: '—', troughMonth: '—', uplift: 0 };
      return {
        channel: ch,
        peakMonth: MONTH_NAMES_SHORT[sea.peakMonth],
        troughMonth: MONTH_NAMES_SHORT[sea.troughMonth],
        uplift: Math.round(sea.peakBoost * 100),
      };
    });
  }, [seasonality]);

  const dowTableData = useMemo(() => {
    return CHANNELS.map(ch => {
      const d = dowMetrics.find(m => m.channel === ch);
      if (!d) return { channel: ch, best1: '—', best2: '—', worst: '—' };
      const ranked = d.dowIndex
        .map((v, i) => ({ v, i }))
        .sort((a, b) => b.v - a.v);
      return {
        channel: ch,
        best1: DOW_NAMES_SHORT[ranked[0].i],
        best2: DOW_NAMES_SHORT[ranked[1].i],
        worst: DOW_NAMES_SHORT[ranked[ranked.length - 1].i],
        bias: d.weekendBias,
      };
    });
  }, [dowMetrics]);

  // ── Marginal ROAS curve for selected channel ──────────────────────────────
  const marginalCurveData = useMemo(() => {
    const cap = channelCapByName[selectedChannel];
    if (!cap) return [];
    return [
      { spend: cap.bucketSpend.low, roas: cap.bucketROAS.low, bucket: 'Low Spend' },
      { spend: cap.bucketSpend.medium, roas: cap.bucketROAS.medium, bucket: 'Mid Spend' },
      { spend: cap.bucketSpend.high, roas: cap.bucketROAS.high, bucket: 'High Spend' },
    ].filter((p) => p.spend > 0 && p.roas > 0);
  }, [selectedChannel, channelCapByName]);

  const currentChannelSpend = (projectedPlan.channelTotals[selectedChannel]?.spend || 0) / durationMonthCount;

  // ── Comparison bar chart data ─────────────────────────────────────────────
  const comparisonData = useMemo(() =>
    CHANNELS.map(ch => ({
      channel: ch.replace(' ', '\n'),
      current: parseFloat((((projectedPlan.channelShares[ch] || 0) * 100)).toFixed(1)),
      optimal: parseFloat(((optimalFractions[ch] || 0) * 100).toFixed(1)),
    })),
  [projectedPlan.channelShares, optimalFractions]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSlider = useCallback((ch: string, val: number[]) => {
    setAllocations(prev => ({ ...prev, [ch]: val[0] / 100 }));
  }, []);

  const resetToCurrent = () => {
    setAllocations({ ...currentFractions });
    setPaused(new Set());
  };

  const applyOptimal = () => {
    setAllocations({ ...optimalFractions });
    setPaused(new Set());
  };

  const togglePause = (ch: string) => {
    const next = new Set(paused);
    if (next.has(ch)) next.delete(ch); else next.add(ch);
    setPaused(next);
  };

  if (isLoading) return <DashboardSkeleton />;

  const tabStyle = (active: boolean) => ({
    fontFamily: 'Outfit' as const, fontSize: 13, fontWeight: 600 as const,
    padding: '8px 20px', borderRadius: 8, cursor: 'pointer' as const, transition: '150ms',
    backgroundColor: active ? '#E8803A' : 'var(--border-subtle)',
    color: active ? '#fff' : 'var(--text-muted)',
    border: 'none',
  });

  return (
    <div className="mobile-page mix-page space-y-6" style={{ maxWidth: 1320 }}>
      {/* Header with Export */}
      <div className="mobile-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
            Marketing Mix Optimizer
          </h1>
          <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, marginBottom: 12 }}>AI-powered budget allocation & revenue forecasting</p>
        </div>
        <button 
          onClick={() => exportToCSV(CHANNELS.map(ch => {
            const currentAllocation = projectedPlan.channelShares[ch] || 0;
            const optimalAllocation = optimalFractions[ch] || 0;
            const currentRevenue = projectedPlan.channelTotals[ch]?.revenue || 0;
            const optimalRevenue = recommendedPlan.channelTotals[ch]?.revenue || 0;
            return {
            Channel: ch,
            'Current Allocation (%)': (currentAllocation * 100).toFixed(1),
            'AI Optimal Allocation (%)': (optimalAllocation * 100).toFixed(1),
            'Current Spend': ((projectedPlan.channelTotals[ch]?.spend || 0)).toFixed(0),
            'Optimal Spend': ((recommendedPlan.channelTotals[ch]?.spend || 0)).toFixed(0),
            'Current Revenue': currentRevenue.toFixed(0),
            'Optimal Revenue': optimalRevenue.toFixed(0)
            };
          }), 'Luma_Marketing_Mix_Optimization')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all hover:scale-105 active:scale-95"
          style={{ 
            backgroundColor: 'var(--bg-card)', 
            border: '1px solid var(--border-strong)', 
            color: 'var(--text-primary)',
            fontFamily: 'Outfit',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer'
          }}
        >
          <Download size={16} />
          Export Optimization
        </button>
      </div>

      {/* Planning Context: Budget Planner Input Bar */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: 'Outfit', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Monthly Budget
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'var(--bg-root)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 12px' }}>
              <span style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>₹</span>
              <input
                type="number"
                value={safeBudget}
                min={0}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  setBudget(Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
                }}
                style={{ flex: 1, minWidth: 110, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'Outfit', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
              />
            </div>
            <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              {formatINRCompact(safeBudget)} / month
            </p>
          </div>

          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: 'Outfit', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Planning Period
            </p>
            <select
              value={planningPeriod}
              onChange={(e) => setPlanningPeriod(e.target.value as PlanningPeriod)}
              style={{ width: '100%', backgroundColor: 'var(--bg-root)', border: '1px solid var(--border-strong)', borderRadius: 10, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans', fontSize: 13, padding: '11px 12px' }}
            >
              <option value="1m">1 Month</option>
              <option value="1q">1 Quarter</option>
              <option value="6m">6 Months</option>
              <option value="1y">1 Year</option>
              <option value="custom">Custom</option>
            </select>
            {planningPeriod === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <select
                  value={customStartMonth}
                  onChange={(e) => setCustomStartMonth(e.target.value)}
                  style={{ flex: 1, backgroundColor: 'var(--bg-root)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans', fontSize: 11, padding: '7px 8px' }}
                >
                  {timelineMonths.map((m) => (
                    <option key={`start-${m.key}`} value={m.key}>{`${monthNames[m.month]} ${m.year}`}</option>
                  ))}
                </select>
                <span style={{ fontFamily: 'Outfit', fontSize: 10, color: 'var(--text-muted)' }}>to</span>
                <select
                  value={customEndMonth}
                  onChange={(e) => setCustomEndMonth(e.target.value)}
                  style={{ flex: 1, backgroundColor: 'var(--bg-root)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans', fontSize: 11, padding: '7px 8px' }}
                >
                  {timelineMonths.map((m) => (
                    <option key={`end-${m.key}`} value={m.key}>{`${monthNames[m.month]} ${m.year}`}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: 'Outfit', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Planning Mode
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { value: 'conservative', label: 'Conservative (0.8x)' },
                { value: 'target', label: 'Target (1.0x)' },
                { value: 'aggressive', label: 'Aggressive (1.2x)' },
              ].map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setPlanningMode(mode.value as PlanningMode)}
                  style={{
                    fontFamily: 'Plus Jakarta Sans',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '10px 14px',
                    borderRadius: 999,
                    border: planningMode === mode.value ? '1px solid var(--border-strong)' : '1px solid var(--border-subtle)',
                    backgroundColor: planningMode === mode.value ? 'var(--bg-root)' : 'transparent',
                    color: planningMode === mode.value ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: '150ms'
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-root)' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-secondary)' }}>
            {`${selectedRange.length} month${selectedRange.length === 1 ? '' : 's'} at ${formatINRCompact(safeBudget)} = ${formatINRCompact(totalPlannedBudget)} total budget`}
          </p>
        </div>
      </div>

      {/* ── Revenue gap banner ── */}
      {revenueGap > 5000 ? (
        <div style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.08), rgba(52,211,153,0.04))', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 14, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: 600, color: '#34D399', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Revenue Opportunity Identified</p>
            <p style={{ fontFamily: 'Outfit', fontSize: 22, fontWeight: 800, color: '#34D399', letterSpacing: '-0.025em', marginTop: 4 }}>
              {formatINR(Math.round(revenueGap))} additional revenue possible {durationLabel}
            </p>
            <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'rgba(52,211,153,0.7)', marginTop: 4 }}>
              {isManualAllocation
                ? `vs. your current manual allocation — AI-recommended mix would generate ${formatINRCompact(optimalRevenue)} vs your ${formatINRCompact(projectedRevenue)}`
                : `vs. an equal 10% split across all channels — AI redistributes toward high-ROAS channels`}
            </p>
          </div>
          <button onClick={applyOptimal} style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg, #34D399, #2DD4BF)', color: 'var(--bg-root)', border: 'none', cursor: 'pointer' }}>
            Apply AI Recommendation →
          </button>
        </div>
      ) : revenueGap <= 5000 && isManualAllocation ? (
        <div style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 14, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div>
            <p style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: '#60A5FA' }}>You're already on the optimal allocation</p>
            <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Your current mix is within 0.2% of the AI-recommended allocation. No changes needed.</p>
          </div>
        </div>
      ) : null}

      {/* ── Top KPIs ── */}
      <div className="mix-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: 'Projected Revenue', value: formatINRCompact(projectedRevenue), color: 'var(--text-primary)', accent: '#34D399' },
          { label: 'Projected ROAS', value: `${projectedROAS.toFixed(2)}x`, color: '#E8803A', accent: '#E8803A' },
          { label: 'Optimal Revenue', value: formatINRCompact(optimalRevenue), color: 'var(--text-primary)', accent: '#A78BFA' },
          { label: 'Active Channels', value: `${activeChannels.length} / 10`, color: 'var(--text-primary)', accent: '#60A5FA' },
        ].map(kpi => (
          <div key={kpi.label} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '18px 20px' }}>
            <p style={{ fontFamily: 'Outfit', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{kpi.label}</p>
            <p style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 800, color: kpi.color, letterSpacing: '-0.03em', marginTop: 6 }}>{kpi.value}</p>
            <div style={{ height: 2, backgroundColor: kpi.accent, borderRadius: 1, marginTop: 12, opacity: 0.4 }} />
          </div>
        ))}
      </div>

      {/* ── Tab navigation ── */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="flex items-center gap-2" style={tabStyle(activeTab === 'optimizer')} onClick={() => setActiveTab('optimizer')}><Sliders size={14}/> Optimizer</button>
        <button className="flex items-center gap-2" style={tabStyle(activeTab === 'insights')} onClick={() => setActiveTab('insights')}><Lightbulb size={14}/> AI Insights ({insights.length})</button>
        <button className="flex items-center gap-2" style={tabStyle(activeTab === 'curves')} onClick={() => setActiveTab('curves')}><TrendingDown size={14}/> Diminishing Returns</button>
      </div>

      {/* ════════════════ OPTIMIZER TAB ════════════════ */}
      {activeTab === 'optimizer' && (
        <div className="mix-optimizer-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Sliders */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Manual Allocation</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={resetToCurrent} style={{ fontFamily: 'Outfit', fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, backgroundColor: 'var(--bg-root)', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)', cursor: 'pointer' }}>Reset to Current</button>
                <button onClick={applyOptimal} style={{ fontFamily: 'Outfit', fontSize: 12, fontWeight: 700, padding: '7px 16px', borderRadius: 8, background: 'linear-gradient(135deg, #E8803A, #FBBF24)', color: 'var(--bg-root)', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(232,128,58,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  AI Recommendation <Sparkles size={12} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {CHANNELS.map((ch, ci) => {
                const pct = Math.round((alloc[ch] || 0) * 100);
                const monthlyAmt = (effectiveAlloc[ch] || 0) * safeBudget;
                const periodAmt = monthlyAmt * durationMonthCount;
                const projRev = projectedPlan.channelTotals[ch]?.revenue || 0;
                const optPct = Math.round((optimalFractions[ch] || 0) * 100);
                const isPaused = paused.has(ch);
                const color = CHANNEL_COLORS[ci];
                const delta = optPct - pct;

                return (
                  <div key={ch} style={{ opacity: isPaused ? 0.4 : 1, border: '1px solid var(--border-strong)', borderRadius: 12, padding: '12px 14px', backgroundColor: 'var(--bg-root)', transition: 'opacity 200ms' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                        <ChannelName channel={ch} style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, color: 'var(--text-secondary)' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {delta !== 0 && !isPaused && (
                          <span style={{ fontFamily: 'Outfit', fontSize: 10, fontWeight: 600, color: delta > 0 ? '#34D399' : '#F87171', backgroundColor: delta > 0 ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                            AI: {delta > 0 ? '+' : ''}{delta}%
                          </span>
                        )}
                        <span style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                        <Switch checked={!isPaused} onCheckedChange={() => togglePause(ch)} />
                      </div>
                    </div>
                    <Slider value={[pct]} min={0} max={60} step={1} onValueChange={v => handleSlider(ch, v)} disabled={isPaused} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-muted)' }}>{formatINRCompact(periodAmt)} spend</span>
                      <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: color }}>
                        → {formatINRCompact(projRev)} rev ({periodAmt > 0 ? (projRev / periodAmt).toFixed(2) : '0.00'}x)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ textAlign: 'center', padding: '10px 0', borderRadius: 10, marginTop: 12, backgroundColor: Math.abs(totalPct - 1) > 0.01 ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.1)', color: Math.abs(totalPct - 1) > 0.01 ? '#F87171' : '#34D399', fontFamily: 'Outfit', fontSize: 13, fontWeight: 600 }}>
              Total: {Math.round(totalPct * 100)}%
            </div>

            {/* Why this Allocation — per-channel reasoning */}
            {Object.keys(channelReasons).length > 0 && (
              <div style={{ marginTop: 20, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Lightbulb size={14} style={{ color: '#FBBF24', flexShrink: 0 }} />
                  <h3 style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Why this allocation</h3>
                  <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 10, color: 'var(--text-muted)' }}>— generated from historical data signals</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {CHANNELS.map((ch, ci) => {
                    const color = CHANNEL_COLORS[ci];
                    const reason = channelReasons[ch];
                    const sea = seasonality.find(s => s.channel === ch);
                    // Determine if current planning period months are in-season
                    const currentPlanningMonth = selectedRange[0]?.month ?? new Date().getMonth();
                    const seasonIdx = sea?.monthlyIndex[currentPlanningMonth] ?? 1;
                    const inSeason = seasonIdx > 1.05;
                    const offSeason = seasonIdx < 0.95;
                    if (!reason) return null;
                    return (
                      <div key={ch} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10, backgroundColor: 'var(--bg-root)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0, marginTop: 5 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <span style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{ch}</span>
                            {inSeason && <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 9, fontWeight: 700, color: '#34D399', backgroundColor: 'rgba(52,211,153,0.1)', padding: '1px 6px', borderRadius: 4 }}>IN SEASON</span>}
                            {offSeason && <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 9, fontWeight: 700, color: '#F87171', backgroundColor: 'rgba(248,113,113,0.1)', padding: '1px 6px', borderRadius: 4 }}>OFF SEASON</span>}
                          </div>
                          <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>{reason}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Current vs Optimal */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 24 }}>
              <h2 style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Current vs Optimal Allocation</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={comparisonData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border-subtle)" />
                  <XAxis dataKey="channel" tick={{ fontSize: 8, fill: 'var(--text-muted)', fontFamily: 'Plus Jakarta Sans' }} axisLine={false} tickLine={false} angle={-35} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]} />
                  <Legend wrapperStyle={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-secondary)', marginTop: 10 }} />
                  <Bar dataKey="current" fill="rgba(96,165,250,0.6)" name="Your Allocation" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="optimal" fill="rgba(232,128,58,0.85)" name="AI Optimal" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Budget Scenarios — uses pre-computed scenarioResults */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px 0' }}>
                <h2 style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Budget Scenarios (non-linear model)</h2>
                <div style={{ borderBottom: '1px solid var(--border-subtle)', margin: '16px 0' }} />
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                    {[scenarioBudgetLabel, 'Proj. Revenue', 'ROAS', `vs ${formatINRCompact(BUDGET_SCENARIOS[1].value * durationMonthCount)}`].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'Outfit', fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BUDGET_SCENARIOS.map((s, i) => {
                    const sr = scenarioResults[i] || { revenue: 0, roas: 0 };
                    const baseline = scenarioResults[1]?.revenue || 0; // ₹50L baseline
                    const diff = sr.revenue - baseline;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--border-subtle)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                        <td style={{ padding: '12px 16px', fontFamily: 'Plus Jakarta Sans', fontSize: 13, color: 'var(--text-secondary)' }}>{formatINRCompact(s.value * durationMonthCount)}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'Outfit', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{formatINRCompact(sr.revenue)}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'Outfit', fontSize: 13, fontWeight: 600, color: sr.roas >= 4 ? '#34D399' : sr.roas >= 2 ? '#FBBF24' : '#F87171' }}>{sr.roas.toFixed(2)}x</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: diff >= 0 ? '#34D399' : '#F87171' }}>
                          {diff >= 0 ? '+' : ''}{formatINRCompact(Math.abs(diff))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* AI Allocation Roadmap Summary Table */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px 0' }}>
                <h2 style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  AI Allocation Roadmap (%)
                </h2>
                <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Comparing optimal % mix across budget tiers
                </p>
                <div style={{ borderBottom: '1px solid var(--border-subtle)', margin: '16px 0' }} />
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'rgba(232,128,58,0.03)' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'Outfit', fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Channel</th>
                    {BUDGET_SCENARIOS.map(s => (
                      <th key={s.label} style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'Outfit', fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        {formatINRCompact(s.value * durationMonthCount)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CHANNELS.map((ch, idx) => (
                    <tr key={ch} style={{ borderBottom: idx === CHANNELS.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <ChannelName channel={ch} style={{ fontFamily: 'Outfit', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }} />
                      </td>
                      {scenarioResults.map((sr, si) => {
                        const pct = (sr.fractions[ch] || 0) * 100;
                        const baselinePct = (scenarioResults[1]?.fractions[ch] || 0) * 100;
                        const isPrimary = pct > 15;
                        return (
                          <td key={si} style={{ 
                            padding: '10px 16px', 
                            textAlign: 'right', 
                            fontFamily: 'Plus Jakarta Sans', 
                            fontSize: 12, 
                            fontWeight: 500,
                            color: isPrimary ? 'var(--text-primary)' : 'var(--text-muted)',
                            backgroundColor: pct > baselinePct + 2 ? 'rgba(52, 211, 153, 0.05)' : 'transparent'
                          }}>
                            {pct.toFixed(1)}%
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '12px 16px', backgroundColor: 'var(--border-subtle)', borderTop: '1px solid var(--border-strong)' }}>
                <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
                  Model automatically diversifies as core channels hit saturation limits.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ INSIGHTS TAB ════════════════ */}
      {activeTab === 'insights' && (
        <div>
          <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Based on the non-linear model, seasonality analysis, and day-of-week patterns. Sorted by priority.
          </p>
          {insights.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', backgroundColor: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-subtle)' }}>
              <p style={{ fontFamily: 'Outfit', fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>No insights ready yet</p>
              <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, color: 'var(--text-muted)' }}>Insights are generated once data loads and saturation models are computed. Try adjusting the planning period or budget.</p>
            </div>
          ) : (
            <div className="mix-insights-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {insights.map((ins, i) => (
                <div key={i} style={{ backgroundColor: PRIORITY_BG[ins.priority], border: `1px solid ${PRIORITY_COLORS[ins.priority]}30`, borderLeft: `3px solid ${PRIORITY_COLORS[ins.priority]}`, borderRadius: 14, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {(() => {
                        const Icon = TYPE_ICONS[ins.type as keyof typeof TYPE_ICONS] || Lightbulb;
                        return <Icon size={16} style={{ color: PRIORITY_COLORS[ins.priority] }} />;
                      })()}
                      <p style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{ins.headline}</p>
                    </div>
                    <span style={{ flexShrink: 0, fontFamily: 'Outfit', fontSize: 9, fontWeight: 700, color: PRIORITY_COLORS[ins.priority], backgroundColor: `${PRIORITY_COLORS[ins.priority]}18`, padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {ins.priority}
                    </span>
                  </div>
                  <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{ins.rationale}</p>
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: CHANNEL_COLORS[CHANNELS.indexOf(ins.channel)] || 'var(--text-muted)' }} />
                    <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-muted)' }}>{ins.channel}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Seasonality Peaks Table ── */}
          {seasonalityTableData.length > 0 && (
            <div style={{ marginTop: 32, backgroundColor: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-strong)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 24px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>📅</span>
                  <h3 style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Seasonal Peaks by Channel</h3>
                </div>
                <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-muted)', marginBottom: 0 }}>
                  Which months each channel historically outperforms. Calculated from 3 years of data.
                </p>
                <div style={{ borderBottom: '1px solid var(--border-subtle)', marginTop: 14 }} />
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                  <thead>
                    <tr>
                      {['Channel', 'Peak Month', 'Trough Month', 'ROAS Uplift at Peak'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Channel' ? 'left' : 'center', fontFamily: 'Outfit', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {seasonalityTableData.map((row, i) => (
                      <tr key={row.channel} style={{ borderTop: '1px solid var(--border-subtle)' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--border-subtle)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: CHANNEL_COLORS[i], flexShrink: 0 }} />
                            <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{row.channel}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontFamily: 'Outfit', fontSize: 12, fontWeight: 700, color: '#34D399' }}>{row.peakMonth}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontFamily: 'Outfit', fontSize: 12, fontWeight: 700, color: '#F87171' }}>{row.troughMonth}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                          <span style={{
                            fontFamily: 'Outfit', fontSize: 12, fontWeight: 700,
                            color: row.uplift > 15 ? '#34D399' : row.uplift > 5 ? '#FBBF24' : 'var(--text-muted)',
                            backgroundColor: row.uplift > 15 ? 'rgba(52,211,153,0.1)' : row.uplift > 5 ? 'rgba(251,191,36,0.1)' : 'transparent',
                            padding: row.uplift > 0 ? '2px 8px' : '0', borderRadius: 4,
                          }}>
                            {row.uplift > 0 ? `+${row.uplift}%` : 'Flat'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Best Days by Channel Table ── */}
          {dowTableData.length > 0 && (
            <div style={{ marginTop: 20, backgroundColor: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-strong)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 24px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>📆</span>
                  <h3 style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Best Days by Channel</h3>
                </div>
                <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-muted)', marginBottom: 0 }}>
                  Top 2 performing days per channel by ROAS index. Use to time bid increases. Calculated from historical DoW aggregation.
                </p>
                <div style={{ borderBottom: '1px solid var(--border-subtle)', marginTop: 14 }} />
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                  <thead>
                    <tr>
                      {['Channel', '#1 Day', '#2 Day', 'Weakest Day', 'Bias'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Channel' ? 'left' : 'center', fontFamily: 'Outfit', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dowTableData.map((row, i) => (
                      <tr key={row.channel} style={{ borderTop: '1px solid var(--border-subtle)' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--border-subtle)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: CHANNEL_COLORS[i], flexShrink: 0 }} />
                            <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{row.channel}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontFamily: 'Outfit', fontSize: 12, fontWeight: 700, color: '#34D399' }}>{row.best1}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontFamily: 'Outfit', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{row.best2}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontFamily: 'Outfit', fontSize: 12, fontWeight: 600, color: '#F87171' }}>{row.worst}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                          <span style={{
                            fontFamily: 'Plus Jakarta Sans', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                            color: row.bias === 'weekend' ? '#A78BFA' : row.bias === 'weekday' ? '#60A5FA' : 'var(--text-muted)',
                            backgroundColor: row.bias === 'weekend' ? 'rgba(167,139,250,0.12)' : row.bias === 'weekday' ? 'rgba(96,165,250,0.12)' : 'var(--border-subtle)',
                          }}>
                            {row.bias === 'weekend' ? 'Weekend' : row.bias === 'weekday' ? 'Weekday' : 'Neutral'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════ DIMINISHING RETURNS TAB ════════════════ */}
      {activeTab === 'curves' && (
        <div className="mix-curves-grid" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
          {/* Channel picker */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Select Channel</p>
            {CHANNELS.map((ch, ci) => {
              const isActive = selectedChannel === ch;
              const cap = channelCapByName[ch];
              const color = CHANNEL_COLORS[ci];
              return (
                <button
                  key={ch}
                  onClick={() => setSelectedChannel(ch)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, border: isActive ? `1px solid ${color}40` : '1px solid transparent', backgroundColor: isActive ? `${color}10` : 'transparent', cursor: 'pointer', textAlign: 'left', transition: '120ms' }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', flex: 1 }}>{ch}</span>
                  {cap && (
                    <span style={{ fontFamily: 'Outfit', fontSize: 10, color: color, fontWeight: 600 }}>
                      cap {Number.isFinite(cap.capSpend) ? formatINRCompact(cap.capSpend) : '—'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Curve chart */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 24 }}>
            {(() => {
              const cap = channelCapByName[selectedChannel];
              const color = CHANNEL_COLORS[CHANNELS.indexOf(selectedChannel)];
              const summary = summaryByChannel[selectedChannel];
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div>
                      <h2 style={{ fontFamily: 'Outfit', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedChannel} — Diminishing Returns</h2>
                      <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        Observed low/medium/high spend buckets from historical data and where ROAS drops.
                      </p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {[
                        { label: 'Historical ROAS', value: summary ? `${summary.roas.toFixed(2)}x` : '—' },
                        { label: 'Diminishing Cap', value: cap && Number.isFinite(cap.capSpend) ? formatINRCompact(cap.capSpend) : 'No cap' },
                        { label: 'Current Spend', value: formatINRCompact(currentChannelSpend) },
                        { label: 'High-Bucket ROAS', value: cap ? `${cap.bucketROAS.high.toFixed(2)}x` : '—' },
                      ].map(kpi => (
                        <div key={kpi.label} style={{ backgroundColor: 'var(--bg-root)', borderRadius: 8, padding: '8px 12px', border: '1px solid var(--border-strong)' }}>
                          <p style={{ fontFamily: 'Outfit', fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{kpi.label}</p>
                          <p style={{ fontFamily: 'Outfit', fontSize: 15, fontWeight: 700, color, marginTop: 2 }}>{kpi.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={marginalCurveData}>
                      <CartesianGrid strokeDasharray="2 4" stroke="var(--border-subtle)" />
                      <XAxis
                        dataKey="spend"
                        tickFormatter={v => formatINRCompact(v)}
                        tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'Plus Jakarta Sans' }}
                        axisLine={false} tickLine={false}
                        label={{ value: 'Monthly Spend →', position: 'insideBottom', offset: -4, style: { fill: 'var(--text-muted)', fontSize: 11 } }}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        axisLine={false} tickLine={false}
                        label={{ value: 'ROAS', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted)', fontSize: 11 } }}
                      />
                      <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [`${v.toFixed(2)}x`, name]} labelFormatter={v => `Spend: ${formatINRCompact(Number(v))}`} />
                      <ReferenceLine y={cap?.blendedROAS || 0} stroke="#F87171" strokeDasharray="4 4" label={{ value: 'Blended Avg ROAS', position: 'insideRight', style: { fill: '#F87171', fontSize: 10 } }} />
                      <ReferenceLine x={currentChannelSpend} stroke="#FBBF24" strokeDasharray="4 4" label={{ value: 'Current', position: 'top', style: { fill: '#FBBF24', fontSize: 10 } }} />
                      <Legend wrapperStyle={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-secondary)' }} />
                      <Line type="monotone" dataKey="roas" stroke={color} strokeWidth={2.5} dot={{ r: 4 }} name="Observed ROAS" />
                    </LineChart>
                  </ResponsiveContainer>

                  <div style={{ marginTop: 16, padding: '12px 16px', backgroundColor: 'var(--bg-root)', borderRadius: 10, border: '1px solid var(--border-strong)' }}>
                    <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Reading this chart: </strong>
                      The points show observed ROAS at low, medium, and high historical spend levels for this channel.
                      The red dashed line is blended average ROAS; when higher-spend buckets drop below it, the channel is capped.
                      The yellow marker shows your current monthly spend for this channel.
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Compact month-by-month plan summary */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 8px' }}>
          <h3 style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            Monthly Plan Snapshot
          </h3>
          <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Quick view of each month with top 3 channel allocations.
          </p>
        </div>
        <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border-subtle)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>
                {['Month', 'Top Allocations', 'Spend', 'Revenue'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Top Allocations' ? 'left' : 'right', fontFamily: 'Outfit', fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recommendedPlan.rows.map((row) => {
                const top3 = CHANNELS
                  .map((ch) => ({ channel: ch, spend: row.cells[ch].spend }))
                  .sort((a, b) => b.spend - a.spend)
                  .slice(0, 3);
                return (
                  <tr key={row.monthKey} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {row.label}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'left', fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {top3.map((item) => `${item.channel}: ${formatINRCompact(item.spend)}`).join(' • ')}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Outfit', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {formatINRCompact(row.totalSpend)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Outfit', fontSize: 12, fontWeight: 700, color: '#34D399' }}>
                      {formatINRCompact(row.totalRevenue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Footer Methodology Note */}
      <div className="flex items-start gap-2 p-4 rounded-xl mt-8" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', width: '100%' }}>
        <Lightbulb size={16} style={{ color: '#FBBF24', marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Methodology: </span> 
          This tool analyzes historical channel data to identify diminishing returns. It recommends shifting budget toward the channels projected to deliver the highest incremental revenue. These allocations are predictive estimates designed for planning, not guaranteed outcomes.
        </p>
      </div>
    </div>
  );
}
