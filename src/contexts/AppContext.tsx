/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CHANNELS } from '@/lib/mockData';

/**
 * The date filter applied globally across the dashboard. Year values are
 * represented as the 4-digit string (e.g. `"2025"`) so new years can be added
 * without touching this type — the filter is resolved dynamically against the
 * actual dataset boundaries in `useMarketingData`.
 */
export type DateFilterType = 'all' | 'last90' | 'last30' | `${number}`;

interface AppContextState {
  dateFilter: DateFilterType;
  setDateFilter: (filter: DateFilterType) => void;
  channelBudgets: Record<string, number>;
  setChannelBudgets: (budgets: Record<string, number>) => void;
}

const DEFAULT_BUDGETS: Record<string, number> = {
  'Meta Ads': 2800000, 
  'Google Search': 3100000, 
  'Google Display': 1500000,
  'YouTube': 2300000, 
  'Instagram Reels': 2000000, 
  'Email': 500000,
  'SMS': 400000, 
  'Influencer': 1600000, 
  'Affiliate': 1100000, 
  'Organic Social': 300000,
};

const AppContext = createContext<AppContextState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [channelBudgets, setChannelBudgets] = useState<Record<string, number>>(DEFAULT_BUDGETS);

  return (
    <AppContext.Provider value={{ dateFilter, setDateFilter, channelBudgets, setChannelBudgets }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
