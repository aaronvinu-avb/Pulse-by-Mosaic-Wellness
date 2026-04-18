/**
 * CurrentMix — Page 1 of Mix Optimiser
 *
 * INTERACTION MODEL:
 *   Main table  = read-first analytical surface (no inline sliders)
 *   Edit drawer = focused right-panel that opens on "Adjust" click
 *
 * STATE LAYERS:
 *   allocations (context)  — committed state, drives model recompute
 *   pendingAllocs          — live drawer edits, committed only on Save
 *
 * DATA CONTRACT (current state only):
 *   currentPlan, historicalFractions, diagnosis, flaggedChannels,
 *   explanation, durationMonths, monthlyBudget, totalPeriodBudget,
 *   dataRange, dataSource, dataUpdatedAt, totalHistoricalMonths
 */

import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { useOptimizerModel } from '@/hooks/useOptimizerModel';
import { useOptimizer } from '@/contexts/OptimizerContext';
import { formatINRCompact } from '@/lib/formatCurrency';
import { CHANNELS, CHANNEL_COLORS } from '@/lib/mockData';
import { ChannelName } from '@/components/ChannelName';
import { Slider } from '@/components/ui/slider';
import {
  ArrowRight, TrendingUp, Activity, Minus, Info,
  ChevronDown, X, RotateCcw, Scale, SlidersHorizontal,
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
  num: { fontFamily: 'Outfit' as const, fontVariantNumeric: 'tabular-nums' as const },
};

const CARD: React.CSSProperties = {
  padding: '20px 24px',
  border: '1px solid var(--border-subtle)',
  borderRadius: 14,
  backgroundColor: 'var(--bg-card)',
};

// Main table grid — 6 data columns + action
const COL = 'minmax(160px,1fr) 70px 90px 96px 52px 96px 56px';

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

const TIMELINE_MONTHS = (() => {
  const s = 2023, e = 2027;
  return Array.from({ length: (e - s + 1) * 12 }, (_, i) => {
    const y = s + Math.floor(i / 12), mo = i % 12;
    return { key: `${y}-${String(mo + 1).padStart(2, '0')}`, year: y, month: mo };
  });
})();

