/**
 * CurrentMix — Page 1 of Mix Optimiser
 *
 * ARCHITECTURE NOTE — two allocation state layers:
 *   localAllocs  — live drag values, updated on every slider move (display only)
 *   context.allocations — committed values, updated on drag END (triggers model recompute)
 *
 * DATA CONTRACT — reads from model (committed state only):
 *   currentPlan, historicalFractions, diagnosis, flaggedChannels,
 *   durationMonths, monthlyBudget, totalPeriodBudget,
 *   explanation, dataRange, dataSource, dataUpdatedAt, totalHistoricalMonths
 *
 * Must NOT read: optimizedPlan, uplift, recommendations, scenarios
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { useOptimizerModel } from '@/hooks/useOptimizerModel';
import { useOptimizer } from '@/contexts/OptimizerContext';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import { CHANNELS, CHANNEL_COLORS } from '@/lib/mockData';
import { ChannelName } from '@/components/ChannelName';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  ChevronRight, ChevronDown, ArrowRight, SlidersHorizontal,
  RotateCcw, TrendingUp, Activity, Minus, Scale, Info,
} from 'lucide-react';
import type { PlanningPeriod, PlanningMode } from '@/contexts/OptimizerContext';

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  overline: {
    fontFamily: 'Outfit' as const, fontSize: 10, fontWeight: 600 as const,
    color: 'var(--text-muted)', textTransform: 'uppercase' as const,
    letterSpacing: '0.09em', margin: 0,
  },
  body: {
    fontFamily: 'Plus Jakarta Sans' as const, fontSize: 13,
    fontWeight: 400 as const, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6,
  },
  label: {
    fontFamily: 'Outfit' as const, fontSize: 11, fontWeight: 600 as const,
    color: 'var(--text-muted)', margin: 0,
  },
  num: {
    fontFamily: 'Outfit' as const,
    fontVariantNumeric: 'tabular-nums' as const,
  },
};

const CARD: React.CSSProperties = {
  padding: '20px 24px',
  border: '1px solid var(--border-subtle)',
  borderRadius: 14,
  backgroundColor: 'var(--bg-card)',
};

// Column grid: expand / channel / alloc% / spend / revenue / roas / health
const COL = '16px minmax(140px,1fr) 70px 90px 90px 52px 96px';

const STATUS_META = {
  efficient:      { label: 'On Track',      color: '#34D399', bg: 'rgba(52,211,153,0.09)'  },
  saturated:      { label: 'Saturated',     color: '#F87171', bg: 'rgba(248,113,113,0.09)' },
  'over-scaled':  { label: 'Over-weighted', color: '#FBBF24', bg: 'rgba(251,191,36,0.09)'  },
  'under-scaled': { label: 'Under-invested',color: '#60A5FA', bg: 'rgba(96,165,250,0.09)'  },
} as const;

const STATUS_ORDER: Record<string, number> = {
  saturated: 0, 'over-scaled': 1, 'under-scaled': 2, efficient: 3,
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function confidenceLabel(score: number): { text: string; color: string } {
  if (score >= 0.70) return { text: 'Strong signal',   color: '#34D399' };
  if (score >= 0.38) return { text: 'Moderate signal', color: '#FBBF24' };
  return               { text: 'Thin data',           color: '#94a3b8' };
}

const TIMELINE_MONTHS = (() => {
  const s = 2023, e = 2027;
  return Array.from({ length: (e - s + 1) * 12 }, (_, i) => {
    const y = s + Math.floor(i / 12), mo = i % 12;
    return { key: `${y}-${String(mo + 1).padStart(2, '0')}`, year: y, month: mo };
  });
})();

// ── Component ─────────────────────────────────────────────────────────────────

export default function CurrentMix() {
  const {
    isLoading, dataSource, dataUpdatedAt, dataRange, totalHistoricalMonths,
    currentPlan, historicalFractions, diagnosis, flaggedChannels,
    durationMonths, monthlyBudget, totalPeriodBudget,
    explanation,
  } = useOptimizerModel();

  const {
    budget, setBudget,
    planningPeriod, setPlanningPeriod,
    planningMode, setPlanningMode,
    customStartMonth, setCustomStartMonth,
    customEndMonth, setCustomEndMonth,
    allocations, setAllocations,
    paused, setPaused,
  } = useOptimizer();

  // Live drag state — does NOT trigger model recompute
  const [localAllocs, setLocalAllocs] = useState<Record<string, number>>(() => ({ ...allocations }));
  const [isDragging, setIsDragging] = useState(false);
  useEffect(() => {
    if (!isDragging) setLocalAllocs({ ...allocations });
  }, [allocations, isDragging]);

  // UI state
  const [expandedRows, setExpandedRows]             = useState<Set<string>>(new Set());
  const [editMode, setEditMode]                     = useState(false);
  const [showForecastDetails, setShowForecastDetails] = useState(false);

  const toggleRow = useCallback((ch: string) =>
    setExpandedRows(prev => { const n = new Set(prev); n.has(ch) ? n.delete(ch) : n.add(ch); return n; }),
  []);

  // Stable row sort — keyed to committed diagnosis
  const sortedChannels = useMemo(() =>
    [...CHANNELS].sort((a, b) => {
      const sa = STATUS_ORDER[diagnosis[a]?.status ?? 'efficient'] ?? 3;
      const sb = STATUS_ORDER[diagnosis[b]?.status ?? 'efficient'] ?? 3;
      if (sa !== sb) return sa - sb;
      return (currentPlan.channels[b]?.periodRevenue || 0) - (currentPlan.channels[a]?.periodRevenue || 0);
    }),
  [diagnosis, currentPlan]);

  // Allocation totals
  const localTotal    = Object.values(localAllocs).reduce((s, v) => s + v, 0);
  const localTotalPct = Math.round(localTotal * 100);
  const allocOk       = Math.abs(localTotal - 1) < 0.015;
  const remaining     = Math.round((1 - localTotal) * 100);

  const resetToHistorical = useCallback(() => {
    setLocalAllocs({ ...historicalFractions });
    setAllocations({ ...historicalFractions });
  }, [historicalFractions, setAllocations]);

  const normalizeAllocs = useCallback(() => {
    if (localTotal === 0) return;
    const normalized = Object.fromEntries(
      Object.entries(localAllocs).map(([ch, v]) => [ch, v / localTotal])
    );
    setLocalAllocs(normalized);
    setAllocations(normalized);
  }, [localAllocs, localTotal, setAllocations]);

  const safeBudget = Number.isFinite(budget) && budget > 0 ? budget : 5_000_000;

  // Summary helpers
  const efficientCount = CHANNELS.filter(ch => !diagnosis[ch]?.isFlagged).length;
  const topChannels = useMemo(() =>
    [...CHANNELS]
      .filter(ch => explanation[ch])
      .sort((a, b) => (explanation[b]?.tunedROAS || 0) - (explanation[a]?.tunedROAS || 0))
      .slice(0, 3),
  [explanation]);

  if (isLoading) return <DashboardSkeleton />;

  const barColor = allocOk ? '#34D399' : Math.abs(localTotal - 1) < 0.08 ? '#FBBF24' : '#F87171';

  return (
    <div style={{ maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── A. Header — tight and decision-first ───────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{
            fontFamily: 'Outfit', fontSize: 26, fontWeight: 800,
            color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0,
          }}>
            Current Mix
          </h1>
          <p style={{ ...T.body, fontSize: 13, marginTop: 4, color: 'var(--text-secondary)' }}>
            Adjust and evaluate your current allocation before exploring recommendations.
          </p>
        </div>

        {/* Forecast details disclosure — right-aligned */}
        <button
          onClick={() => setShowForecastDetails(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: '1px solid var(--border-subtle)',
            borderRadius: 7, padding: '5px 10px', cursor: 'pointer',
            fontFamily: 'Outfit', fontSize: 10, fontWeight: 600,
            color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          <Info size={11} />
          Forecast details
          <ChevronDown size={10} style={{ transform: showForecastDetails ? 'rotate(180deg)' : 'none', transition: '150ms' }} />
        </button>
      </div>

      {/* Forecast details panel — collapsed by default */}
      {showForecastDetails && (
        <div style={{
          padding: '12px 16px', borderRadius: 10,
          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center',
        }}>
          {[
            { k: 'Method',        v: 'Tuned historical signals · diminishing returns · timing effects' },
            { k: 'History',       v: `${Math.round(totalHistoricalMonths)} months` },
            dataRange ? { k: 'Date range', v: `${dataRange.min} → ${dataRange.max}` } : null,
            { k: 'Source',        v: dataSource === 'api' ? 'Live API' : dataSource === 'cached' ? 'Cached' : 'Sample data' },
            dataUpdatedAt ? {
              k: 'Updated',
              v: new Date(dataUpdatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
            } : null,
          ].filter(Boolean).map(item => item && (
            <div key={item.k} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ ...T.overline, fontSize: 9 }}>{item.k}</span>
              <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-secondary)' }}>{item.v}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── B. Controls — inline, no section heading ───────────────────────── */}
      <div style={{
        ...CARD, padding: '16px 20px',
        display: 'grid',
        gridTemplateColumns: 'minmax(180px, 240px) minmax(160px, 220px) auto',
        gap: 20, alignItems: 'start',
      }}>

        {/* Monthly Budget */}
        <div>
          <p style={{ ...T.overline, fontSize: 9, marginBottom: 7 }}>Monthly Budget</p>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            backgroundColor: 'var(--bg-root)',
            border: '1px solid var(--border-strong)',
            borderRadius: 9, padding: '9px 12px',
          }}>
            <span style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>₹</span>
            <input
              type="number" value={safeBudget} min={0} step={1000}
              onChange={e => { const v = Number(e.target.value); setBudget(Number.isFinite(v) ? Math.max(0, v) : 0); }}
              onBlur={() => setBudget(b => Math.round(Math.max(0, b) / 1000) * 1000)}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontFamily: 'Outfit', fontWeight: 700, fontSize: 16,
                color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums',
              }}
            />
          </div>
          <p style={{ ...T.body, fontSize: 11, marginTop: 4 }}>
            {formatINRCompact(totalPeriodBudget)} over {durationMonths}mo
          </p>
        </div>

        {/* Planning Period */}
        <div>
          <p style={{ ...T.overline, fontSize: 9, marginBottom: 7 }}>Planning Period</p>
          <select
            value={planningPeriod}
            onChange={e => setPlanningPeriod(e.target.value as PlanningPeriod)}
            style={{
              width: '100%', backgroundColor: 'var(--bg-root)',
              border: '1px solid var(--border-strong)', borderRadius: 9,
              color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans',
              fontSize: 13, padding: '9px 12px', outline: 'none',
            }}
          >
            <option value="1m">1 Month</option>
            <option value="1q">1 Quarter</option>
            <option value="6m">6 Months</option>
            <option value="1y">1 Year</option>
            <option value="custom">Custom range</option>
          </select>
          {planningPeriod === 'custom' && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
              <select value={customStartMonth} onChange={e => setCustomStartMonth(e.target.value)}
                style={{ flex: 1, backgroundColor: 'var(--bg-root)', border: '1px solid var(--border-strong)', borderRadius: 7, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans', fontSize: 10, padding: '6px 8px', outline: 'none' }}>
                {TIMELINE_MONTHS.map(m => <option key={m.key} value={m.key}>{MONTH_NAMES[m.month]} {m.year}</option>)}
              </select>
              <span style={{ ...T.overline, fontSize: 9 }}>to</span>
              <select value={customEndMonth} onChange={e => setCustomEndMonth(e.target.value)}
                style={{ flex: 1, backgroundColor: 'var(--bg-root)', border: '1px solid var(--border-strong)', borderRadius: 7, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans', fontSize: 10, padding: '6px 8px', outline: 'none' }}>
                {TIMELINE_MONTHS.map(m => <option key={m.key} value={m.key}>{MONTH_NAMES[m.month]} {m.year}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Planning Mode */}
        <div>
          <p style={{ ...T.overline, fontSize: 9, marginBottom: 7 }}>Planning Mode</p>
          <div style={{ display: 'flex', gap: 5 }}>
            {(['conservative', 'target', 'aggressive'] as PlanningMode[]).map(m => (
              <button key={m} onClick={() => setPlanningMode(m)} style={{
                fontFamily: 'Outfit', fontSize: 11, fontWeight: 600,
                padding: '8px 11px', borderRadius: 7, cursor: 'pointer', transition: '120ms',
                border: planningMode === m ? '1px solid rgba(232,128,58,0.45)' : '1px solid var(--border-subtle)',
                backgroundColor: planningMode === m ? 'rgba(232,128,58,0.08)' : 'transparent',
                color: planningMode === m ? '#E8803A' : 'var(--text-muted)',
              }}>
                {m === 'conservative' ? 'Conservative' : m === 'aggressive' ? 'Aggressive' : 'Base'}
              </button>
            ))}
          </div>
          <p style={{ ...T.body, fontSize: 11, marginTop: 5 }}>
            {planningMode === 'conservative' ? '0.8× multiplier — downside scenario'
             : planningMode === 'aggressive' ? '1.2× multiplier — upside scenario'
             : '1.0× multiplier — baseline'}
          </p>
        </div>
      </div>

      {/* ── C. KPI Strip ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          {
            label: 'Revenue Forecast',
            value: formatINRCompact(currentPlan.totalPeriodRevenue),
            sub: 'Modeled from current allocation',
            accent: '#60A5FA',
          },
          {
            label: 'Blended ROAS',
            value: `${currentPlan.blendedROAS.toFixed(2)}x`,
            sub: 'Weighted return across the mix',
            accent: '#E8803A',
          },
          {
            label: 'Monthly Budget',
            value: formatINRCompact(monthlyBudget),
            sub: `${durationMonths}mo · ${formatINRCompact(totalPeriodBudget)} total`,
            accent: '#A78BFA',
          },
          {
            label: 'Channels to Review',
            value: flaggedChannels.length === 0 ? 'All healthy' : `${flaggedChannels.length} / 10`,
            sub: flaggedChannels.length === 0
              ? 'No issues detected'
              : `${flaggedChannels.slice(0, 2).join(', ')}${flaggedChannels.length > 2 ? ` +${flaggedChannels.length - 2}` : ''} flagged`,
            accent: flaggedChannels.length === 0 ? '#34D399' : '#FBBF24',
          },
        ].map(kpi => (
          <div key={kpi.label} style={{ ...CARD, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <p style={{ ...T.overline, fontSize: 9 }}>{kpi.label}</p>
            <p style={{
              ...T.num, fontWeight: 800, fontSize: 22,
              color: 'var(--text-primary)', letterSpacing: '-0.025em',
              margin: '6px 0 4px',
            }}>
              {kpi.value}
            </p>
            <p style={{ ...T.body, fontSize: 11, lineHeight: 1.4, flex: 1 }}>{kpi.sub}</p>
            <div style={{ height: 2, backgroundColor: kpi.accent, borderRadius: 1, marginTop: 10, opacity: 0.3 }} />
          </div>
        ))}
      </div>

      {/* ── D. Allocation Table ──────────────────────────────────────────────── */}
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden', backgroundColor: 'var(--bg-card)' }}>

        {/* ── Table toolbar ──────────────────────────────────────────────────── */}
        <div style={{
          padding: '13px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <p style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Allocation
            </p>
            {editMode && (
              <span style={{ ...T.body, fontSize: 11, color: 'var(--text-muted)' }}>
                Drag to adjust · forecast updates on release
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={resetToHistorical}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontFamily: 'Outfit', fontSize: 11, fontWeight: 600,
                padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'transparent', color: 'var(--text-muted)',
                transition: '120ms',
              }}
            >
              <RotateCcw size={10} /> Reset
            </button>

            {!allocOk && editMode && (
              <button
                onClick={normalizeAllocs}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontFamily: 'Outfit', fontSize: 11, fontWeight: 600,
                  padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                  border: `1px solid ${barColor}55`,
                  backgroundColor: `${barColor}0E`,
                  color: barColor, transition: '120ms',
                }}
              >
                <Scale size={10} /> Rebalance
              </button>
            )}

            <button
              onClick={() => setEditMode(e => !e)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: 'Outfit', fontSize: 11, fontWeight: 700,
                padding: '5px 12px', borderRadius: 6, cursor: 'pointer', transition: '120ms',
                border: editMode ? '1px solid rgba(232,128,58,0.5)' : '1px solid var(--border-strong)',
                backgroundColor: editMode ? 'rgba(232,128,58,0.10)' : 'var(--bg-root)',
                color: editMode ? '#E8803A' : 'var(--text-secondary)',
              }}
            >
              <SlidersHorizontal size={11} />
              {editMode ? 'Done' : 'Edit'}
            </button>
          </div>
        </div>

        {/* ── Column headers ──────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: COL,
          padding: '7px 20px', gap: 8,
          backgroundColor: 'var(--bg-root)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {[
            { h: '',                 align: 'left'   },
            { h: 'Channel',          align: 'left'   },
            { h: 'Allocation',       align: 'right'  },
            { h: 'Forecast Spend',   align: 'right'  },
            { h: 'Forecast Revenue', align: 'right'  },
            { h: 'ROAS',             align: 'center' },
            { h: 'Health',           align: 'center' },
          ].map(({ h, align }, i) => (
            <span key={i} style={{ ...T.overline, fontSize: 9, textAlign: align as React.CSSProperties['textAlign'] }}>{h}</span>
          ))}
        </div>

        {/* ── Rows ─────────────────────────────────────────────────────────── */}
        {sortedChannels.map(ch => {
          const color      = CHANNEL_COLORS[CHANNELS.indexOf(ch) % CHANNEL_COLORS.length];
          const row        = currentPlan.channels[ch];
          const diag       = diagnosis[ch];
          const expl       = explanation[ch];
          const status     = (diag?.status || 'efficient') as keyof typeof STATUS_META;
          const st         = STATUS_META[status];
          const isFlagged  = diag?.isFlagged ?? false;
          const isPaused   = paused.has(ch);
          const isExpanded = expandedRows.has(ch);

          const spend   = row?.periodSpend  ?? 0;
          const revenue = row?.periodRevenue ?? 0;
          const roas    = row?.roas          ?? 0;
          const marg    = row?.marginalROAS  ?? 0;
          const margDir = marg >= (roas * 0.9) ? 'healthy' : marg >= 1.0 ? 'weakening' : 'below-breakeven';
          const conf    = expl ? confidenceLabel(expl.efficiencyConfidence) : { text: '', color: 'var(--text-muted)' };

          const livePct = Math.round((localAllocs[ch] || 0) * 100);
          const histPct = Math.round((historicalFractions[ch] || 0) * 100);
          const readPct = (row?.allocationPct ?? 0).toFixed(1);

          return (
            <div
              key={ch}
              style={{
                borderBottom: '1px solid var(--border-subtle)',
                opacity: isPaused ? 0.4 : 1,
                transition: 'opacity 150ms',
                backgroundColor: editMode ? 'rgba(232,128,58,0.012)' : 'transparent',
              }}
            >
              {/* ── Main row ──────────────────────────────────────────────── */}
              <div
                onClick={() => !editMode && toggleRow(ch)}
                style={{
                  display: 'grid', gridTemplateColumns: COL,
                  padding: '11px 20px', gap: 8, alignItems: 'center',
                  cursor: editMode ? 'default' : 'pointer',
                  userSelect: 'none',
                }}
              >
                {/* Expand chevron — only in read mode */}
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                  {!editMode && (isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />)}
                </span>

                {/* Channel name — reason code removed from default view */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    backgroundColor: isFlagged ? st.color : color,
                    flexShrink: 0,
                  }} />
                  <ChannelName channel={ch} style={{
                    fontFamily: 'Plus Jakarta Sans', fontSize: 13, fontWeight: 600,
                    color: 'var(--text-primary)', display: 'block',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }} />
                </div>

                {/* Allocation % — live in edit, committed in read */}
                <div style={{ textAlign: 'right' }}>
                  <p style={{ ...T.num, fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {editMode ? `${livePct}%` : `${readPct}%`}
                  </p>
                  <p style={{ ...T.num, fontSize: 10, color: 'var(--text-muted)', margin: '1px 0 0', opacity: 0.7 }}>
                    {histPct}% hist
                  </p>
                </div>

                {/* Forecast Spend */}
                <p style={{ ...T.num, fontSize: 12, color: 'var(--text-secondary)', margin: 0, textAlign: 'right' }}>
                  {formatINRCompact(spend)}
                </p>

                {/* Forecast Revenue */}
                <p style={{ ...T.num, fontSize: 12, fontWeight: 700, color, margin: 0, textAlign: 'right' }}>
                  {formatINRCompact(revenue)}
                </p>

                {/* ROAS */}
                <p style={{ ...T.num, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: 0, textAlign: 'center' }}>
                  {roas.toFixed(2)}x
                </p>

                {/* Health badge — compact, committed state */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <span style={{
                    fontFamily: 'Outfit', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                    color: st.color, backgroundColor: st.bg,
                    padding: '3px 8px', borderRadius: 4,
                    textTransform: 'uppercase', whiteSpace: 'nowrap',
                  }}>
                    {st.label}
                  </span>
                </div>
              </div>

              {/* ── Edit mode: slider track ────────────────────────────────── */}
              {editMode && (
                <div style={{
                  padding: '0 20px 10px',
                  display: 'grid',
                  gridTemplateColumns: '24px 28px 1fr 40px 44px',
                  gap: 10, alignItems: 'center',
                }}>
                  {/* Active toggle */}
                  <Switch
                    checked={!isPaused}
                    onCheckedChange={() => setPaused(prev => {
                      const n = new Set(prev); n.has(ch) ? n.delete(ch) : n.add(ch); return n;
                    })}
                  />

                  {/* Live % */}
                  <span style={{ ...T.num, fontSize: 11, fontWeight: 700, color: barColor, textAlign: 'right' }}>
                    {livePct}%
                  </span>

                  {/* Slider */}
                  <Slider
                    value={[livePct]}
                    min={0} max={60} step={1}
                    disabled={isPaused}
                    onValueChange={([v]) => {
                      setIsDragging(true);
                      setLocalAllocs(prev => ({ ...prev, [ch]: v / 100 }));
                    }}
                    onValueCommit={([v]) => {
                      setIsDragging(false);
                      setLocalAllocs(prev => ({ ...prev, [ch]: v / 100 }));
                      setAllocations(prev => ({ ...prev, [ch]: v / 100 }));
                    }}
                  />

                  {/* Max label */}
                  <span style={{ ...T.body, fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>60%</span>

                  {/* Historical hint */}
                  <span style={{ ...T.body, fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    hist {histPct}%
                  </span>
                </div>
              )}

              {/* ── Expanded detail (read mode only) ──────────────────────── */}
              {isExpanded && !editMode && (
                <div style={{
                  padding: '4px 20px 16px',
                  borderTop: `1px solid ${st.color}18`,
                  backgroundColor: 'var(--bg-root)',
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>

                    {/* Modeled Outlook */}
                    <div style={{ padding: '12px 14px', backgroundColor: 'var(--bg-card)', borderRadius: 9, border: '1px solid var(--border-subtle)' }}>
                      <p style={{ ...T.overline, fontSize: 9, marginBottom: 10 }}>Modeled Outlook</p>
                      {[
                        { k: 'Monthly spend',  v: formatINRCompact(row?.spend ?? 0) },
                        { k: 'Period revenue', v: formatINRCompact(revenue) },
                        { k: 'Effective ROAS', v: `${roas.toFixed(2)}x` },
                        { k: 'Marginal ROAS',  v: `${marg.toFixed(2)}x` },
                      ].map(({ k, v }) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                          <span style={{ ...T.body, fontSize: 12 }}>{k}</span>
                          <span style={{ ...T.num, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{v}</span>
                        </div>
                      ))}
                      <p style={{ ...T.body, fontSize: 11, lineHeight: 1.5, borderTop: '1px solid var(--border-subtle)', paddingTop: 8, marginTop: 6 }}>
                        {margDir === 'below-breakeven'
                          ? 'Each additional ₹1 spent returns less than ₹1 — marginal return is below breakeven.'
                          : margDir === 'weakening'
                          ? `Marginal return (${marg.toFixed(2)}x) is below channel average — efficiency is declining at this spend level.`
                          : `Marginal return (${marg.toFixed(2)}x) is healthy — further spend should remain productive.`}
                      </p>
                    </div>

                    {/* Performance Signal */}
                    <div style={{ padding: '12px 14px', backgroundColor: 'var(--bg-card)', borderRadius: 9, border: '1px solid var(--border-subtle)' }}>
                      <p style={{ ...T.overline, fontSize: 9, marginBottom: 10 }}>Performance Signal</p>
                      {expl ? (
                        <>
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
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                              <span style={{ ...T.body, fontSize: 12 }}>{k}</span>
                              <span style={{ ...T.num, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{v}</span>
                            </div>
                          ))}
                          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8, marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ ...T.body, fontSize: 12 }}>Data quality</span>
                            <span style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: 700, color: conf.color }}>{conf.text}</span>
                          </div>
                          {expl.isHighVolatility && (
                            <p style={{ ...T.body, fontSize: 11, lineHeight: 1.4, color: '#FBBF24', marginTop: 6 }}>
                              High month-to-month variance — the model moderates outliers before scoring.
                            </p>
                          )}
                        </>
                      ) : (
                        <p style={{ ...T.body, fontSize: 12 }}>No signal data available.</p>
                      )}
                    </div>

                    {/* Timing Effects */}
                    <div style={{ padding: '12px 14px', backgroundColor: 'var(--bg-card)', borderRadius: 9, border: '1px solid var(--border-subtle)' }}>
                      <p style={{ ...T.overline, fontSize: 9, marginBottom: 10 }}>Timing Effects</p>
                      {expl ? (() => {
                        const hasSeason = expl.seasonalityStrength !== 'weak';
                        const hasDow    = expl.dowEffectStrength   !== 'weak';
                        if (!hasSeason && !hasDow)
                          return <p style={{ ...T.body, fontSize: 12 }}>No significant timing patterns detected.</p>;
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {hasSeason && (
                              <p style={{ ...T.body, fontSize: 12, lineHeight: 1.5 }}>
                                Seasonality peak:{' '}
                                <strong style={{ color: 'var(--text-primary)', fontFamily: 'Outfit' }}>{MONTH_NAMES[expl.peakMonth]}</strong>
                                {` (+${Math.round(expl.peakBoost * 100)}% above annual avg) · `}
                                <span style={{ color: expl.seasonalityStrength === 'strong' ? '#34D399' : '#FBBF24' }}>
                                  {expl.seasonalityStrength} signal
                                </span>
                              </p>
                            )}
                            {hasDow && (
                              <p style={{ ...T.body, fontSize: 12, lineHeight: 1.5 }}>
                                Best day:{' '}
                                <strong style={{ color: 'var(--text-primary)', fontFamily: 'Outfit' }}>{DOW_NAMES[expl.bestDay]}</strong>
                                {` (+${Math.round((expl.dowIndex[expl.bestDay] - 1) * 100)}% above weekly avg)`}
                                {expl.weekendBias !== 'neutral' ? ` · ${expl.weekendBias === 'weekend' ? 'weekend' : 'weekday'} bias` : ''}
                              </p>
                            )}
                          </div>
                        );
                      })() : (
                        <p style={{ ...T.body, fontSize: 12 }}>Timing data not available.</p>
                      )}
                    </div>

                    {/* Assessment */}
                    <div style={{ padding: '12px 14px', backgroundColor: 'var(--bg-card)', borderRadius: 9, border: `1px solid ${st.color}20` }}>
                      <p style={{ ...T.overline, fontSize: 9, marginBottom: 8 }}>Assessment</p>
                      <p style={{ ...T.body, fontSize: 12, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                        {diag?.explanation || `${ch} is operating within a normal efficiency range.`}
                      </p>
                      {diag?.reasonCode && diag.reasonCode !== 'Efficient allocation' && (
                        <span style={{
                          display: 'inline-block', marginTop: 9,
                          fontFamily: 'Outfit', fontSize: 9, fontWeight: 700,
                          color: st.color, backgroundColor: st.bg,
                          padding: '3px 8px', borderRadius: 4,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
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

        {/* ── Total allocation footer ─────────────────────────────────────── */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-root)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          {/* Progress bar */}
          <div style={{ flex: 1, height: 4, borderRadius: 3, backgroundColor: 'var(--border-strong)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(localTotalPct, 100)}%`,
              backgroundColor: barColor, borderRadius: 3, opacity: 0.7,
              transition: isDragging ? 'none' : 'width 200ms ease, background-color 200ms ease',
            }} />
          </div>

          {/* Total % */}
          <span style={{ ...T.num, fontSize: 13, fontWeight: 800, color: barColor, letterSpacing: '-0.01em', flexShrink: 0 }}>
            {localTotalPct}%
          </span>

          {/* Status text */}
          <span style={{ ...T.body, fontSize: 11, flexShrink: 0, color: allocOk ? '#34D399' : 'var(--text-muted)' }}>
            {allocOk
              ? 'Allocation valid'
              : remaining > 0
              ? `${remaining}pp unassigned`
              : `${Math.abs(remaining)}pp over`}
          </span>
        </div>
      </div>

      {/* ── E. Mix Assessment ────────────────────────────────────────────────── */}
      <div style={{ ...CARD }}>
        <p style={{ ...T.overline, marginBottom: 16 }}>Mix Assessment</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <TrendingUp size={11} color="#34D399" />
              <p style={{ ...T.label, color: '#34D399' }}>Strongest channels</p>
            </div>
            {topChannels.map(ch => {
              const ex  = explanation[ch];
              const r   = currentPlan.channels[ch];
              return (
                <div key={ch} style={{ paddingBottom: 7, marginBottom: 7, borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ChannelName channel={ch} style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }} />
                    <span style={{ ...T.num, fontSize: 12, fontWeight: 700, color: '#34D399' }}>
                      {(ex?.tunedROAS ?? r?.roas ?? 0).toFixed(2)}x
                    </span>
                  </div>
                  <p style={{ ...T.body, fontSize: 11, marginTop: 1 }}>
                    {(r?.allocationPct ?? 0).toFixed(1)}% · {formatINRCompact(r?.periodRevenue ?? 0)}
                  </p>
                </div>
              );
            })}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              {flaggedChannels.length > 0 ? <Activity size={11} color="#FBBF24" /> : <TrendingUp size={11} color="#34D399" />}
              <p style={{ ...T.label, color: flaggedChannels.length > 0 ? '#FBBF24' : '#34D399' }}>
                Channels to review
              </p>
            </div>
            {flaggedChannels.length === 0 ? (
              <p style={{ ...T.body, fontSize: 12 }}>All channels within efficient ranges.</p>
            ) : flaggedChannels.map(ch => {
              const d  = diagnosis[ch];
              const st = STATUS_META[(d?.status || 'efficient') as keyof typeof STATUS_META] ?? STATUS_META.efficient;
              return (
                <div key={ch} style={{ paddingBottom: 7, marginBottom: 7, borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ChannelName channel={ch} style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }} />
                    <span style={{ fontFamily: 'Outfit', fontSize: 9, fontWeight: 700, color: st.color, backgroundColor: st.bg, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase' as const }}>
                      {st.label}
                    </span>
                  </div>
                  <p style={{ ...T.body, fontSize: 11, marginTop: 2 }}>{d?.reasonCode}</p>
                </div>
              );
            })}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <Minus size={11} color="var(--text-muted)" />
              <p style={{ ...T.label }}>Strategic takeaway</p>
            </div>
            <p style={{ ...T.body, fontSize: 13, lineHeight: 1.7 }}>
              {'Current mix is forecast at '}
              <strong style={{ color: 'var(--text-primary)', fontFamily: 'Outfit' }}>
                {formatINRCompact(currentPlan.totalPeriodRevenue)}
              </strong>
              {' at '}
              <strong style={{ color: 'var(--text-primary)', fontFamily: 'Outfit' }}>
                {currentPlan.blendedROAS.toFixed(2)}x
              </strong>
              {' ROAS. '}
              {efficientCount === CHANNELS.length
                ? `All ${CHANNELS.length} channels are within efficient ranges.`
                : flaggedChannels.length === 1
                ? `${CHANNELS.length - 1} channels look healthy; ${flaggedChannels[0]} needs attention.`
                : `${efficientCount} of ${CHANNELS.length} channels appear balanced — ${flaggedChannels.length} need review.`}
            </p>
          </div>
        </div>
      </div>

      {/* ── F. CTA ───────────────────────────────────────────────────────────── */}
      <div style={{
        ...CARD,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 20, flexWrap: 'wrap' as const,
        borderColor: 'rgba(232,128,58,0.18)', padding: '18px 22px',
      }}>
        <div>
          <p style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Ready to explore the recommendation?
          </p>
          <p style={{ ...T.body, fontSize: 12, marginTop: 4 }}>
            The next step shows how the model would redistribute this budget to improve projected return.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexShrink: 0 }}>
          <Link to="/optimizer/diagnosis" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 15px', borderRadius: 9,
            border: '1px solid var(--border-strong)',
            backgroundColor: 'var(--bg-root)', color: 'var(--text-secondary)',
            fontFamily: 'Outfit', fontSize: 12, fontWeight: 600, textDecoration: 'none',
          }}>
            Open Diagnosis
          </Link>
          <Link to="/optimizer/recommended" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '10px 18px', borderRadius: 9,
            background: 'linear-gradient(135deg, #E8803A, #FBBF24)',
            color: '#000', fontFamily: 'Outfit', fontSize: 13, fontWeight: 700,
            textDecoration: 'none', whiteSpace: 'nowrap' as const,
          }}>
            See Recommended Mix <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
