import type { QueryClient } from '@tanstack/react-query';
import { fetchMarketingDataset, MARKETING_DATA_QUERY_KEY } from '@/lib/marketingDataLoader';

/** Warm the same cache entry as `useMarketingData` (sidebar hover, landing CTA, etc.). */
export function prefetchMarketingData(client: QueryClient) {
  return client.prefetchQuery({
    queryKey: MARKETING_DATA_QUERY_KEY,
    queryFn: fetchMarketingDataset,
    staleTime: Infinity,
  });
}
