import { useQuery } from '@tanstack/react-query';
import { MarketingRecord, generateMockData } from '@/lib/mockData';
import { getAggregatedState } from '@/lib/calculations';
import { useAppContext } from '@/contexts/AppContext';
import { useMemo, useRef, useEffect } from 'react';
import { getCache, setCache } from '@/lib/storage';
import { auditMarketingData, logDataQualityReport, type DataQualityReport } from '@/lib/dataQuality';
import { computeDataBoundaries, subtractDays, type DataBoundaries } from '@/lib/dataBoundaries';

const API_BASE = 'https://mosaicfellowship.in/api/data/marketing/daily';
const PAGINATION_LIMIT = 500;
const CONCURRENCY_LIMIT = 6;
const CACHE_KEY = 'marketing_data_v1';
const CACHE_TTL = 1000 * 3600 * 24; // 24 hours

interface UseMarketingDataOptions {
  includeGlobalAggregate?: boolean;
}

type DataSource = 'api' | 'mock' | 'loading' | 'cached';
type MarketingDataResult = {
  records: MarketingRecord[];
  source: DataSource;
  /** Count of raw rows that failed normalization (missing date/channel/day_of_week). */
  droppedDuringNormalization: number;
};

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeRecord(input: unknown): MarketingRecord | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  if (typeof raw.date !== 'string' || typeof raw.channel !== 'string' || typeof raw.day_of_week !== 'string') {
    return null;
  }

  return {
    date: raw.date,
    day_of_week: raw.day_of_week,
    channel: raw.channel,
    spend: toNumber(raw.spend),
    revenue: toNumber(raw.revenue),
    roas: toNumber(raw.roas),
    impressions: toNumber(raw.impressions),
    clicks: toNumber(raw.clicks),
    conversions: toNumber(raw.conversions),
    new_customers: toNumber(raw.new_customers),
    ctr: toNumber(raw.ctr),
    cpc: toNumber(raw.cpc),
    cpa: toNumber(raw.cpa),
    aov: toNumber(raw.aov),
  };
}

function normalizeRecords(records: unknown[]): { records: MarketingRecord[]; dropped: number } {
  let dropped = 0;
  const out: MarketingRecord[] = [];
  for (const raw of records) {
    const r = normalizeRecord(raw);
    if (r) out.push(r); else dropped += 1;
  }
  return { records: out, dropped };
}

/**
 * Fetches multiple pages in parallel with concurrency control
 */
async function fetchInChunks(totalPages: number): Promise<MarketingRecord[]> {
  const results: MarketingRecord[][] = [];
  const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2); // Pages 2..N

  for (let i = 0; i < pages.length; i += CONCURRENCY_LIMIT) {
    const chunk = pages.slice(i, i + CONCURRENCY_LIMIT);
    const chunkResults = await Promise.all(
      chunk.map(async (page) => {
        const res = await fetch(`${API_BASE}?page=${page}&limit=${PAGINATION_LIMIT}`);
        if (!res.ok) throw new Error(`API error on page ${page}: ${res.status}`);
        const json = await res.json();
        return Array.isArray(json) ? json : json.data ?? json.results ?? [];
      })
    );
    results.push(...chunkResults);
  }

  return results.flat();
}

