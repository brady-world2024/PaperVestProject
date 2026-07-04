import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PortfolioPerformanceCenter } from '../portfolio-performance-center';
import type { PortfolioPerformanceResponse } from '@papervest/shared-types';

const samplePerformance: PortfolioPerformanceResponse = {
  range: '1M',
  from: '2026-06-05T00:00:00Z',
  to: '2026-07-05T00:00:00Z',
  status: 'READY',
  summary: {
    currentValue: 106000,
    startValue: 100000,
    endValue: 106000,
    absoluteReturn: 6000,
    returnPercent: 6,
    maxDrawdownPercent: 4,
    realizedPnl: 2500,
    unrealizedPnl: 3500,
  },
  allocation: {
    cashValue: 21200,
    cashPercent: 20,
    holdingsValue: 84800,
    holdingsPercent: 80,
  },
  pnlContribution: {
    realizedValue: 2500,
    realizedPercent: 41.67,
    unrealizedValue: 3500,
    unrealizedPercent: 58.33,
  },
  topHoldings: [
    {
      rank: 1,
      symbol: 'AAPL',
      companyName: 'Apple Inc.',
      marketValue: 33920,
      portfolioWeightPercent: 32,
      unrealizedPnl: 3500,
      unrealizedPnlPercent: 11.55,
    },
  ],
  points: [
    {
      timestamp: '2026-06-05T00:00:00Z',
      totalPortfolioValue: 100000,
      cashBalance: 20000,
      holdingsMarketValue: 80000,
      drawdownPercent: 0,
    },
  ],
};

test('portfolio performance center renders backend-derived performance sections', () => {
  const html = renderToStaticMarkup(
    <PortfolioPerformanceCenter
      range="1M"
      performance={samplePerformance}
      loading={false}
      onSelectRange={() => undefined}
    />
  );

  assert.match(html, /Performance center/);
  assert.match(html, /Range return/);
  assert.match(html, /Max drawdown/);
  assert.match(html, /Allocation/);
  assert.match(html, /P&amp;L contribution/);
  assert.match(html, /Top contributors/);
  assert.match(html, /AAPL/);
});

test('portfolio performance center explains sparse history', () => {
  const html = renderToStaticMarkup(
    <PortfolioPerformanceCenter
      range="1M"
      performance={{
        ...samplePerformance,
        status: 'INSUFFICIENT_HISTORY',
        points: [],
      }}
      loading={false}
      onSelectRange={() => undefined}
    />
  );

  assert.match(html, /Performance history is limited/);
});
