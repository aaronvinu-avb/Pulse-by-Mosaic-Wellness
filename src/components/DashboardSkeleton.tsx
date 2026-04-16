export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="skeleton-shimmer rounded-lg h-9 w-9 mb-4" />
            <div className="skeleton-shimmer rounded h-8 w-28 mb-2" />
            <div className="skeleton-shimmer rounded h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="skeleton-shimmer rounded h-4 w-40 mb-4" />
        <div className="skeleton-shimmer rounded-xl h-[300px] w-full" />
      </div>
      <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="skeleton-shimmer rounded h-4 w-48 mb-4" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex gap-4 mb-3">
            <div className="skeleton-shimmer rounded h-4 w-24" />
            <div className="skeleton-shimmer rounded h-4 flex-1" />
            <div className="skeleton-shimmer rounded h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