async function fetchAllPages(): Promise<MarketingRecord[]> {
  const start = performance.now();
  
  // 1. Fetch first page to get metadata
  const res = await fetch(`${API_BASE}?page=1&limit=${PAGINATION_LIMIT}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const firstPageJson = await res.json();
  
  const firstPageRecords: MarketingRecord[] = Array.isArray(firstPageJson) 
    ? firstPageJson 
    : firstPageJson.data ?? firstPageJson.results ?? [];
  
  if (firstPageRecords.length === 0) throw new Error('No data returned');

  const totalPages = firstPageJson.pagination?.total_pages ?? 1;
  const allRecords = [...firstPageRecords];

  // 2. Fetch remaining pages in parallel
  if (totalPages > 1) {
    const remaining = await fetchInChunks(totalPages);
    allRecords.push(...remaining);
  }

  const end = performance.now();
  const meta = firstPageJson.pagination;
  console.log(
    `[Luma] Fetched ${allRecords.length} records across ${totalPages} page(s) in ${((end - start) / 1000).toFixed(2)}s` +
      (meta ? ` (API total_records=${meta.total_records ?? 'n/a'}, page_size=${meta.page_size ?? PAGINATION_LIMIT})` : ''),
  );
  if (meta && typeof meta.total_records === 'number' && meta.total_records !== allRecords.length) {
    console.warn(
      `[Luma] Record count mismatch — API advertised ${meta.total_records} total_records but we received ${allRecords.length}. Pagination may be incomplete.`,
    );
  }

  return allRecords;
}

export function useMarketingData(options: UseMarketingDataOptions = {}) {
  const { includeGlobalAggregate = false } = options;
  const query = useQuery<MarketingDataResult>({
    queryKey: ['marketing-data'],
    queryFn: async () => {
      // 1. Try Cache First
      const cached = await getCache<MarketingRecord[]>(CACHE_KEY);
      if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        console.log('[Luma] Loading from IndexedDB Cache');
        const { records, dropped } = normalizeRecords(cached.data);
        return { records, source: 'cached', droppedDuringNormalization: dropped };
      }

      // 2. Try API
      try {
        const data = await fetchAllPages();
        const { records, dropped } = normalizeRecords(data);

        // Save to cache (fire and forget)
        setCache(CACHE_KEY, records).catch(err => console.error('Cache save failed:', err));

        return { records, source: 'api', droppedDuringNormalization: dropped };
      } catch (err) {
        console.warn('API/Cache unavailable, using mock data:', err);

        // Final fallback to mock data — mock data has no malformed rows.
        return { records: generateMockData(), source: 'mock', droppedDuringNormalization: 0 };
      }
    },
    staleTime: Infinity,
    retry: false,
  });


  const { dateFilter } = useAppContext();

  // Run the data quality audit exactly once per successful fetch (per source).
  // The report is logged to console AND attached to the hook return so any page
  // can consume it (e.g. a diagnostics surface) without recomputing.
  const auditReport: DataQualityReport | null = useMemo(() => {
    if (!query.data?.records) return null;
    return auditMarketingData(query.data.records, query.data.droppedDuringNormalization);
  }, [query.data]);

  const lastLoggedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!query.data || !auditReport) return;
    const key = `${query.data.source}:${query.data.records.length}:${query.dataUpdatedAt}`;
    if (lastLoggedKeyRef.current === key) return;
    lastLoggedKeyRef.current = key;
    logDataQualityReport(auditReport);
  }, [query.data, auditReport, query.dataUpdatedAt]);

  // Boundaries are derived from the FULL unfiltered dataset so every page
  // agrees on the real earliest/latest/available years — even when a narrow
  // filter like "Last 30 Days" is active.
  const boundaries: DataBoundaries | null = useMemo(
    () => computeDataBoundaries(query.data?.records),
    [query.data],
  );

  const filteredData = useMemo(() => {
    if (!query.data?.records) return undefined;
    if (dateFilter === 'all' || !boundaries) return query.data.records;

    // String-based grouping/filtering for performance. All window math is
    // anchored to the latest AVAILABLE data date (not `Date.now()`), so the
    // app behaves correctly on the day the dataset ends mid-range.
    if (dateFilter === 'last30' || dateFilter === 'last90') {
      const windowDays = dateFilter === 'last30' ? 30 : 90;
      // Inclusive window: N days ending on (and including) the latest date.
      // Subtracting (windowDays - 1) yields exactly N calendar days.
      const cutoff = subtractDays(boundaries.latestDate, windowDays - 1);
      return query.data.records.filter(r => r.date >= cutoff);
    }

    // Year filters — only honoured if the year actually exists in the data.
    const yearMatch = /^(\d{4})$/.exec(dateFilter);
    if (yearMatch) {
      const year = yearMatch[1];
      if (!boundaries.availableYears.includes(Number(year))) {
        // Gracefully degrade to the full dataset rather than rendering empty.
        return query.data.records;
      }
      return query.data.records.filter(r => r.date.startsWith(year));
    }

    return query.data.records;
  }, [query.data, dateFilter, boundaries]);

  // globalAggregate is derived from the full unfiltered history (for training/YoY)
  const globalAggregate = useMemo(() => {
    if (!includeGlobalAggregate) return undefined;
    if (!query.data?.records) return undefined;
    return getAggregatedState(query.data.records);
  }, [query.data, includeGlobalAggregate]);

  // aggregate is always derived from the same data the pages see (for UI display)
  const aggregate = useMemo(() => {
    if (!filteredData) return undefined;
    return getAggregatedState(filteredData);
  }, [filteredData]);

  return {
    ...query,
    data: filteredData,
    aggregate,
    globalAggregate,
    dataSource: query.data ? query.data.source : 'loading',
    /** ms epoch — when the query last successfully resolved (API, cache, or mock) */
    dataUpdatedAt: query.dataUpdatedAt,
    /** Structured per-channel quality audit (logged once to the console on each load). */
    auditReport,
    /** Dataset boundaries (earliest/latest/available years) — computed from the UNFILTERED stream. */
    boundaries,
  };
}
