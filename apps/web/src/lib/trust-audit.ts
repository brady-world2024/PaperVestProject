import type {
  ConditionalOrder,
  Holding,
  PortfolioHistoryPoint,
  PortfolioSnapshotSource,
  TradeExecutionResponse,
} from '@papervest/shared-types';

export type PortfolioTrustSummary = {
  latestQuoteTimestamp: string | null;
  latestSnapshotTimestamp: string | null;
  latestSnapshotSource: PortfolioSnapshotSource | null;
  staleQuoteCount: number;
  trackedHoldingsCount: number;
  latestLedgerTradeId: string | null;
};

export type ExecutionAuditSummary = {
  latestExecutionAt: string | null;
  latestTradeId: string | null;
  replayCount: number;
  verifiedFillCount: number;
  uniqueSymbolsCount: number;
};

export type ConditionalOrderAuditSummary = {
  latestLifecycleAt: string | null;
  activeExecutionKeys: number;
  monitoredSymbolsCount: number;
  failureCount: number;
  latestFailureCode: string | null;
};

export function getPortfolioTrustSummary({
  holdings,
  historyPoints,
  trades,
}: {
  holdings: Holding[];
  historyPoints: PortfolioHistoryPoint[];
  trades: TradeExecutionResponse[];
}): PortfolioTrustSummary {
  const latestSnapshot = getLatestByTimestamp(historyPoints, (point) => point.timestamp);
  const latestTrade = getLatestByTimestamp(trades, (trade) => trade.executedAt);

  return {
    latestQuoteTimestamp: getLatestTimestamp(holdings.map((holding) => holding.quoteTimestamp)),
    latestSnapshotTimestamp: latestSnapshot?.timestamp ?? null,
    latestSnapshotSource: latestSnapshot?.snapshotSource ?? null,
    staleQuoteCount: holdings.filter((holding) => holding.staleQuote).length,
    trackedHoldingsCount: holdings.length,
    latestLedgerTradeId: latestTrade?.tradeId ?? null,
  };
}

export function getExecutionAuditSummary(trades: TradeExecutionResponse[]): ExecutionAuditSummary {
  const latestTrade = getLatestByTimestamp(trades, (trade) => trade.executedAt);

  return {
    latestExecutionAt: latestTrade?.executedAt ?? null,
    latestTradeId: latestTrade?.tradeId ?? null,
    replayCount: trades.filter((trade) => trade.idempotentReplay).length,
    verifiedFillCount: trades.filter((trade) => !trade.idempotentReplay).length,
    uniqueSymbolsCount: new Set(trades.map((trade) => trade.symbol)).size,
  };
}

export function getConditionalOrderAuditSummary(
  orders: ConditionalOrder[]
): ConditionalOrderAuditSummary {
  const latestOrder = getLatestByTimestamp(orders, (order) => order.updatedAt ?? order.createdAt);
  const failedOrders = orders.filter((order) => order.status === 'FAILED');

  return {
    latestLifecycleAt: latestOrder ? latestOrder.updatedAt ?? latestOrder.createdAt : null,
    activeExecutionKeys: new Set(
      orders
        .filter(
          (order) =>
            order.status === 'ACTIVE' ||
            order.status === 'TRIGGERED' ||
            order.status === 'EXECUTING'
        )
        .map((order) => order.executionKey)
    ).size,
    monitoredSymbolsCount: new Set(orders.map((order) => order.symbol)).size,
    failureCount: failedOrders.length,
    latestFailureCode:
      getLatestByTimestamp(
        failedOrders.filter((order) => order.failureCode),
        (order) => order.updatedAt ?? order.createdAt
      )?.failureCode ?? null,
  };
}

export function getPortfolioSnapshotSourceLabel(
  source: PortfolioSnapshotSource | null
) {
  if (source === 'TRADE_EXECUTION') {
    return 'Trade execution snapshot';
  }

  return 'No snapshot yet';
}

function getLatestTimestamp(timestamps: Array<string | null | undefined>) {
  let latestTimestamp: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;

  for (const timestamp of timestamps) {
    if (!timestamp) {
      continue;
    }

    const parsed = Date.parse(timestamp);
    if (!Number.isFinite(parsed) || parsed <= latestMs) {
      continue;
    }

    latestMs = parsed;
    latestTimestamp = timestamp;
  }

  return latestTimestamp;
}

function getLatestByTimestamp<T>(
  items: T[],
  getTimestamp: (item: T) => string | null | undefined
) {
  let latestItem: T | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;

  for (const item of items) {
    const timestamp = getTimestamp(item);
    if (!timestamp) {
      continue;
    }

    const parsed = Date.parse(timestamp);
    if (!Number.isFinite(parsed) || parsed <= latestMs) {
      continue;
    }

    latestMs = parsed;
    latestItem = item;
  }

  return latestItem;
}
