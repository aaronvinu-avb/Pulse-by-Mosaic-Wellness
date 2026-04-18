/**
 * CurrentMix — Page 1 of Mix Optimiser
 *
 * DATA CONTRACT — reads from model:
 *   currentPlan, historicalFractions, diagnosis, flaggedChannels,
 *   overWeightedChannels, underWeightedChannels,
 *   durationMonths, monthlyBudget, totalPeriodBudget,
 *   explanation, dataRange, dataSource, dataUpdatedAt, totalHistoricalMonths
 *
 * Must NOT read: optimizedPlan, uplift, recommendations, scenarios
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { OptimizerSubnav } from '@/components/optimizer/OptimizerSubnav';
import { useOptimizerModel } from '@/hooks/useOptimizerModel';
import { useOptimizer } from '@/contexts/OptimizerContext';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import { CHANNELS, CHANNEL_COLORS } from '@/lib/mockData';
import { ChannelName } from '@/components/ChannelName';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  ChevronRight, ChevronDown, ArrowRight, SlidersHorizontal,
  RotateCcw, TrendingUp, TrendingDown, Minus, Activity,
} from 'lucide-react';
import type { PlanningPeriod, PlanningMode } from '@/contexts/OptimizerContext';

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  overline: {
    fontFamily: 'Outfit' as const, fontSize: 10, fontWeight: 600 as const,
    color: 'var(--text-muted)', textTransform: 'uppercase' as const,
    letterSpacing: '0.08em', margin: 0,
  },
  body: {
    fontFamily: 'Plus Jakarta Sans' as const, fontSize: 13,
    fontWeight: 400 as const, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6,
  },
  label: {
    fontFamily: 'Outfit' as const, fontSize: 11, fontWeight: 600 as const,
    color: 'var(--text-muted)', margin: 0,
  },
};

const CARD: React.CSSProperties = {
  padding: '20px 24px',
  border: '1px solid var(--border-subtle)',
  borderRadius: 14,
  backgroundColor: 'var(--bg-card)',
};

// Plain-English health label mapping
const STATUS_META = {
  efficient:      { label: 'On Track',      color: '#34D399', bg: 'rgba(52,211,153,0.12)'  },
  saturated:      { label: 'Saturated',     color: '#F87171', bg: 'rgba(248,113,113,0.12)' },
  'over-scaled':  { label: 'Over-weighted', color: '#FBBF24', bg: 'rgba(251,191,36,0.12)'  },
  'under-scaled': { label: 'Under-invested',color: '#60A5FA', bg: 'rgba(96,165,250,0.12)'  },
} as const;

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Sort priority: saturated first, then over-scaled, then under-scaled, then efficient
const STATUS_ORDER: Record<string, number> = {
  saturated: 0, 'over-scaled': 1, 'under-scaled': 2, efficient: 3,
};

function confidenceLabel(score: number): { text: string; color: string } {
  if (score >= 0.70) return { text: 'Strong signal',    color: '#34D399' };
  if (score >= 0.38) return { text: 'Moderate signal',  color: '#FBBF24' };
  return               { text: 'Thin data',            color: '#94a3b8' };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CurrentMix() {
  // ── Tuned model outputs (read-only, current state only) ───────────────────
  const {
    isLoading, dataSource, dataUpdatedAt, dataRange, totalHistoricalMonths,
    currentPlan, historicalFractions, diagnosis, flaggedChannels,
    durationMonths, monthlyBudget, totalPeriodBudget,
    explanation,
  } = useOptimizerModel();

  // ── Context: writeable planning inputs ────────────────────────────────────
  const {
    budget, setBudget,
    planningPeriod, setPlanningPeriod,
    planningMode, setPlanningMode,
    customStartMonth, setCustomStartMonth,
    customEndMonth, setCustomEndMonth,
    allocations, setAllocations,
    paused, setPaused,
  } = useOptimizer();

  // ── Local UI state ────────────────────────────────────────────────────────
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);

  const safeBudget = Number.isFinite(budget) && budget > 0 ? budget : 5_000_000;

  const timelineMonths = (() => {
    const s = 2023, e = 2027;
    return Array.from({ length: (e - s + 1) * 12 }, (_, i) => {
      const y = s + Math.floor(i / 12), mo = i % 12;
      return { key: `${y}-${String(mo + 1).padStart(2, '0')}`, year: y, month: mo };
    });
  })();

  const toggleRow = (ch: string) =>
    setExpandedRows(prev => { const n = new Set(prev); n.has(ch) ? n.delete(ch) : n.add(ch); return n; });

  if (isLoading) return <DashboardSkeleton />;

  // ── Derived display values ─────────────────────────────────────────────────
  const sortedChannels = [...CHANNELS].sort((a, b) => {
    const sa = STATUS_ORDER[diagnosis[a]?.status ?? 'efficient'] ?? 3;
    const sb = STATUS_ORDER[diagnosis[b]?.status ?? 'efficient'] ?? 3;
    if (sa !== sb) return sa - sb;
    // Within same status: sort by revenue descending
    return (currentPlan.channels[b]?.periodRevenue || 0) - (currentPlan.channels[a]?.periodRevenue || 0);
  });

  const efficientCount = CHANNELS.filter(ch => !diagnosis[ch]?.isFlagged).length;
  const allocTotal = Object.values(allocations).reduce((s, v) => s + v, 0);
  const allocOk = Math.abs(allocTotal - 1) < 0.015;

  // Top channels by tunedROAS for diagnosis summary
  const topChannels = [...CHANNELS]
    .filter(ch => explanation[ch])
    .sort((a, b) => (explanation[b]?.tunedROAS || 0) - (explanation[a]?.tunedROAS || 0))
    .slice(0, 3);

  return (
    <div style={{ maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 28 }}>
      <OptimizerSubnav />

      {/* ── A. Page Header ──────────────────────────────────────────────────── */}
      <div>
        <h1 style={{
          fontFamily: 'Outfit', fontSize: 28, fontWeight: 800,
          color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0,
        }}>
          Current Mix
        </h1>
        <p style={{ ...T.body, marginTop: 6, fontSize: 14, color: 'var(--text-secondary)' }}>
          Review your current allocation and modeled performance before exploring recommendations.
        </p>
        <p style={{ ...T.body, fontSize: 12, marginTop: 5, color: 'var(--text-muted)' }}>
          Forecast uses tuned historical signals, diminishing returns, and timing effects.
          {dataRange ? ` · Data: ${dataRange.min} → ${dataRange.max}` : ''}
          {' · '}{Math.round(totalHistoricalMonths)} months of history
          {' · '}Source: {dataSource === 'api' ? 'Live API' : dataSource === 'cached' ? 'Cache' : 'Sample data'}
          {dataUpdatedAt ? ` · Updated ${new Date(dataUpdatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
        </p>
      </div>

      {/* ── B. Controls Strip ───────────────────────────────────────────────── */}
      <div style={{ ...CARD }}>
        <p style={{ ...T.overline, marginBottom: 18 }}>Planning settings</p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 24, alignItems: 'start',
        }}>

          {/* Monthly Budget */}
          <div>
            <p style={{ ...T.label, marginBottom: 8 }}>Monthly Budget</p>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              backgroundColor: 'var(--bg-root)',
              border: '1px solid var(--border-strong)',
              borderRadius: 10, padding: '10px 14px',
            }}>
              <span style={{ fontFamily: 'Outfit', fontSize: 15, fontWeight: 700, color: 'var(--text-muted)' }}>₹</span>
              <input
                type="number" value={safeBudget} min={0} step={1000}
                onChange={e => { const v = Number(e.target.value); setBudget(Number.isFinite(v) ? Math.max(0, v) : 0); }}
                onBlur={() => setBudget(b => Math.round(Math.max(0, b) / 1000) * 1000)}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  fontFamily: 'Outfit', fontWeight: 700, fontSize: 17, color: 'var(--text-primary)',
                }}
              />
            </div>
            <p style={{ ...T.body, fontSize: 11, marginTop: 5 }}>
              {formatINR(safeBudget)}/mo · {formatINRCompact(totalPeriodBudget)} total for period
            </p>
          </div>

          {/* Planning Period */}
          <div>
            <p style={{ ...T.label, marginBottom: 8 }}>Planning Period</p>
            <select
              value={planningPeriod}
              onChange={e => setPlanningPeriod(e.target.value as PlanningPeriod)}
              style={{
                width: '100%', backgroundColor: 'var(--bg-root)',
                border: '1px solid var(--border-strong)', borderRadius: 10,
                color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans',
                fontSize: 13, padding: '11px 14px', outline: 'none',
              }}
            >
              <option value="1m">1 Month</option>
              <option value="1q">1 Quarter (3 months)</option>
              <option value="6m">6 Months</option>
              <option value="1y">1 Year</option>
              <option value="custom">Custom range</option>
            </select>
            {planningPeriod === 'custom' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <select
                  value={customStartMonth} onChange={e => setCustomStartMonth(e.target.value)}
                  style={{ flex: 1, backgroundColor: 'var(--bg-root)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans', fontSize: 11, padding: '7px 8px', outline: 'none' }}
                >
                  {timelineMonths.map(m => <option key={m.key} value={m.key}>{MONTH_NAMES[m.month]} {m.year}</option>)}
                </select>
                <span style={{ ...T.overline, fontSize: 9 }}>to</span>
                <select
                  value={customEndMonth} onChange={e => setCustomEndMonth(e.target.value)}
                  style={{ flex: 1, backgroundColor: 'var(--bg-root)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans', fontSize: 11, padding: '7px 8px', outline: 'none' }}
                >
                  {timelineMonths.map(m => <option key={m.key} value={m.key}>{MONTH_NAMES[m.month]} {m.year}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Planning Mode */}
          <div>
            <p style={{ ...T.label, marginBottom: 8 }}>Planning Mode</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['conservative', 'target', 'aggressive'] as PlanningMode[]).map(m => (
                <button
                  key={m} onClick={() => setPlanningMode(m)}
                  style={{
                    fontFamily: 'Outfit', fontSize: 12, fontWeight: 600,
                    padding: '9px 14px', borderRadius: 8, cursor: 'pointer', transition: '120ms',
                    border: planningMode === m ? '1px solid var(--border-strong)' : '1px solid var(--border-subtle)',
                    backgroundColor: planningMode === m ? 'var(--bg-root)' : 'transparent',
                    color: planningMode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            <p style={{ ...T.body, fontSize: 11, marginTop: 6 }}>
              {planningMode === 'conservative' ? 'Applies a 0.8× revenue multiplier (downside scenario).' :
               planningMode === 'aggressive'   ? 'Applies a 1.2× revenue multiplier (upside scenario).' :
               'Applies a 1.0× multiplier — baseline forecast.'}
            </p>
          </div>
        </div>
      </div>

      {/* ── C. KPI Strip ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          {
            label: 'Current Revenue Forecast',
            value: formatINRCompact(currentPlan.totalPeriodRevenue),
            sub: `Modeled from current allocation using tuned historical signals`,
            accent: '#60A5FA',
          },
          {
            label: 'Current Blended ROAS',
            value: `${currentPlan.blendedROAS.toFixed(2)}x`,
            sub: 'Weighted return across the current channel mix',
            accent: '#E8803A',
          },
          {
            label: 'Total Monthly Budget',
            value: formatINRCompact(monthlyBudget),
            sub: `${formatINR(monthlyBudget)}/mo · ${durationMonths} month${durationMonths > 1 ? 's' : ''}`,
            accent: '#A78BFA',
          },
          {
            label: 'Channels to Review',
            value: flaggedChannels.length === 0 ? 'All healthy' : `${flaggedChannels.length} of 10`,
            sub: flaggedChannels.length === 0
              ? 'All channels are operating efficiently'
              : `${flaggedChannels.join(', ')} — flagged below`,
            accent: flaggedChannels.length === 0 ? '#34D399' : '#FBBF24',
          },
        ].map(kpi => (
          <div key={kpi.label} style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 0 }}>
            <p style={T.overline}>{kpi.label}</p>
            <p style={{
              fontFamily: 'Outfit', fontWeight: 800, fontSize: 26,
              color: 'var(--text-primary)', letterSpacing: '-0.025em',
              margin: '8px 0 6px',
            }}>
              {kpi.value}
            </p>
            <p style={{ ...T.body, fontSize: 11, lineHeight: 1.45, flex: 1 }}>{kpi.sub}</p>
            <div style={{ height: 2, backgroundColor: kpi.accent, borderRadius: 1, marginTop: 14, opacity: 0.4 }} />
          </div>
        ))}
      </div>

      {/* ── D. Allocation Table ──────────────────────────────────────────────── */}
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden', backgroundColor: 'var(--bg-card)' }}>

        {/* Table header */}
        <div style={{ padding: '18px 24px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <p style={{ ...T.overline, fontSize: 11 }}>Channel Allocation Review</p>
            <p style={{ ...T.body, fontSize: 12, marginTop: 4 }}>
              {editMode
                ? 'Edit mode: adjust sliders to change your allocation.'
                : 'Click any row to see the detailed channel view. Click Edit to adjust allocations.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setAllocations({ ...historicalFractions })}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: 'Outfit', fontSize: 11, fontWeight: 600,
                padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'transparent', color: 'var(--text-muted)',
              }}
            >
              <RotateCcw size={11} /> Reset to Historical
            </button>
            <button
              onClick={() => setEditMode(e => !e)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: 'Outfit', fontSize: 11, fontWeight: 600,
                padding: '7px 12px', borderRadius: 8, cursor: 'pointer', transition: '120ms',
                border: editMode ? '1px solid var(--border-strong)' : '1px solid var(--border-subtle)',
                backgroundColor: editMode ? 'var(--bg-root)' : 'transparent',
                color: editMode ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              <SlidersHorizontal size={11} /> {editMode ? 'Done editing' : 'Edit allocation'}
            </button>
          </div>
        </div>

        <div style={{ borderBottom: '1px solid var(--border-subtle)' }} />

        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '28px minmax(150px, 2fr) 80px 1fr 1fr 64px 110px',
          padding: '9px 24px', gap: 8,
          backgroundColor: 'var(--bg-root)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {['', 'Channel', 'Allocation', 'Forecast Spend', 'Forecast Revenue', 'ROAS', 'Health'].map((h, i) => (
            <span key={i} style={{ ...T.overline, textAlign: i <= 1 ? 'left' : 'center' }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {sortedChannels.map((ch, ci) => {
          const color      = CHANNEL_COLORS[CHANNELS.indexOf(ch) % CHANNEL_COLORS.length];
          const row        = currentPlan.channels[ch];
          const diag       = diagnosis[ch];
          const expl       = explanation[ch];
          const histPct    = Math.round((historicalFractions[ch] || 0) * 100);
          const yourPct    = row?.allocationPct ?? 0;
          const spend      = row?.periodSpend   ?? 0;
          const revenue    = row?.periodRevenue ?? 0;
          const roas       = row?.roas          ?? 0;
          const marg       = row?.marginalROAS  ?? 0;
          const status     = (diag?.status || 'efficient') as keyof typeof STATUS_META;
          const st         = STATUS_META[status] ?? STATUS_META.efficient;
          const isPaused   = paused.has(ch);
          const isExpanded = expandedRows.has(ch);
          const allocPct   = Math.round((allocations[ch] || 0) * 100);
          const isFlagged  = diag?.isFlagged ?? false;

          const conf       = expl ? confidenceLabel(expl.efficiencyConfidence) : { text: '', color: 'var(--text-muted)' };
          const margDir    = marg >= (roas * 0.9) ? 'healthy' : marg >= 1.0 ? 'weakening' : 'below-breakeven';

          return (
            <div key={ch} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: isPaused ? 0.4 : 1 }}>

              {/* Main row */}
              <button
                onClick={() => !editMode && toggleRow(ch)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '28px minmax(150px, 2fr) 80px 1fr 1fr 64px 110px',
                  padding: '14px 24px', gap: 8, alignItems: 'center',
                  width: '100%', background: 'transparent', border: 'none',
                  cursor: editMode ? 'default' : 'pointer', textAlign: 'left',
                  transition: '80ms',
                }}
              >
                {/* Expand chevron */}
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {editMode ? null : isExpanded
                    ? <ChevronDown size={13} />
                    : <ChevronRight size={13} />}
                </span>

                {/* Channel name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                  <div>
                    <ChannelName channel={ch} style={{
                      fontFamily: 'Plus Jakarta Sans', fontSize: 13, fontWeight: 700,
                      color: 'var(--text-primary)', display: 'block',
                    }} />
                    {isFlagged && (
                      <span style={{ fontFamily: 'Outfit', fontSize: 9, fontWeight: 600, color: st.color, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>
                        {diag?.reasonCode}
                      </span>
                    )}
                  </div>
                </div>

                {/* Allocation % + historical comparison */}
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {yourPct.toFixed(1)}%
                  </p>
                  <p style={{ fontFamily: 'Outfit', fontSize: 10, color: 'var(--text-muted)', margin: '1px 0 0' }}>
                    hist. {histPct}%
                  </p>
                </div>

                {/* Forecast Spend */}
                <p style={{ fontFamily: 'Outfit', fontSize: 13, color: 'var(--text-secondary)', margin: 0, textAlign: 'center' }}>
                  {formatINRCompact(spend)}
                </p>

                {/* Forecast Revenue */}
                <p style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color, margin: 0, textAlign: 'center' }}>
                  {formatINRCompact(revenue)}
                </p>

                {/* ROAS */}
                <p style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0, textAlign: 'center' }}>
                  {roas.toFixed(2)}x
                </p>

                {/* Health pill */}
                <span style={{
                  fontFamily: 'Outfit', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                  color: st.color, backgroundColor: st.bg,
                  padding: '4px 10px', borderRadius: 5,
                  textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const,
                  justifySelf: 'start' as const,
                }}>
                  {st.label}
                </span>
              </button>

              {/* Edit mode: sliders */}
              {editMode && (
                <div style={{ padding: '4px 24px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Switch
                    checked={!isPaused}
                    onCheckedChange={() => setPaused(prev => {
                      const n = new Set(prev); n.has(ch) ? n.delete(ch) : n.add(ch); return n;
                    })}
                  />
                  <div style={{ flex: 1 }}>
                    <Slider
                      value={[allocPct]} min={0} max={60} step={1} disabled={isPaused}
                      onValueChange={([v]) => setAllocations(prev => ({ ...prev, [ch]: v / 100 }))}
                    />
                  </div>
                  <span style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', minWidth: 34, textAlign: 'right' as const }}>
                    {allocPct}%
                  </span>
                </div>
              )}

              {/* Expanded detail panel */}
              {isExpanded && !editMode && (
                <div style={{
                  padding: '0 24px 20px 24px',
                  borderTop: `1px solid ${st.color}22`,
                  backgroundColor: 'var(--bg-root)',
                }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16,
                  }}>

                    {/* 1. Modeled Outlook */}
                    <div style={{ padding: '14px 16px', backgroundColor: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                      <p style={{ ...T.overline, marginBottom: 12 }}>Modeled Outlook</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                          { k: 'Monthly spend',    v: formatINRCompact(row?.spend ?? 0) },
                          { k: 'Period revenue',   v: formatINRCompact(revenue) },
                          { k: 'Effective ROAS',   v: `${roas.toFixed(2)}x` },
                          { k: 'Marginal ROAS',    v: `${marg.toFixed(2)}x` },
                        ].map(({ k, v }) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ ...T.body, fontSize: 12 }}>{k}</span>
                            <span style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{v}</span>
                          </div>
                        ))}
                        <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                          <p style={{ ...T.body, fontSize: 11, lineHeight: 1.5 }}>
                            {margDir === 'below-breakeven'
                              ? `Each additional ₹1 spent is returning less than ₹1 — marginal returns are below breakeven at this spend level.`
                              : margDir === 'weakening'
                              ? `Marginal return (${marg.toFixed(2)}x) is below the channel average (${roas.toFixed(2)}x) — spend efficiency is declining.`
                              : `Marginal return (${marg.toFixed(2)}x) is healthy — additional spend should still produce proportionate returns.`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 2. Performance Signal */}
                    <div style={{ padding: '14px 16px', backgroundColor: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                      <p style={{ ...T.overline, marginBottom: 12 }}>Performance Signal</p>
                      {expl ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {[
                            { k: 'Tuned ROAS',       v: `${expl.tunedROAS.toFixed(2)}x` },
                            { k: 'Portfolio median', v: `${expl.portfolioROAS.toFixed(2)}x` },
                            {
                              k: 'vs portfolio',
                              v: expl.tunedROAS > expl.portfolioROAS * 1.1
                                ? `+${Math.round((expl.tunedROAS / expl.portfolioROAS - 1) * 100)}% above`
                                : expl.tunedROAS < expl.portfolioROAS * 0.9
                                ? `${Math.round((1 - expl.tunedROAS / expl.portfolioROAS) * 100)}% below`
                                : 'In line',
                            },
                          ].map(({ k, v }) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ ...T.body, fontSize: 12 }}>{k}</span>
                              <span style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{v}</span>
                            </div>
                          ))}
                          <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ ...T.body, fontSize: 12 }}>Data quality</span>
                              <span style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: 700, color: conf.color }}>{conf.text}</span>
                            </div>
                            {expl.isHighVolatility && (
                              <p style={{ ...T.body, fontSize: 11, lineHeight: 1.4, color: '#FBBF24' }}>
                                This channel shows high month-to-month variance. The tuned figure moderates outliers.
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p style={{ ...T.body, fontSize: 12 }}>No performance data available for this channel.</p>
                      )}
                    </div>

                    {/* 3. Timing Effects */}
                    <div style={{ padding: '14px 16px', backgroundColor: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                      <p style={{ ...T.overline, marginBottom: 12 }}>Timing Effects</p>
                      {expl ? (() => {
                        const hasSeasonality = expl.seasonalityStrength !== 'weak';
                        const hasDow         = expl.dowEffectStrength   !== 'weak';
                        if (!hasSeasonality && !hasDow) {
                          return <p style={{ ...T.body, fontSize: 12 }}>No significant timing patterns detected for this channel. Timing adjustments are minimal.</p>;
                        }
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {hasSeasonality && (
                              <div>
                                <p style={{ ...T.label, marginBottom: 4 }}>Seasonality</p>
                                <p style={{ ...T.body, fontSize: 12, lineHeight: 1.5 }}>
                                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'Outfit' }}>
                                    {MONTH_NAMES[expl.peakMonth]}
                                  </strong>
                                  {' '}is the strongest month (+{Math.round(expl.peakBoost * 100)}% above annual average).
                                  Signal strength: <span style={{ color: expl.seasonalityStrength === 'strong' ? '#34D399' : '#FBBF24' }}>
                                    {expl.seasonalityStrength}
                                  </span>.
                                </p>
                              </div>
                            )}
                            {hasDow && (
                              <div style={{ marginTop: hasSeasonality ? 4 : 0 }}>
                                <p style={{ ...T.label, marginBottom: 4 }}>Day of week</p>
                                <p style={{ ...T.body, fontSize: 12, lineHeight: 1.5 }}>
                                  Best day is <strong style={{ color: 'var(--text-primary)', fontFamily: 'Outfit' }}>
                                    {DOW_NAMES[expl.bestDay]}
                                  </strong>
                                  {' '}(+{Math.round((expl.dowIndex[expl.bestDay] - 1) * 100)}% above weekly average).
                                  {expl.weekendBias !== 'neutral'
                                    ? ` This channel performs better on ${expl.weekendBias === 'weekend' ? 'weekends' : 'weekdays'}.`
                                    : ''}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })() : (
                        <p style={{ ...T.body, fontSize: 12 }}>Timing data not available.</p>
                      )}
                    </div>

                    {/* 4. Analyst Note */}
                    <div style={{ padding: '14px 16px', backgroundColor: 'var(--bg-card)', borderRadius: 10, border: `1px solid ${st.color}33` }}>
                      <p style={{ ...T.overline, marginBottom: 10 }}>Assessment</p>
                      <p style={{ ...T.body, fontSize: 13, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                        {diag?.explanation || `${ch} appears to be operating within a normal efficiency range.`}
                      </p>
                      {diag?.reasonCode && diag.reasonCode !== 'Efficient allocation' && (
                        <span style={{
                          display: 'inline-block', marginTop: 10,
                          fontFamily: 'Outfit', fontSize: 10, fontWeight: 600,
                          color: st.color, backgroundColor: st.bg,
                          padding: '3px 10px', borderRadius: 4,
                          textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                        }}>
                          {diag.reasonCode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Allocation total footer */}
        <div style={{
          padding: '11px 24px', textAlign: 'right',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
        }}>
          <span style={{ ...T.body, fontSize: 12 }}>Total allocation:</span>
          <span style={{
            fontFamily: 'Outfit', fontSize: 13, fontWeight: 800,
            color: allocOk ? '#34D399' : '#F87171',
          }}>
            {Math.round(allocTotal * 100)}%
          </span>
          {!allocOk && (
            <span style={{ ...T.body, fontSize: 11, color: '#F87171' }}>
              — must sum to 100%
            </span>
          )}
        </div>
      </div>

      {/* ── E. Diagnosis Summary ─────────────────────────────────────────────── */}
      <div style={{ ...CARD }}>
        <p style={{ ...T.overline, marginBottom: 18 }}>Mix Assessment</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>

          {/* Strongest channels */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <TrendingUp size={13} color="#34D399" />
              <p style={{ ...T.label, color: '#34D399' }}>Strongest channels</p>
            </div>
            {topChannels.map(ch => {
              const expl = explanation[ch];
              const row  = currentPlan.channels[ch];
              return (
                <div key={ch} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ChannelName channel={ch} style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }} />
                    <span style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: '#34D399' }}>
                      {(expl?.tunedROAS ?? row?.roas ?? 0).toFixed(2)}x
                    </span>
                  </div>
                  <p style={{ ...T.body, fontSize: 11, marginTop: 2 }}>
                    {(row?.allocationPct ?? 0).toFixed(1)}% of budget · {formatINRCompact(row?.periodRevenue ?? 0)} forecast
                  </p>
                </div>
              );
            })}
          </div>

          {/* Channels to review */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              {flaggedChannels.length > 0
                ? <Activity size={13} color="#FBBF24" />
                : <TrendingUp size={13} color="#34D399" />}
              <p style={{ ...T.label, color: flaggedChannels.length > 0 ? '#FBBF24' : '#34D399' }}>
                Channels to review
              </p>
            </div>
            {flaggedChannels.length === 0 ? (
              <p style={{ ...T.body, fontSize: 13 }}>
                No channels are flagged. All are operating within efficient ranges relative to the model benchmark.
              </p>
            ) : (
              flaggedChannels.map(ch => {
                const d = diagnosis[ch];
                const status = (d?.status || 'efficient') as keyof typeof STATUS_META;
                const st = STATUS_META[status] ?? STATUS_META.efficient;
                return (
                  <div key={ch} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <ChannelName channel={ch} style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }} />
                      <span style={{ fontFamily: 'Outfit', fontSize: 9, fontWeight: 700, color: st.color, backgroundColor: st.bg, padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase' as const }}>
                        {st.label}
                      </span>
                    </div>
                    <p style={{ ...T.body, fontSize: 11, marginTop: 2 }}>{d?.reasonCode}</p>
                  </div>
                );
              })
            )}
          </div>

          {/* Strategic takeaway */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Minus size={13} color="var(--text-muted)" />
              <p style={{ ...T.label }}>Strategic takeaway</p>
            </div>
            <p style={{ ...T.body, fontSize: 13, lineHeight: 1.7 }}>
              {`Your current mix is forecast to generate `}
              <strong style={{ color: 'var(--text-primary)', fontFamily: 'Outfit' }}>
                {formatINRCompact(currentPlan.totalPeriodRevenue)}
              </strong>
              {` at a blended ROAS of `}
              <strong style={{ color: 'var(--text-primary)', fontFamily: 'Outfit' }}>
                {currentPlan.blendedROAS.toFixed(2)}x
              </strong>
              {`. `}
              {efficientCount === CHANNELS.length
                ? `All ${CHANNELS.length} channels are operating within efficient ranges.`
                : flaggedChannels.length === 1
                ? `${CHANNELS.length - 1} channels are efficient; ${flaggedChannels[0]} needs attention before accepting a recommendation.`
                : `${efficientCount} of ${CHANNELS.length} channels appear well-balanced. ${flaggedChannels.join(', ')} ${flaggedChannels.length === 1 ? 'needs' : 'need'} review before moving forward.`}
            </p>
          </div>
        </div>
      </div>

      {/* ── F. Next-step CTA ─────────────────────────────────────────────────── */}
      <div style={{
        ...CARD,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 20, flexWrap: 'wrap' as const,
        borderColor: 'rgba(232,128,58,0.25)',
      }}>
        <div>
          <p style={{ fontFamily: 'Outfit', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Current state reviewed. Ready for the AI recommendation?
          </p>
          <p style={{ ...T.body, fontSize: 13, marginTop: 6 }}>
            The next step shows how the model would redistribute this budget to improve projected return — with per-channel rationale and uplift.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          <Link
            to="/optimizer/diagnosis"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 16px', borderRadius: 10,
              border: '1px solid var(--border-strong)',
              backgroundColor: 'var(--bg-root)', color: 'var(--text-secondary)',
              fontFamily: 'Outfit', fontSize: 12, fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Open Diagnosis
          </Link>
          <Link
            to="/optimizer/recommended"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 20px', borderRadius: 10,
              background: 'linear-gradient(135deg, #E8803A, #FBBF24)',
              color: '#000', fontFamily: 'Outfit', fontSize: 13, fontWeight: 700,
              textDecoration: 'none', whiteSpace: 'nowrap' as const,
            }}
          >
            See Recommended Mix <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}
