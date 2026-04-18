/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CHANNELS } from '@/lib/mockData';

export type PlanningPeriod = '1m' | '1q' | '6m' | '1y' | 'custom';
export type PlanningMode   = 'conservative' | 'target' | 'aggressive';

interface OptimizerState {
  // Planning inputs (shared across all 5 pages)
  budget: number;
  setBudget: (v: number | ((prev: number) => number)) => void;

  planningPeriod: PlanningPeriod;
  setPlanningPeriod: (v: PlanningPeriod) => void;

  planningMode: PlanningMode;
  setPlanningMode: (v: PlanningMode) => void;

  customStartMonth: string;
  setCustomStartMonth: (v: string) => void;

  customEndMonth: string;
  setCustomEndMonth: (v: string) => void;

  // Manual allocation weights (normalized fractions, sum to 1)
  allocations: Record<string, number>;
  setAllocations: (v: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;

  // Paused / disabled channels
  paused: Set<string>;
  setPaused: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void;

  // Whether the initial budget has been set from real data
  hasSetInitialBudget: boolean;
  setHasSetInitialBudget: (v: boolean) => void;
}

const OptimizerContext = createContext<OptimizerState | undefined>(undefined);

const DEFAULT_EQUAL_ALLOC: Record<string, number> = Object.fromEntries(
  CHANNELS.map((ch) => [ch, 1 / CHANNELS.length])
);

export function OptimizerProvider({ children }: { children: ReactNode }) {
  const [budget, setBudget]                         = useState(5000000);
  const [planningPeriod, setPlanningPeriod]         = useState<PlanningPeriod>('1y');
  const [planningMode, setPlanningMode]             = useState<PlanningMode>('target');
  const [customStartMonth, setCustomStartMonth]     = useState('2025-01');
  const [customEndMonth, setCustomEndMonth]         = useState('2025-12');
  const [allocations, setAllocations]               = useState<Record<string, number>>(DEFAULT_EQUAL_ALLOC);
  const [paused, setPaused]                         = useState<Set<string>>(new Set());
  const [hasSetInitialBudget, setHasSetInitialBudget] = useState(false);

  return (
    <OptimizerContext.Provider value={{
      budget, setBudget,
      planningPeriod, setPlanningPeriod,
      planningMode, setPlanningMode,
      customStartMonth, setCustomStartMonth,
      customEndMonth, setCustomEndMonth,
      allocations, setAllocations,
      paused, setPaused,
      hasSetInitialBudget, setHasSetInitialBudget,
    }}>
      {children}
    </OptimizerContext.Provider>
  );
}

export function useOptimizer() {
  const ctx = useContext(OptimizerContext);
  if (!ctx) throw new Error('useOptimizer must be used within an OptimizerProvider');
  return ctx;
}
