/**
 * Data boundary detection.
 *
 * Every period selector, default range, and range label in the dashboard must
 * be derived from the actual dataset — never from `Date.now()` or a hardcoded
 * year list. This module centralises that detection so every page agrees on
 * the same "what is latest / earliest / full range" answer.
 */

import type { MarketingRecord } from './mockData';

export interface DataBoundaries {
  /** Earliest date present in the dataset, as YYYY-MM-DD. */
  earliestDate: string;
  /** Latest date present in the dataset, as YYYY-MM-DD. */
  latestDate: string;
  /** Calendar year of earliestDate. */
  earliestYear: number;
  /** Calendar year of latestDate. */
  latestYear: number;
  /** All distinct calendar years present (sorted descending — newest first). */
  availableYears: number[];
  /** Distinct day count. */
  totalDays: number;
  /** Distinct month-year buckets (YYYY-MM) present. */
  totalMonths: number;
  /** Label like "Jan 2023 – Dec 2025". */
  fullRangeLabel: string;
  /** Short label like "36 months of data". */
  coverageLabel: string;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parse a YYYY-MM-DD date string as a *local* date (no timezone shift).
 *
 * `new Date("2025-12-31")` is parsed as UTC midnight which, in timezones west
 * of UTC, yields the previous calendar day under `.getDate()`. Using explicit
 * y/m/d components keeps every page on the same IST wall-clock day.
 */
export function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Format a Date as YYYY-MM-DD in local wall-clock time. */
export function toLocalYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Subtract `days` calendar days from a YYYY-MM-DD string (local time).
 *
 * NOTE: the result represents `ymd - days` days. If you want an INCLUSIVE
 * window of N days ending at `ymd`, pass `N - 1`.
 */
export function subtractDays(ymd: string, days: number): string {
  const d = parseLocalDate(ymd);
  d.setDate(d.getDate() - days);
  return toLocalYMD(d);
}

function formatLabel(ymd: string): string {
  const d = parseLocalDate(ymd);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Derive data boundaries from the raw record stream.
 * Must be called on the UNFILTERED records — callers that pass a date-filtered
 * subset will get narrower boundaries than the true dataset.
 */
export function computeDataBoundaries(records: MarketingRecord[] | undefined | null): DataBoundaries | null {
  if (!records || records.length === 0) return null;

  let earliest = records[0].date;
  let latest = records[0].date;
  const dayKeys = new Set<string>();
  const monthKeys = new Set<string>();
  const yearSet = new Set<number>();

  for (const r of records) {
    if (!r.date || typeof r.date !== 'string') continue;
    if (r.date < earliest) earliest = r.date;
    if (r.date > latest) latest = r.date;
    dayKeys.add(r.date);
    monthKeys.add(r.date.slice(0, 7));
    const year = Number(r.date.slice(0, 4));
    if (Number.isFinite(year)) yearSet.add(year);
  }

  const availableYears = Array.from(yearSet).sort((a, b) => b - a);
  const earliestYear = parseLocalDate(earliest).getFullYear();
  const latestYear = parseLocalDate(latest).getFullYear();
  const totalMonths = monthKeys.size;

  return {
    earliestDate: earliest,
    latestDate: latest,
    earliestYear,
    latestYear,
    availableYears,
    totalDays: dayKeys.size,
    totalMonths,
    fullRangeLabel: `${formatLabel(earliest)} – ${formatLabel(latest)}`,
    coverageLabel: `${totalMonths} month${totalMonths === 1 ? '' : 's'} of data`,
  };
}
