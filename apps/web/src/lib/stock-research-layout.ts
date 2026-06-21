export type StockResearchViewMode = 'focus' | 'split' | 'desk';

export type StockResearchViewMeta = {
  id: StockResearchViewMode;
  shortLabel: string;
  label: string;
  description: string;
  signature: string;
};

const stockResearchViews: StockResearchViewMeta[] = [
  {
    id: 'focus',
    shortLabel: 'Focus',
    label: 'Chart focus',
    description:
      'Keeps the research chart dominant while trade context and the primary execution ticket stay in a disciplined side rail.',
    signature: 'Best when the thesis still starts from price structure and only then moves into execution.',
  },
  {
    id: 'split',
    shortLabel: 'Split',
    label: 'Balanced split',
    description:
      'Balances chart work, quote context, position state, and execution panels without letting any one lane dominate the page.',
    signature: 'Best for normal day-to-day review when you want research and execution on the same screen.',
  },
  {
    id: 'desk',
    shortLabel: 'Desk',
    label: 'Execution desk',
    description:
      'Compresses the workspace into a denser trading desk so quote context, sizing, and both tickets stay closer together.',
    signature: 'Best when you are actively staging trims, entries, exits, and execution automation around one symbol.',
  },
];

export function getStockResearchViewModes() {
  return stockResearchViews;
}

export function getStockResearchViewMeta(mode: StockResearchViewMode) {
  return stockResearchViews.find((view) => view.id === mode) ?? stockResearchViews[1];
}

export function sanitizeStockResearchViewMode(
  value: string | null | undefined
): StockResearchViewMode {
  return value === 'focus' || value === 'split' || value === 'desk' ? value : 'split';
}
