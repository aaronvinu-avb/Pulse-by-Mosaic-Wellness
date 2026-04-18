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
} from '@/lib/calculations';
import { formatINRCompact } from '@/lib/formatCurrency';
import { ArrowLeft, TrendingDown } from 'lucide-react';

// ── Design tokens ────────────────────────────────────────────────────────────

const T = {
  overline: { fontFamily: 'Outfit' as const, fontSize: 10, fontWeight: 600 as const, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: 0 },
  value:    { fontFamily: 'Outfit' as const, fontWeight: 700 as const, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 },
  helper:   { fontFamily: 'Plus Jakarta Sans' as const, fontSize: 13, fontWeight: 400 as const, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 },
};
const CARD = { padding: '20px 24px', border: '1px solid var(--border-subtle)', borderRadius: 14, backgroundColor: 'var(--bg-card)' };

// ── Scenario tiers ────────────────────────────────────────────────────────────

const TIERS = [
  { key: 'conservative', label: 'Conservative', monthlyMultiplier: 0.6, color: '#60A5FA', note: '₹30L/mo baseline' },
  { key: 'current',      label: 'Current',       monthlyMultiplier: 1.0, color: '#FBBF24', note: '₹50L/mo baseline' },
  { key: 'growth',       label: 'Growth',        monthlyMultiplier: 1.3, color: '#34D399', note: '₹65L/mo baseline' },
  { key: 'aggressive',   label: 'Aggressive',    monthlyMultiplier: 1.5, color: '#E8803A', note: '₹75L/mo baseline' },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BudgetScenarios() {
  const { data, aggregate, globalAggregate, isLoading } = useMarketingData({ includeGlobalAggregate: true });
  const {
    budget, planningPeriod, planningMode, customStartMonth, customEndMonth,
  } = useOptimizer();

  const safeBudget     = Number.isFinite(budget) && budget > 0 ? budget : 5000000;
  const modeMultiplier = planningMode === 'conservative' ? 0.8 : planningMode === 'aggressive' ? 1.2 : 1.0;

  const summaries = useMemo(
    () => (aggregate || data) ? getChannelSummaries(aggregate || data!) : [],
    [data, aggregate]
  );
  const models = useMemo(
    () => (globalAggregate || data) ? getChannelSaturationModels(globalAggregate || data!) : [],
    [data, globalAggregate]
  );

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

  // ── Scenario results ────────────────────────────────────────────────────
  const scenarioResults = useMemo(
    () => TIERS.map((tier) => {
      const tierBudget = Math.round(safeBudget * tier.monthlyMultiplier / 1000) * 1000;
      const shares = getOptimalSharesForPeriod({
        data: globalAggregate || data || [],
        selectedMonths: selectedRange,
        monthlyBudget: tierBudget,
      });
      const plan = buildMonthlyPlanFromData({
        data: globalAggregate || data || [],
        selectedMonths: selectedRange,
        monthlyBudget: tierBudget,
        modeMultiplier,
        allocationShares: shares,
        saturationModels: models,
      });
      const periodBudget  = tierBudget * durationMonths;
      const periodRevenue = plan.totalRevenue;
      const roas          = periodBudget > 0 ? periodRevenue / periodBudget : 0;
      return { ...tier, tierBudget, periodBudget, periodRevenue, roas };
    }),
    [globalAggregate, data, selectedRange, safeBudget, modeMultiplier, models, durationMonths]
  );

  // ── Marginal ROAS between tiers ─────────────────────────────────────────
  const marginalNotes = useMemo(() => {
    const notes: { from: string; to: string; marginal: number }[] = [];
    for (let i = 0; i < scenarioResults.length - 1; i++) {
      const a = scenarioResults[i], b = scenarioResults[i + 1];
      const extraBudget  = b.periodBudget - a.periodBudget;
      const extraRevenue = b.periodRevenue - a.periodRevenue;
      if (extraBudget > 0) {
        notes.push({ from: a.label, to: b.label, marginal: extraRevenue / extraBudget });
      }
    }
    return notes;
  }, [scenarioResults]);

  // ── Interpretive summary ────────────────────────────────────────────────
  const baselineResult    = scenarioResults.find((s) => s.key === 'current');
  const aggressiveResult  = scenarioResults.find((s) => s.key === 'aggressive');
  const conservativeResult = scenarioResults.find((s) => s.key === 'conservative');

  const summaryText = useMemo(() => {
    if (!baselineResult || !aggressiveResult || !conservativeResult) return '';
    const extraBudget  = aggressiveResult.periodBudget - baselineResult.periodBudget;
    const extraRevenue = aggressiveResult.periodRevenue - baselineResult.periodRevenue;
    const margROAS     = extraBudget > 0 ? extraRevenue / extraBudget : 0;
    const baseROAS     = baselineResult.roas;
    const roasDropPct  = baseROAS > 0 ? ((baseROAS - aggressiveResult.roas) / baseROAS * 100) : 0;
    return `Increasing from ${formatINRCompact(baselineResult.tierBudget)}/mo to ${formatINRCompact(aggressiveResult.tierBudget)}/mo ` +
      `generates ${formatINRCompact(extraRevenue)} in additional revenue over the period, ` +
      `at a marginal ROAS of ${margROAS.toFixed(2)}x — ` +
      `${roasDropPct > 0 ? `${Math.round(roasDropPct)}% below the current blended rate` : 'near the current blended rate'}. ` +
      (margROAS < 2 ? 'Diminishing returns are steep above the current budget level.' : 'There is still meaningful return available at higher spend.');
  }, [scenarioResults, baselineResult, aggressiveResult]);

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div style={{ maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Progress nav ───────────────────────────────────────────────── */}
      <OptimizerSubnav />

      {/* ── Page header ────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
          Budget Scenarios
        </h1>
        <p style={{ ...T.helper, marginTop: 6 }}>
          What happens to revenue and ROAS if the total monthly budget increases or decreases.
        </p>
        <p style={{ ...T.helper, fontSize: 11, marginTop: 4, color: 'var(--text-muted)' }}>
          Each scenario uses the AI-optimised allocation for that budget level — so the mix may differ across tiers.
        </p>
      </div>

      {/* ── Scenario KPI cards ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {scenarioResults.map((s) => {
          const isCurrent = s.key === 'current';
          return (
            <div key={s.key} style={{
              ...CARD,
              borderColor: isCurrent ? s.color : 'var(--border-subtle)',
              boxShadow: isCurrent ? `0 0 0 1px ${s.color}` : 'none',
            }}>
              {isCurrent && (
                <span style={{ fontFamily: 'Outfit', fontSize: 9, fontWeight: 700, color: s.color, backgroundColor: `${s.color}15`, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'inline-block', marginBottom: 8 }}>
                  Current level
                </span>
              )}
              <p style={T.overline}>{s.label}</p>
              <p style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: s.color, marginTop: 4 }}>
                {formatINRCompact(s.tierBudget)}/mo
              </p>
              <p style={{ ...T.value, fontSize: 22, fontWeight: 800, marginTop: 8 }}>{formatINRCompact(s.periodRevenue)}</p>
              <p style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginTop: 4 }}>
                {s.roas.toFixed(2)}x ROAS
              </p>
              <div style={{ height: 2, backgroundColor: s.color, borderRadius: 1, marginTop: 14, opacity: 0.35 }} />
            </div>
          );
        })}
      </div>

      {/* ── Scenario comparison table ─────────────────────────────────── */}
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden', backgroundColor: 'var(--bg-card)' }}>
        <div style={{ padding: '20px 24px 0' }}>
          <p style={{ ...T.overline, fontSize: 11 }}>Scenario Comparison Table</p>
          <p style={{ ...T.helper, fontSize: 12, marginTop: 4 }}>
            Period budget totals, revenue forecasts, ROAS, and delta vs the current tier.
          </p>
          <div style={{ borderBottom: '1px solid var(--border-subtle)', marginTop: 16 }} />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-root)' }}>
              {['Scenario', 'Monthly Budget', 'Period Budget', 'Forecast Revenue', 'ROAS', `vs Current`].map((h) => (
                <th key={h} style={{ padding: '11px 20px', textAlign: 'left', ...T.overline, fontSize: 9, borderBottom: '1px solid var(--border-subtle)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenarioResults.map((s, i) => {
              const baseline = baselineResult?.periodRevenue || 0;
              const diff     = s.periodRevenue - baseline;
              const isCur    = s.key === 'current';
              return (
                <tr key={s.key}
                  style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: isCur ? `${s.color}07` : 'transparent' }}
                  onMouseEnter={(e) => { if (!isCur) e.currentTarget.style.backgroundColor = 'var(--border-subtle)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isCur ? `${s.color}07` : 'transparent'; }}
                >
                  <td style={{ padding: '13px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: s.color, flexShrink: 0 }} />
                      <span style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{s.label}</span>
                    </div>
                  </td>
                  <td style={{ padding: '13px 20px', fontFamily: 'Plus Jakarta Sans', fontSize: 13, color: 'var(--text-secondary)' }}>{formatINRCompact(s.tierBudget)}</td>
                  <td style={{ padding: '13px 20px', fontFamily: 'Plus Jakarta Sans', fontSize: 13, color: 'var(--text-secondary)' }}>{formatINRCompact(s.periodBudget)}</td>
                  <td style={{ padding: '13px 20px', fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{formatINRCompact(s.periodRevenue)}</td>
                  <td style={{ padding: '13px 20px', fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: s.roas >= 4 ? '#34D399' : s.roas >= 2 ? '#FBBF24' : '#F87171' }}>{s.roas.toFixed(2)}x</td>
                  <td style={{ padding: '13px 20px', fontFamily: 'Plus Jakarta Sans', fontSize: 13, color: diff > 0 ? '#34D399' : diff < 0 ? '#F87171' : 'var(--text-muted)' }}>
                    {diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${formatINRCompact(Math.abs(diff))}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Marginal ROAS between tiers ───────────────────────────────── */}
      <div style={{ ...CARD }}>
        <p style={{ ...T.overline, fontSize: 11, marginBottom: 14 }}>Marginal ROAS Between Tiers</p>
        <p style={{ ...T.helper, fontSize: 12, marginBottom: 16 }}>
          How much revenue each extra rupee of budget returns as you move from one tier to the next.
          A declining marginal ROAS is normal — this is the diminishing returns curve at the portfolio level.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {marginalNotes.map((note) => (
            <div key={`${note.from}-${note.to}`} style={{ backgroundColor: 'var(--bg-root)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-subtle)' }}>
              <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-muted)', margin: '0 0 6px 0' }}>
                {note.from} → {note.to}
              </p>
              <p style={{ fontFamily: 'Outfit', fontSize: 22, fontWeight: 800, color: note.marginal >= 3 ? '#34D399' : note.marginal >= 1.5 ? '#FBBF24' : '#F87171', margin: 0 }}>
                {note.marginal.toFixed(2)}x
              </p>
              <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                marginal ROAS
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Interpretive summary ──────────────────────────────────────── */}
      {summaryText && (
        <div style={{ ...CARD, borderColor: 'rgba(251,191,36,0.25)', backgroundColor: 'rgba(251,191,36,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <TrendingDown style={{ width: 18, height: 18, color: '#FBBF24', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ ...T.overline, fontSize: 10, color: '#FBBF24', marginBottom: 8 }}>Revenue vs Budget Interpretation</p>
              <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
                {summaryText}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Back CTA ─────────────────────────────────────────────────── */}
      <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontFamily: 'Outfit', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Return to the recommended allocation
          </p>
          <p style={{ ...T.helper, fontSize: 12, marginTop: 6 }}>
            Apply the AI mix or adjust your manual allocation from the Recommended Mix page.
          </p>
        </div>
        <Link to="/optimizer/recommended" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '12px 20px', borderRadius: 10,
          backgroundColor: 'var(--bg-root)', border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)', fontFamily: 'Outfit', fontSize: 13, fontWeight: 700,
          textDecoration: 'none', whiteSpace: 'nowrap',
        }}>
          <ArrowLeft size={15} /> Recommended Mix
        </Link>
      </div>

    </div>
  );
}