function confidenceLabel(score: number): { text: string; color: string } {
  if (score >= 0.70) return { text: 'Strong signal',   color: '#34D399' };
  if (score >= 0.38) return { text: 'Moderate signal', color: '#FBBF24' };
  return               { text: 'Thin data',           color: '#94a3b8' };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CurrentMix() {
  const {
    isLoading, dataSource, dataUpdatedAt, dataRange, totalHistoricalMonths,
    currentPlan, historicalFractions, diagnosis, flaggedChannels,
    durationMonths, monthlyBudget, totalPeriodBudget, explanation,
  } = useOptimizerModel();

  const {
    budget, setBudget,
    planningPeriod, setPlanningPeriod,
    planningMode, setPlanningMode,
    customStartMonth, setCustomStartMonth,
    customEndMonth, setCustomEndMonth,
    allocations, setAllocations,
  } = useOptimizer();

  // ── UI state ────────────────────────────────────────────────────────────────
  const [showForecastDetails, setShowForecastDetails] = useState(false);

  // ── Edit drawer state ────────────────────────────────────────────────────────
  // pendingAllocs mirrors all channel allocations while the drawer is open.
  // Changes only commit to context on Save — table stays stable during editing.
  const [drawerChannel, setDrawerChannel]   = useState<string | null>(null);
  const [pendingAllocs, setPendingAllocs]   = useState<Record<string, number>>({});

  const openDrawer = useCallback((ch: string) => {
    setPendingAllocs({ ...allocations });
    setDrawerChannel(ch);
  }, [allocations]);

  const closeDrawer = useCallback(() => setDrawerChannel(null), []);

  const saveAllocation = useCallback(() => {
    setAllocations({ ...pendingAllocs });
    setDrawerChannel(null);
  }, [pendingAllocs, setAllocations]);

  const resetChannelToHistorical = useCallback((ch: string) => {
    setPendingAllocs(prev => ({ ...prev, [ch]: historicalFractions[ch] ?? 0 }));
  }, [historicalFractions]);

  const normalizeAllocs = useCallback(() => {
    const total = Object.values(pendingAllocs).reduce((s, v) => s + v, 0);
    if (total === 0) return;
    setPendingAllocs(Object.fromEntries(
      Object.entries(pendingAllocs).map(([ch, v]) => [ch, v / total])
    ));
  }, [pendingAllocs]);

  // ── Derived values ───────────────────────────────────────────────────────────
  const safeBudget = Number.isFinite(budget) && budget > 0 ? budget : 5_000_000;

  const pendingTotal    = Object.values(pendingAllocs).reduce((s, v) => s + v, 0);
  const pendingTotalPct = Math.round(pendingTotal * 100);
  const pendingOk       = Math.abs(pendingTotal - 1) < 0.015;
  const pendingRemaining = Math.round((1 - pendingTotal) * 100);
  const drawerBarColor  = pendingOk ? '#34D399' : Math.abs(pendingTotal - 1) < 0.08 ? '#FBBF24' : '#F87171';

  const sortedChannels = useMemo(() =>
    [...CHANNELS].sort((a, b) => {
      const sa = STATUS_ORDER[diagnosis[a]?.status ?? 'efficient'] ?? 3;
      const sb = STATUS_ORDER[diagnosis[b]?.status ?? 'efficient'] ?? 3;
      if (sa !== sb) return sa - sb;
      return (currentPlan.channels[b]?.periodRevenue || 0) - (currentPlan.channels[a]?.periodRevenue || 0);
    }),
  [diagnosis, currentPlan]);

  const topChannels = useMemo(() =>
    [...CHANNELS]
      .filter(ch => explanation[ch])
      .sort((a, b) => (explanation[b]?.tunedROAS || 0) - (explanation[a]?.tunedROAS || 0))
      .slice(0, 3),
  [explanation]);

  const efficientCount = CHANNELS.filter(ch => !diagnosis[ch]?.isFlagged).length;

  if (isLoading) return <DashboardSkeleton />;

  // ── Drawer channel data ──────────────────────────────────────────────────────
  const dCh      = drawerChannel;
  const dColor   = dCh ? CHANNEL_COLORS[CHANNELS.indexOf(dCh) % CHANNEL_COLORS.length] : '#E8803A';
  const dExpl    = dCh ? explanation[dCh]   : null;
  const dDiag    = dCh ? diagnosis[dCh]     : null;
  const dRow     = dCh ? currentPlan.channels[dCh] : null;
  const dStatus  = ((dDiag?.status || 'efficient') as keyof typeof STATUS_META);
  const dSt      = STATUS_META[dStatus];
  const dPct     = dCh ? Math.round((pendingAllocs[dCh] || 0) * 100) : 0;
  const dHistPct = dCh ? Math.round((historicalFractions[dCh] || 0) * 100) : 0;
  const dDelta   = dPct - dHistPct;
  const dSpend   = dCh ? safeBudget * (pendingAllocs[dCh] || 0) : 0;
  const dConf    = dExpl ? confidenceLabel(dExpl.efficiencyConfidence) : { text: '', color: 'var(--text-muted)' };

  return (
    <div style={{ maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── A. Header ─────────────────────────────────────────────────────── */}
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
          <Info size={10} />
          Forecast details
          <ChevronDown size={9} style={{ transform: showForecastDetails ? 'rotate(180deg)' : 'none', transition: '150ms' }} />
        </button>
      </div>

      {showForecastDetails && (
        <div style={{
          padding: '10px 14px', borderRadius: 9,
          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center',
        }}>
          {[
            { k: 'Method',    v: 'Tuned signals · diminishing returns · timing effects' },
            { k: 'History',   v: `${Math.round(totalHistoricalMonths)} months` },
            dataRange ? { k: 'Range', v: `${dataRange.min} → ${dataRange.max}` } : null,
            { k: 'Source',    v: dataSource === 'api' ? 'Live API' : dataSource === 'cached' ? 'Cached' : 'Sample data' },
            dataUpdatedAt ? { k: 'Updated', v: new Date(dataUpdatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) } : null,
          ].filter(Boolean).map(item => item && (
            <div key={item.k} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ ...T.overline, fontSize: 9 }}>{item.k}</span>
              <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-secondary)' }}>{item.v}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── B. Controls ───────────────────────────────────────────────────── */}
      <div style={{
        ...CARD, padding: '16px 20px',
        display: 'grid',
        gridTemplateColumns: 'minmax(180px,240px) minmax(160px,220px) auto',
        gap: 20, alignItems: 'start',
      }}>
        {/* Budget */}
        <div>
          <p style={{ ...T.overline, fontSize: 9, marginBottom: 7 }}>Monthly Budget</p>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            backgroundColor: 'var(--bg-root)', border: '1px solid var(--border-strong)',
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

        {/* Period */}
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

        {/* Mode */}
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
            {planningMode === 'conservative' ? '0.8× — downside scenario'
             : planningMode === 'aggressive' ? '1.2× — upside scenario'
             : '1.0× — baseline forecast'}
          </p>
        </div>
      </div>

      {/* ── C. KPI Strip ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { label: 'Revenue Forecast',   value: formatINRCompact(currentPlan.totalPeriodRevenue), sub: 'Modeled from current allocation',       accent: '#60A5FA' },
          { label: 'Blended ROAS',       value: `${currentPlan.blendedROAS.toFixed(2)}x`,         sub: 'Weighted return across the mix',          accent: '#E8803A' },
          { label: 'Monthly Budget',     value: formatINRCompact(monthlyBudget),                   sub: `${durationMonths}mo · ${formatINRCompact(totalPeriodBudget)} total`, accent: '#A78BFA' },
          {
            label: 'Channels to Review',
            value: flaggedChannels.length === 0 ? 'All healthy' : `${flaggedChannels.length} / 10`,
            sub: flaggedChannels.length === 0 ? 'No issues detected'
              : `${flaggedChannels.slice(0, 2).join(', ')}${flaggedChannels.length > 2 ? ` +${flaggedChannels.length - 2}` : ''} flagged`,
            accent: flaggedChannels.length === 0 ? '#34D399' : '#FBBF24',
          },
        ].map(kpi => (
          <div key={kpi.label} style={{ ...CARD, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <p style={{ ...T.overline, fontSize: 9 }}>{kpi.label}</p>
            <p style={{ ...T.num, fontWeight: 800, fontSize: 22, color: 'var(--text-primary)', letterSpacing: '-0.025em', margin: '6px 0 4px' }}>
              {kpi.value}
            </p>
            <p style={{ ...T.body, fontSize: 11, lineHeight: 1.4, flex: 1 }}>{kpi.sub}</p>
            <div style={{ height: 2, backgroundColor: kpi.accent, borderRadius: 1, marginTop: 10, opacity: 0.3 }} />
          </div>
        ))}
      </div>

      {/* ── D. Allocation Block ──────────────────────────────────────────────── */}
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 14, backgroundColor: 'var(--bg-card)' }}>

        {/* Toolbar */}
        <div style={{
          padding: '13px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          borderRadius: '14px 14px 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <p style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Allocation
            </p>
            <span style={{ ...T.body, fontSize: 11 }}>
              Click <strong style={{ fontFamily: 'Outfit', color: 'var(--text-secondary)' }}>Adjust</strong> on any row to edit
            </span>
          </div>
          {drawerChannel && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: dColor }} />
              <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                {drawerChannel} — editing
              </span>
            </div>
          )}
        </div>

        {/* Table + Drawer side by side */}
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>

          {/* ── Main table ───────────────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Column headers */}
            <div style={{
              display: 'grid', gridTemplateColumns: COL,
              padding: '7px 20px', gap: 8,
              backgroundColor: 'var(--bg-root)',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              {[
                { h: 'Channel',          align: 'left'   },
                { h: 'Allocation',       align: 'right'  },
                { h: 'Forecast Spend',   align: 'right'  },
                { h: 'Forecast Revenue', align: 'right'  },
                { h: 'ROAS',             align: 'center' },
                { h: 'Health',           align: 'center' },
                { h: '',                 align: 'center' },
              ].map(({ h, align }, i) => (
                <span key={i} style={{ ...T.overline, fontSize: 9, textAlign: align as React.CSSProperties['textAlign'] }}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            {sortedChannels.map(ch => {
              const color     = CHANNEL_COLORS[CHANNELS.indexOf(ch) % CHANNEL_COLORS.length];
              const row       = currentPlan.channels[ch];
              const diag      = diagnosis[ch];
              const status    = (diag?.status || 'efficient') as keyof typeof STATUS_META;
              const st        = STATUS_META[status];
              const isSelected = drawerChannel === ch;

              const spend   = row?.periodSpend  ?? 0;
              const revenue = row?.periodRevenue ?? 0;
              const roas    = row?.roas          ?? 0;
              const allocPct = (row?.allocationPct ?? 0).toFixed(1);

              return (
                <div key={ch} style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: isSelected ? `${dColor}08` : 'transparent',
                  borderLeft: isSelected ? `2px solid ${dColor}` : '2px solid transparent',
                  transition: 'background-color 150ms',
                }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: COL,
                    padding: '11px 20px', gap: 8, alignItems: 'center',
                  }}>
                    {/* Channel */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                      <ChannelName channel={ch} style={{
                        fontFamily: 'Plus Jakarta Sans', fontSize: 13, fontWeight: 600,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }} />
                    </div>

                    {/* Allocation */}
                    <p style={{ ...T.num, fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0, textAlign: 'right' }}>
                      {allocPct}%
                    </p>

                    {/* Spend */}
                    <p style={{ ...T.num, fontSize: 12, color: 'var(--text-secondary)', margin: 0, textAlign: 'right' }}>
                      {formatINRCompact(spend)}
                    </p>

                    {/* Revenue */}
                    <p style={{ ...T.num, fontSize: 12, fontWeight: 700, color, margin: 0, textAlign: 'right' }}>
                      {formatINRCompact(revenue)}
                    </p>

                    {/* ROAS */}
                    <p style={{ ...T.num, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: 0, textAlign: 'center' }}>
                      {roas.toFixed(2)}x
                    </p>

                    {/* Health badge */}
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

                    {/* Adjust action */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <button
                        onClick={() => isSelected ? closeDrawer() : openDrawer(ch)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontFamily: 'Outfit', fontSize: 10, fontWeight: 600,
                          padding: '4px 9px', borderRadius: 5, cursor: 'pointer', transition: '120ms',
                          border: isSelected
                            ? `1px solid ${dColor}55`
                            : '1px solid var(--border-subtle)',
                          backgroundColor: isSelected ? `${dColor}12` : 'transparent',
                          color: isSelected ? dColor : 'var(--text-muted)',
                        }}
                      >
                        <SlidersHorizontal size={9} />
                        {isSelected ? 'Close' : 'Adjust'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Table footer — committed total */}
            <div style={{
              padding: '10px 20px',
              borderTop: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-root)',
              borderRadius: drawerChannel ? '0' : '0 0 14px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ ...T.overline, fontSize: 9 }}>Total</span>
              <div style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'var(--border-strong)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '100%', backgroundColor: '#34D399', opacity: 0.4, borderRadius: 2 }} />
              </div>
              <span style={{ ...T.num, fontSize: 12, fontWeight: 800, color: '#34D399' }}>100%</span>
              <span style={{ ...T.body, fontSize: 11, color: '#34D399' }}>Committed</span>
            </div>
          </div>

          {/* ── Edit Drawer ──────────────────────────────────────────────── */}
          {drawerChannel && dCh && (
            <div style={{
              width: 296,
              flexShrink: 0,
              borderLeft: '1px solid var(--border-strong)',
              display: 'flex',
              flexDirection: 'column',
              alignSelf: 'stretch',
              borderRadius: '0 0 14px 0',
            }}>

              {/* Drawer header */}
              <div style={{
                padding: '13px 16px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dColor }} />
                  <ChannelName channel={dCh} style={{
                    fontFamily: 'Plus Jakarta Sans', fontSize: 14, fontWeight: 700,
                    color: 'var(--text-primary)',
                  }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontFamily: 'Outfit', fontSize: 9, fontWeight: 700,
                    color: dSt.color, backgroundColor: dSt.bg,
                    padding: '3px 8px', borderRadius: 4,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {dSt.label}
                  </span>
                  <button
                    onClick={closeDrawer}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                      color: 'var(--text-muted)', borderRadius: 5,
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Drawer body — scrollable */}
              <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>

                {/* Allocation control */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
                    <p style={{ ...T.overline, fontSize: 9 }}>Allocation</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                      <span style={{ ...T.num, fontSize: 30, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1 }}>
                        {dPct}%
                      </span>
                      {dDelta !== 0 && (
                        <span style={{
                          fontFamily: 'Outfit', fontSize: 11, fontWeight: 700,
                          color: dDelta > 0 ? '#34D399' : '#F87171',
                        }}>
                          {dDelta > 0 ? '+' : ''}{dDelta}pp
                        </span>
                      )}
                    </div>
                  </div>

                  <Slider
                    value={[dPct]}
                    min={0} max={60} step={1}
                    onValueChange={([v]) =>
                      setPendingAllocs(prev => ({ ...prev, [dCh]: v / 100 }))
                    }
                    onValueCommit={() => {}}
                  />

                  {/* Scale labels */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 7 }}>
                    <span style={{ ...T.body, fontSize: 10 }}>0%</span>
                    <button
                      onClick={() => resetChannelToHistorical(dCh)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: 'none', border: '1px solid var(--border-subtle)',
                        borderRadius: 5, padding: '2px 7px', cursor: 'pointer',
                        fontFamily: 'Outfit', fontSize: 9, fontWeight: 600, color: 'var(--text-muted)',
                      }}
                    >
                      <RotateCcw size={8} /> hist. {dHistPct}%
                    </button>
                    <span style={{ ...T.body, fontSize: 10 }}>60%</span>
                  </div>
                </div>

                {/* Spend preview */}
                <div style={{
                  padding: '10px 12px', backgroundColor: 'var(--bg-root)',
                  borderRadius: 8, border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ ...T.body, fontSize: 12 }}>Monthly spend</span>
                    <span style={{ ...T.num, fontSize: 13, fontWeight: 800, color: dColor }}>
                      {formatINRCompact(dSpend)}
                    </span>
                  </div>
                  <p style={{ ...T.body, fontSize: 11, marginTop: 4, lineHeight: 1.4, opacity: 0.75 }}>
                    Revenue forecast updates after saving.
                  </p>
                </div>

                {/* Efficiency context */}
                {dExpl && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderRadius: 8, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                    {[
                      { k: 'Tuned ROAS',       v: `${dExpl.tunedROAS.toFixed(2)}x` },
                      { k: 'Portfolio median', v: `${dExpl.portfolioROAS.toFixed(2)}x` },
                      { k: 'ROAS at current',  v: `${dRow?.roas?.toFixed(2) ?? '—'}x` },
                      { k: 'Marginal ROAS',    v: `${dRow?.marginalROAS?.toFixed(2) ?? '—'}x` },
                    ].map(({ k, v }, i) => (
                      <div key={k} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '7px 12px',
                        backgroundColor: i % 2 === 0 ? 'var(--bg-root)' : 'transparent',
                      }}>
                        <span style={{ ...T.body, fontSize: 11 }}>{k}</span>
                        <span style={{ ...T.num, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{v}</span>
                      </div>
                    ))}
                    <div style={{ padding: '7px 12px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)' }}>
                      <span style={{ ...T.body, fontSize: 11 }}>Signal quality</span>
                      <span style={{ fontFamily: 'Outfit', fontSize: 10, fontWeight: 700, color: dConf.color }}>{dConf.text}</span>
                    </div>
                  </div>
                )}

                {/* Timing note */}
                {dExpl && (dExpl.seasonalityStrength !== 'weak' || dExpl.dowEffectStrength !== 'weak') && (
                  <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-root)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <p style={{ ...T.overline, fontSize: 9, marginBottom: 7 }}>Timing</p>
                    {dExpl.seasonalityStrength !== 'weak' && (
                      <p style={{ ...T.body, fontSize: 11, lineHeight: 1.5, marginBottom: 5 }}>
                        Peak month:{' '}
                        <strong style={{ color: 'var(--text-primary)', fontFamily: 'Outfit' }}>{MONTH_NAMES[dExpl.peakMonth]}</strong>
                        {` (+${Math.round(dExpl.peakBoost * 100)}%) · `}
                        <span style={{ color: dExpl.seasonalityStrength === 'strong' ? '#34D399' : '#FBBF24' }}>
                          {dExpl.seasonalityStrength}
                        </span>
                      </p>
                    )}
                    {dExpl.dowEffectStrength !== 'weak' && (
                      <p style={{ ...T.body, fontSize: 11, lineHeight: 1.5 }}>
                        Best day:{' '}
                        <strong style={{ color: 'var(--text-primary)', fontFamily: 'Outfit' }}>{DOW_NAMES[dExpl.bestDay]}</strong>
                        {dExpl.weekendBias !== 'neutral' ? ` · ${dExpl.weekendBias} bias` : ''}
                      </p>
                    )}
                  </div>
                )}

                {/* Assessment */}
                {dDiag && (
                  <div>
                    <p style={{ ...T.overline, fontSize: 9, marginBottom: 7 }}>Assessment</p>
                    <p style={{ ...T.body, fontSize: 12, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                      {dDiag.explanation || `${dCh} is operating within a normal efficiency range.`}
                    </p>
                    {dDiag.reasonCode && dDiag.reasonCode !== 'Efficient allocation' && (
                      <span style={{
                        display: 'inline-block', marginTop: 8,
                        fontFamily: 'Outfit', fontSize: 9, fontWeight: 700,
                        color: dSt.color, backgroundColor: dSt.bg,
                        padding: '3px 8px', borderRadius: 4,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {dDiag.reasonCode}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Drawer footer — portfolio summary + actions */}
              <div style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--border-strong)',
                flexShrink: 0,
                backgroundColor: 'var(--bg-root)',
                borderRadius: '0 0 14px 0',
              }}>
                {/* Portfolio total */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ ...T.overline, fontSize: 9 }}>Portfolio total</span>
                    <span style={{ ...T.num, fontSize: 12, fontWeight: 800, color: drawerBarColor }}>
                      {pendingTotalPct}%
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, backgroundColor: 'var(--border-strong)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(pendingTotalPct, 100)}%`,
                      backgroundColor: drawerBarColor, opacity: 0.65, borderRadius: 2,
                      transition: 'width 80ms ease, background-color 150ms ease',
                    }} />
                  </div>
                  {!pendingOk && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <span style={{ ...T.body, fontSize: 11, color: drawerBarColor }}>
                        {pendingRemaining > 0 ? `${pendingRemaining}pp unassigned` : `${Math.abs(pendingRemaining)}pp over`}
                      </span>
                      <button
                        onClick={normalizeAllocs}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontFamily: 'Outfit', fontSize: 9, fontWeight: 700,
                          padding: '3px 8px', borderRadius: 5, cursor: 'pointer',
                          border: `1px solid ${drawerBarColor}44`,
                          backgroundColor: `${drawerBarColor}0D`,
                          color: drawerBarColor,
                        }}
                      >
                        <Scale size={9} /> Rebalance
                      </button>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={closeDrawer}
                    style={{
                      flex: 1, fontFamily: 'Outfit', fontSize: 11, fontWeight: 600,
                      padding: '8px 0', borderRadius: 7, cursor: 'pointer',
                      border: '1px solid var(--border-strong)',
                      backgroundColor: 'transparent', color: 'var(--text-secondary)',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveAllocation}
                    style={{
                      flex: 2, fontFamily: 'Outfit', fontSize: 12, fontWeight: 700,
                      padding: '8px 0', borderRadius: 7, cursor: 'pointer',
                      border: 'none',
                      background: 'linear-gradient(135deg, #E8803A, #FBBF24)',
                      color: '#000',
                    }}
                  >
                    Save changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── E. Mix Assessment ─────────────────────────────────────────────── */}
      <div style={{ ...CARD }}>
        <p style={{ ...T.overline, marginBottom: 16 }}>Mix Assessment</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <TrendingUp size={11} color="#34D399" />
              <p style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: 600, color: '#34D399', margin: 0 }}>Strongest channels</p>
            </div>
            {topChannels.map(ch => {
              const ex = explanation[ch];
              const r  = currentPlan.channels[ch];
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
              {flaggedChannels.length > 0
                ? <Activity size={11} color="#FBBF24" />
                : <TrendingUp size={11} color="#34D399" />}
              <p style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: 600, color: flaggedChannels.length > 0 ? '#FBBF24' : '#34D399', margin: 0 }}>
                Channels to review
              </p>
            </div>
            {flaggedChannels.length === 0
              ? <p style={{ ...T.body, fontSize: 12 }}>All channels within efficient ranges.</p>
              : flaggedChannels.map(ch => {
                  const d  = diagnosis[ch];
                  const st = STATUS_META[(d?.status || 'efficient') as keyof typeof STATUS_META];
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
              <p style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', margin: 0 }}>Strategic takeaway</p>
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

      {/* ── F. CTA ────────────────────────────────────────────────────────── */}
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
