import React, { useState, useEffect } from 'react';

interface DeferredRenderProps {
  children: React.ReactNode;
  delay?: number;
  fallback?: React.ReactNode;
}

/**
 * Defers the rendering of heavy components (like charts) to keep the initial
 * frame paint as light as possible.
 */
export function DeferredRender({ children, delay = 50, fallback = null }: DeferredRenderProps) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setShouldRender(true);
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay]);

  if (!shouldRender) return <>{fallback}</>;

  return <>{children}</>;
}
