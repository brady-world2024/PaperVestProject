import assert from 'node:assert/strict';
import test from 'node:test';

import type { ConditionalOrder, Holding, TradeExecutionResponse, WatchlistItem } from '@papervest/shared-types';

import {
  filterConditionalOrders,
  sortConditionalOrders,
  sortHoldings,
  sortTrades,
  sortWatchlistItems,
} from '../../lib/workspace-grids';

const watchlistItems: WatchlistItem[] = [
  {
    symbol: 'NVDA',
    companyName: 'NVIDIA Corporation',
    currentPrice: 140,
    dailyChange: 4,
    dailyChangePercent: 2.9,
    quoteTimestamp: '2026-06-22T01:00:00Z',
    staleQuote: false,
    marketSession: 'OPEN',
    tradingEnabled: true,
    marketTimezone: 'America/New_York',
    addedAt: '2026-06-20T01:00:00Z',
  },
  {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    currentPrice: 200,
    dailyChange: -1,
    dailyChangePercent: -0.5,
    quoteTimestamp: '2026-06-22T03:00:00Z',
    staleQuote: false,
    marketSession: 'OPEN',
    tradingEnabled: true,
    marketTimezone: 'America/New_York',
    addedAt: '2026-06-21T01:00:00Z',
  },
];

const holdings: Holding[] = [
  {
    symbol: 'MSFT',
    companyName: 'Microsoft Corporation',
    quantity: 5,
    reservedQuantity: 0,
    availableQuantity: 5,
    averageCost: 400,
    currentPrice: 420,
    costBasis: 2000,
    marketValue: 2100,
    unrealizedPnl: 100,
    unrealizedPnlPercent: 5,
    dailyChange: 20,
    staleQuote: false,
    quoteTimestamp: '2026-06-22T03:00:00Z',
    marketSession: 'OPEN',
    tradingEnabled: true,
    marketTimezone: 'America/New_York',
  },
  {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    quantity: 10,
    reservedQuantity: 0,
    availableQuantity: 10,
    averageCost: 170,
    currentPrice: 200,
    costBasis: 1700,
    marketValue: 2000,
    unrealizedPnl: 300,
    unrealizedPnlPercent: 17.6,
    dailyChange: 15,
    staleQuote: false,
    quoteTimestamp: '2026-06-22T03:00:00Z',
    marketSession: 'OPEN',
    tradingEnabled: true,
    marketTimezone: 'America/New_York',
  },
];

const trades: TradeExecutionResponse[] = [
  {
    tradeId: 'trade-1',
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    side: 'BUY',
    quantity: 10,
    executedPrice: 180,
    grossAmount: 1800,
    realizedPnl: 0,
    cashBalanceAfterTrade: 98200,
    executedAt: '2026-06-21T10:00:00Z',
    idempotentReplay: false,
  },
  {
    tradeId: 'trade-2',
    symbol: 'MSFT',
    companyName: 'Microsoft Corporation',
    side: 'SELL',
    quantity: 3,
    executedPrice: 420,
    grossAmount: 1260,
    realizedPnl: 60,
    cashBalanceAfterTrade: 99460,
    executedAt: '2026-06-22T10:00:00Z',
    idempotentReplay: false,
  },
];

const orders: ConditionalOrder[] = [
  {
    id: 'order-1',
    symbol: 'AAPL',
    side: 'SELL',
    triggerType: 'TARGET_PRICE',
    targetPrice: 210,
    quantity: 2,
    status: 'ACTIVE',
    failureCode: null,
    failureMessage: null,
    executionKey: 'key-1',
    lastCheckedPrice: 200,
    triggeredAt: null,
    executedAt: null,
    expiresAt: null,
    createdAt: '2026-06-21T10:00:00Z',
    updatedAt: '2026-06-21T10:00:00Z',
    version: 1,
  },
  {
    id: 'order-2',
    symbol: 'MSFT',
    side: 'BUY',
    triggerType: 'TARGET_PRICE',
    targetPrice: 400,
    quantity: 4,
    status: 'FILLED',
    failureCode: null,
    failureMessage: null,
    executionKey: 'key-2',
    lastCheckedPrice: 399,
    triggeredAt: '2026-06-22T08:00:00Z',
    executedAt: '2026-06-22T08:01:00Z',
    expiresAt: null,
    createdAt: '2026-06-20T10:00:00Z',
    updatedAt: '2026-06-22T08:01:00Z',
    version: 2,
  },
];

test('watchlist sort can rank by daily change or latest quote', () => {
  assert.deepEqual(sortWatchlistItems(watchlistItems, 'dailyChange').map((item) => item.symbol), ['NVDA', 'AAPL']);
  assert.deepEqual(sortWatchlistItems(watchlistItems, 'latest').map((item) => item.symbol), ['AAPL', 'NVDA']);
});

test('holding sort can rank by market value or unrealized pnl', () => {
  assert.deepEqual(sortHoldings(holdings, 'marketValue').map((item) => item.symbol), ['MSFT', 'AAPL']);
  assert.deepEqual(sortHoldings(holdings, 'unrealizedPnl').map((item) => item.symbol), ['AAPL', 'MSFT']);
});

test('trade sort can rank by latest and realized pnl', () => {
  assert.deepEqual(sortTrades(trades, 'latest').map((item) => item.tradeId), ['trade-2', 'trade-1']);
  assert.deepEqual(sortTrades(trades, 'realizedPnl').map((item) => item.tradeId), ['trade-2', 'trade-1']);
});

test('order filtering separates active and terminal states', () => {
  assert.deepEqual(filterConditionalOrders(orders, 'active').map((item) => item.id), ['order-1']);
  assert.deepEqual(filterConditionalOrders(orders, 'terminal').map((item) => item.id), ['order-2']);
});

test('order sorting can prioritize target price', () => {
  assert.deepEqual(sortConditionalOrders(orders, 'targetPrice').map((item) => item.id), ['order-2', 'order-1']);
  assert.deepEqual(sortConditionalOrders(orders, 'symbol').map((item) => item.id), ['order-1', 'order-2']);
});
