'use client';

import { useEffect, useState } from 'react';

export type WorkspaceDensity = 'comfortable' | 'compact';

export function useWorkspaceDensity(storageKey: string, fallback: WorkspaceDensity = 'comfortable') {
  const [density, setDensity] = useState<WorkspaceDensity>(fallback);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const savedValue = window.localStorage.getItem(storageKey);
    if (savedValue === 'comfortable' || savedValue === 'compact') {
      setDensity(savedValue);
    }
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !ready) {
      return;
    }

    window.localStorage.setItem(storageKey, density);
  }, [density, ready, storageKey]);

  return {
    density,
    setDensity,
  };
}
