import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMarketingData } from '@/hooks/useMarketingData';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { OptimizerSubnav } from '@/components/optimizer/OptimizerSubnav';
import { useOptimizer } from '@/contexts/OptimizerContext';
import {
  getChannelSummaries,
  getChannelSaturationModels,
  getOptimalSharesForPeriod,
  buildMonthlyPlanFromData,
  buildMonthRange,
  getPeriodTimeWeightSums,
  getPortfolioWeightedROAS,
  getPeriodicMarginalROAS,
  computeRevenueUpliftMetrics,
  getChannelCapsFromData,
} from '@/lib/calculations';
import { formatINRCompact } from '@/lib/formatCurrency';
import { CHANNELS, CHANNEL_COLORS } from '@/lib/mockData';
import { ChannelName } from '@/components/ChannelName';
import {
  Sparkles, ArrowRight, TrendingUp, TrendingDown,
  ChevronDown, ChevronRight as ChevronRightIcon,
  CheckCircle,
} from 'lucide-react';
import { useState } from 'react';

// ── Design tokens ────────────────────────────────────────────────────────────

const T = {
  overline: { fontFamily: 'Outfit' as const, fontSize: 10, fontWeight: 600 as const, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: 0 },
  value:    { fontFamily: 'Outfit' as const, fontWeight: 700 as const, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 },
  helper:   { fontFamily: 'Plus Jakarta Sans' as const, fontSize: 13, fontWeight: 400 as const, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 },
};
const CARD = { padding: '20px 24px', border: '1px solid var(--border-subtle)', borderRadius: 14, backgroundColor: 'var(--bg-card)' };

// ── Reason helpers ────────────────────────────────────────────────────────────

