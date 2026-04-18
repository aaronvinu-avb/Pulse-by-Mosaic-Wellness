/**
 * MixOptimizer.tsx — retired.
 *
 * The Mix Optimiser has been re-architected into a 5-page guided flow.
 * This file is kept only as a calculation reference; the route /optimizer
 * now redirects to /optimizer/current-mix via App.tsx.
 *
 * Pages:
 *   /optimizer/current-mix  → src/pages/optimizer/CurrentMix.tsx
 *   /optimizer/diagnosis    → src/pages/optimizer/Diagnosis.tsx
 *   /optimizer/recommended  → src/pages/optimizer/RecommendedMix.tsx
 *   /optimizer/why          → src/pages/optimizer/WhyItWorks.tsx
 *   /optimizer/scenarios    → src/pages/optimizer/BudgetScenarios.tsx
 *
 * Shared state: src/contexts/OptimizerContext.tsx
 */

import { Navigate } from 'react-router-dom';

export default function MixOptimizer() {
  return <Navigate to="/optimizer/current-mix" replace />;
}
