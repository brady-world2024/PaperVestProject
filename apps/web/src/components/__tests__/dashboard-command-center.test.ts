import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  ConditionalOrder,
  Holding,
  PortfolioSummary,
  Quote,
  WatchlistItem,
} from '@papervest/shared-types';

import {
  getCommandCenterDecisionSupport,
  getActiveCommandCenterOrders,
  getCommandCenterExposureSummary,
  getCommandCenterMarketSummary,
  getCommandCenterNextActions,
} from '../../lib/dashboard-command-center';
import type { TradeExecutionResponse } from '@papervest/shared-types';

const sampleSummary: PortfolioSummary = {
  initialCash: 100000,
  cashBalance: 40000,
  reservedCashBalance: 0,
  availableCashBalance: 40000,
  holdingsMarketValue: 60000,
  totalPortfolioValue: 100000,
  unrealizedPnl: 3200,
  realizedPnl: 1800,
  totalPnl: 5000,
  totalReturnPercent: 5,
  dailyChange: 420,
};

const sampleHoldings: Holding[] = [
  {
    symbol: 'NVDA',
    companyName: 'NVIDIA Corporation',
    quantity: 10,
    reservedQuantity: 0,
    availableQuantity: 10,
    averageCost: 100,
    currentPrice: 120,
    costBasis: 1000,
    marketValue: 1200,
    unrealizedPnl: 200,
    unrealizedPnlPercent: 20,
    dailyChange: 40,
    staleQuote: false,
    quoteTimestamp: '2026-06-21T10:00:00Z',
    marketSession: 'OPEN',
    tradingEnabled: true,
    marketTimezone: 'America/New_York',
  },
  {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    quantity: 20,
    reservedQuantity: 0,
    availableQuantity: 20,
    averageCost: 150,
    currentPrice: 165,
    costBasis: 3000,
    marketValue: 3300,
    unrealizedPnl: 300,
    unrealizedPnlPercent: 10,
    dailyChange: 55,
    staleQuote: false,
    quoteTimestamp: '2026-06-21T10:00:00Z',
    marketSession: 'OPEN',
    tradingEnabled: true,
    marketTimezone: 'America/New_York',
  },
];

const activeOrder: ConditionalOrder = {
  id: 'order-1',
  symbol: 'AAPL',
  side: 'SELL',
  triggerType: 'TARGET_PRICE',
  targetPrice: 170,
  quantity: 5,
  status: 'ACTIVE',
  failureCode: null,
  failureMessage: null,
  executionKey: 'exec-1',
  lastCheckedPrice: 165,
  triggeredAt: null,
  executedAt: null,
  expiresAt: null,
  createdAt: '2026-06-21T10:00:00Z',
  updatedAt: '2026-06-21T10:00:00Z',
  version: 1,
};

const sampleWatchlist: WatchlistItem[] = [
  {
    symbol: 'MSFT',
    companyName: 'Microsoft Corporation',
    currentPrice: 420,
    dailyChange: 4,
    dailyChangePercent: 1,
    quoteTimestamp: '2026-06-21T10:00:00Z',
    staleQuote: false,
    marketSession: 'OPEN',
    tradingEnabled: true,
    marketTimezone: 'America/New_York',
    addedAt: '2026-06-20T10:00:00Z',
  },
];

const sampleQuotes: Quote[] = [
  {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    currentPrice: 165,
    dailyChange: 2,
    dailyChangePercent: 1.2,
    openPrice: 163,
    highPrice: 166,
    lowPrice: 162,
    previousClose: 163,
    quoteTimestamp: '2026-06-21T10:00:00Z',
    stale: false,
    marketSession: 'OPEN',
    tradingEnabled: true,
    marketTimezone: 'America/New_York',
  },
];

