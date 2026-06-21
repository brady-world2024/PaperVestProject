'use client';

import { useEffect, useState } from 'react';

import {
  applyDashboardWorkspacePreset,
  getDefaultDashboardWorkspace,
  sanitizeDashboardWorkspace,
  type DashboardModuleColumn,
  type DashboardModuleId,
  type DashboardModulePreference,
  type DashboardWorkspacePreset,
  moveDashboardModuleToColumn,
  moveDashboardModuleWithinColumn,
  resetDashboardWorkspace,
  toggleDashboardModuleCollapsed,
  toggleDashboardModuleVisibility,
} from './dashboard-workspace';

const storageKey = 'pv-dashboard-workspace-v1';

export function useDashboardWorkspace() {
  const [preferences, setPreferences] = useState<DashboardModulePreference[]>(
    getDefaultDashboardWorkspace
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      try {
        setPreferences(sanitizeDashboardWorkspace(JSON.parse(saved)));
      } catch {
        setPreferences(getDefaultDashboardWorkspace());
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !ready) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(preferences));
  }, [preferences, ready]);

  return {
    preferences,
    setPreferences,
    applyPreset(preset: DashboardWorkspacePreset) {
      setPreferences((current) => applyDashboardWorkspacePreset(current, preset));
    },
    reset() {
      setPreferences(resetDashboardWorkspace());
    },
    toggleVisibility(moduleId: DashboardModuleId, nextVisible?: boolean) {
      setPreferences((current) =>
        toggleDashboardModuleVisibility(current, moduleId, nextVisible)
      );
    },
    toggleCollapsed(moduleId: DashboardModuleId) {
      setPreferences((current) => toggleDashboardModuleCollapsed(current, moduleId));
    },
    moveWithinColumn(moduleId: DashboardModuleId, direction: 'up' | 'down') {
      setPreferences((current) =>
        moveDashboardModuleWithinColumn(current, moduleId, direction)
      );
    },
    moveToColumn(moduleId: DashboardModuleId, column: DashboardModuleColumn) {
      setPreferences((current) => moveDashboardModuleToColumn(current, moduleId, column));
    },
  };
}
