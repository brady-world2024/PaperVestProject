import assert from 'node:assert/strict';
import test from 'node:test';

import type { Holding, PortfolioSummary } from '@papervest/shared-types';

import { getTradeAvailability } from '../../lib/trade-availability';

const summary: PortfolioSummary = {
  initialCash: 100000,
  cashBalance: 100000,
  reservedCashBalance: 80000,
  availableCashBalance: 20000,
  holdingsMarketValue: 10000,
  totalPortfolioValue: 110000,
  unrealizedPnl: 1000,
  realizedPnl: 500,
  totalPnl: 1500,
  totalReturnPercent: 1.5,
  dailyChange: 120,
};

const holding: Holding = {
  symbol: 'AAPL',
  companyName: 'Apple Inc.',
  quantity: 100,
  reservedQuantity: 70,
  availableQuantity: 30,
  averageCost: 150,
  currentPrice: 170,
  costBasis: 15000,
  marketValue: 17000,
  unrealizedPnl: 2000,
  unrealizedPnlPercent: 13.3,
  dailyChange: 20,
  staleQuote: false,
  quoteTimestamp: '2026-07-03T15:00:00Z',
  marketSession: 'OPEN',
  tradingEnabled: true,
  marketTimezone: 'America/New_York',
};

test('trade availability prefers available buying power and available shares', () => {
  const availability = getTradeAvailability(summary, holding);

  assert.equal(availability.cashBalance, 100000);
  assert.equal(availability.reservedCashBalance, 80000);
  assert.equal(availability.availableCashBalance, 20000);
  assert.equal(availability.holdingQuantity, 100);
  assert.equal(availability.reservedQuantity, 70);
  assert.equal(availability.availableQuantity, 30);
});

test('trade availability falls back to zero when portfolio data is missing', () => {
  const availability = getTradeAvailability(null, null);

  assert.equal(availability.cashBalance, 0);
  assert.equal(availability.reservedCashBalance, 0);
  assert.equal(availability.availableCashBalance, 0);
  assert.equal(availability.holdingQuantity, 0);
  assert.equal(availability.reservedQuantity, 0);
  assert.equal(availability.availableQuantity, 0);
});
