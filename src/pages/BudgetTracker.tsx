import { useMemo, useState } from 'react';
import { useMarketingData } from '@/hooks/useMarketingData';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { ChannelName } from '@/components/ChannelName';
import { CHANNELS } from '@/lib/mockData';
import { formatINRCompact } from '@/lib/formatCurrency';
import { parseLocalDate } from '@/lib/dataBoundaries';
import { useAppContext } from '@/contexts/AppContext';
import { Edit2, Check, AlertCircle, TrendingUp, TrendingDown, Lightbulb } from 'lucide-react';

export default function BudgetTracker() {
  const { data, isLoading } = useMarketingData();
  const { channelBudgets, setChannelBudgets } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [tempBudgets, setTempBudgets] = useState<Record<string, number>>({});
  
  const TOTAL_BUDGET = useMemo(() => Object.values(channelBudgets).reduce((a, b) => a + b, 0), [channelBudgets]);

  const { monthName, channelSpends, totalSpent, daysRemaining, projected, dailyBurnRate, idealDailyBurn, requiredDailyBurn } = useMemo(() => {
    if (!data) return { monthName: '', channelSpends: [], totalSpent: 0, daysRemaining: 0, projected: 0, dailyBurnRate: 0, idealDailyBurn: 0, requiredDailyBurn: 0 };

    const dates = [...new Set(data.map(r => r.date))].sort();
    // Parse as a local-wall-clock date so `getDate()` reports the IST calendar
    // day even when the runtime is in a timezone west of UTC.
    const lastDate = parseLocalDate(dates[dates.length - 1]);
    const year = lastDate.getFullYear();
    const month = lastDate.getMonth();
    const monthName = lastDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayOfMonth = lastDate.getDate() || 1;
    const daysRemaining = daysInMonth - dayOfMonth;

    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthData = data.filter(r => r.date.startsWith(monthStr));

    const channelSpends = CHANNELS.map(ch => {
      const spent = monthData.filter(r => r.channel === ch).reduce((s, r) => s + r.spend, 0);
      const budget = channelBudgets[ch] || 0;
      const pct = budget > 0 ? (spent / budget) * 100 : 0;
      const projectedSpend = dayOfMonth > 0 ? (spent / dayOfMonth) * daysInMonth : 0;
      const pacingRatio = budget > 0 ? projectedSpend / budget : (spent > 0 ? Infinity : 1);

      let status = 'track';
      let recom = 'Maintain current velocity.';
      if (budget === 0 && spent === 0) {
        recom = 'No budget set for this channel.';
      } else if (pacingRatio > 1.05) {
        status = 'critical';
        recom = `Throttle spend. Projected to overshoot by ${formatINRCompact(Math.max(0, projectedSpend - budget))}.`;
      } else if (pacingRatio < 0.95) {
        status = 'surplus';
        recom = `Capacity to scale. ${formatINRCompact(Math.max(0, budget - projectedSpend))} projected surplus.`;
      }

      return { channel: ch, spent, budget, pct: Math.min(pct, 100), projectedSpend, status, recom };
    });

    const totalSpent = channelSpends.reduce((s, c) => s + c.spent, 0);
    const projected = dayOfMonth > 0 ? (totalSpent / dayOfMonth) * daysInMonth : 0;
    
    // Velocity metrics
    const dailyBurnRate = totalSpent / dayOfMonth;
    const idealDailyBurn = TOTAL_BUDGET / daysInMonth;
    const requiredDailyBurn = daysRemaining > 0 ? Math.max(0, (TOTAL_BUDGET - totalSpent) / daysRemaining) : 0;

    return { monthName, channelSpends, totalSpent, daysRemaining, projected, dailyBurnRate, idealDailyBurn, requiredDailyBurn };
  }, [data, channelBudgets, TOTAL_BUDGET]);

  if (isLoading) return <DashboardSkeleton />;

  const critical = channelSpends.filter(c => c.status === 'critical').sort((a,b) => b.projectedSpend - a.projectedSpend);
  const track = channelSpends.filter(c => c.status === 'track').sort((a,b) => b.projectedSpend - a.projectedSpend);
  const surplus = channelSpends.filter(c => c.status === 'surplus').sort((a,b) => b.projectedSpend - a.projectedSpend);

  type ChannelSpendRow = (typeof channelSpends)[number];

  const renderChannelRow = (row: ChannelSpendRow) => (
    <div key={row.channel} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
    <div style={{
      display: 'grid', gridTemplateColumns: '180px 180px 1fr 120px', alignItems: 'center', gap: 20,
      padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'transparent',
      minWidth: 580,
    }}>
      <ChannelName channel={row.channel} style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }} />
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatINRCompact(row.spent)}</span> / {formatINRCompact(row.budget)}
        </span>
        <div style={{ height: 6, backgroundColor: 'var(--border-strong)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${row.pct}%`, backgroundColor: row.status === 'critical' ? '#EF4444' : row.status === 'surplus' ? '#3B82F6' : '#10B981', borderRadius: 999 }} />
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ padding: '6px 12px', backgroundColor: 'var(--bg-root)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-muted)' }}>{row.recom}</span>
        </div>
        {isEditing && (
          <input 
            type="number"
            value={tempBudgets[row.channel] || 0}
            onChange={(e) => setTempBudgets(prev => ({ ...prev, [row.channel]: Number(e.target.value) }))}
            style={{ backgroundColor: 'var(--bg-root)', border: '1px solid #E8803A', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: 6, width: '100px', fontSize: 12, outline: 'none' }}
          />
        )}
      </div>

      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>EOM Proj.</span>
        <span style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: row.status === 'critical' ? '#EF4444' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatINRCompact(row.projectedSpend)}</span>
      </div>
    </div>
    </div>
  );

  const statusColor = projected > TOTAL_BUDGET * 1.05 ? '#EF4444' : projected < TOTAL_BUDGET * 0.95 ? '#3B82F6' : '#10B981';

  return (
    <div className="mobile-page budget-page" style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* Header & Controls */}
      <div className="mobile-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>Budget Tracker</h1>
          <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{monthName} Pacing Analytics</p>
        </div>
        <button
          onClick={() => {
            if (isEditing) { setChannelBudgets(tempBudgets); setIsEditing(false); } 
            else { setTempBudgets(channelBudgets); setIsEditing(true); }
          }}
          className="flex items-center gap-2 px-4 py-2 transition-colors"
          style={{ backgroundColor: isEditing ? '#E8803A' : 'var(--bg-card)', border: isEditing ? 'none' : '1px solid var(--border-subtle)', borderRadius: 8, color: isEditing ? '#fff' : 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans', fontSize: 12, fontWeight: 600 }}
        >
          {isEditing ? <><Check size={14} className="text-white" /> Save Targets</> : <><Edit2 size={14} /> Edit Targets</>}
        </button>
      </div>

      {/* Top Split Panel */}
      <div className="budget-top-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1.2fr) 1fr', gap: 20 }}>
        {/* Macro View */}
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 16, padding: '24px 28px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Global Allocation Used</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                <span style={{ fontFamily: 'Outfit', fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{formatINRCompact(totalSpent)}</span>
                <span style={{ fontFamily: 'Outfit', fontSize: 18, fontWeight: 500, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>/ {formatINRCompact(TOTAL_BUDGET)}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-muted)' }}>Status</span>
              <p style={{ fontFamily: 'Outfit', fontSize: 16, fontWeight: 700, color: statusColor, marginTop: 2 }}>
                {projected > TOTAL_BUDGET * 1.05 ? 'Overspending' : projected < TOTAL_BUDGET * 0.95 ? 'Surplus Capacity' : 'On Track'}
              </p>
            </div>
          </div>
          <div style={{ width: '100%', height: 8, backgroundColor: 'var(--border-strong)', borderRadius: 999, marginTop: 24, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min((totalSpent / TOTAL_BUDGET) * 100, 100)}%`, backgroundColor: statusColor, borderRadius: 999, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-secondary)' }}>{daysRemaining} days remaining in cycle</span>
            <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-secondary)' }}>Projected: <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatINRCompact(projected)}</strong></span>
          </div>
        </div>

        {/* Velocity & Burn */}
        <div className="budget-velocity-grid" style={{ backgroundColor: 'var(--bg-card)', borderRadius: 16, padding: '24px 28px', border: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {dailyBurnRate > idealDailyBurn ? <TrendingUp size={16} color="#EF4444" /> : <TrendingDown size={16} color="#3B82F6" />}
              <span style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Daily Velocity</span>
            </div>
            <span style={{ fontFamily: 'Outfit', fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{formatINRCompact(dailyBurnRate)}<span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>/day</span></span>
            <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Current burn rate</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: '1px solid var(--border-subtle)', paddingLeft: 20 }}>
            <span style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Target Velocity</span>
            <span style={{ fontFamily: 'Outfit', fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{formatINRCompact(requiredDailyBurn)}<span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>/day</span></span>
            <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Required to hit target exactly</span>
          </div>
        </div>
      </div>

      {/* Segmented Channel Grids */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, marginTop: 8 }}>
        {/* Critical Array */}
        {critical.length > 0 && (
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 16, border: '1px solid rgba(239, 68, 68, 0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} color="#EF4444" />
              <span style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: '#EF4444', letterSpacing: '0.02em' }}>Critical Overspend Detected ({critical.length})</span>
            </div>
            {critical.map(renderChannelRow)}
          </div>
        )}

        {/* On Track Array */}
        {track.length > 0 && (
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', backgroundColor: 'var(--border-subtle)', borderBottom: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Check size={16} color="#10B981" />
              <span style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>Pacing On Schedule ({track.length})</span>
            </div>
            {track.map(renderChannelRow)}
          </div>
        )}

        {/* Surplus Array */}
        {surplus.length > 0 && (
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 16, border: '1px solid rgba(59, 130, 246, 0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', backgroundColor: 'rgba(59, 130, 246, 0.05)', borderBottom: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lightbulb size={16} color="#3B82F6" />
              <span style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 700, color: '#3B82F6', letterSpacing: '0.02em' }}>Surplus Allocation / Room to Scale ({surplus.length})</span>
            </div>
            {surplus.map(renderChannelRow)}
          </div>
        )}
      </div>

      {/* Footer Methodology Note */}
      <div className="flex items-start gap-2 p-4 rounded-xl mt-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', width: '100%' }}>
        <Lightbulb size={16} style={{ color: '#FBBF24', marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Methodology: </span> 
          Budget pacing and end-of-month estimates are calculated based on your current daily spend rate. Status alerts appear if a channel deviates more than 5% from its target. The suggested actions safely guide reallocations, but always defer to your own strategic goals.
        </p>
      </div>
    </div>
  );
}
