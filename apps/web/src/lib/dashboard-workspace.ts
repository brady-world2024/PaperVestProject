export type DashboardModuleId =
  | 'history'
  | 'watchlist'
  | 'activity'
  | 'marketBoard'
  | 'decisionSupport'
  | 'nextActions'
  | 'exposure'
  | 'activeOrders'
  | 'holdingsPulse';

export type DashboardModuleColumn = 'primary' | 'secondary';
export type DashboardWorkspacePreset = 'balanced' | 'research' | 'execution';

export type DashboardModulePreference = {
  id: DashboardModuleId;
  column: DashboardModuleColumn;
  visible: boolean;
  collapsed: boolean;
};

export type DashboardModuleMeta = {
  id: DashboardModuleId;
  label: string;
  shortLabel: string;
  description: string;
};

const moduleMeta: Record<DashboardModuleId, DashboardModuleMeta> = {
  history: {
    id: 'history',
    label: 'Portfolio history',
    shortLabel: 'History',
    description: 'Track the account time series and value trend.',
  },
  watchlist: {
    id: 'watchlist',
    label: 'Watchlist preview',
    shortLabel: 'Watchlist',
    description: 'Keep saved symbols and live quote context close.',
  },
  activity: {
    id: 'activity',
    label: 'Recent activity',
    shortLabel: 'Activity',
    description: 'See the latest simulated executions at a glance.',
  },
  marketBoard: {
    id: 'marketBoard',
    label: 'Market board',
    shortLabel: 'Market board',
    description: 'Scan the home market symbols and quote freshness.',
  },
  decisionSupport: {
    id: 'decisionSupport',
    label: 'Decision support',
    shortLabel: 'Decision support',
    description: 'Surface the highest-value signals before the next trade.',
  },
  nextActions: {
    id: 'nextActions',
    label: 'Next actions',
    shortLabel: 'Next actions',
    description: 'Surface the highest-value follow-up moves.',
  },
  exposure: {
    id: 'exposure',
    label: 'Exposure summary',
    shortLabel: 'Exposure',
    description: 'Measure cash balance, concentration, and top-weight risk.',
  },
  activeOrders: {
    id: 'activeOrders',
    label: 'Active conditional orders',
    shortLabel: 'Orders',
    description: 'Keep automation and protective orders visible.',
  },
  holdingsPulse: {
    id: 'holdingsPulse',
    label: 'Holdings pulse',
    shortLabel: 'Holdings',
    description: 'Monitor open positions and unrealized performance.',
  },
};

const balancedLayout: DashboardModulePreference[] = [
  { id: 'history', column: 'primary', visible: true, collapsed: false },
  { id: 'watchlist', column: 'primary', visible: true, collapsed: false },
  { id: 'activity', column: 'primary', visible: true, collapsed: false },
  { id: 'marketBoard', column: 'primary', visible: true, collapsed: false },
  { id: 'nextActions', column: 'secondary', visible: true, collapsed: false },
  { id: 'decisionSupport', column: 'secondary', visible: true, collapsed: false },
  { id: 'exposure', column: 'secondary', visible: true, collapsed: false },
  { id: 'activeOrders', column: 'secondary', visible: true, collapsed: false },
  { id: 'holdingsPulse', column: 'secondary', visible: true, collapsed: false },
];

const presetLayouts: Record<DashboardWorkspacePreset, DashboardModulePreference[]> = {
  balanced: balancedLayout,
  research: [
    { id: 'marketBoard', column: 'primary', visible: true, collapsed: false },
    { id: 'watchlist', column: 'primary', visible: true, collapsed: false },
    { id: 'history', column: 'primary', visible: true, collapsed: false },
    { id: 'activity', column: 'primary', visible: true, collapsed: true },
    { id: 'decisionSupport', column: 'primary', visible: true, collapsed: false },
    { id: 'nextActions', column: 'secondary', visible: true, collapsed: false },
    { id: 'exposure', column: 'secondary', visible: true, collapsed: false },
    { id: 'activeOrders', column: 'secondary', visible: true, collapsed: false },
    { id: 'holdingsPulse', column: 'secondary', visible: true, collapsed: false },
  ],
  execution: [
    { id: 'history', column: 'primary', visible: true, collapsed: true },
    { id: 'activity', column: 'primary', visible: true, collapsed: false },
    { id: 'marketBoard', column: 'primary', visible: true, collapsed: false },
    { id: 'decisionSupport', column: 'primary', visible: true, collapsed: false },
    { id: 'watchlist', column: 'primary', visible: true, collapsed: false },
    { id: 'nextActions', column: 'secondary', visible: true, collapsed: false },
    { id: 'activeOrders', column: 'secondary', visible: true, collapsed: false },
    { id: 'holdingsPulse', column: 'secondary', visible: true, collapsed: false },
    { id: 'exposure', column: 'secondary', visible: true, collapsed: true },
  ],
};

