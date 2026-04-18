/**
 * WhyItWorks — Page 4 of Mix Optimiser
 *
 * DATA CONTRACT:
 *   explanation, recommendations, uplift,
 *   totalHistoricalMonths, dataRange, dataSource,
 *   debug.portfolioAvgConfidence
 *
 * Must NOT use: raw calibration audit tables
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { useOptimizerModel } from '@/hooks/useOptimizerModel';
import { CHANNELS, CHANNEL_COLORS } from '@/lib/mockData';
import { ChannelName } from '@/components/ChannelName';
import {
  ArrowRight, ArrowLeft, TrendingUp, TrendingDown, Minus,
  Activity, Zap, Shield, Clock, ChevronRight,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  overline: {
    fontFamily: 'Outfit' as const, fontSize: 10, fontWeight: 600 as const,
    color: 'var(--text-muted)', textTransform: 'uppercase' as const,
    letterSpacing: '0.09em', margin: 0,
  },
  body: {
    fontFamily: 'Plus Jakarta Sans' as const, fontSize: 13,
    fontWeight: 400 as const, color: 'var(--text-muted)', margin: 0, lineHeight: 1.65,
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
  padding: '18px 22px',
  border: '1px solid var(--border-subtle)',
  borderRadius: 12,
  backgroundColor: 'var(--bg-card)',
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const CONFIDENCE_META = {
  high:        { label: 'High confidence',    color: '#34D399', bg: 'rgba(52,211,153,0.10)'  },
  moderate:    { label: 'Moderate confidence',color: '#FBBF24', bg: 'rgba(251,191,36,0.10)'  },
  exploratory: { label: 'Exploratory',         color: '#94a3b8', bg: 'rgba(148,163,184,0.10)' },
} as const;

// Plain-English "why adjusted" for raw vs tuned comparison
function tuningNote(rawROAS: number, tunedROAS: number, isHighVol: boolean): string {
  if (isHighVol) return 'High volatility — outlier months smoothed down';
  const delta = (rawROAS - tunedROAS) / Math.max(rawROAS, 0.01);
  if (delta > 0.12) return 'Outlier spikes reduced — signal stabilised';
  if (delta < -0.12) return 'Spend-weighted upward correction applied';
  return 'Signal stable — minor tuning only';
}

function channelConfidenceLabel(score: number): { text: string; color: string } {
  if (score >= 0.70) return { text: 'Strong',   color: '#34D399' };
  if (score >= 0.38) return { text: 'Moderate', color: '#FBBF24' };
  return               { text: 'Thin',     color: '#94a3b8' };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WhyItWorks() {
  const {
    isLoading,
    explanation, recommendations, uplift,
    totalHistoricalMonths, dataRange, dataSource,
    debug,
  } = useOptimizerModel();

  const [selectedChannel, setSelectedChannel] = useState(CHANNELS[0]);
  const expl    = explanation[selectedChannel];
  const chColor = CHANNEL_COLORS[CHANNELS.indexOf(selectedChannel) % CHANNEL_COLORS.length];

  if (isLoading) return <DashboardSkeleton />;

  const confidence    = uplift.upliftConfidence;
  const confMeta      = CONFIDENCE_META[confidence.tier];
  const portfolioPct  = Math.round((debug.portfolioAvgConfidence ?? 0.5) * 100);

  // Group channels by recommendation direction
  const increases = CHANNELS.filter(ch => recommendations[ch]?.direction === 'increase')
    .sort((a, b) => (recommendations[b]?.deltaPct || 0) - (recommendations[a]?.deltaPct || 0));
  const holds     = CHANNELS.filter(ch => recommendations[ch]?.direction === 'hold');
  const decreases = CHANNELS.filter(ch => recommendations[ch]?.direction === 'decrease')
    .sort((a, b) => (recommendations[a]?.deltaPct || 0) - (recommendations[b]?.deltaPct || 0));

  return (
    <div style={{ maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── A. Page Header ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{
          fontFamily: 'Outfit', fontSize: 26, fontWeight: 800,
          color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0,
        }}>
          Why It Works
        </h1>
        <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {Math.round(totalHistoricalMonths)}mo history
          {dataRange ? ` · ${dataRange.min} – ${dataRange.max}` : ''}
          {' · '}{dataSource === 'api' ? 'Live' : dataSource === 'cached' ? 'Cached' : 'Sample data'}
        </span>
      </div>

      {/* ── B. How the Optimizer Thinks ──────────────────────────────────── */}
      <div>
        <p style={{ ...T.overline, marginBottom: 14 }}>How the optimizer thinks</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            {
              step: '01',
              icon: <Activity size={14} color="#60A5FA" />,
              title: 'Read historical performance',
              body: 'The optimizer starts with each channel\'s historical spend and revenue. Rather than using raw daily averages, it looks for consistent patterns across months.',
            },
            {
              step: '02',
              icon: <Shield size={14} color="#FBBF24" />,
              title: 'Stabilize noisy signals',
              body: 'Outlier months, thin data periods, and high-variance channels are moderated using spend-weighted smoothing. The goal is a reliable signal, not a lucky snapshot.',
            },
            {
              step: '03',
              icon: <TrendingUp size={14} color="#E8803A" />,
              title: 'Account for diminishing returns',
              body: 'As spend on any channel rises, each additional pound returns less. The optimizer maps this curve per channel and finds the allocation where marginal returns are best balanced.',
            },
            {
              step: '04',
              icon: <Clock size={14} color="#34D399" />,
              title: 'Apply timing and stability controls',
              body: 'Seasonality and day-of-week patterns are incorporated where signal is strong enough. Stability controls prevent dramatic reallocations when evidence is limited.',
            },
          ].map(s => (
            <div key={s.step} style={{ ...CARD, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{
                  fontFamily: 'Outfit', fontSize: 11, fontWeight: 800,
                  color: 'var(--text-muted)', letterSpacing: '-0.01em',
                }}>
                  {s.step}
                </span>
                {s.icon}
              </div>
              <p style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                {s.title}
              </p>
              <p style={{ ...T.body, fontSize: 12, lineHeight: 1.65 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── C. Raw vs Tuned Signals ───────────────────────────────────────── */}
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', backgroundColor: 'var(--bg-card)' }}>
        <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
          <p style={{ ...T.overline, marginBottom: 4 }}>Raw vs tuned efficiency signals</p>
          <p style={{ ...T.body, fontSize: 12 }}>
            The optimizer doesn't use raw historical averages directly. Each channel's signal is adjusted to reduce the influence of outliers, sparse periods, and high-variance months.
          </p>
        </div>

        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'minmax(130px,1fr) 80px 80px 80px 1fr',
          padding: '8px 24px', gap: 8,
          backgroundColor: 'var(--bg-root)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {['Channel', 'Raw signal', 'Tuned signal', 'Adjustment', 'Why'].map((h, i) => (
            <span key={i} style={{ ...T.overline, fontSize: 9, textAlign: i > 0 && i < 4 ? 'center' : 'left' as React.CSSProperties['textAlign'] }}>{h}</span>
          ))}
        </div>

        {CHANNELS.map(ch => {
          const ex    = explanation[ch];
          const color = CHANNEL_COLORS[CHANNELS.indexOf(ch) % CHANNEL_COLORS.length];
          if (!ex) return null;
          const raw   = ex.rawROAS;
          const tuned = ex.tunedROAS;
          const diff  = tuned - raw;
          const diffColor = Math.abs(diff) < 0.05 ? '#94a3b8' : diff > 0 ? '#34D399' : '#FBBF24';
          const note  = tuningNote(raw, tuned, ex.isHighVolatility);

          return (
            <div key={ch} style={{
              display: 'grid', gridTemplateColumns: 'minmax(130px,1fr) 80px 80px 80px 1fr',
              padding: '11px 24px', gap: 8, alignItems: 'center',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              {/* Channel */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                <ChannelName channel={ch} style={{
                  fontFamily: 'Plus Jakarta Sans', fontSize: 12, fontWeight: 600,
                  color: 'var(--text-primary)',
                }} />
              </div>
              {/* Raw */}
              <p style={{ ...T.num, fontSize: 12, color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
                {raw.toFixed(2)}x
              </p>
              {/* Tuned */}
              <p style={{ ...T.num, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: 0, textAlign: 'center' }}>
                {tuned.toFixed(2)}x
              </p>
              {/* Adjustment */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                {Math.abs(diff) < 0.05
                  ? <Minus size={10} color="#94a3b8" />
                  : diff > 0 ? <TrendingUp size={10} color="#34D399" /> : <TrendingDown size={10} color="#FBBF24" />}
                <span style={{ ...T.num, fontSize: 11, fontWeight: 700, color: diffColor }}>
                  {diff >= 0 ? '+' : ''}{diff.toFixed(2)}
                </span>
              </div>
              {/* Why */}
              <p style={{ ...T.body, fontSize: 11, lineHeight: 1.4 }}>{note}</p>
            </div>
          );
        })}
      </div>

      {/* ── D. Diminishing Returns ────────────────────────────────────────── */}
      <div>
        <p style={{ ...T.overline, marginBottom: 6 }}>Diminishing returns</p>
        <p style={{ ...T.body, fontSize: 13, marginBottom: 16, color: 'var(--text-secondary)' }}>
          Every channel reaches a point where each additional pound of spend returns less than the previous. The optimizer identifies this curve per channel — channels already operating near saturation receive less budget, freeing it for channels with better marginal return.
        </p>

        {/* Key concepts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            {
              icon: <TrendingUp size={13} color="#34D399" />,
              title: 'Efficient range',
              body: 'Each channel has a spend range where returns are healthy. Below it, the channel is under-invested. Above it, the channel is approaching saturation.',
            },
            {
              icon: <Activity size={13} color="#FBBF24" />,
              title: 'Marginal return',
              body: 'The marginal ROAS tells you what the next pound of spend will return. A channel with ROAS 4.0x but marginal ROAS 0.8x is not a good candidate for more budget.',
            },
            {
              icon: <Shield size={13} color="#60A5FA" />,
              title: 'Concentration limits',
              body: 'No channel receives an extreme allocation. Even very efficient channels are bounded to prevent over-concentration risk from thin data or unusual conditions.',
            },
          ].map(c => (
            <div key={c.title} style={{ ...CARD, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                {c.icon}
                <p style={{ fontFamily: 'Outfit', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{c.title}</p>
              </div>
              <p style={{ ...T.body, fontSize: 12, lineHeight: 1.6 }}>{c.body}</p>
            </div>
          ))}
        </div>

        {/* Channel selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <p style={{ ...T.overline, fontSize: 9 }}>Channel view:</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CHANNELS.map((ch, i) => {
              const col = CHANNEL_COLORS[i % CHANNEL_COLORS.length];
              return (
                <button key={ch} onClick={() => setSelectedChannel(ch)} style={{
                  fontFamily: 'Outfit', fontSize: 10, fontWeight: 600,
                  padding: '5px 11px', borderRadius: 7, cursor: 'pointer', transition: '100ms',
                  border: selectedChannel === ch ? `1px solid ${col}` : '1px solid var(--border-subtle)',
                  backgroundColor: selectedChannel === ch ? `${col}18` : 'transparent',
                  color: selectedChannel === ch ? col : 'var(--text-muted)',
                }}>
                  {ch}
                </button>
              );
            })}
          </div>
        </div>

        {expl && (
          <div style={{ ...CARD }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              <div>
                <p style={{ ...T.overline, marginBottom: 5 }}>Spend–return curve · {selectedChannel}</p>
                <p style={{ ...T.body, fontSize: 12, lineHeight: 1.55, maxWidth: 520 }}>
                  Each point is a historical month of spend and observed return. The model fits a curve through these observations.
                  {expl.isSaturated
                    ? ' At the current spend level, this channel shows saturation pressure — marginal return is below breakeven.'
                    : ` At the current spend level, this channel has marginal ROAS of ${expl.marginalROASAtCurrent.toFixed(2)}x.`}
                  {Number.isFinite(expl.capSpend) && expl.capSpend > 0
                    ? ` Estimated saturation threshold: around ₹${Math.round(expl.capSpend / 1000)}K/mo.`
                    : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 14, flexShrink: 0 }}>
                {[
                  { k: 'Marginal ROAS (current)',     v: `${expl.marginalROASAtCurrent.toFixed(2)}x`,     color: expl.marginalROASAtCurrent >= 1 ? '#34D399' : '#F87171' },
                  { k: 'Marginal ROAS (recommended)', v: `${expl.marginalROASAtRecommended.toFixed(2)}x`, color: '#E8803A' },
                ].map(({ k, v, color: c }) => (
                  <div key={k} style={{ textAlign: 'right' }}>
                    <p style={{ ...T.overline, fontSize: 8, marginBottom: 4 }}>{k}</p>
                    <p style={{ ...T.num, fontSize: 18, fontWeight: 800, color: c, margin: 0 }}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
            {(expl.saturationCurve?.length || 0) > 1 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={expl.saturationCurve} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis
                    dataKey="spend"
                    tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`}
                    tick={{ fontFamily: 'Outfit', fontSize: 9, fill: 'var(--text-muted)' }}
                  />
                  <YAxis
                    tickFormatter={v => `${v.toFixed(1)}x`}
                    tick={{ fontFamily: 'Outfit', fontSize: 9, fill: 'var(--text-muted)' }}
                  />
                  <Tooltip
                    formatter={(v: number) => [`${v.toFixed(2)}x ROAS`, 'Return']}
                    labelFormatter={v => `Spend: ₹${(Number(v) / 1000).toFixed(0)}K/mo`}
                    contentStyle={{
                      fontFamily: 'Outfit', fontSize: 11,
                      backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8,
                    }}
                  />
                  <Line type="monotone" dataKey="roas" stroke={chColor} strokeWidth={2} dot={{ r: 3, fill: chColor, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ ...T.body, fontSize: 12, fontStyle: 'italic' }}>
                Insufficient historical data points to render a curve for this channel.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── E. Timing Effects ─────────────────────────────────────────────── */}
      {expl && (
        <div>
          <p style={{ ...T.overline, marginBottom: 6 }}>Timing effects · {selectedChannel}</p>
          <p style={{ ...T.body, fontSize: 13, marginBottom: 16, color: 'var(--text-secondary)' }}>
            Timing effects show how channel performance varies by month and day of week. Where the signal is strong, the optimizer weights planning periods accordingly.
            Where it is weak, timing effects are moderated to avoid over-fitting sparse patterns.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            {/* Seasonality */}
            <div style={{ ...CARD }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <p style={{ ...T.overline, marginBottom: 5 }}>Monthly seasonality</p>
                  <p style={{ ...T.body, fontSize: 12, lineHeight: 1.5 }}>
                    {expl.seasonalityStrength === 'weak'
                      ? 'Timing effect is weak — the optimizer does not over-weight seasonality for this channel.'
                      : `${expl.seasonalityStrength === 'strong' ? 'Strong' : 'Moderate'} seasonal pattern detected. `
                        + `${MONTH_NAMES[expl.peakMonth]} is the peak month (+${Math.round(expl.peakBoost * 100)}% above annual average).`}
                  </p>
                </div>
                <span style={{
                  fontFamily: 'Outfit', fontSize: 9, fontWeight: 700,
                  color: expl.seasonalityStrength === 'strong' ? '#34D399' : expl.seasonalityStrength === 'moderate' ? '#FBBF24' : '#94a3b8',
                  backgroundColor: expl.seasonalityStrength === 'strong' ? 'rgba(52,211,153,0.1)' : expl.seasonalityStrength === 'moderate' ? 'rgba(251,191,36,0.1)' : 'rgba(148,163,184,0.1)',
                  padding: '3px 8px', borderRadius: 4,
                  textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {expl.seasonalityStrength} signal
                </span>
              </div>

              {/* Bar chart with raw (dimmer) and tuned (bright) overlay */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3 }}>
                {(expl.seasonalityIndex || []).map((idx, m) => {
                  const raw  = expl.rawSeasonalityIndex?.[m] ?? idx;
                  const isPeak = m === expl.peakMonth;
                  const barH = Math.max(8, Math.min(100, idx * 65));
                  const rawH = Math.max(8, Math.min(100, raw * 65));
                  return (
                    <div key={m} style={{ textAlign: 'center' }}>
                      <div style={{ height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 1 }}>
                        {/* Raw bar (background, dimmer) */}
                        <div style={{
                          position: 'absolute',
                          width: '100%', height: `${rawH}%`,
                          backgroundColor: `${chColor}20`,
                          borderRadius: '2px 2px 0 0',
                        }} />
                        {/* Tuned bar (foreground) */}
                        <div style={{
                          width: '100%',
                          height: `${barH}%`,
                          backgroundColor: isPeak ? chColor : `${chColor}55`,
                          borderRadius: '2px 2px 0 0',
                        }} />
                      </div>
                      <p style={{
                        fontFamily: 'Outfit', fontSize: 8,
                        fontWeight: isPeak ? 700 : 400,
                        color: isPeak ? chColor : 'var(--text-muted)',
                        marginTop: 4, margin: '4px 0 0',
                      }}>
                        {MONTH_NAMES[m]}
                      </p>
                      <p style={{ fontFamily: 'Outfit', fontSize: 8, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                        {idx.toFixed(2)}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p style={{ ...T.body, fontSize: 11, marginTop: 12, lineHeight: 1.45 }}>
                Index 1.0 = channel annual average.
                {expl.peakBoost > 0.12
                  ? ` ${MONTH_NAMES[expl.peakMonth]} outperforms average by ~${Math.round(expl.peakBoost * 100)}%.`
                  : ' Seasonality is near-flat — timing matters less than allocation share.'}
              </p>
            </div>

            {/* Day of week */}
            <div style={{ ...CARD }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <p style={{ ...T.overline, marginBottom: 5 }}>Day-of-week pattern</p>
                  <p style={{ ...T.body, fontSize: 12, lineHeight: 1.5 }}>
                    {expl.dowEffectStrength === 'weak'
                      ? 'Day-of-week effect is weak — performance is consistent across the week for this channel.'
                      : `${expl.dowEffectStrength === 'strong' ? 'Strong' : 'Moderate'} day-of-week pattern. `
                        + (expl.weekendBias !== 'neutral'
                          ? `Performs better on ${expl.weekendBias === 'weekend' ? 'weekends' : 'weekdays'}.`
                          : `Best day: ${DOW_SHORT[expl.bestDay]}.`)}
                  </p>
                </div>
                <span style={{
                  fontFamily: 'Outfit', fontSize: 9, fontWeight: 700,
                  color: expl.dowEffectStrength === 'strong' ? '#34D399' : expl.dowEffectStrength === 'moderate' ? '#FBBF24' : '#94a3b8',
                  backgroundColor: expl.dowEffectStrength === 'strong' ? 'rgba(52,211,153,0.1)' : expl.dowEffectStrength === 'moderate' ? 'rgba(251,191,36,0.1)' : 'rgba(148,163,184,0.1)',
                  padding: '3px 8px', borderRadius: 4,
                  textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {expl.dowEffectStrength} signal
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
                {(expl.dowIndex || []).map((idx, d) => {
                  const isBest = d === expl.bestDay;
                  const barH   = Math.max(10, Math.min(100, idx * 65));
                  return (
                    <div key={d} style={{ flex: 1, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <div style={{
                        backgroundColor: isBest ? chColor : `${chColor}44`,
                        borderRadius: '3px 3px 0 0', height: `${barH}%`,
                      }} />
                      <p style={{
                        fontFamily: 'Outfit', fontSize: 9,
                        fontWeight: isBest ? 700 : 400,
                        color: isBest ? chColor : 'var(--text-muted)',
                        margin: '4px 0 0',
                      }}>
                        {DOW_SHORT[d]}
                      </p>
                      <p style={{ fontFamily: 'Outfit', fontSize: 8, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                        {idx.toFixed(2)}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p style={{ ...T.body, fontSize: 11, marginTop: 12, lineHeight: 1.45 }}>
                Index 1.0 = 7-day weekly average.
                {expl.weekendBias !== 'neutral'
                  ? ` ${expl.weekendBias === 'weekend' ? 'Weekend' : 'Weekday'} bias is ${expl.dowEffectStrength} — bid strategies can leverage this pattern.`
                  : ' No consistent weekend/weekday bias detected.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── F. Confidence and Uncertainty ─────────────────────────────────── */}
      <div>
        <p style={{ ...T.overline, marginBottom: 6 }}>Confidence and uncertainty</p>
        <p style={{ ...T.body, fontSize: 13, marginBottom: 16, color: 'var(--text-secondary)' }}>
          The optimizer is explicit about what it knows and does not know. Channels with stronger, more consistent historical signals receive more decisive recommendations. Where data is thin or volatile, the model applies caution.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 14 }}>

          {/* Portfolio-level confidence */}
          <div style={{ ...CARD }}>
            <p style={{ ...T.overline, marginBottom: 14 }}>Portfolio signal quality</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 16 }}>
              <p style={{ ...T.num, fontSize: 40, fontWeight: 900, color: confMeta.color, letterSpacing: '-0.04em', margin: 0, lineHeight: 1 }}>
                {portfolioPct}%
              </p>
              <span style={{
                fontFamily: 'Outfit', fontSize: 10, fontWeight: 700,
                color: confMeta.color, backgroundColor: confMeta.bg,
                padding: '3px 9px', borderRadius: 4,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                marginBottom: 4,
              }}>
                {confMeta.label}
              </span>
            </div>
            {/* Confidence bar */}
            <div style={{ height: 5, backgroundColor: 'var(--border-strong)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ height: '100%', width: `${portfolioPct}%`, backgroundColor: confMeta.color, borderRadius: 3, opacity: 0.65 }} />
            </div>
            <p style={{ ...T.body, fontSize: 12, lineHeight: 1.55 }}>
              {confidence.note}
            </p>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              <p style={{ ...T.body, fontSize: 12, lineHeight: 1.55 }}>
                {confidence.tier === 'high'
                  ? 'Strong portfolio-wide signal supports confident reallocation. The model has sufficient data to make meaningful distinctions between channel efficiency levels.'
                  : confidence.tier === 'moderate'
                  ? 'Moderate confidence. Some channels have thin or volatile data, so the model applies stability controls to limit over-aggressive changes.'
                  : 'Exploratory confidence. Data is limited across several channels — treat this recommendation as directional guidance, not a precise answer.'}
              </p>
            </div>
          </div>

          {/* Per-channel confidence table */}
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
              <p style={{ ...T.overline, fontSize: 9 }}>Per-channel signal quality</p>
            </div>
            {CHANNELS.map(ch => {
              const ex = explanation[ch];
              const color = CHANNEL_COLORS[CHANNELS.indexOf(ch) % CHANNEL_COLORS.length];
              if (!ex) return null;
              const conf = channelConfidenceLabel(ex.efficiencyConfidence);
              const barW = Math.round(ex.efficiencyConfidence * 100);
              return (
                <div key={ch} style={{
                  display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 60px 100px 80px',
                  padding: '9px 20px', gap: 8, alignItems: 'center',
                  borderBottom: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                    <ChannelName channel={ch} style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }} />
                  </div>
                  {/* Bar */}
                  <div style={{ height: 4, backgroundColor: 'var(--border-strong)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${barW}%`, backgroundColor: conf.color, opacity: 0.7, borderRadius: 2 }} />
                  </div>
                  <p style={{ fontFamily: 'Outfit', fontSize: 10, fontWeight: 700, color: conf.color, margin: 0 }}>
                    {conf.text} ({barW}%)
                  </p>
                  {ex.isHighVolatility ? (
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontFamily: 'Outfit', fontSize: 9, fontWeight: 600, color: '#FBBF24',
                      backgroundColor: 'rgba(251,191,36,0.09)', padding: '2px 7px', borderRadius: 4,
                    }}>
                      <Activity size={8} /> Volatile
                    </span>
                  ) : (
                    <span style={{
                      fontFamily: 'Outfit', fontSize: 9, fontWeight: 600, color: '#34D399',
                      backgroundColor: 'rgba(52,211,153,0.09)', padding: '2px 7px', borderRadius: 4,
                    }}>
                      Stable
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── G. Recommendation Logic Summary ──────────────────────────────── */}
      <div>
        <p style={{ ...T.overline, marginBottom: 6 }}>Recommendation logic</p>
        <p style={{ ...T.body, fontSize: 13, marginBottom: 16, color: 'var(--text-secondary)' }}>
          Here is why the optimizer reached the recommended allocation — one clear reason per channel.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>

          {/* Scale up */}
          <div style={{ ...CARD, borderColor: 'rgba(52,211,153,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <TrendingUp size={13} color="#34D399" />
              <p style={{ ...T.overline, color: '#34D399' }}>Scale up</p>
            </div>
            <p style={{ ...T.body, fontSize: 12, marginBottom: 14 }}>
              These channels have room to grow — their tuned efficiency and marginal return profile supports higher allocation.
            </p>
            {increases.length === 0 ? (
              <p style={{ ...T.body, fontSize: 12, fontStyle: 'italic' }}>No channels recommended for increase.</p>
            ) : increases.map(ch => {
              const rec = recommendations[ch];
              return (
                <div key={ch} style={{ paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <ChannelName channel={ch} style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }} />
                    <span style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: 700, color: '#34D399' }}>
                      +{(rec?.deltaPct || 0).toFixed(1)}pp
                    </span>
                  </div>
                  <p style={{ ...T.body, fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>
                    {rec?.primaryReasonCode}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Hold */}
          <div style={{ ...CARD, borderColor: 'rgba(148,163,184,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Minus size={13} color="#94a3b8" />
              <p style={{ ...T.overline, color: '#94a3b8' }}>Hold position</p>
            </div>
            <p style={{ ...T.body, fontSize: 12, marginBottom: 14 }}>
              These channels are close to their efficient range — the optimizer sees no strong reason to move them significantly.
            </p>
            {holds.length === 0 ? (
              <p style={{ ...T.body, fontSize: 12, fontStyle: 'italic' }}>No channels at hold position.</p>
            ) : holds.map(ch => {
              const rec = recommendations[ch];
              return (
                <div key={ch} style={{ paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <ChannelName channel={ch} style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }} />
                    <span style={{ fontFamily: 'Outfit', fontSize: 10, fontWeight: 600, color: '#94a3b8', backgroundColor: 'rgba(148,163,184,0.09)', padding: '2px 8px', borderRadius: 4 }}>
                      Hold
                    </span>
                  </div>
                  <p style={{ ...T.body, fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>
                    {rec?.primaryReasonCode || 'Allocation within efficient range'}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Scale back */}
          <div style={{ ...CARD, borderColor: 'rgba(248,113,113,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <TrendingDown size={13} color="#F87171" />
              <p style={{ ...T.overline, color: '#F87171' }}>Scale back</p>
            </div>
            <p style={{ ...T.body, fontSize: 12, marginBottom: 14 }}>
              These channels are receiving more budget than their current marginal return justifies. Reducing their share frees budget for better opportunities.
            </p>
            {decreases.length === 0 ? (
              <p style={{ ...T.body, fontSize: 12, fontStyle: 'italic' }}>No channels recommended for reduction.</p>
            ) : decreases.map(ch => {
              const rec = recommendations[ch];
              return (
                <div key={ch} style={{ paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <ChannelName channel={ch} style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }} />
                    <span style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: 700, color: '#F87171' }}>
                      {(rec?.deltaPct || 0).toFixed(1)}pp
                    </span>
                  </div>
                  <p style={{ ...T.body, fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>
                    {rec?.primaryReasonCode}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── H. Next-step CTA ─────────────────────────────────────────────── */}
      <div style={{
        ...CARD,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 20, flexWrap: 'wrap' as const,
        borderColor: 'rgba(232,128,58,0.22)',
      }}>
        <div>
          <p style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Ready to apply the recommended mix?
          </p>
          <p style={{ ...T.body, fontSize: 12, marginTop: 5 }}>
            Head back to Recommended Mix to review the per-channel allocation and apply it in one click.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          <Link to="/optimizer/current-mix" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 15px', borderRadius: 9,
            border: '1px solid var(--border-strong)',
            backgroundColor: 'var(--bg-root)', color: 'var(--text-secondary)',
            fontFamily: 'Outfit', fontSize: 12, fontWeight: 600, textDecoration: 'none',
          }}>
            <ArrowLeft size={13} /> Back to Current Mix
          </Link>
          <Link to="/optimizer/recommended" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 9,
            background: 'linear-gradient(135deg, #E8803A, #FBBF24)',
            color: '#000', fontFamily: 'Outfit', fontSize: 13, fontWeight: 700,
            textDecoration: 'none', whiteSpace: 'nowrap' as const,
          }}>
            Recommended Mix <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
