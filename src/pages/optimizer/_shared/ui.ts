/**
 * Shared UI tokens for Mix Optimiser pages.
 *
 * Single source of truth for:
 *   - typography scale (T)
 *   - card surface (CARD)
 *   - table layout metrics (TABLE)
 *   - badge/chip style  (badgeStyle)
 *   - status + action label dictionaries (STATUS_META, ACTION_META)
 *
 * Every Mix Optimiser page imports from here to stay visually consistent.
 */

import type { CSSProperties } from 'react';

// ── Typography ────────────────────────────────────────────────────────────────

export const T = {
  overline: {
    fontFamily: 'Outfit' as const, fontSize: 10, fontWeight: 600 as const,
    color: 'var(--text-muted)', textTransform: 'uppercase' as const,
    letterSpacing: '0.09em', margin: 0,
  },
  body: {
    fontFamily: 'Plus Jakarta Sans' as const, fontSize: 13,
    fontWeight: 400 as const, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6,
  },
  label: {
    fontFamily: 'Outfit' as const, fontSize: 11, fontWeight: 600 as const,
    color: 'var(--text-muted)', margin: 0,
  },
  num: {
    fontFamily: 'Outfit' as const,
    fontVariantNumeric: 'tabular-nums' as const,
  },
};

// ── Card surface ──────────────────────────────────────────────────────────────

export const CARD: CSSProperties = {
  padding: '18px 22px',
  border: '1px solid var(--border-subtle)',
  borderRadius: 12,
  backgroundColor: 'var(--bg-card)',
};

// ── Table layout ──────────────────────────────────────────────────────────────

export const TABLE = {
  rowPadding:    '11px 22px',
  headerPadding: '8px 22px',
  toolbarPadding:'14px 22px',
  columnGap: 10,
};

// ── Badge / chip system ───────────────────────────────────────────────────────

/**
 * Unified badge style: 20px pill, low-opacity tinted surface, title-case label.
 * No uppercase, no sentence-length text, no thick colored border.
 *
 * Use with a preceding colored dot for extra clarity:
 *   <span style={badgeStyle('#34D399')}>
 *     <span style={dotStyle('#34D399')} /> On Track
 *   </span>
 */
export function badgeStyle(color: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontFamily: 'Outfit',
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1,
    color,
    backgroundColor: `${color}18`,
    padding: '4px 9px',
    borderRadius: 999,
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
    textTransform: 'none',
  };
}

export function dotStyle(color: string, size = 5): CSSProperties {
  return { width: size, height: size, borderRadius: '50%', backgroundColor: color, flexShrink: 0 };
}

// ── Status labels ─────────────────────────────────────────────────────────────
// Allowed labels: On Track · Over-Weighted · Under-Invested · Saturated · High Risk

export const STATUS_META = {
  efficient:      { label: 'On Track',        color: '#34D399' },
  saturated:      { label: 'Saturated',       color: '#F87171' },
  'over-scaled':  { label: 'Over-Weighted',   color: '#FBBF24' },
  'under-scaled': { label: 'Under-Invested',  color: '#60A5FA' },
  'high-risk':    { label: 'High Risk',       color: '#F87171' },
} as const;

export type StatusKey = keyof typeof STATUS_META;

// Sort priority for tables — worst issues first, healthy last.
export const STATUS_ORDER: Record<string, number> = {
  saturated: 0, 'over-scaled': 1, 'under-scaled': 2, 'high-risk': 0, efficient: 3,
};

// ── Action labels (Recommended Mix) ───────────────────────────────────────────
// Allowed: Scale · Hold · Reduce

export const ACTION_META = {
  increase: { label: 'Scale',  color: '#34D399' },
  hold:     { label: 'Hold',   color: '#94a3b8' },
  decrease: { label: 'Reduce', color: '#F87171' },
} as const;
