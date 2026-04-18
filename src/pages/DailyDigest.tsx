import { useMemo } from 'react';
import { useMarketingData } from '@/hooks/useMarketingData';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { ChannelName } from '@/components/ChannelName';
import { CHANNELS } from '@/lib/mockData';
import { formatINRCompact } from '@/lib/formatCurrency';

export default function DailyDigest() {
  const { data, isLoading } = useMarketingData();

  const { yesterday, channelRows, best, worst, totalRevenue } = useMemo(() => {
    if (!data) return { yesterday: '', channelRows: [], best: null, worst: null, totalRevenue: 0 };

    const dates = [...new Set(data.map(r => r.date))].sort();
    const yesterdayDate = dates[dates.length - 1];
    const trailing30Dates = new Set(dates.slice(-30));

    const channelRows = CHANNELS.map(ch => {
      const yesterdayRecords = data.filter(r => r.date === yesterdayDate && r.channel === ch);
      const ySpend = yesterdayRecords.reduce((s, r) => s + r.spend, 0);
      const yRevenue = yesterdayRecords.reduce((s, r) => s + r.revenue, 0);

      const baselineRecords = data.filter(r => r.channel === ch && trailing30Dates.has(r.date));
      const uniqueDays = new Set(baselineRecords.map(r => r.date)).size;
      const avgRevenue = baselineRecords.reduce((s, r) => s + r.revenue, 0) / (uniqueDays || 1);

      const vsAvg = avgRevenue > 0 ? ((yRevenue - avgRevenue) / avgRevenue) * 100 : 0;
      const roas = ySpend > 0 ? yRevenue / ySpend : 0;

      return { channel: ch, spend: ySpend, revenue: yRevenue, vsAvg, roas, aboveAvg: vsAvg >= 0 };
    });

    const totalRevenue = channelRows.reduce((s, r) => s + r.revenue, 0);
    const best = channelRows.reduce((a, b) => a.roas > b.roas ? a : b);
    const worst = channelRows.reduce((a, b) => a.roas < b.roas ? a : b);

    const d = new Date(yesterdayDate);
    const yesterday = d.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return { yesterday, channelRows, best, worst, totalRevenue };
  }, [data]);

  if (isLoading) return <DashboardSkeleton />;

  const summaryCards = [
    { label: 'Best Performer', value: best?.channel || '-', sub: `ROAS ${best?.roas.toFixed(1)}x`, accent: '#34D399' },
    { label: 'Worst Performer', value: worst?.channel || '-', sub: `ROAS ${worst?.roas.toFixed(1)}x`, accent: '#F87171' },
    { label: 'Total Revenue', value: formatINRCompact(totalRevenue), sub: 'combined across all channels', accent: '#FB923C' },
  ];

  return (
    <div className="mobile-page digest-page" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontFamily: 'Outfit', fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>Daily Digest</h1>
        <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Latest Available Data: {yesterday}</p>
        <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Dataset covers Jan 2023 – Dec 2025. Showing most recent date in the dataset.</p>
      </div>

      <div className="digest-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {summaryCards.map((c, i) => (
          <div key={i} style={{ backgroundColor: 'var(--bg-card)', borderRadius: 12, padding: '20px 24px', border: '1px solid var(--border-subtle)' }}>
            <p style={{ fontFamily: 'Outfit', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{c.label}</p>
            <p style={{ fontFamily: 'Outfit', fontSize: 22, fontWeight: 700, color: c.accent, margin: '8px 0 4px', letterSpacing: '-0.02em' }}>{c.value}</p>
            <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{c.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Channel', 'Spend', 'Revenue', 'vs. Average', 'Status'].map(h => (
                <th key={h} style={{
                  fontFamily: 'Outfit', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
                  textTransform: 'uppercase', letterSpacing: '0.08em', padding: '12px 16px',
                  textAlign: 'left', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {channelRows.map((row, i) => (
              <tr key={i} style={{ borderBottom: i < channelRows.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <td style={{ padding: '12px 16px', fontFamily: 'Plus Jakarta Sans', fontSize: 13, color: 'var(--text-primary)' }}>
                  <ChannelName channel={row.channel} />
                </td>
                <td style={{ padding: '12px 16px', fontFamily: 'Plus Jakarta Sans', fontSize: 13, color: 'var(--text-primary)' }}>{formatINRCompact(row.spend)}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'Plus Jakarta Sans', fontSize: 13, color: 'var(--text-primary)' }}>{formatINRCompact(row.revenue)}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'Plus Jakarta Sans', fontSize: 13, color: row.aboveAvg ? '#34D399' : '#F87171', fontWeight: 600 }}>
                  {row.aboveAvg ? '+' : ''}{row.vsAvg.toFixed(1)}%
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px',
                    borderRadius: 999,
                    backgroundColor: row.aboveAvg ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                    color: row.aboveAvg ? '#34D399' : '#F87171',
                    fontFamily: 'Outfit', fontSize: 11, fontWeight: 700,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'currentColor', display: 'inline-block' }} />
                    {row.aboveAvg ? 'Above Avg' : 'Below Avg'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-start gap-2 p-4 rounded-xl mt-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', width: '100%' }}>
        <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Methodology: </span> 
          Daily snapshots represent reported metrics for the most recent complete date. Average comparisons use a trailing 30-day baseline to account for normal day-of-week volatility.
        </p>
      </div>
    </div>
  );
}
