import { useQuery } from '@tanstack/react-query';
import { MarketingRecord, generateMockData } from '@/lib/mockData';
import { useAppContext } from '@/contexts/AppContext';
import { useMemo } from 'react';

const API_BASE = 'https://mosaicfellowship.in/api/data/marketing/daily';
const PAGINATION_LIMIT = 500;

// Track the data source so the UI can display it
let _dataSource: 'api' | 'mock' | 'loading' = 'loading';

async function fetchAllPages(): Promise<MarketingRecord[]> {
  const allRecords: MarketingRecord[] = [];
  let page = 1;
  const maxPages = 50; // Safety limit to prevent infinite loops

  while (page <= maxPages) {
    const res = await fetch(`${API_BASE}?page=${page}&limit=${PAGINATION_LIMIT}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const json = await res.json();

    // Real API returns { data: [...], pagination: { has_next: bool, ... } }
    const records: MarketingRecord[] = Array.isArray(json) ? json : json.data ?? json.results ?? [];
    if (!Array.isArray(records) || records.length === 0) break;

    allRecords.push(...records);

    // Use API's pagination.has_next flag — more reliable than checking record count
    const hasNext = json.pagination?.has_next ?? (records.length === PAGINATION_LIMIT);
    if (!hasNext) break;
    page++;
  }

  if (allRecords.length === 0) throw new Error('No data returned');
  return allRecords;
}

export function useMarketingData() {
  const query = useQuery<MarketingRecord[]>({
    queryKey: ['marketing-data'],
    queryFn: async () => {
      try {
        const data = await fetchAllPages();
        _dataSource = 'api';
        return data;
      } catch {
        console.warn('API unavailable, using mock data');
        _dataSource = 'mock';
        return generateMockData();
      }
    },
    staleTime: Infinity,
    retry: false,
  });

  const { dateFilter } = useAppContext();

  const filteredData = useMemo(() => {
    if (!query.data) return undefined;
    if (dateFilter === 'all') return query.data;

    return query.data.filter(r => {
      if (dateFilter === '2023') return r.date.startsWith('2023');
      if (dateFilter === '2024') return r.date.startsWith('2024');
      if (dateFilter === '2025') return r.date.startsWith('2025');
      
      const rDate = new Date(r.date);
      const now = new Date('2025-12-31'); // Anchor to dataset end
      const diffDays = (now.getTime() - rDate.getTime()) / (1000 * 3600 * 24);
      
      if (dateFilter === 'last30') return diffDays <= 30;
      if (dateFilter === 'last90') return diffDays <= 90;
      return true;
    });
  }, [query.data, dateFilter]);

  return { ...query, data: filteredData, dataSource: query.data ? _dataSource : 'loading' };
}
