import { Link, useLocation } from 'react-router-dom';
import { Sliders, Stethoscope, Sparkles, HelpCircle, LineChart, ChevronRight } from 'lucide-react';

const STEPS = [
  { label: 'Current Mix',      url: '/optimizer/current-mix', icon: Sliders,      step: 1 },
  { label: 'Diagnosis',        url: '/optimizer/diagnosis',   icon: Stethoscope,  step: 2 },
  { label: 'Recommended Mix',  url: '/optimizer/recommended', icon: Sparkles,     step: 3 },
  { label: 'Why It Works',     url: '/optimizer/why',         icon: HelpCircle,   step: 4 },
  { label: 'Budget Scenarios', url: '/optimizer/scenarios',   icon: LineChart,    step: 5 },
];

export function OptimizerSubnav() {
  const location = useLocation();
  const currentIdx = STEPS.findIndex((s) => s.url === location.pathname);

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '12px 0',
        flexWrap: 'wrap',
      }}
      aria-label="Mix Optimiser steps"
    >
      {STEPS.map((step, idx) => {
        const isActive   = location.pathname === step.url;
        const isVisited  = idx < currentIdx;
        const Icon       = step.icon;

        return (
          <div key={step.url} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Link
              to={step.url}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '7px 14px',
                borderRadius: 999,
                fontFamily: 'Outfit',
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                textDecoration: 'none',
                transition: '140ms',
                border: isActive
                  ? '1.5px solid #E8803A'
                  : '1.5px solid var(--border-subtle)',
                backgroundColor: isActive
                  ? 'rgba(232,128,58,0.10)'
                  : isVisited
                  ? 'var(--bg-card)'
                  : 'transparent',
                color: isActive
                  ? '#E8803A'
                  : isVisited
                  ? 'var(--text-secondary)'
                  : 'var(--text-muted)',
              }}
            >
              <Icon
                style={{
                  width: 13,
                  height: 13,
                  color: isActive ? '#E8803A' : isVisited ? 'var(--text-muted)' : 'var(--text-muted)',
                }}
              />
              <span>{step.label}</span>
            </Link>

            {idx < STEPS.length - 1 && (
              <ChevronRight
                style={{ width: 12, height: 12, color: 'var(--text-muted)', flexShrink: 0 }}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
