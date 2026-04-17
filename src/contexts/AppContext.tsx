/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CHANNELS } from '@/lib/mockData';

export type DateFilterType = 'all' | '2023' | '2024' | '2025' | 'last90' | 'last30';

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
