import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  ConditionalOrder,
  Holding,
  PortfolioHistoryPoint,
  TradeExecutionResponse,
} from '@papervest/shared-types';

import {
  getConditionalOrderAuditSummary,
  getExecutionAuditSummary,
  getPortfolioSnapshotSourceLabel,
  getPortfolioTrustSummary,
} from '../../lib/trust-audit';

const holdings: Holding[] = [
  {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    quantity: 10,
    reservedQuantity: 0,
    availableQuantity: 10,
    averageCost: 150,
    currentPrice: 170,
    costBasis: 1500,
    marketValue: 1700,
    unrealizedPnl: 200,
    unrealizedPnlPercent: 13.3,
    dailyChange: 18,
    staleQuote: false,
    quoteTimestamp: '2026-06-22T00:04:00Z',
    marketSession: 'OPEN',
    tradingEnabled: true,
    marketTimezone: 'America/New_York',
  },
  {
    symbol: 'MSFT',
    companyName: 'Microsoft Corporation',
    quantity: 5,
    reservedQuantity: 0,
    availableQuantity: 5,
    averageCost: 400,
    currentPrice: 405,
    costBasis: 2000,
    marketValue: 2025,
    unrealizedPnl: 25,
    unrealizedPnlPercent: 1.25,
    dailyChange: -6,
    staleQuote: true,
    quoteTimestamp: '2026-06-22T00:03:00Z',
    marketSession: 'OPEN',
    tradingEnabled: true,
    marketTimezone: 'America/New_York',
  },
];

const historyPoints: PortfolioHistoryPoint[] = [
  {
    timestamp: '2026-06-21T21:00:00Z',
    totalPortfolioValue: 100000,
    cashBalance: 45000,
    holdingsMarketValue: 55000,
    realizedPnl: 1200,
    unrealizedPnl: 800,
    snapshotSource: 'TRADE_EXECUTION',
  },
  {
    timestamp: '2026-06-22T00:05:00Z',
    totalPortfolioValue: 100900,
    cashBalance: 44800,
    holdingsMarketValue: 56100,
    realizedPnl: 1300,
    unrealizedPnl: 900,
    snapshotSource: 'TRADE_EXECUTION',
  },
];

const trades: TradeExecutionResponse[] = [
  {
    tradeId: 'trade-1',
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    side: 'BUY',
    quantity: 3,
    executedPrice: 169,
    grossAmount: 507,
    realizedPnl: 0,
    cashBalanceAfterTrade: 44800,
    executedAt: '2026-06-22T00:05:30Z',
    idempotentReplay: false,
  },
  {
    tradeId: 'trade-2',
    symbol: 'MSFT',
    companyName: 'Microsoft Corporation',
    side: 'SELL',
    quantity: 2,
    executedPrice: 404,
    grossAmount: 808,
    realizedPnl: 14,
    cashBalanceAfterTrade: 45608,
    executedAt: '2026-06-21T20:00:00Z',
    idempotentReplay: true,
  },
];

const orders: ConditionalOrder[] = [
  {
    id: 'order-1',
    symbol: 'AAPL',
    side: 'SELL',
    triggerType: 'TARGET_PRICE',
    targetPrice: 180,
    quantity: 3,
    status: 'ACTIVE',
    failureCode: null,
    failureMessage: null,
    executionKey: 'exec-1',
    lastCheckedPrice: 170,
    triggeredAt: null,
    executedAt: null,
    expiresAt: null,
    createdAt: '2026-06-22T00:00:00Z',
    updatedAt: '2026-06-22T00:04:00Z',
    version: 2,
  },
  {
    id: 'order-2',
    symbol: 'MSFT',
    side: 'BUY',
    triggerType: 'TARGET_PRICE',
    targetPrice: 390,
    quantity: 2,
    status: 'FAILED',
    failureCode: 'MARKET_CLOSED',
    failureMessage: 'Market closed',
    executionKey: 'exec-2',
    lastCheckedPrice: 401,
    triggeredAt: null,
    executedAt: null,
    expiresAt: null,
    createdAt: '2026-06-21T19:00:00Z',
    updatedAt: '2026-06-22T00:06:00Z',
    version: 4,
  },
];

test('portfolio trust summary derives latest quote, snapshot, and ledger linkage', () => {
  const summary = getPortfolioTrustSummary({ holdings, historyPoints, trades });

  assert.equal(summary.latestQuoteTimestamp, '2026-06-22T00:04:00Z');
  assert.equal(summary.latestSnapshotTimestamp, '2026-06-22T00:05:00Z');
  assert.equal(summary.latestSnapshotSource, 'TRADE_EXECUTION');
  assert.equal(summary.staleQuoteCount, 1);
  assert.equal(summary.latestLedgerTradeId, 'trade-1');
});

test('execution audit summary counts replay-safe and replayed fills', () => {
  const summary = getExecutionAuditSummary(trades);

  assert.equal(summary.latestTradeId, 'trade-1');
  assert.equal(summary.replayCount, 1);
  assert.equal(summary.verifiedFillCount, 1);
  assert.equal(summary.uniqueSymbolsCount, 2);
});

test('conditional order audit summary reports active keys and latest failure code', () => {
  const summary = getConditionalOrderAuditSummary(orders);

  assert.equal(summary.activeExecutionKeys, 1);
  assert.equal(summary.monitoredSymbolsCount, 2);
  assert.equal(summary.failureCount, 1);
  assert.equal(summary.latestFailureCode, 'MARKET_CLOSED');
  assert.equal(summary.latestLifecycleAt, '2026-06-22T00:06:00Z');
});

test('portfolio snapshot source label stays human-readable', () => {
  assert.equal(
    getPortfolioSnapshotSourceLabel('TRADE_EXECUTION'),
    'Trade execution snapshot'
  );
  assert.equal(getPortfolioSnapshotSourceLabel(null), 'No snapshot yet');
});
