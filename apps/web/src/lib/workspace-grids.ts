import type {
  ConditionalOrder,
  Holding,
  TradeExecutionResponse,
  WatchlistItem,
} from '@papervest/shared-types';

export type WatchlistSort = 'dailyChange' | 'symbol' | 'price' | 'latest';
export type HoldingSort = 'marketValue' | 'unrealizedPnl' | 'symbol' | 'quantity';
export type TradeSort = 'latest' | 'realizedPnl' | 'grossAmount' | 'symbol';
export type OrderSort = 'latest' | 'status' | 'targetPrice' | 'symbol';
export type OrderFilter = 'all' | 'active' | 'terminal';

export function sortWatchlistItems(items: WatchlistItem[], sort: WatchlistSort) {
  const copy = [...items];

  switch (sort) {
    case 'symbol':
      return copy.sort((left, right) => left.symbol.localeCompare(right.symbol));
    case 'price':
      return copy.sort((left, right) => (right.currentPrice ?? Number.NEGATIVE_INFINITY) - (left.currentPrice ?? Number.NEGATIVE_INFINITY));
    case 'latest':
      return copy.sort((left, right) => compareDates(right.quoteTimestamp, left.quoteTimestamp));
    case 'dailyChange':
    default:
      return copy.sort((left, right) => (right.dailyChangePercent ?? Number.NEGATIVE_INFINITY) - (left.dailyChangePercent ?? Number.NEGATIVE_INFINITY));
  }
}

export function sortHoldings(items: Holding[], sort: HoldingSort) {
  const copy = [...items];

  switch (sort) {
    case 'symbol':
      return copy.sort((left, right) => left.symbol.localeCompare(right.symbol));
    case 'quantity':
      return copy.sort((left, right) => right.quantity - left.quantity);
    case 'unrealizedPnl':
      return copy.sort((left, right) => right.unrealizedPnl - left.unrealizedPnl);
    case 'marketValue':
    default:
      return copy.sort((left, right) => right.marketValue - left.marketValue);
  }
}

export function sortTrades(items: TradeExecutionResponse[], sort: TradeSort) {
  const copy = [...items];

  switch (sort) {
    case 'symbol':
      return copy.sort((left, right) => left.symbol.localeCompare(right.symbol));
    case 'grossAmount':
      return copy.sort((left, right) => right.grossAmount - left.grossAmount);
    case 'realizedPnl':
      return copy.sort((left, right) => right.realizedPnl - left.realizedPnl);
    case 'latest':
    default:
      return copy.sort((left, right) => compareDates(right.executedAt, left.executedAt));
  }
}

export function sortConditionalOrders(items: ConditionalOrder[], sort: OrderSort) {
  const copy = [...items];

  switch (sort) {
    case 'status':
      return copy.sort((left, right) => left.status.localeCompare(right.status) || compareDates(right.createdAt, left.createdAt));
    case 'targetPrice':
      return copy.sort((left, right) => right.targetPrice - left.targetPrice);
    case 'symbol':
      return copy.sort((left, right) => left.symbol.localeCompare(right.symbol));
    case 'latest':
    default:
      return copy.sort((left, right) => compareDates(right.createdAt, left.createdAt));
  }
}

export function filterConditionalOrders(items: ConditionalOrder[], filter: OrderFilter) {
  if (filter === 'active') {
    return items.filter((item) => item.status === 'ACTIVE' || item.status === 'TRIGGERED' || item.status === 'EXECUTING');
  }

  if (filter === 'terminal') {
    return items.filter((item) => item.status === 'FILLED' || item.status === 'FAILED' || item.status === 'CANCELLED' || item.status === 'EXPIRED');
  }

  return items;
}

function compareDates(left: string | null, right: string | null) {
  return toEpoch(left) - toEpoch(right);
}

function toEpoch(value: string | null) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  return new Date(value).getTime();
}
