import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMarketingData } from '@/hooks/useMarketingData';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { OptimizerSubnav } from '@/components/optimizer/OptimizerSubnav';
import { useOptimizer } from '@/contexts/OptimizerContext';
import {
  getChannelSummaries,
  getChannelSaturationModels,
  classifyMixChannelEfficiency,
  getPeriodTimeWeightSums,
  getChannelCapsFromData,
  getPortfolioWeightedROAS,
  buildMonthRange,
  getTimeFrameMonths,
} from '@/lib/calculations';
import { formatINRCompact } from '@/lib/formatCurrency';
import { CHANNELS, CHANNEL_COLORS } from '@/lib/mockData';
import { ChannelName } from '@/components/ChannelName';
import {
  CheckCircle, AlertTriangle, TrendingDown, TrendingUp,
  ArrowRight, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

// ── Design tokens ────────────────────────────────────────────────────────────

const T = {
  overline: { fontFamily: 'Outfit' as const, fontSize: 10, fontWeight: 600 as const, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: 0 },
  value:    { fontFamily: 'Outfit' as const, fontWeight: 700 as const, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 },
  helper:   { fontFamily: 'Plus Jakarta Sans' as const, fontSize: 13, fontWeight: 400 as const, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 },
};
const CARD = { padding: '20px 24px', border: '1px solid var(--border-subtle)', borderRadius: 14, backgroundColor: 'var(--bg-card)' };

type EfficiencyTier = 'efficient' | 'saturated' | 'over-scaled' | 'under-scaled';

const STATUS: Record<EfficiencyTier, {
  label: string; color: string; bg: string;
  Icon: React.ElementType; description: string;
}> = {
  efficient:      { label: 'Efficient',    color: '#34D399', bg: 'rgba(52,211,153,0.1)',  Icon: CheckCircle,  description: 'Return is strong relative to spend — hold or grow carefully.' },
  saturated:      { label: 'Saturated',    color: '#F87171', bg: 'rgba(248,113,113,0.1)', Icon: TrendingDown, description: 'Adding more spend returns significantly less — consider reducing budget here.' },
  'over-scaled':  { label: 'Over-scaled',  color: '#FBBF24', bg: 'rgba(251,191,36,0.1)',  Icon: AlertTriangle,description: 'Receiving more of the budget than efficiency justifies.' },
  'under-scaled': { label: 'Under-scaled', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)',  Icon: TrendingUp,   description: 'Performing well but receiving less budget than it could absorb.' },
};

// ── Plain-English reason generator ───────────────────────────────────────────

function buildReason(
  ch: string,
  tier: EfficiencyTier,
  yourPct: number,
  histPct: number,
  roas: number,
  portfolioROAS: number,
): string {
  const roasVsAvg = roas > portfolioROAS * 1.2 ? 'above portfolio average' : roas < portfolioROAS * 0.8 ? 'below portfolio average' : 'near portfolio average';
  const allocNote = yourPct > histPct + 5
    ? `currently receiving ${yourPct}% — more than its historical ${histPct}%`
    : yourPct < histPct - 5
    ? `currently receiving ${yourPct}% — less than its historical ${histPct}%`
    : `allocation (${yourPct}%) is close to its historical share`;

  if (tier === 'saturated')
    return `Historical ROAS of ${roas.toFixed(2)}x is ${roasVsAvg}. Higher spend tiers show diminishing returns. ${ch} is ${allocNote}.`;
  if (tier === 'over-scaled')
    return `${ch} is ${allocNote} but ROAS (${roas.toFixed(2)}x) suggests the extra spend is not fully justified by returns.`;
  if (tier === 'under-scaled')
    return `${ch} has a strong ROAS (${roas.toFixed(2)}x, ${roasVsAvg}) but is ${allocNote}. There may be room to invest more.`;
  return `${ch} is performing at ${roas.toFixed(2)}x ROAS (${roasVsAvg}). No immediate reallocation signal.`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Diagnosis() {
  const { data, aggregate, globalAggregate, isLoading } = useMarketingData({ includeGlobalAggregate: true });
  const {
    budget, planningPeriod, planningMode, customStartMonth, customEndMonth,
    allocations, paused,
  } = useOptimizer();

  const safeBudget = Number.isFinite(budget) && budget > 0 ? budget : 5000000;
  const modeMultiplier = planningMode === 'conservative' ? 0.8 : planningMode === 'aggressive' ? 1.2 : 1.0;

  const summaries = useMemo(
    () => (aggregate || data) ? getChannelSummaries(aggregate || data!) : [],
    [data, aggregate]
  );
  const models = useMemo(
    () => (globalAggregate || data) ? getChannelSaturationModels(globalAggregate || data!) : [],
    [data, globalAggregate]
  );
  const caps = useMemo(() => getChannelCapsFromData(globalAggregate || data || []), [globalAggregate, data]);
  const capByChannel = useMemo(() => {
    const m: Record<string, typeof caps[number] | undefined> = {};
    caps.forEach((c) => (m[c.channel] = c));
    return m;
  }, [caps]);

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

  const periodWeights = useMemo(
    () => getPeriodTimeWeightSums({ data: globalAggregate || data || [], selectedMonths: selectedRange }),
    [globalAggregate, data, selectedRange]
  );

  // ── Historical fractions (baseline) ─────────────────────────────────────
  const historicalFractions = useMemo(() => {
    const total = summaries.reduce((s, c) => s + c.totalSpend, 0);
    const f: Record<string, number> = {};
    CHANNELS.forEach((ch) => {
      const s = summaries.find((x) => x.channel === ch);
      f[ch] = total > 0 ? (s?.totalSpend || 0) / total : 1 / CHANNELS.length;
    });
    return f;
  }, [summaries]);

  // ── Effective allocation ──────────────────────────────────────────────────
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

  // ── Channel status ────────────────────────────────────────────────────────
  const channelStatuses = useMemo(() => {
    const result: Record<string, EfficiencyTier> = {};
    for (const ch of CHANNELS) {
      const s = summaries.find((x) => x.channel === ch);
      const m = models.find((x) => x.channel === ch);
      if (!s || !m) { result[ch] = 'efficient'; continue; }
      result[ch] = classifyMixChannelEfficiency({
        optimalFraction: allocations[ch] || 0,
        manualFraction: effectiveAlloc[ch] || 0,
        model: m, cap: capByChannel[ch],
        portfolioAvgROAS: portfolioROAS,
        monthlyBudget: safeBudget,
        summaryROAS: s.roas,
        periodTimeWeightSum: periodWeights[ch] ?? 1,
      }) as EfficiencyTier;
    }
    return result;
  }, [summaries, models, allocations, effectiveAlloc, capByChannel, portfolioROAS, safeBudget, periodWeights]);

  // ── Derived channel lists ─────────────────────────────────────────────────
  const flaggedChannels = CHANNELS.filter((ch) => channelStatuses[ch] !== 'efficient');
  const efficientChannels = CHANNELS.filter((ch) => channelStatuses[ch] === 'efficient');
  const overWeighted  = CHANNELS.filter((ch) => (effectiveAlloc[ch] || 0) > (historicalFractions[ch] || 0) + 0.04);
  const underWeighted = CHANNELS.filter((ch) => (effectiveAlloc[ch] || 0) < (historicalFractions[ch] || 0) - 0.04);

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div style={{ maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Progress nav ───────────────────────────────────────────────── */}
      <OptimizerSubnav />

      {/* ── Page header ────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
          Diagnosis
        </h1>
        <p style={{ ...T.helper, marginTop: 6 }}>
          What the data says about your current mix — before seeing any recommendation.
        </p>
      </div>

      {/* ── Channel health summary grid ────────────────────────────────── */}
      <div style={{ ...CARD }}>
        <p style={{ ...T.overline, fontSize: 11, marginBottom: 16 }}>Channel Health Overview</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {CHANNELS.map((ch, ci) => {
            const tier = channelStatuses[ch] || 'efficient';
            const st   = STATUS[tier];
            const Icon = st.Icon;
            const color = CHANNEL_COLORS[ci];
            return (
              <div key={ch} style={{
                borderRadius: 10, padding: '12px 14px',
                border: `1.5px solid ${st.bg}`,
                backgroundColor: st.bg,
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                  <ChannelName channel={ch} style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon style={{ width: 12, height: 12, color: st.color }} />
                  <span style={{ fontFamily: 'Outfit', fontSize: 10, fontWeight: 700, color: st.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {st.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Flagged channels (expandable detail) ──────────────────────── */}
      {flaggedChannels.length > 0 ? (
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ padding: '20px 24px 0' }}>
            <p style={{ ...T.overline, fontSize: 11 }}>
              Flagged Channels — {flaggedChannels.length} require attention
            </p>
            <p style={{ ...T.helper, fontSize: 12, marginTop: 4, marginBottom: 0 }}>
              These channels show signs of inefficiency, saturation, or misallocation.
            </p>
            <div style={{ borderBottom: '1px solid var(--border-subtle)', marginTop: 16 }} />
          </div>
          {flaggedChannels.map((ch, i) => {
            const tier    = channelStatuses[ch];
            const st      = STATUS[tier];
            const Icon    = st.Icon;
            const summary = summaries.find((s) => s.channel === ch);
            const roas    = summary?.roas || 0;
            const histPct = Math.round((historicalFractions[ch] || 0) * 100);
            const yourPct = Math.round((effectiveAlloc[ch] || 0) * 100);
            const reason  = buildReason(ch, tier, yourPct, histPct, roas, portfolioROAS);

            return (
              <div key={ch} style={{ borderBottom: i < flaggedChannels.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: st.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon style={{ width: 16, height: 16, color: st.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <ChannelName channel={ch} style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }} />
                      <span style={{ fontFamily: 'Outfit', fontSize: 10, fontWeight: 700, color: st.color, backgroundColor: st.bg, padding: '3px 10px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {st.label}
                      </span>
                    </div>
                    <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                      {reason}
                    </p>
                    <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                      {st.description}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{yourPct}%</span>
                    <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-muted)' }}>vs {histPct}% hist</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ ...CARD, display: 'flex', alignItems: 'center', gap: 16 }}>
          <CheckCircle style={{ width: 28, height: 28, color: '#34D399', flexShrink: 0 }} />
          <div>
            <p style={{ fontFamily: 'Outfit', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              All channels are classified as efficient.
            </p>
            <p style={{ ...T.helper, fontSize: 12, marginTop: 4 }}>
              No saturation, over-scaling, or under-scaling detected with the current allocation and data.
            </p>
          </div>
        </div>
      )}

      {/* ── Over / Under weighted vs historical ────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ ...CARD, borderColor: 'rgba(251,191,36,0.3)', backgroundColor: 'rgba(251,191,36,0.04)' }}>
          <p style={{ ...T.overline, fontSize: 10, color: '#FBBF24', marginBottom: 12 }}>Over-weighted vs historical</p>
          {overWeighted.length === 0 ? (
            <p style={{ ...T.helper, fontSize: 12 }}>No channels are significantly over-weighted.</p>
          ) : overWeighted.map((ch) => {
            const yours = Math.round((effectiveAlloc[ch] || 0) * 100);
            const hist  = Math.round((historicalFractions[ch] || 0) * 100);
            return (
              <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <ArrowUpRight style={{ width: 14, height: 14, color: '#FBBF24', flexShrink: 0 }} />
                <ChannelName channel={ch} style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }} />
                <span style={{ fontFamily: 'Outfit', fontSize: 12, color: '#FBBF24', fontWeight: 700 }}>{yours}%</span>
                <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-muted)' }}>hist {hist}%</span>
              </div>
            );
          })}
        </div>

        <div style={{ ...CARD, borderColor: 'rgba(96,165,250,0.3)', backgroundColor: 'rgba(96,165,250,0.04)' }}>
          <p style={{ ...T.overline, fontSize: 10, color: '#60A5FA', marginBottom: 12 }}>Under-weighted vs historical</p>
          {underWeighted.length === 0 ? (
            <p style={{ ...T.helper, fontSize: 12 }}>No channels are significantly under-weighted.</p>
          ) : underWeighted.map((ch) => {
            const yours = Math.round((effectiveAlloc[ch] || 0) * 100);
            const hist  = Math.round((historicalFractions[ch] || 0) * 100);
            return (
              <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <ArrowDownRight style={{ width: 14, height: 14, color: '#60A5FA', flexShrink: 0 }} />
                <ChannelName channel={ch} style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }} />
                <span style={{ fontFamily: 'Outfit', fontSize: 12, color: '#60A5FA', fontWeight: 700 }}>{yours}%</span>
                <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-muted)' }}>hist {hist}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Allocation risk overview ───────────────────────────────────── */}
      <div style={{ ...CARD }}>
        <p style={{ ...T.overline, fontSize: 11, marginBottom: 12 }}>Allocation Risk Summary</p>
        {flaggedChannels.length === 0 ? (
          <p style={{ ...T.helper, fontSize: 13 }}>
            The current allocation does not show any strong concentration risk. The mix is broadly in line with historical spend and efficiency signals.
          </p>
        ) : (
          <p style={{ ...T.helper, fontSize: 13, lineHeight: 1.7 }}>
            {flaggedChannels.filter((ch) => channelStatuses[ch] === 'saturated').length > 0 &&
              `${flaggedChannels.filter((ch) => channelStatuses[ch] === 'saturated').map((ch) => ch).join(', ')} ${flaggedChannels.filter((ch) => channelStatuses[ch] === 'saturated').length > 1 ? 'are' : 'is'} showing saturation — adding spend returns less than the portfolio average. `}
            {overWeighted.length > 0 &&
              `${overWeighted.map((ch) => ch).join(', ')} ${overWeighted.length > 1 ? 'are' : 'is'} receiving more budget than the historical baseline. `}
            {underWeighted.length > 0 &&
              `${underWeighted.map((ch) => ch).join(', ')} ${underWeighted.length > 1 ? 'are' : 'is'} under-represented relative to history. `}
            The AI recommendation on the next page proposes a reallocation to address these signals.
          </p>
        )}
      </div>

      {/* ── CTA to Recommended Mix ────────────────────────────────────── */}
      <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontFamily: 'Outfit', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Ready to see what the optimizer recommends?
          </p>
          <p style={{ ...T.helper, fontSize: 12, marginTop: 6 }}>
            The Recommended Mix page shows the AI-proposed allocation and the expected revenue uplift.
          </p>
        </div>
        <Link to="/optimizer/recommended" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '12px 20px', borderRadius: 10,
          background: 'linear-gradient(135deg, #E8803A, #FBBF24)',
          color: '#000', fontFamily: 'Outfit', fontSize: 13, fontWeight: 700,
          textDecoration: 'none', whiteSpace: 'nowrap',
        }}>
          See Recommended Mix <ArrowRight size={15} />
        </Link>
      </div>

    </div>
  );
}
