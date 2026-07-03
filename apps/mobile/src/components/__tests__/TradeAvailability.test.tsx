import type { Holding, PortfolioSummary } from '@papervest/shared-types';

import { getTradeAvailability } from '../../utils/tradeAvailability';

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

describe('trade availability', () => {
  it('prefers available buying power and available shares', () => {
    const availability = getTradeAvailability(summary, holding);

    expect(availability.cashBalance).toBe(100000);
    expect(availability.reservedCashBalance).toBe(80000);
    expect(availability.availableCashBalance).toBe(20000);
    expect(availability.holdingQuantity).toBe(100);
    expect(availability.reservedQuantity).toBe(70);
    expect(availability.availableQuantity).toBe(30);
  });

  it('falls back to zero when portfolio data is missing', () => {
    const availability = getTradeAvailability(null, null);

    expect(availability.cashBalance).toBe(0);
    expect(availability.reservedCashBalance).toBe(0);
    expect(availability.availableCashBalance).toBe(0);
    expect(availability.holdingQuantity).toBe(0);
    expect(availability.reservedQuantity).toBe(0);
    expect(availability.availableQuantity).toBe(0);
  });
});
