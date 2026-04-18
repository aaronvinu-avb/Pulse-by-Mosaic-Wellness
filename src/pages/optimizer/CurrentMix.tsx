import { useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMarketingData } from '@/hooks/useMarketingData';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { OptimizerSubnav } from '@/components/optimizer/OptimizerSubnav';
import { useOptimizer } from '@/contexts/OptimizerContext';
import {
  getChannelSummaries,
  getTimeFrameMonths,
  buildMonthRange,
  buildMonthlyPlanFromData,
  getPortfolioWeightedROAS,
  classifyMixChannelEfficiency,
  getChannelSaturationModels,
  getPeriodTimeWeightSums,
  getChannelCapsFromData,
} from '@/lib/calculations';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import { CHANNELS, CHANNEL_COLORS } from '@/lib/mockData';
import { ChannelName } from '@/components/ChannelName';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Sliders, ArrowRight, CheckCircle, AlertTriangle, Minus,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import type { PlanningPeriod, PlanningMode } from '@/contexts/OptimizerContext';

// ── Design tokens ────────────────────────────────────────────────────────────

const T = {
  overline: { fontFamily: 'Outfit' as const, fontSize: 10, fontWeight: 600 as const, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: 0 },
  value:    { fontFamily: 'Outfit' as const, fontWeight: 700 as const, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 },
  helper:   { fontFamily: 'Plus Jakarta Sans' as const, fontSize: 13, fontWeight: 400 as const, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 },
};
const CARD = { padding: '20px 24px', border: '1px solid var(--border-subtle)', borderRadius: 14, backgroundColor: 'var(--bg-card)' };

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  efficient:      { label: 'Efficient',     color: '#34D399', bg: 'rgba(52,211,153,0.1)',  Icon: CheckCircle },
  saturated:      { label: 'Saturated',     color: '#F87171', bg: 'rgba(248,113,113,0.1)', Icon: AlertTriangle },
  'over-scaled':  { label: 'Over-scaled',   color: '#FBBF24', bg: 'rgba(251,191,36,0.1)',  Icon: AlertTriangle },
  'under-scaled': { label: 'Under-scaled',  color: '#60A5FA', bg: 'rgba(96,165,250,0.1)',  Icon: Minus },
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CurrentMix() {
  const {
    data, aggregate, globalAggregate, isLoading, dataSource, dataUpdatedAt,
  } = useMarketingData({ includeGlobalAggregate: true });

  const {
    budget, setBudget,
    planningPeriod, setPlanningPeriod,
    planningMode, setPlanningMode,
    allocations, setAllocations,
    paused, setPaused,
    hasSetInitialBudget, setHasSetInitialBudget,
    customStartMonth, setCustomStartMonth,
    customEndMonth, setCustomEndMonth,
  } = useOptimizer();

  const safeBudget = Number.isFinite(budget) && budget > 0 ? budget : 5000000;

  // ── Data derivations ────────────────────────────────────────────────────
  const summaries = useMemo(
    () => (aggregate || data) ? getChannelSummaries(aggregate || data!) : [],
    [data, aggregate]
  );
  const models = useMemo(
    () => (globalAggregate || data) ? getChannelSaturationModels(globalAggregate || data!) : [],
    [data, globalAggregate]
  );
  const caps = useMemo(
    () => getChannelCapsFromData(globalAggregate || data || []),
    [globalAggregate, data]
  );
  const capByChannel = useMemo(() => {
    const m: Record<string, typeof caps[number] | undefined> = {};
    caps.forEach((c) => (m[c.channel] = c));
    return m;
  }, [caps]);

  const timelineMonths = useMemo(() => {
    const start = 2023, end = 2027;
    return Array.from({ length: (end - start + 1) * 12 }, (_, i) => {
      const y = start + Math.floor(i / 12), mo = i % 12;
      return { key: `${y}-${String(mo + 1).padStart(2, '0')}`, year: y, month: mo };
    });
  }, []);

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const totalMonths = useMemo(
    () => getTimeFrameMonths(aggregate || data || []),
    [aggregate, data]
  );

  // ── Set initial budget from historical average ──────────────────────────
  const avgMonthlySpend = useMemo(() => {
    if (summaries.length === 0) return 5000000;
    return Math.round(summaries.reduce((s, c) => s + c.totalSpend, 0) / (totalMonths || 1));
  }, [summaries, totalMonths]);

  useEffect(() => {
    if (hasSetInitialBudget || summaries.length === 0) return;
    setBudget(Math.round(avgMonthlySpend / 1000) * 1000);
    setHasSetInitialBudget(true);
  }, [avgMonthlySpend, hasSetInitialBudget, summaries.length, setBudget, setHasSetInitialBudget]);

  // ── Initialise allocations from historical share ────────────────────────
  const historicalFractions = useMemo(() => {
    const total = summaries.reduce((s, c) => s + c.totalSpend, 0);
    const f: Record<string, number> = {};
    CHANNELS.forEach((ch) => {
      const s = summaries.find((x) => x.channel === ch);
      f[ch] = total > 0 ? (s?.totalSpend || 0) / total : 1 / CHANNELS.length;
    });
    return f;
  }, [summaries]);

  useEffect(() => {
    if (Object.keys(allocations).length > 0) return;
    setAllocations({ ...historicalFractions });
  }, [historicalFractions, allocations, setAllocations]);

  // ── Selected planning range ────────────────────────────────────────────
  const selectedRange = useMemo(
    () => buildMonthRange(timelineMonths, '2025-01', planningPeriod, customStartMonth, customEndMonth),
    [timelineMonths, planningPeriod, customStartMonth, customEndMonth]
  );
  const durationMonths = selectedRange.length || 1;
  const totalBudget = safeBudget * durationMonths;

  const modeMultiplier = planningMode === 'conservative' ? 0.8 : planningMode === 'aggressive' ? 1.2 : 1.0;

  // ── Active channels and effective allocation ───────────────────────────
  const activeChannels = CHANNELS.filter((ch) => !paused.has(ch));

  const effectiveAlloc = useMemo(() => {
    const pausedTotal  = CHANNELS.filter((ch) => paused.has(ch)).reduce((s, ch) => s + (allocations[ch] || 0), 0);
    const activeTotal  = activeChannels.reduce((s, ch) => s + (allocations[ch] || 0), 0);
    const eff: Record<string, number> = {};
    for (const ch of CHANNELS) {
      if (paused.has(ch)) { eff[ch] = 0; continue; }
      eff[ch] = activeTotal > 0 ? (allocations[ch] || 0) / activeTotal * (activeTotal + pausedTotal) : 0;
    }
    const sum = Object.values(eff).reduce((s, v) => s + v, 0);
    if (sum > 0) for (const k of Object.keys(eff)) eff[k] /= sum;
    return eff;
  }, [allocations, paused, activeChannels]);

  // ── Current plan forecast ──────────────────────────────────────────────
  const currentPlan = useMemo(
    () => buildMonthlyPlanFromData({
      data: globalAggregate || data || [],
      selectedMonths: selectedRange,
      monthlyBudget: safeBudget,
      modeMultiplier,
      allocationShares: effectiveAlloc,
      saturationModels: models,
    }),
    [globalAggregate, data, selectedRange, safeBudget, modeMultiplier, effectiveAlloc, models]
  );

  const weightedROAS = useMemo(() => getPortfolioWeightedROAS(summaries), [summaries]);
  const periodWeights = useMemo(
    () => getPeriodTimeWeightSums({ data: globalAggregate || data || [], selectedMonths: selectedRange }),
    [globalAggregate, data, selectedRange]
  );

  const currentROAS = totalBudget > 0 ? currentPlan.totalRevenue / totalBudget : 0;

  // ── Channel status classification ──────────────────────────────────────
  const channelStatuses = useMemo(() => {
    const result: Record<string, string> = {};
    for (const ch of CHANNELS) {
      const s = summaries.find((x) => x.channel === ch);
      const m = models.find((x) => x.channel === ch);
      if (!s || !m) { result[ch] = 'efficient'; continue; }
      result[ch] = classifyMixChannelEfficiency({
        optimalFraction: allocations[ch] || 0,
        manualFraction: effectiveAlloc[ch] || 0,
        model: m, cap: capByChannel[ch],
        portfolioAvgROAS: weightedROAS,
        monthlyBudget: safeBudget,
        summaryROAS: s.roas,
        periodTimeWeightSum: periodWeights[ch] ?? 1,
      });
    }
    return result;
  }, [summaries, models, allocations, effectiveAlloc, capByChannel, weightedROAS, safeBudget, periodWeights]);

  const channelsToReview = CHANNELS.filter((ch) => channelStatuses[ch] !== 'efficient').length;

  // ── Data freshness ─────────────────────────────────────────────────────
  const dataRange = useMemo(() => {
    if (!data?.length) return null;
    let min = data[0].date, max = data[0].date;
    for (const r of data) { if (r.date < min) min = r.date; if (r.date > max) max = r.date; }
    return { min, max };
  }, [data]);

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div style={{ maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Progress nav ───────────────────────────────────────────────── */}
      <OptimizerSubnav />

      {/* ── Page header ────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
          Current Mix
        </h1>
        <p style={{ ...T.helper, marginTop: 6 }}>
          What your budget is doing right now — before any AI recommendation.
        </p>
        {dataRange && (
          <p style={{ ...T.helper, fontSize: 11, marginTop: 4, color: 'var(--text-muted)' }}>
            Data: {dataRange.min} → {dataRange.max}
            {' · '}Source: {dataSource === 'api' ? 'API' : dataSource === 'cached' ? 'Cache' : 'Sample'}
            {dataUpdatedAt ? ` · Loaded ${new Date(dataUpdatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
          </p>
        )}
      </div>

      {/* ── Planning controls ──────────────────────────────────────────── */}
      <div style={{ ...CARD }}>
        <p style={{ ...T.overline, marginBottom: 16 }}>Planning settings</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, alignItems: 'start' }}>

          {/* Budget */}
          <div>
            <p style={{ ...T.overline, fontSize: 10, marginBottom: 8 }}>Monthly Budget</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'var(--bg-root)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 12px' }}>
              <span style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>₹</span>
              <input
                type="number"
                value={safeBudget}
                min={0}
                step={1000}
                onChange={(e) => { const v = Number(e.target.value); setBudget(Number.isFinite(v) ? Math.max(0, v) : 0); }}
                onBlur={() => setBudget((b) => Math.round(Math.max(0, b) / 1000) * 1000)}
                style={{ flex: 1, minWidth: 100, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'Outfit', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}
              />
            </div>
            <p style={{ ...T.helper, fontSize: 11, marginTop: 4 }}>
              {formatINR(safeBudget)}/mo · {formatINRCompact(totalBudget)} total
            </p>
          </div>

          {/* Planning period */}
          <div>
            <p style={{ ...T.overline, fontSize: 10, marginBottom: 8 }}>Planning Period</p>
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
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <select value={customStartMonth} onChange={(e) => setCustomStartMonth(e.target.value)}
                  style={{ flex: 1, backgroundColor: 'var(--bg-root)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans', fontSize: 11, padding: '7px 8px' }}>
                  {timelineMonths.map((m) => <option key={`s-${m.key}`} value={m.key}>{monthNames[m.month]} {m.year}</option>)}
                </select>
                <span style={{ ...T.overline, fontSize: 9 }}>to</span>
                <select value={customEndMonth} onChange={(e) => setCustomEndMonth(e.target.value)}
                  style={{ flex: 1, backgroundColor: 'var(--bg-root)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans', fontSize: 11, padding: '7px 8px' }}>
                  {timelineMonths.map((m) => <option key={`e-${m.key}`} value={m.key}>{monthNames[m.month]} {m.year}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Planning mode */}
          <div>
            <p style={{ ...T.overline, fontSize: 10, marginBottom: 8 }}>Planning Mode</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['conservative','target','aggressive'] as PlanningMode[]).map((m) => (
                <button key={m} onClick={() => setPlanningMode(m)} style={{
                  fontFamily: 'Outfit', fontSize: 12, fontWeight: 600, padding: '9px 14px', borderRadius: 8, cursor: 'pointer', transition: '120ms',
                  border: planningMode === m ? '1px solid var(--border-strong)' : '1px solid var(--border-subtle)',
                  backgroundColor: planningMode === m ? 'var(--bg-root)' : 'transparent',
                  color: planningMode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                }}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          {
            label: 'Current Revenue Forecast',
            value: formatINRCompact(currentPlan.totalRevenue),
            sub: `${durationMonths}-month model forecast`,
            accent: '#60A5FA',
            note: 'Based on your current allocation — not realized historical revenue.',
          },
          {
            label: 'Current Blended ROAS',
            value: `${currentROAS.toFixed(2)}x`,
            sub: 'Revenue ÷ budget',
            accent: '#E8803A',
            note: 'Modelled period revenue divided by total planned spend.',
          },
          {
            label: 'Total Budget',
            value: formatINRCompact(totalBudget),
            sub: `${formatINR(safeBudget)}/mo × ${durationMonths} months`,
            accent: '#A78BFA',
            note: '',
          },
          {
            label: 'Channels to Review',
            value: `${channelsToReview} / 10`,
            sub: channelsToReview === 0 ? 'All channels efficient' : 'Saturated, over-scaled, or under-scaled',
            accent: channelsToReview === 0 ? '#34D399' : '#FBBF24',
            note: 'See Diagnosis for detail.',
          },
        ].map((kpi) => (
          <div key={kpi.label} style={{ ...CARD }}>
            <p style={T.overline}>{kpi.label}</p>
            <p style={{ ...T.value, fontSize: 24, fontWeight: 800, marginTop: 6 }}>{kpi.value}</p>
            <p style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: 600, color: kpi.accent, marginTop: 4 }}>{kpi.sub}</p>
            {kpi.note && <p style={{ ...T.helper, fontSize: 10, marginTop: 8, lineHeight: 1.4 }}>{kpi.note}</p>}
            <div style={{ height: 2, backgroundColor: kpi.accent, borderRadius: 1, marginTop: 12, opacity: 0.35 }} />
          </div>
        ))}
      </div>

      {/* ── Current allocation table ───────────────────────────────────── */}
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden', backgroundColor: 'var(--bg-card)' }}>
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ ...T.overline, fontSize: 11 }}>Channel Allocation</p>
            <p style={{ ...T.helper, fontSize: 12, marginTop: 4 }}>
              Your current budget distribution across all 10 channels.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setAllocations({ ...historicalFractions })}
              style={{ fontFamily: 'Outfit', fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-root)', color: 'var(--text-muted)' }}
            >
              Reset to Historical
            </button>
          </div>
        </div>
        <div style={{ borderBottom: '1px solid var(--border-subtle)', marginTop: 16 }} />

        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(140px,1.4fr) 50px 56px 80px 80px 54px minmax(80px,0.9fr)',
          padding: '10px 24px', gap: 8,
          backgroundColor: 'var(--bg-root)', borderBottom: '1px solid var(--border-subtle)',
        }}>
          {['Channel', 'Hist', 'Yours', 'Spend', 'Revenue', 'ROAS', 'Status'].map((h) => (
            <span key={h} style={{ ...T.overline, textAlign: h !== 'Channel' ? 'center' : 'left' }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {CHANNELS.map((ch, ci) => {
          const color    = CHANNEL_COLORS[ci];
          const histPct  = Math.round((historicalFractions[ch] || 0) * 100);
          const yourPct  = Math.round((effectiveAlloc[ch] || 0) * 100);
          const spend    = currentPlan.channelTotals[ch]?.spend || 0;
          const revenue  = currentPlan.channelTotals[ch]?.revenue || 0;
          const roas     = spend > 0 ? revenue / spend : 0;
          const status   = channelStatuses[ch] || 'efficient';
          const st       = STATUS_STYLES[status] || STATUS_STYLES.efficient;
          const isPaused = paused.has(ch);
          const allocPct = Math.round((allocations[ch] || 0) * 100);

          return (
            <div key={ch} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: isPaused ? 0.45 : 1 }}>
              {/* Main row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(140px,1.4fr) 50px 56px 80px 80px 54px minmax(80px,0.9fr)',
                padding: '13px 24px', gap: 8, alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                  <ChannelName channel={ch} style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }} />
                </div>
                <span style={{ fontFamily: 'Outfit', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>{histPct}%</span>
                <span style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>{yourPct}%</span>
                <span style={{ fontFamily: 'Outfit', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>{formatINRCompact(spend)}</span>
                <span style={{ fontFamily: 'Outfit', fontSize: 12, fontWeight: 600, color, textAlign: 'center' }}>{formatINRCompact(revenue)}</span>
                <span style={{ fontFamily: 'Outfit', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>{roas.toFixed(2)}x</span>
                <span style={{ fontFamily: 'Outfit', fontSize: 10, fontWeight: 700, color: st.color, backgroundColor: st.bg, padding: '4px 10px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', justifySelf: 'start' }}>
                  {st.label}
                </span>
              </div>

              {/* Slider row */}
              <div style={{ padding: '0 24px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <Switch checked={!isPaused} onCheckedChange={() => {
                  setPaused((prev) => {
                    const next = new Set(prev);
                    if (next.has(ch)) next.delete(ch); else next.add(ch);
                    return next;
                  });
                }} />
                <div style={{ flex: 1 }} onClick={(e) => e.stopPropagation()}>
                  <Slider
                    value={[allocPct]}
                    min={0} max={60} step={1}
                    disabled={isPaused}
                    onValueChange={([v]) => setAllocations((prev) => ({ ...prev, [ch]: v / 100 }))}
                  />
                </div>
                <span style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', minWidth: 34, textAlign: 'right' }}>{allocPct}%</span>
              </div>
            </div>
          );
        })}

        {/* Total bar */}
        <div style={{
          padding: '12px 24px',
          textAlign: 'right',
          fontFamily: 'Outfit', fontSize: 13, fontWeight: 700,
          color: Math.abs(Object.values(allocations).reduce((s, v) => s + v, 0) - 1) > 0.01 ? '#F87171' : '#34D399',
          borderTop: '1px solid var(--border-subtle)',
        }}>
          Total: {Math.round(Object.values(allocations).reduce((s, v) => s + v, 0) * 100)}%
        </div>
      </div>

      {/* ── Diagnosis CTA ─────────────────────────────────────────────── */}
      <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontFamily: 'Outfit', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {channelsToReview === 0
              ? 'All channels look efficient based on current data.'
              : `${channelsToReview} channel${channelsToReview > 1 ? 's' : ''} flagged for review.`}
          </p>
          <p style={{ ...T.helper, fontSize: 12, marginTop: 6 }}>
            {channelsToReview === 0
              ? 'Proceed to Diagnosis to confirm, then review the AI recommendation.'
              : 'Head to Diagnosis to see which channels are saturated, over-scaled, or under-invested.'}
          </p>
        </div>
        <Link to="/optimizer/diagnosis" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '12px 20px', borderRadius: 10,
          background: 'linear-gradient(135deg, #E8803A, #FBBF24)',
          color: '#000', fontFamily: 'Outfit', fontSize: 13, fontWeight: 700,
          textDecoration: 'none', whiteSpace: 'nowrap',
        }}>
          See Diagnosis <ArrowRight size={15} />
        </Link>
      </div>

    </div>
  );
}