function channelReason(
  ch: string,
  currentPct: number,
  aiPct: number,
  roas: number,
  portfolioROAS: number,
): string {
  const delta = aiPct - currentPct;
  const roasDesc = roas > portfolioROAS * 1.2
    ? 'strong efficiency above portfolio average'
    : roas < portfolioROAS * 0.8
    ? 'below-average efficiency'
    : 'near-average efficiency';

  if (delta > 5) return `Increased to ${aiPct}% — ${roasDesc}. Additional spend expected to maintain positive marginal return.`;
  if (delta < -5) return `Reduced to ${aiPct}% — ${roasDesc}. Spend above current level shows diminishing returns.`;
  return `Held near ${aiPct}% — ${roasDesc}. No strong reallocation signal.`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function RecommendedMix() {
  const { data, aggregate, globalAggregate, isLoading } = useMarketingData({ includeGlobalAggregate: true });
  const {
    budget, planningPeriod, planningMode, customStartMonth, customEndMonth,
    allocations, setAllocations, paused, setPaused,
  } = useOptimizer();

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const safeBudget     = Number.isFinite(budget) && budget > 0 ? budget : 5000000;
  const modeMultiplier = planningMode === 'conservative' ? 0.8 : planningMode === 'aggressive' ? 1.2 : 1.0;

  // ── Data derivations ─────────────────────────────────────────────────────
  const summaries = useMemo(
    () => (aggregate || data) ? getChannelSummaries(aggregate || data!) : [],
    [data, aggregate]
  );
  const models = useMemo(
    () => (globalAggregate || data) ? getChannelSaturationModels(globalAggregate || data!) : [],
    [data, globalAggregate]
  );
  const portfolioROAS = useMemo(() => getPortfolioWeightedROAS(summaries), [summaries]);

  const timelineMonths = useMemo(() => {
    const s = 2023, e = 2027;
    return Array.from({ length: (e - s + 1) * 12 }, (_, i) => {
      const y = s + Math.floor(i / 12), mo = i % 12;
      return { key: `${y}-${String(mo + 1).padStart(2, '0')}`, year: y, month: mo };
    });
  }, []);

  const selectedRange = useMemo(
    () => buildMonthRange(timelineMonths, '2025-01', planningPeriod, customStartMonth, customEndMonth),
    [timelineMonths, planningPeriod, customStartMonth, customEndMonth]
  );
  const durationMonths = selectedRange.length || 1;
  const totalBudget = safeBudget * durationMonths;

  const periodWeights = useMemo(
    () => getPeriodTimeWeightSums({ data: globalAggregate || data || [], selectedMonths: selectedRange }),
    [globalAggregate, data, selectedRange]
  );

  // ── Effective current allocation ────────────────────────────────────────
  const activeChannels = CHANNELS.filter((ch) => !paused.has(ch));
  const effectiveAlloc = useMemo(() => {
    const pausedTotal = CHANNELS.filter((ch) => paused.has(ch)).reduce((s, ch) => s + (allocations[ch] || 0), 0);
    const activeTotal = activeChannels.reduce((s, ch) => s + (allocations[ch] || 0), 0);
    const eff: Record<string, number> = {};
    for (const ch of CHANNELS) {
      if (paused.has(ch)) { eff[ch] = 0; continue; }
      eff[ch] = activeTotal > 0 ? (allocations[ch] || 0) / activeTotal * (activeTotal + pausedTotal) : 0;
    }
    const sum = Object.values(eff).reduce((s, v) => s + v, 0);
    if (sum > 0) for (const k of Object.keys(eff)) eff[k] /= sum;
    return eff;
  }, [allocations, paused, activeChannels]);

  // ── Current vs recommended plans ────────────────────────────────────────
  const optimalFractions = useMemo(
    () => getOptimalSharesForPeriod({
      data: globalAggregate || data || [],
      selectedMonths: selectedRange,
      monthlyBudget: safeBudget,
    }),
    [globalAggregate, data, selectedRange, safeBudget]
  );

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

  const recommendedPlan = useMemo(
    () => buildMonthlyPlanFromData({
      data: globalAggregate || data || [],
      selectedMonths: selectedRange,
      monthlyBudget: safeBudget,
      modeMultiplier,
      allocationShares: optimalFractions,
      saturationModels: models,
    }),
    [globalAggregate, data, selectedRange, safeBudget, modeMultiplier, optimalFractions, models]
  );

  const { revenueOpportunity, upliftPct, isNearOptimal } = useMemo(
    () => computeRevenueUpliftMetrics(currentPlan.totalRevenue, recommendedPlan.totalRevenue),
    [currentPlan.totalRevenue, recommendedPlan.totalRevenue]
  );

  const currentROAS     = totalBudget > 0 ? currentPlan.totalRevenue / totalBudget : 0;
  const recommendedROAS = totalBudget > 0 ? recommendedPlan.totalRevenue / totalBudget : 0;

  // ── Top channel changes ──────────────────────────────────────────────────
  const topIncreases = useMemo(
    () => CHANNELS
      .filter((ch) => (optimalFractions[ch] || 0) - (effectiveAlloc[ch] || 0) >= 0.03)
      .sort((a, b) =>
        ((optimalFractions[b] || 0) - (effectiveAlloc[b] || 0)) -
        ((optimalFractions[a] || 0) - (effectiveAlloc[a] || 0))
      )
      .slice(0, 4),
    [optimalFractions, effectiveAlloc]
  );

  const topReductions = useMemo(
    () => CHANNELS
      .filter((ch) => (effectiveAlloc[ch] || 0) - (optimalFractions[ch] || 0) >= 0.03)
      .sort((a, b) =>
        ((effectiveAlloc[b] || 0) - (optimalFractions[b] || 0)) -
        ((effectiveAlloc[a] || 0) - (optimalFractions[a] || 0))
      )
      .slice(0, 4),
    [optimalFractions, effectiveAlloc]
  );

  // ── Handlers ────────────────────────────────────────────────────────────
  const applyAIMix = () => {
    setAllocations({ ...optimalFractions });
    setPaused(new Set());
  };
  const resetToHistorical = () => {
    const total = summaries.reduce((s, c) => s + c.totalSpend, 0);
    const f: Record<string, number> = {};
    CHANNELS.forEach((ch) => {
      const s = summaries.find((x) => x.channel === ch);
      f[ch] = total > 0 ? (s?.totalSpend || 0) / total : 1 / CHANNELS.length;
    });
    setAllocations(f);
    setPaused(new Set());
  };
  const toggleRow = (ch: string) => setExpandedRows((prev) => {
    const next = new Set(prev); next.has(ch) ? next.delete(ch) : next.add(ch); return next;
  });

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div style={{ maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Progress nav ─────────────────────────────────────────────── */}
      <OptimizerSubnav />

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
            Recommended Mix
          </h1>
          <p style={{ ...T.helper, marginTop: 6 }}>
            What the optimizer suggests instead — and the expected improvement.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={resetToHistorical} style={{ fontFamily: 'Outfit', fontSize: 12, fontWeight: 600, padding: '9px 16px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>
            Reset to Current
          </button>
          <button onClick={applyAIMix} style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, padding: '9px 18px', borderRadius: 8, cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg, #E8803A, #FBBF24)', color: '#000', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} /> Apply AI Mix
          </button>
        </div>
      </div>

      {/* ── Uplift KPI strip ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Current Revenue',      value: formatINRCompact(currentPlan.totalRevenue),     accent: '#60A5FA', note: 'Forecast from your current allocation.' },
          { label: 'Recommended Revenue',  value: formatINRCompact(recommendedPlan.totalRevenue), accent: '#34D399', note: 'Forecast from the AI-recommended allocation.' },
          {
            label: 'Revenue Opportunity',
            value: `${revenueOpportunity >= 0 ? '+' : ''}${formatINRCompact(revenueOpportunity)}`,
            sub: `${upliftPct >= 0 ? '+' : ''}${upliftPct.toFixed(2)}% uplift`,
            accent: revenueOpportunity >= 0 ? '#34D399' : '#F87171',
            note: isNearOptimal ? 'Current mix is already near-optimal.' : 'Recommended minus current — both are modelled forecasts.',
          },
          { label: 'ROAS Improvement',     value: `${currentROAS.toFixed(2)}x → ${recommendedROAS.toFixed(2)}x`, accent: '#E8803A', note: 'Current then recommended blended ROAS.' },
        ].map((kpi) => (
          <div key={kpi.label} style={{ ...CARD }}>
            <p style={T.overline}>{kpi.label}</p>
            <p style={{ ...T.value, fontSize: 22, fontWeight: 800, marginTop: 6 }}>{kpi.value}</p>
            {kpi.sub && <p style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: 700, color: kpi.accent, marginTop: 3 }}>{kpi.sub}</p>}
            <p style={{ ...T.helper, fontSize: 10, marginTop: 8, lineHeight: 1.45 }}>{kpi.note}</p>
            <div style={{ height: 2, backgroundColor: kpi.accent, borderRadius: 1, marginTop: 12, opacity: 0.35 }} />
          </div>
        ))}
      </div>

      {/* ── Near-optimal note ────────────────────────────────────────── */}
      {isNearOptimal && (
        <div style={{ ...CARD, display: 'flex', alignItems: 'center', gap: 14, borderColor: 'rgba(52,211,153,0.3)', backgroundColor: 'rgba(52,211,153,0.05)' }}>
          <CheckCircle style={{ width: 22, height: 22, color: '#34D399', flexShrink: 0 }} />
          <p style={{ ...T.helper, fontSize: 13 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Your current mix is already close to the AI recommendation.</strong>
            {' '}The opportunity gap is within the model's tolerance. The comparison table below still shows the proposed changes — the "AI vs historical" narrative (on Diagnosis) explains why the AI still differs from historical spend.
          </p>
        </div>
      )}

      {/* ── Top changes ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { title: 'Top Increases', channels: topIncreases, color: '#34D399', bg: 'rgba(52,211,153,0.07)', borderColor: 'rgba(52,211,153,0.25)', Icon: TrendingUp },
          { title: 'Top Reductions', channels: topReductions, color: '#F87171', bg: 'rgba(248,113,113,0.07)', borderColor: 'rgba(248,113,113,0.25)', Icon: TrendingDown },
        ].map(({ title, channels, color, bg, borderColor, Icon }) => (
          <div key={title} style={{ borderRadius: 14, border: `1px solid ${borderColor}`, padding: '20px 24px', backgroundColor: bg }}>
            <p style={{ ...T.overline, color, marginBottom: 14 }}>{title}</p>
            {channels.length === 0 ? (
              <p style={{ ...T.helper, fontSize: 12 }}>No channels meet the threshold for this category.</p>
            ) : channels.map((ch, i) => {
              const yourPct = Math.round((effectiveAlloc[ch] || 0) * 100);
              const aiPct   = Math.round((optimalFractions[ch] || 0) * 100);
              const delta   = aiPct - yourPct;
              return (
                <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < channels.length - 1 ? 10 : 0 }}>
                  <Icon style={{ width: 14, height: 14, color, flexShrink: 0 }} />
                  <ChannelName channel={ch} style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }} />
                  <span style={{ fontFamily: 'Outfit', fontSize: 12, fontWeight: 700, color }}>{delta > 0 ? '+' : ''}{delta}%</span>
                  <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-muted)' }}>{yourPct}% → {aiPct}%</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Channel comparison table ──────────────────────────────────── */}
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden', backgroundColor: 'var(--bg-card)' }}>
        <div style={{ padding: '20px 24px 0' }}>
          <p style={{ ...T.overline, fontSize: 11 }}>Channel-by-Channel Comparison</p>
          <p style={{ ...T.helper, fontSize: 12, marginTop: 4 }}>
            Current vs AI-recommended allocation. Expand a row for marginal ROAS and reasoning.
          </p>
          <div style={{ borderBottom: '1px solid var(--border-subtle)', marginTop: 16 }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(140px,1.4fr) 56px 56px 52px minmax(200px,1.5fr) 28px',
          padding: '10px 24px', gap: 8,
          backgroundColor: 'var(--bg-root)', borderBottom: '1px solid var(--border-subtle)',
        }}>
          {['Channel', 'Yours', 'AI', 'Δ', 'Why', ''].map((h) => (
            <span key={h} style={{ ...T.overline, textAlign: h !== 'Channel' && h !== 'Why' && h !== '' ? 'center' : 'left' }}>{h}</span>
          ))}
        </div>

        {CHANNELS.map((ch, ci) => {
          const color   = CHANNEL_COLORS[ci];
          const yourPct = Math.round((effectiveAlloc[ch] || 0) * 100);
          const aiPct   = Math.round((optimalFractions[ch] || 0) * 100);
          const delta   = aiPct - yourPct;
          const roas    = summaries.find((s) => s.channel === ch)?.roas || 0;
          const reason  = channelReason(ch, yourPct, aiPct, roas, portfolioROAS);
          const isExp   = expandedRows.has(ch);

          const monthlySpend = (currentPlan.channelTotals[ch]?.spend || 0) / durationMonths;
          const model        = models.find((m) => m.channel === ch);
          const pw           = periodWeights[ch] ?? 1;
          const margROAS     = model ? getPeriodicMarginalROAS(model, monthlySpend, pw) : 0;

          return (
            <div key={ch} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => toggleRow(ch)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(140px,1.4fr) 56px 56px 52px minmax(200px,1.5fr) 28px',
                  padding: '13px 24px', gap: 8, alignItems: 'center',
                  cursor: 'pointer', width: '100%', border: 'none', background: 'transparent', textAlign: 'left', transition: '120ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--border-subtle)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                  <ChannelName channel={ch} style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }} />
                </div>
                <span style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center' }}>{yourPct}%</span>
                <span style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>{aiPct}%</span>
                <span style={{ fontFamily: 'Outfit', fontSize: 12, fontWeight: 700, textAlign: 'center', color: delta > 0 ? '#34D399' : delta < 0 ? '#F87171' : 'var(--text-muted)' }}>
                  {delta > 0 ? '+' : ''}{delta}%
                </span>
                <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {reason.split('—')[0]?.trim() || reason}
                </span>
                <span style={{ display: 'flex', justifyContent: 'center' }}>
                  {isExp ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronRightIcon size={16} style={{ color: 'var(--text-muted)' }} />}
                </span>
              </button>

              {isExp && (
                <div style={{ padding: '0 24px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  <div style={{ borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-root)' }}>
                    <p style={{ ...T.overline, fontSize: 9, marginBottom: 8 }}>Performance</p>
                    {[
                      ['Current spend (period)',  formatINRCompact(currentPlan.channelTotals[ch]?.spend || 0)],
                      ['Current revenue',         formatINRCompact(currentPlan.channelTotals[ch]?.revenue || 0)],
                      ['Recommended revenue',     formatINRCompact(recommendedPlan.channelTotals[ch]?.revenue || 0)],
                      ['Historical ROAS',         `${roas.toFixed(2)}x`],
                      ['Marginal ROAS (current)', `${margROAS.toFixed(2)}x`],
                    ].map(([label, val]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                        <span style={{ ...T.helper, fontSize: 11 }}>{label}</span>
                        <span style={{ fontFamily: 'Outfit', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{val}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-root)' }}>
                    <p style={{ ...T.overline, fontSize: 9, marginBottom: 8 }}>Reasoning</p>
                    <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{reason}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Why It Works CTA ─────────────────────────────────────────── */}
      <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontFamily: 'Outfit', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Want to understand how the optimizer reaches this recommendation?
          </p>
          <p style={{ ...T.helper, fontSize: 12, marginTop: 6 }}>
            Why It Works explains the model logic, diminishing returns, timing effects, and data sources.
          </p>
        </div>
        <Link to="/optimizer/why" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '12px 20px', borderRadius: 10,
          background: 'linear-gradient(135deg, #E8803A, #FBBF24)',
          color: '#000', fontFamily: 'Outfit', fontSize: 13, fontWeight: 700,
          textDecoration: 'none', whiteSpace: 'nowrap',
        }}>
          See Why It Works <ArrowRight size={15} />
        </Link>
      </div>

    </div>
  );
}
