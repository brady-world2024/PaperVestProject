import type {
  ConditionalOrder,
  Holding,
  PortfolioSummary,
  Quote,
  WatchlistItem,
} from '@papervest/shared-types';

type CommandTone = 'positive' | 'neutral' | 'caution';

export type CommandCenterMarketSummary = {
  label: string;
  detail: string;
  chip: string;
  tone: CommandTone;
  marketClosed: boolean;
  degraded: boolean;
};

export type CommandCenterExposureSummary = {
  cashWeight: number;
  investedWeight: number;
  openPositions: number;
  topHolding: Holding | null;
  topHoldingWeight: number;
  topThreeWeight: number;
};

export type CommandCenterNextAction = {
  id: string;
  title: string;
  description: string;
  href: string;
  label: string;
  tone: CommandTone;
};

const activeOrderStatuses = new Set<ConditionalOrder['status']>([
  'ACTIVE',
  'TRIGGERED',
  'EXECUTING',
]);

export function getActiveCommandCenterOrders(orders: ConditionalOrder[]) {
  return orders.filter((order) => activeOrderStatuses.has(order.status));
}

export function getCommandCenterExposureSummary(
  summary: PortfolioSummary | undefined,
  holdings: Holding[]
): CommandCenterExposureSummary {
  const totalPortfolioValue = summary?.totalPortfolioValue ?? 0;
  const rankedHoldings = [...holdings].sort((left, right) => right.marketValue - left.marketValue);
  const topHolding = rankedHoldings[0] ?? null;
  const topThreeValue = rankedHoldings.slice(0, 3).reduce((sum, holding) => sum + holding.marketValue, 0);

  return {
    cashWeight: toPercent(summary?.cashBalance ?? 0, totalPortfolioValue),
    investedWeight: toPercent(summary?.holdingsMarketValue ?? 0, totalPortfolioValue),
    openPositions: holdings.length,
    topHolding,
    topHoldingWeight: topHolding ? toPercent(topHolding.marketValue, totalPortfolioValue) : 0,
    topThreeWeight: toPercent(topThreeValue, totalPortfolioValue),
  };
}

export function getCommandCenterMarketSummary(
  quotes: Quote[],
  degraded: boolean
): CommandCenterMarketSummary {
  const openCount = quotes.filter((quote) => quote.marketSession === 'OPEN').length;
  const extendedCount = quotes.filter((quote) => quote.marketSession === 'PRE_MARKET' || quote.marketSession === 'AFTER_HOURS').length;
  const tradableCount = quotes.filter((quote) => quote.tradingEnabled).length;

  if (degraded) {
    return {
      label: 'Cached market context',
      detail: 'Quotes are still usable, but at least one board symbol fell back to cached data.',
      chip: 'Degraded',
      tone: 'caution',
      marketClosed: openCount === 0 && extendedCount === 0,
      degraded: true,
    };
  }

  if (openCount > 0) {
    return {
      label: 'Regular session live',
      detail: `${tradableCount} tracked names are tradable right now across the home market board.`,
      chip: 'Live',
      tone: 'positive',
      marketClosed: false,
      degraded: false,
    };
  }

  if (extendedCount > 0) {
    return {
      label: 'Extended-hours tape',
      detail: 'Pre-market or after-hours pricing is available, while regular market trading remains restricted.',
      chip: 'Extended',
      tone: 'neutral',
      marketClosed: false,
      degraded: false,
    };
  }

  return {
    label: 'Market closed',
    detail: 'Use the dashboard to stage watchlist moves, review history, and line up the next session.',
    chip: 'Closed',
    tone: 'neutral',
    marketClosed: true,
    degraded: false,
  };
}

export function getCommandCenterNextActions({
  holdings,
  watchlistItems,
  activeConditionalOrders,
  marketSummary,
}: {
  holdings: Holding[];
  watchlistItems: WatchlistItem[];
  activeConditionalOrders: ConditionalOrder[];
  marketSummary: CommandCenterMarketSummary;
}) {
  const actions: CommandCenterNextAction[] = [];
  const topHolding = [...holdings].sort((left, right) => right.marketValue - left.marketValue)[0] ?? null;
  const firstWatchlist = watchlistItems[0] ?? null;

  if (!holdings.length) {
    actions.push({
      id: 'first-trade',
      title: 'Place the first simulated buy',
      description: 'Open a liquid large-cap name and seed the portfolio with a starter position.',
      href: toStockDetailHref('AAPL', 'Apple Inc.'),
      label: 'Open AAPL ticket',
      tone: 'positive',
    });
  }

  if (!watchlistItems.length) {
    actions.push({
      id: 'build-watchlist',
      title: 'Build the watchlist spine',
      description: 'Save a few names so the command center can track live context beyond current holdings.',
      href: toStockDetailHref('NVDA', 'NVIDIA Corporation'),
      label: 'Start with NVDA',
      tone: 'neutral',
    });
  }

  if (topHolding && activeConditionalOrders.length === 0) {
    actions.push({
      id: 'protect-position',
      title: `Protect ${topHolding.symbol} with a target-price order`,
      description: 'The account has open exposure but no active conditional orders watching price moves.',
      href: `/orders?symbol=${encodeURIComponent(topHolding.symbol)}&side=SELL`,
      label: 'Open order composer',
      tone: 'positive',
    });
  }

  if (marketSummary.marketClosed) {
    actions.push({
      id: 'plan-next-session',
      title: 'Queue the next session',
      description: 'Regular trading is closed, so this is a good window to stage orders and review capital allocation.',
      href: topHolding
        ? `/orders?symbol=${encodeURIComponent(topHolding.symbol)}&side=SELL`
        : firstWatchlist
          ? toStockDetailHref(firstWatchlist.symbol, firstWatchlist.companyName)
          : '/portfolio',
      label: topHolding ? 'Stage a protective order' : 'Review portfolio',
      tone: 'neutral',
    });
  }

  if (marketSummary.degraded) {
    actions.push({
      id: 'verify-cached-prices',
      title: 'Review cached quote context',
      description: 'One or more board symbols were served from stale cache, so verify price-sensitive ideas before trading.',
      href: '/watchlist',
      label: 'Inspect watchlist',
      tone: 'caution',
    });
  }

  if (actions.length < 4) {
    actions.push({
      id: 'review-history',
      title: 'Review account time series',
      description: 'Check how cash, holdings value, and total portfolio value have moved across recent snapshots.',
      href: '/portfolio',
      label: 'Open portfolio',
      tone: 'neutral',
    });
  }

  if (actions.length < 4) {
    actions.push({
      id: 'scan-activity',
      title: 'Audit the latest executions',
      description: 'Look at recent fills and realized P&L before entering the next trade or conditional order.',
      href: '/activity',
      label: 'Open activity',
      tone: 'neutral',
    });
  }

  return actions.slice(0, 4);
}

function toPercent(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return (numerator / denominator) * 100;
}

function toStockDetailHref(symbol: string, companyName: string) {
  return `/stocks/${encodeURIComponent(symbol)}?companyName=${encodeURIComponent(companyName)}`;
}
