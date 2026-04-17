import { useMemo } from 'react';
import { ChannelSummary } from '@/lib/calculations';
import { CHANNELS, CHANNEL_COLORS } from '@/lib/mockData';
import { formatINRCompact } from '@/lib/formatCurrency';
import { ChannelName } from '@/components/ChannelName';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ZAxis, Label,
} from 'recharts';

interface Props {
  summaries: ChannelSummary[];
}

interface BubblePoint {
  channel: string;
  spend: number;
  roas: number;
  customers: number;
  color: string;
}

interface BubbleTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: BubblePoint }>;
}

const CustomTooltip = ({ active, payload }: BubbleTooltipProps) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div style={{ backgroundColor: 'var(--bg-root)', color: '#EDE8E3', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 14px', fontFamily: 'Plus Jakarta Sans', fontSize: 12, boxShadow: 'var(--shadow-lg)' }}>
      <p style={{ fontWeight: 600 }}>{d.channel}</p>
      <p>Spend: {formatINRCompact(d.spend)}</p>
      <p>ROAS: {d.roas.toFixed(1)}x</p>
      <p>New Customers: {d.customers.toLocaleString('en-IN')}</p>
    </div>
  );
};

export function ChannelBubbleChart({ summaries }: Props) {
  const points = useMemo(() =>
    summaries.map(s => ({
      channel: s.channel,
      spend: s.totalSpend,
      roas: s.roas,
      customers: s.newCustomers,
      color: CHANNEL_COLORS[CHANNELS.indexOf(s.channel)],
    })),
  [summaries]);

  const maxCustomers = Math.max(...points.map(p => p.customers));
  const sizes: number[] = [
    Math.round(maxCustomers * 0.25),
    Math.round(maxCustomers * 0.5),
    Math.round(maxCustomers * 0.75),
  ];

  return (
    <div
      className="rounded-2xl card-enter"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-sm)', padding: 24, animationDelay: '420ms', transition: 'transform var(--duration) var(--ease), box-shadow var(--duration) var(--ease), border-color var(--duration) var(--ease)' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = '#3A3835'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
    >
      <h2 style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: '#EDE8E3' }}>Channel Performance Explorer</h2>
      <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: '#4A4640', marginTop: 3 }}>Bubble size = New Customers acquired</p>
      <div style={{ borderBottom: '1px solid var(--border-subtle)', margin: '16px 0' }} />
      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border-subtle)" />
          <XAxis type="number" dataKey="spend" tickFormatter={v => formatINRCompact(v)} tick={{ fontSize: 10, fill: '#3A3835', fontFamily: 'Plus Jakarta Sans' }} axisLine={false} tickLine={false}>
            <Label value="Total Spend" position="bottom" offset={0} style={{ fontSize: 11, fill: '#4A4640', fontFamily: 'Plus Jakarta Sans' }} />
          </XAxis>
          <YAxis type="number" dataKey="roas" tick={{ fontSize: 10, fill: '#3A3835', fontFamily: 'Plus Jakarta Sans' }} axisLine={false} tickLine={false}>
            <Label value="Overall ROAS" angle={-90} position="insideLeft" style={{ fontSize: 11, fill: '#4A4640', fontFamily: 'Plus Jakarta Sans' }} />
          </YAxis>
          <ZAxis type="number" dataKey="customers" range={[200, 2000]} />
          <Tooltip content={<CustomTooltip />} />
          <Scatter data={points} name="channels">
            {points.map((p, i) => (
              <Cell key={i} fill={p.color} fillOpacity={0.7} stroke={p.color} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap items-center gap-4 mt-3 justify-center">
        {points.map((p, i) => (
          <ChannelName key={i} channel={p.channel} style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: '#857F78' }} />
        ))}
      </div>
      <div className="flex items-center gap-4 mt-2 justify-center">
        <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: '#4A4640' }}>Bubble size:</span>
        {sizes.map((s, i) => (
          <span key={i} className="flex items-center gap-1" style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: '#4A4640' }}>
            <span style={{ width: 8 + i * 6, height: 8 + i * 6, borderRadius: '50%', backgroundColor: 'var(--border-strong)', display: 'inline-block' }} />
            {s.toLocaleString('en-IN')}
          </span>
        ))}
      </div>
    </div>
  );
}
