import { useMemo, useState } from 'react';
import { useMarketingData } from '@/hooks/useMarketingData';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { ChannelName } from '@/components/ChannelName';
import { getChannelSummaries, getChannelSaturationModels, computeScenarios, projectRevenue } from '@/lib/calculations';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import { CHANNELS, CHANNEL_COLORS } from '@/lib/mockData';
import { CalendarRange, Shield, Zap, TrendingUp, Sliders } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Slider } from '@/components/ui/slider';

const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: 'var(--bg-root)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)',
    borderRadius: 10, padding: '10px 14px', fontFamily: 'Plus Jakarta Sans', fontSize: 12,
    boxShadow: 'var(--shadow-lg)',
  },
  itemStyle: { color: 'var(--text-primary)' },
  labelStyle: { color: 'var(--text-secondary)' },
};

export default function ScenarioPlanner() {
  const { data, isLoading } = useMarketingData();
  const [marketMultiplier, setMarketMultiplier] = useState(1.0);

  const budgets = [3000000, 5000000, 8000000];
  const scenarioLabels = ['Conservative', 'Target (AI)', 'Aggressive'];
  const scenarioIcons = [Shield, Zap, TrendingUp];
  const scenarioColors = ['#60A5FA', '#E8803A', '#A78BFA'];

  const models = useMemo(() => data ? getChannelSaturationModels(data) : [], [data]);

  const globalMultipliers = useMemo(() => {
    const m: Record<string, number> = {};
    CHANNELS.forEach(ch => (m[ch] = marketMultiplier));
    return m;
  }, [marketMultiplier]);

  const scenarios = useMemo(() => 
    models.length > 0 ? computeScenarios(models, budgets, new Set(), globalMultipliers) : [],
  [models, marketMultiplier]);

  const projectionData = useMemo(() => {
    if (scenarios.length < 3) return [];
    const results = [];
    for (let day = 1; day <= 30; day++) {
      const dailyWeights = day / 30;
      results.push({
        day: `Day ${day}`,
        conservative: Math.round((scenarios[0].revenue / 30) * day),
        target: Math.round((scenarios[1].revenue / 30) * day),
        aggressive: Math.round((scenarios[2].revenue / 30) * day),
      });
    }
    return results;
  }, [scenarios]);

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8" style={{ maxWidth: 1280 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
            Scenario Planner
          </h1>
          <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>Model budget scenarios across varying market conditions</p>
          <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)', padding: '6px 12px', borderRadius: 8 }}>
            <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Baseline Modeled Spend: </span>
            <span style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginLeft: 8 }}>₹{formatINRCompact(5000000)} / mo</span>
          </div>
        </div>

        {/* Sensitivity Control */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: '16px 20px', width: 320, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sliders size={14} style={{ color: '#E8803A' }} />
              <span style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Market Sensitivity</span>
            </div>
            <span style={{ fontFamily: 'Outfit', fontSize: 12, fontWeight: 700, color: '#E8803A', backgroundColor: 'rgba(232,128,58,0.1)', padding: '2px 8px', borderRadius: 6 }}>
              {Math.round(marketMultiplier * 100)}%
            </span>
          </div>
          <Slider 
            value={[marketMultiplier]} 
            min={0.5} 
            max={1.5} 
            step={0.01} 
            onValueChange={([v]) => setMarketMultiplier(v)} 
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 9, color: 'var(--text-muted)' }}>Trough (0.5x)</span>
            <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 9, color: 'var(--text-muted)' }}>Peak (1.5x)</span>
          </div>
        </div>
      </div>

      {/* Triple Scenario Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {scenarios.map((s, i) => {
          const Icon = scenarioIcons[i];
          const color = scenarioColors[i];
          return (
            <div key={i} style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${color}30`, borderRadius: 20, padding: 24, boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: `radial-gradient(circle at top right, ${color}15, transparent)`, pointerEvents: 'none' }} />
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ padding: 8, borderRadius: 10, backgroundColor: `${color}15` }}>
                  <Icon size={18} style={{ color }} />
                </div>
                <h3 style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{scenarioLabels[i]}</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Projected Monthly Revenue</p>
                  <p style={{ fontFamily: 'Outfit', fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{formatINRCompact(s.revenue)}</p>
                </div>

                <div style={{ display: 'flex', gap: 20 }}>
                  <div>
                    <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 10, color: 'var(--text-muted)' }}>Budget</p>
                    <p style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>{formatINRCompact(s.budget)}</p>
                  </div>
                  <div>
                    <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 10, color: 'var(--text-muted)' }}>Est. ROAS</p>
                    <p style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: color }}>{s.roas.toFixed(2)}x</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Multi-Series Forecast Chart */}
      <div
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 24, padding: 32, boxShadow: 'var(--shadow-sm)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontFamily: 'Outfit', fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Strategic Forecast (30 Days)</h2>
            <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Compare revenue growth velocity across budget tiers</p>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {scenarioLabels.map((l, i) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: scenarioColors[i] }} />
                <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderBottom: '1px solid var(--border-subtle)', margin: '16px 0' }} />
        
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={projectionData}>
            <defs>
              {scenarioColors.map((c, i) => (
                <linearGradient key={i} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={c} stopOpacity={0.1}/>
                  <stop offset="95%" stopColor={c} stopOpacity={0}/>
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'Plus Jakarta Sans' }} axisLine={false} tickLine={false} interval={4} />
            <YAxis tickFormatter={(v: number) => formatINRCompact(v)} tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'Plus Jakarta Sans' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: number) => formatINR(v)} {...chartTooltipStyle} />
            
            <Area type="monotone" dataKey="aggressive" stroke={scenarioColors[2]} fill={`url(#grad-2)`} strokeWidth={2.5} />
            <Area type="monotone" dataKey="target" stroke={scenarioColors[1]} fill={`url(#grad-1)`} strokeWidth={2.5} />
            <Area type="monotone" dataKey="conservative" stroke={scenarioColors[0]} fill={`url(#grad-0)`} strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 20, padding: 24 }}>
          <h2 style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>AI Strategic Advisory</h2>
          <div style={{ padding: 16, borderRadius: 12, backgroundColor: 'rgba(232,128,58,0.05)', border: '1px solid rgba(232,128,58,0.1)' }}>
            <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {marketMultiplier > 1.1 ? (
                <span>High market efficiency detected. The model recommends shifting towards the <strong style={{ color: '#A78BFA' }}>Aggressive</strong> scenario to capture momentum, as marginal ROAS remains above breakeven even at scale.</span>
              ) : marketMultiplier < 0.9 ? (
                <span>Market headwinds detected. Efficiency is dropping across core channels. Consider reverting to the <strong style={{ color: '#60A5FA' }}>Conservative</strong> tier to protect margins until demand indices recover.</span>
              ) : (
                <span>Market conditions are stable. The <strong style={{ color: '#E8803A' }}>Target (AI)</strong> scenario offers the most balanced "Efficient Growth" path, maximizing revenue without significant ROI dilution.</span>
              )}
            </p>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 20, padding: 20 }}>
            <h2 style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Efficiency Trend</h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-secondary)' }}>Aggressive Volume Lift</span>
                <span style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: '#34D399' }}>
                    +{scenarios.length > 2 ? Math.round(((scenarios[2].revenue / scenarios[0].revenue) - 1) * 100) : 0}%
                </span>
            </div>
            <div style={{ height: 1, backgroundColor: 'var(--border-subtle)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-secondary)' }}>Incremental ROAS Drop</span>
                <span style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: '#F87171' }}>
                    -{scenarios.length > 2 ? Math.round((1 - (scenarios[2].roas / scenarios[0].roas)) * 100) : 0}%
                </span>
            </div>
        </div>
      </div>
      
      {/* Footer Methodology Note */}
      <div className="flex items-start gap-2 p-4 rounded-xl mt-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', width: '100%' }}>
        <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Methodology: </span> 
          The Scenario Planner tests different budget levels to forecast potential revenue. It accounts for overall market conditions by adjusting performance up or down. These outputs offer strategic estimates to guide risk management, rather than guaranteed results.
        </p>
      </div>
    </div>
  );
}