export function getDefaultDashboardWorkspace() {
  return clonePreferences(balancedLayout);
}

export function getDashboardWorkspacePreset(preset: DashboardWorkspacePreset) {
  return clonePreferences(presetLayouts[preset] ?? balancedLayout);
}

export function sanitizeDashboardWorkspace(value: unknown) {
  if (!Array.isArray(value)) {
    return getDefaultDashboardWorkspace();
  }

  const preferences = value
    .filter(isDashboardModulePreference)
    .map((item) => ({
      id: item.id,
      column: item.column,
      visible: item.visible,
      collapsed: item.collapsed,
    }));
  const included = new Set<DashboardModuleId>();

  const ordered = preferences.filter((item) => {
    if (included.has(item.id)) {
      return false;
    }

    included.add(item.id);
    return true;
  });

  for (const fallback of balancedLayout) {
    if (!included.has(fallback.id)) {
      ordered.push({ ...fallback });
    }
  }

  return ordered;
}

export function getDashboardModulesForColumn(
  preferences: DashboardModulePreference[],
  column: DashboardModuleColumn
) {
  return preferences.filter((module) => module.column === column && module.visible);
}

export function getHiddenDashboardModules(preferences: DashboardModulePreference[]) {
  return preferences.filter((module) => !module.visible);
}

export function getDashboardModuleMeta(id: DashboardModuleId) {
  return moduleMeta[id];
}

export function applyDashboardWorkspacePreset(
  preferences: DashboardModulePreference[],
  preset: DashboardWorkspacePreset
) {
  const next = getDashboardWorkspacePreset(preset);
  const currentVisibility = new Map(preferences.map((item) => [item.id, item.visible]));

  return next.map((item) => ({
    ...item,
    visible: currentVisibility.get(item.id) ?? item.visible,
  }));
}

export function resetDashboardWorkspace() {
  return getDefaultDashboardWorkspace();
}

export function toggleDashboardModuleVisibility(
  preferences: DashboardModulePreference[],
  moduleId: DashboardModuleId,
  nextVisible?: boolean
) {
  return preferences.map((module) =>
    module.id === moduleId
      ? {
          ...module,
          visible: nextVisible ?? !module.visible,
          collapsed: nextVisible === false ? true : module.collapsed,
        }
      : module
  );
}

export function toggleDashboardModuleCollapsed(
  preferences: DashboardModulePreference[],
  moduleId: DashboardModuleId
) {
  return preferences.map((module) =>
    module.id === moduleId ? { ...module, collapsed: !module.collapsed } : module
  );
}

export function moveDashboardModuleWithinColumn(
  preferences: DashboardModulePreference[],
  moduleId: DashboardModuleId,
  direction: 'up' | 'down'
) {
  const index = preferences.findIndex((module) => module.id === moduleId);
  if (index === -1) {
    return preferences;
  }

  const current = preferences[index];
  const siblingIndices = preferences.reduce<number[]>((acc, module, moduleIndex) => {
    if (module.column === current.column && module.visible) {
      acc.push(moduleIndex);
    }
    return acc;
  }, []);
  const siblingPosition = siblingIndices.indexOf(index);
  const targetSiblingIndex =
    direction === 'up' ? siblingIndices[siblingPosition - 1] : siblingIndices[siblingPosition + 1];

  if (targetSiblingIndex == null) {
    return preferences;
  }

  const copy = [...preferences];
  [copy[index], copy[targetSiblingIndex]] = [copy[targetSiblingIndex], copy[index]];
  return copy;
}

export function moveDashboardModuleToColumn(
  preferences: DashboardModulePreference[],
  moduleId: DashboardModuleId,
  column: DashboardModuleColumn
) {
  const current = preferences.find((module) => module.id === moduleId);
  if (!current || current.column === column) {
    return preferences;
  }

  const remaining = preferences.filter((module) => module.id !== moduleId);
  const nextModule = { ...current, column };

  if (column === 'primary') {
    const firstSecondaryIndex = remaining.findIndex((module) => module.column === 'secondary');
    if (firstSecondaryIndex === -1) {
      return [...remaining, nextModule];
    }

    return [
      ...remaining.slice(0, firstSecondaryIndex),
      nextModule,
      ...remaining.slice(firstSecondaryIndex),
    ];
  }

  return [...remaining, nextModule];
}

function clonePreferences(preferences: DashboardModulePreference[]) {
  return preferences.map((item) => ({ ...item }));
}

function isDashboardModulePreference(value: unknown): value is DashboardModulePreference {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<DashboardModulePreference>;
  return (
    typeof candidate.id === 'string' &&
    candidate.id in moduleMeta &&
    (candidate.column === 'primary' || candidate.column === 'secondary') &&
    typeof candidate.visible === 'boolean' &&
    typeof candidate.collapsed === 'boolean'
  );
}
