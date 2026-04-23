import { MarketingRecord, generateMockData } from '@/lib/mockData';
import { getCache, setCache } from '@/lib/storage';

const API_BASE = 'https://mosaicfellowship.in/api/data/marketing/daily';
const PAGINATION_LIMIT = 500;
const CONCURRENCY_LIMIT = 6;
const CACHE_KEY = 'marketing_data_v1';
const CACHE_TTL = 1000 * 3600 * 24; // 24 hours

export const MARKETING_DATA_QUERY_KEY = ['marketing-data'] as const;

type DataSource = 'api' | 'mock' | 'loading' | 'cached';

export type MarketingDatasetLoadResult = {
  records: MarketingRecord[];
  source: DataSource;
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

async function fetchInChunks(totalPages: number): Promise<MarketingRecord[]> {
  const results: MarketingRecord[][] = [];
  const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

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

  const res = await fetch(`${API_BASE}?page=1&limit=${PAGINATION_LIMIT}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const firstPageJson = await res.json();

  const firstPageRecords: MarketingRecord[] = Array.isArray(firstPageJson)
    ? firstPageJson
    : firstPageJson.data ?? firstPageJson.results ?? [];

  if (firstPageRecords.length === 0) throw new Error('No data returned');

  const totalPages = firstPageJson.pagination?.total_pages ?? 1;
  const allRecords = [...firstPageRecords];

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

/**
 * Single source of truth for marketing rows (API → cache → mock).
 * Used by React Query and by explicit prefetch (hover / landing CTA).
 */
export async function fetchMarketingDataset(): Promise<MarketingDatasetLoadResult> {
  const cached = await getCache<MarketingRecord[]>(CACHE_KEY);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log('[Luma] Loading from IndexedDB Cache');
    const { records, dropped } = normalizeRecords(cached.data);
    return { records, source: 'cached', droppedDuringNormalization: dropped };
  }

  try {
    const data = await fetchAllPages();
    const { records, dropped } = normalizeRecords(data);

    setCache(CACHE_KEY, records).catch(err => console.error('Cache save failed:', err));

    return { records, source: 'api', droppedDuringNormalization: dropped };
  } catch (err) {
    console.warn('API/Cache unavailable, using mock data:', err);

    return { records: generateMockData(), source: 'mock', droppedDuringNormalization: 0 };
  }
}
