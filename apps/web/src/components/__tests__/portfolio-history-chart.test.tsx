import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PortfolioHistoryChart } from '../portfolio-history-chart';
import type { PortfolioHistoryResponse } from '@papervest/shared-types';

const sampleHistory: PortfolioHistoryResponse = {
  range: '1M',
  from: '2026-05-01T00:00:00Z',
  to: '2026-05-31T00:00:00Z',
  points: [
    {
      timestamp: '2026-05-10T10:00:00Z',
      totalPortfolioValue: 100000,
      cashBalance: 99000,
      holdingsMarketValue: 1000,
      realizedPnl: 0,
      unrealizedPnl: 0,
      snapshotSource: 'TRADE_EXECUTION',
    },
    {
      timestamp: '2026-05-15T10:00:00Z',
      totalPortfolioValue: 100400,
      cashBalance: 99400,
      holdingsMarketValue: 1000,
      realizedPnl: 400,
      unrealizedPnl: 0,
      snapshotSource: 'TRADE_EXECUTION',
    },
  ],
};

test('portfolio history chart renders summary and range controls', () => {
  const html = renderToStaticMarkup(
    <PortfolioHistoryChart
      range="1M"
      history={sampleHistory}
      loading={false}
      onSelectRange={() => undefined}
    />
  );

  assert.match(html, /Portfolio history/);
  assert.match(html, /Range move/);
  assert.match(html, /Latest value/);
  assert.match(html, />1W</);
  assert.match(html, />ALL</);
});

test('portfolio history chart renders empty state when no snapshots exist', () => {
  const html = renderToStaticMarkup(
    <PortfolioHistoryChart
      range="1M"
      history={{ ...sampleHistory, points: [] }}
      loading={false}
      onSelectRange={() => undefined}
    />
  );

  assert.match(html, /No portfolio snapshots yet/);
});
