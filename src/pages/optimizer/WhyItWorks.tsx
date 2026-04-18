import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMarketingData } from '@/hooks/useMarketingData';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { OptimizerSubnav } from '@/components/optimizer/OptimizerSubnav';
import { useOptimizer } from '@/contexts/OptimizerContext';
import {
  getChannelSummaries,
  getChannelSaturationModels,
  getSeasonalityMetrics,
  getDayOfWeekMetrics,
  getChannelCapsFromData,
  buildMonthRange,
  getTimeFrameMonths,
} from '@/lib/calculations';
import { formatINRCompact } from '@/lib/formatCurrency';
import { CHANNELS, CHANNEL_COLORS } from '@/lib/mockData';
import { ChannelName } from '@/components/ChannelName';
import {
  BarChart3, TrendingDown, Calendar, Zap,
  ArrowRight, Sun,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ── Design tokens ────────────────────────────────────────────────────────────

const T = {
  overline: { fontFamily: 'Outfit' as const, fontSize: 10, fontWeight: 600 as const, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: 0 },
  value:    { fontFamily: 'Outfit' as const, fontWeight: 700 as const, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 },
  helper:   { fontFamily: 'Plus Jakarta Sans' as const, fontSize: 13, fontWeight: 400 as const, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 },
};
const CARD = { padding: '20px 24px', border: '1px solid var(--border-subtle)', borderRadius: 14, backgroundColor: 'var(--bg-card)' };

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const tooltipStyle = {
  contentStyle: { backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px', fontFamily: 'Plus Jakarta Sans', fontSize: 12 },
  itemStyle: { color: 'var(--text-primary)' },
  labelStyle: { color: 'var(--text-secondary)' },
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function WhyItWorks() {
  const { data, aggregate, globalAggregate, isLoading, dataSource, dataUpdatedAt } = useMarketingData({ includeGlobalAggregate: true });
  const { planningPeriod, customStartMonth, customEndMonth } = useOptimizer();
  const [selectedChannel, setSelectedChannel] = useState(CHANNELS[0]);

  const summaries = useMemo(
    () => (aggregate || data) ? getChannelSummaries(aggregate || data!) : [],
    [data, aggregate]
  );
  const models = useMemo(
    () => (globalAggregate || data) ? getChannelSaturationModels(globalAggregate || data!) : [],
    [data, globalAggregate]
  );
  const seasonality = useMemo(
    () => (globalAggregate || data) ? getSeasonalityMetrics(globalAggregate || data!) : [],
    [data, globalAggregate]
  );
  const dowMetrics = useMemo(
    () => (aggregate || data) ? getDayOfWeekMetrics(aggregate || data!) : [],
    [data, aggregate]
  );
  const caps = useMemo(
    () => getChannelCapsFromData(globalAggregate || data || []),
    [globalAggregate, data]
  );
  const totalMonths = useMemo(
    () => getTimeFrameMonths(aggregate || data || []),
    [aggregate, data]
  );

  const dataRange = useMemo(() => {
    if (!data?.length) return null;
    let min = data[0].date, max = data[0].date;
    for (const r of data) { if (r.date < min) min = r.date; if (r.date > max) max = r.date; }
    return { min, max };
  }, [data]);

  // ── Diminishing returns curve for selected channel ────────────────────
  const selectedCap     = caps.find((c) => c.channel === selectedChannel);
  const selectedSummary = summaries.find((s) => s.channel === selectedChannel);
  const curveData = useMemo(() => {
    if (!selectedCap) return [];
    return [
      { spend: selectedCap.bucketSpend.low,    roas: selectedCap.bucketROAS.low,    bucket: 'Low Spend' },
      { spend: selectedCap.bucketSpend.medium,  roas: selectedCap.bucketROAS.medium, bucket: 'Mid Spend' },
      { spend: selectedCap.bucketSpend.high,   roas: selectedCap.bucketROAS.high,   bucket: 'High Spend' },
    ].filter((p) => p.spend > 0 && p.roas > 0);
  }, [selectedCap]);

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div style={{ maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Progress nav ───────────────────────────────────────────────── */}
      <OptimizerSubnav />

      {/* ── Page header ────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
          Why It Works
        </h1>
        <p style={{ ...T.helper, marginTop: 6 }}>
          How the optimizer decides what to recommend — the model logic, the data it uses, and the signals it weighs.
        </p>
      </div>

      {/* ── Optimization logic — 4 steps ──────────────────────────────── */}
      <div style={{ ...CARD }}>
        <p style={{ ...T.overline, fontSize: 11, marginBottom: 20 }}>How the optimizer works</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {[
            {
              step: '01', icon: BarChart3, color: '#60A5FA',
              title: 'Analyse historical efficiency',
              desc: 'Calculate ROAS for each channel across 3 years of daily data. Establish a baseline return rate per rupee of spend for each channel.',
            },
            {
              step: '02', icon: TrendingDown, color: '#F87171',
              title: 'Detect saturation and diminishing returns',
              desc: 'Group spend into low, medium, and high tiers. Identify where higher spend produces lower returns — those channels have a spend cap.',
            },
            {
              step: '03', icon: Calendar, color: '#FBBF24',
              title: 'Weight for timing',
              desc: 'Apply channel-specific seasonality and day-of-week multipliers. Channels that peak in a particular month get higher budget weight during that period.',
            },
            {
              step: '04', icon: Zap, color: '#34D399',
              title: 'Reallocate toward highest marginal return',
              desc: 'Solve for the allocation that maximises total expected revenue under the budget constraint, with saturation caps bounding each channel share.',
            },
          ].map((item) => (
            <div key={item.step} style={{ backgroundColor: 'var(--bg-root)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '18px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <item.icon style={{ width: 16, height: 16, color: item.color }} />
                </div>
                <span style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: 700, color: item.color }}>{item.step}</span>
              </div>
              <h3 style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{item.title}</h3>
              <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Diminishing returns ───────────────────────────────────────── */}
      <div style={{ ...CARD }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ ...T.overline, fontSize: 11, marginBottom: 4 }}>Diminishing Returns by Channel</p>
            <p style={{ ...T.helper, fontSize: 12 }}>
              Each channel's ROAS at low, medium, and high spend levels — the curve that drives the saturation cap.
            </p>
          </div>
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            style={{ backgroundColor: 'var(--bg-root)', border: '1px solid var(--border-strong)', borderRadius: 10, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans', fontSize: 13, padding: '10px 14px', minWidth: 180 }}
          >
            {CHANNELS.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Historical ROAS',  value: selectedSummary ? `${selectedSummary.roas.toFixed(2)}x` : '—' },
            { label: 'Saturation Cap',   value: selectedCap && Number.isFinite(selectedCap.capSpend) ? formatINRCompact(selectedCap.capSpend) + '/mo' : 'None detected' },
            { label: 'Low-spend ROAS',   value: selectedCap ? `${selectedCap.bucketROAS.low.toFixed(2)}x` : '—' },
            { label: 'High-spend ROAS',  value: selectedCap ? `${selectedCap.bucketROAS.high.toFixed(2)}x` : '—' },
          ].map((kpi) => (
            <div key={kpi.label} style={{ backgroundColor: 'var(--bg-root)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border-subtle)' }}>
              <p style={{ ...T.overline, fontSize: 9 }}>{kpi.label}</p>
              <p style={{ fontFamily: 'Outfit', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {curveData.length >= 2 ? (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={curveData}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border-subtle)" />
                <XAxis dataKey="spend" tickFormatter={(v) => formatINRCompact(v)} tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'Plus Jakarta Sans' }} axisLine={false} tickLine={false} label={{ value: 'Monthly Spend →', position: 'insideBottom', offset: -4, style: { fill: 'var(--text-muted)', fontSize: 11 } }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} label={{ value: 'ROAS', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted)', fontSize: 11 } }} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${Number(v).toFixed(2)}x`, 'ROAS']} labelFormatter={(v) => `Spend: ${formatINRCompact(Number(v))}`} />
                {selectedCap?.blendedROAS ? <ReferenceLine y={selectedCap.blendedROAS} stroke="#F87171" strokeDasharray="4 4" label={{ value: 'Blended avg', position: 'insideRight', style: { fill: '#F87171', fontSize: 10 } }} /> : null}
                <Line type="monotone" dataKey="roas" stroke={CHANNEL_COLORS[CHANNELS.indexOf(selectedChannel)]} strokeWidth={2.5} dot={{ r: 5 }} name="ROAS by spend tier" />
              </LineChart>
            </ResponsiveContainer>
            <p style={{ ...T.helper, fontSize: 11, marginTop: 10 }}>
              Points show ROAS at low, mid, and high historical spend. When the high-spend point falls below the red dashed line (blended average), the channel is capped.
            </p>
          </>
        ) : (
          <p style={{ ...T.helper, fontSize: 12, fontStyle: 'italic' }}>Insufficient spend-tier data for {selectedChannel}.</p>
        )}
      </div>

      {/* ── Day-of-week effects ───────────────────────────────────────── */}
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden', backgroundColor: 'var(--bg-card)' }}>
        <div style={{ padding: '20px 24px 0' }}>
          <p style={{ ...T.overline, fontSize: 11 }}>Day-of-Week Performance</p>
          <p style={{ ...T.helper, fontSize: 12, marginTop: 4 }}>Best performing days per channel based on historical ROAS by weekday.</p>
          <div style={{ borderBottom: '1px solid var(--border-subtle)', marginTop: 16 }} />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Channel', 'Best Day', 'Runner-Up', 'Weekend Bias'].map((h) => (
                <th key={h} style={{ padding: '11px 24px', textAlign: h === 'Channel' ? 'left' : 'center', ...T.overline, fontSize: 9 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dowMetrics.map((row, i) => (
              <tr key={row.channel} style={{ borderTop: '1px solid var(--border-subtle)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--border-subtle)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
                <td style={{ padding: '12px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: CHANNEL_COLORS[i], flexShrink: 0 }} />
                    <ChannelName channel={row.channel} style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }} />
                  </div>
                </td>
                <td style={{ padding: '12px 24px', textAlign: 'center', fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: '#34D399' }}>{DOW_NAMES[row.bestDay]}</td>
                <td style={{ padding: '12px 24px', textAlign: 'center', fontFamily: 'Outfit', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{DOW_NAMES[row.days.indexOf(Math.max(...row.days.filter((_, di) => di !== row.bestDay)))]}</td>
                <td style={{ padding: '12px 24px', textAlign: 'center', fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{row.weekendBias || 'neutral'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Seasonality ───────────────────────────────────────────────── */}
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden', backgroundColor: 'var(--bg-card)' }}>
        <div style={{ padding: '20px 24px 0' }}>
          <p style={{ ...T.overline, fontSize: 11 }}>Seasonal Peaks by Channel</p>
          <p style={{ ...T.helper, fontSize: 12, marginTop: 4 }}>Which months each channel historically outperforms — budget is weighted toward peak periods.</p>
          <div style={{ borderBottom: '1px solid var(--border-subtle)', marginTop: 16 }} />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Channel', 'Peak Month', 'Implication'].map((h) => (
                <th key={h} style={{ padding: '11px 24px', textAlign: h === 'Implication' || h === 'Channel' ? 'left' : 'center', ...T.overline, fontSize: 9 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seasonality.map((row, i) => (
              <tr key={row.channel} style={{ borderTop: '1px solid var(--border-subtle)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--border-subtle)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
                <td style={{ padding: '12px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: CHANNEL_COLORS[i], flexShrink: 0 }} />
                    <ChannelName channel={row.channel} style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }} />
                  </div>
                </td>
                <td style={{ padding: '12px 24px', textAlign: 'center', fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: '#34D399' }}>{MONTH_NAMES[row.peakMonth]}</td>
                <td style={{ padding: '12px 24px', fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  {row.peakIndex > 1.15
                    ? `${MONTH_NAMES[row.peakMonth]} outperforms average by ~${Math.round((row.peakIndex - 1) * 100)}% — consider extra weight here.`
                    : `Seasonality index is near average — timing matters less for this channel.`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Data & methodology note ────────────────────────────────────── */}
      <div style={{ ...CARD, borderColor: 'rgba(251,191,36,0.2)', backgroundColor: 'rgba(251,191,36,0.04)' }}>
        <p style={{ ...T.overline, fontSize: 10, color: '#FBBF24', marginBottom: 10 }}>Data and methodology notes</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[
            { label: 'Data range',     value: dataRange ? `${dataRange.min} → ${dataRange.max}` : '—' },
            { label: 'Data points',    value: `${totalMonths} months × 10 channels` },
            { label: 'Source',         value: dataSource === 'api' ? 'Live API' : dataSource === 'cached' ? 'Cached' : 'Sample data' },
            { label: 'Last loaded',    value: dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—' },
            { label: 'Model type',     value: 'Concave spend–response: α·ln(spend+1)' },
            { label: 'Forecast basis', value: 'Model output × seasonality × day-of-week weights' },
          ].map((item) => (
            <div key={item.label}>
              <p style={{ ...T.overline, fontSize: 9, marginBottom: 4 }}>{item.label}</p>
              <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{item.value}</p>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.6, margin: '16px 0 0' }}>
          All revenue figures are model forecasts, not guaranteed outcomes. The optimizer recommends the allocation expected to maximise revenue given current efficiency signals and budget constraints.
        </p>
      </div>

      {/* ── CTA to Budget Scenarios ───────────────────────────────────── */}
      <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontFamily: 'Outfit', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Ready to explore what happens if the budget changes?
          </p>
          <p style={{ ...T.helper, fontSize: 12, marginTop: 6 }}>
            Budget Scenarios shows revenue and ROAS projections across conservative, current, and aggressive spend levels.
          </p>
        </div>
        <Link to="/optimizer/scenarios" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '12px 20px', borderRadius: 10,
          background: 'linear-gradient(135deg, #E8803A, #FBBF24)',
          color: '#000', fontFamily: 'Outfit', fontSize: 13, fontWeight: 700,
          textDecoration: 'none', whiteSpace: 'nowrap',
        }}>
          See Budget Scenarios <ArrowRight size={15} />
        </Link>
      </div>

    </div>
  );
}
