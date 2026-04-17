import { useMemo } from 'react';
import { ChannelSummary } from '@/lib/calculations';
import { CHANNELS, CHANNEL_COLORS } from '@/lib/mockData';
import { formatINRCompact } from '@/lib/formatCurrency';
import { ChannelName } from '@/components/ChannelName';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine, Cell, Label,
} from 'recharts';
import { Star, Diamond, AlertTriangle, Scissors } from 'lucide-react';

interface Props {
  summaries: ChannelSummary[];
}

function getQuadrant(spend: number, roas: number, medSpend: number, medRoas: number) {
  if (spend >= medSpend && roas >= medRoas) return { label: 'Efficiency Cluster', icon: Star, color: '#34D399' };
  if (spend < medSpend && roas >= medRoas) return { label: 'Growth Opportunity', icon: Diamond, color: '#FBBF24' };
  if (spend >= medSpend && roas < medRoas) return { label: 'Review Efficiency', icon: AlertTriangle, color: '#F87171' };
  return { label: 'Pivot Required', icon: Scissors, color: '#94A3B8' };
}

interface MatrixPoint {
  channel: string;
  spend: number;
  roas: number;
  color: string;
}

interface MatrixTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: MatrixPoint }>;
  medSpend: number;
  medRoas: number;
}

const CustomTooltip = ({ active, payload, medSpend, medRoas }: MatrixTooltipProps) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  const quad = getQuadrant(d.spend, d.roas, medSpend, medRoas);
  return (
    <div style={{ backgroundColor: 'var(--bg-root)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 14px', fontFamily: 'Plus Jakarta Sans', fontSize: 12, boxShadow: 'var(--shadow-lg)' }}>
      <p style={{ fontWeight: 600, marginBottom: 8 }}>{d.channel}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={{ margin: 0 }}>ROAS: <span style={{ fontWeight: 600 }}>{d.roas.toFixed(1)}x</span></p>
        <p style={{ margin: 0 }}>Spend: <span style={{ fontWeight: 600 }}>{formatINRCompact(d.spend)}</span></p>
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-muted)' }}>Status:</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: quad.color, fontWeight: 700 }}>
            {(() => {
              const Icon = quad.icon;
              return <Icon size={12} />;
            })()}
            {quad.label}
          </span>
        </div>
      </div>
    </div>
  );
};

export function SpendEfficiencyMatrix({ summaries }: Props) {
  const { points, medSpend, medRoas, maxSpend, maxRoas } = useMemo(() => {
    const pts = summaries.map(s => ({
      channel: s.channel,
      spend: s.totalSpend,
      roas: s.roas,
      color: CHANNEL_COLORS[CHANNELS.indexOf(s.channel)],
    }));
    const spends = pts.map(p => p.spend).sort((a, b) => a - b);
    const roases = pts.map(p => p.roas).sort((a, b) => a - b);
    const mid = Math.floor(spends.length / 2);
    const medS = spends.length % 2 ? spends[mid] : (spends[mid - 1] + spends[mid]) / 2;
    const medR = roases.length % 2 ? roases[mid] : (roases[mid - 1] + roases[mid]) / 2;
    return {
      points: pts, medSpend: medS, medRoas: medR,
      maxSpend: Math.max(...spends) * 1.2, maxRoas: Math.max(...roases) * 1.25,
    };
  }, [summaries]);

  return (
    <div
      className="rounded-2xl card-enter"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-sm)', padding: 24, transition: 'transform var(--duration) var(--ease), box-shadow var(--duration) var(--ease), border-color var(--duration) var(--ease)' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = '#3A3835'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
    >
      <h2 style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Spend Efficiency Matrix</h2>
      <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>BCG-style quadrant: spend vs ROAS per channel</p>
      <div style={{ borderBottom: '1px solid var(--border-subtle)', margin: '16px 0' }} />
      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 30, right: 40, bottom: 30, left: 30 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
          <ReferenceArea x1={medSpend} x2={maxSpend} y1={medRoas} y2={maxRoas} fill="rgba(127,175,123,0.08)" fillOpacity={1} label={{ value: 'Efficiency Cluster', position: 'insideTopRight', fontSize: 10, fill: '#34D399', fontWeight: 600 }} />
          <ReferenceArea x1={0} x2={medSpend} y1={medRoas} y2={maxRoas} fill="rgba(212,169,106,0.08)" fillOpacity={1} label={{ value: 'Growth Opportunity', position: 'insideTopLeft', fontSize: 10, fill: '#FBBF24', fontWeight: 600 }} />
          <ReferenceArea x1={medSpend} x2={maxSpend} y1={0} y2={medRoas} fill="rgba(193,123,111,0.08)" fillOpacity={1} label={{ value: 'Review Efficiency', position: 'insideBottomRight', fontSize: 10, fill: '#F87171', fontWeight: 600 }} />
          <ReferenceArea x1={0} x2={medSpend} y1={0} y2={medRoas} fill="rgba(138,155,168,0.08)" fillOpacity={1} label={{ value: 'Pivot Required', position: 'insideBottomLeft', fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} />
          <ReferenceLine x={medSpend} stroke="var(--border-strong)" strokeDasharray="4 4" />
          <ReferenceLine y={medRoas} stroke="var(--border-strong)" strokeDasharray="4 4" />
          <XAxis type="number" dataKey="spend" tickFormatter={v => formatINRCompact(v)} tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'Plus Jakarta Sans' }} axisLine={false} tickLine={false} domain={[0, maxSpend]}>
            <Label value="Total Spend" position="bottom" offset={0} style={{ fontSize: 11, fill: 'var(--text-secondary)', fontFamily: 'Plus Jakarta Sans' }} />
          </XAxis>
          <YAxis
            type="number" dataKey="roas"
            tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'Plus Jakarta Sans' }}
            axisLine={false} tickLine={false}
            domain={[0, 'auto']}
            ticks={[0, 3, 6, 9, 12]}
          >
            <Label value="Avg ROAS" angle={-90} position="insideLeft" style={{ fontSize: 11, fill: 'var(--text-secondary)', fontFamily: 'Plus Jakarta Sans' }} />
          </YAxis>
          <Tooltip content={<CustomTooltip medSpend={medSpend} medRoas={medRoas} />} />
          <Scatter data={points} name="channels">
            {points.map((p, i) => (
              <Cell key={i} fill={p.color} stroke={p.color} r={10} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 mt-3 justify-center">
        {points.map((p, i) => (
          <ChannelName key={i} channel={p.channel} style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-secondary)' }} />
        ))}
      </div>
    </div>
  );
}