const sampleTrades: TradeExecutionResponse[] = [
  {
    tradeId: 'trade-1',
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    side: 'SELL',
    quantity: 5,
    executedPrice: 170,
    grossAmount: 850,
    realizedPnl: 100,
    cashBalanceAfterTrade: 40850,
    executedAt: '2026-06-21T12:00:00Z',
    idempotentReplay: false,
  },
  {
    tradeId: 'trade-2',
    symbol: 'NVDA',
    companyName: 'NVIDIA Corporation',
    side: 'BUY',
    quantity: 3,
    executedPrice: 118,
    grossAmount: 354,
    realizedPnl: 0,
    cashBalanceAfterTrade: 40496,
    executedAt: '2026-06-21T11:00:00Z',
    idempotentReplay: false,
  },
];

test('exposure summary derives allocation and concentration from portfolio data', () => {
  const summary = getCommandCenterExposureSummary(sampleSummary, sampleHoldings);

  assert.equal(summary.cashWeight, 40);
  assert.equal(summary.investedWeight, 60);
  assert.equal(summary.openPositions, 2);
  assert.equal(summary.topHolding?.symbol, 'AAPL');
  assert.ok(Math.abs(summary.topHoldingWeight - 3.3) < 0.0001);
  assert.ok(Math.abs(summary.topThreeWeight - 4.5) < 0.0001);
});

test('active order filter keeps only actionable conditional orders', () => {
  const orders = getActiveCommandCenterOrders([
    activeOrder,
    { ...activeOrder, id: 'order-2', status: 'TRIGGERED' },
    { ...activeOrder, id: 'order-3', status: 'FILLED' },
  ]);

  assert.deepEqual(
    orders.map((order) => order.id),
    ['order-1', 'order-2']
  );
});

test('next actions prioritize first trade and watchlist setup for empty accounts', () => {
  const marketSummary = getCommandCenterMarketSummary([], false);
  const actions = getCommandCenterNextActions({
    holdings: [],
    watchlistItems: [],
    activeConditionalOrders: [],
    marketSummary,
  });

  assert.equal(actions[0]?.id, 'first-trade');
  assert.equal(actions[1]?.id, 'build-watchlist');
  assert.ok(actions.some((action) => action.id === 'plan-next-session'));
});

test('next actions suggest protection when exposure exists without active orders', () => {
  const marketSummary = getCommandCenterMarketSummary(sampleQuotes, true);
  const actions = getCommandCenterNextActions({
    holdings: sampleHoldings,
    watchlistItems: sampleWatchlist,
    activeConditionalOrders: [],
    marketSummary,
  });

  assert.equal(actions[0]?.id, 'protect-position');
  assert.ok(actions.some((action) => action.id === 'verify-cached-prices'));
});

test('market summary reports live regular session when tradable quotes are open', () => {
  const summary = getCommandCenterMarketSummary(sampleQuotes, false);

  assert.equal(summary.label, 'Regular session live');
  assert.equal(summary.chip, 'Live');
  assert.equal(summary.marketClosed, false);
});

test('decision support surfaces mover, protection gap, and execution pulse', () => {
  const signals = getCommandCenterDecisionSupport({
    summary: sampleSummary,
    holdings: sampleHoldings,
    watchlistItems: sampleWatchlist,
    activeConditionalOrders: [],
    recentTrades: sampleTrades,
  });

  assert.equal(signals[0]?.id, 'watchlist-mover');
  assert.ok(signals.some((signal) => signal.id === 'protection-gap'));
  assert.ok(signals.some((signal) => signal.id === 'execution-pulse'));
});

test('decision support reports automation coverage when holdings are already protected', () => {
  const signals = getCommandCenterDecisionSupport({
    summary: sampleSummary,
    holdings: sampleHoldings,
    watchlistItems: sampleWatchlist,
    activeConditionalOrders: [
      activeOrder,
      { ...activeOrder, id: 'order-2', symbol: 'NVDA' },
    ],
    recentTrades: sampleTrades,
  });

  assert.ok(signals.some((signal) => signal.id === 'protected-book'));
  assert.equal(signals.some((signal) => signal.id === 'protection-gap'), false);
});
