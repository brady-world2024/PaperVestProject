import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { StockPriceHistory } from '@papervest/shared-types';

import { StockHistoryChart } from '../stock-history-chart';

const sampleHistory: StockPriceHistory = {
  symbol: 'AAPL',
  range: '1M',
  interval: '1d',
  from: '2026-05-01T00:00:00Z',
  to: '2026-05-31T00:00:00Z',
  points: [
    {
      timestamp: '2026-05-01T00:00:00Z',
      openPrice: 180,
      highPrice: 182,
      lowPrice: 179,
      closePrice: 181,
      volume: 1200000,
    },
    {
      timestamp: '2026-05-02T00:00:00Z',
      openPrice: 181,
      highPrice: 183,
      lowPrice: 180,
      closePrice: 182,
      volume: 1500000,
    },
    {
      timestamp: '2026-05-03T00:00:00Z',
      openPrice: 182,
      highPrice: 184,
      lowPrice: 181,
      closePrice: 183,
      volume: 1700000,
    },
    {
      timestamp: '2026-05-04T00:00:00Z',
      openPrice: 183,
      highPrice: 185,
      lowPrice: 182,
      closePrice: 184,
      volume: 1600000,
    },
    {
      timestamp: '2026-05-05T00:00:00Z',
      openPrice: 184,
      highPrice: 186,
      lowPrice: 183,
      closePrice: 185,
      volume: 1900000,
    },
  ],
};

const oneYearContext: StockPriceHistory = {
  ...sampleHistory,
  range: '1Y',
  points: [
    ...sampleHistory.points,
    {
      timestamp: '2026-05-06T00:00:00Z',
      openPrice: 185,
      highPrice: 196,
      lowPrice: 168,
      closePrice: 186,
      volume: 2100000,
    },
  ],
};

test('stock research chart renders indicator controls and research actions', () => {
  const html = renderToStaticMarkup(
    <StockHistoryChart
      range="1M"
      history={sampleHistory}
      contextHistory={oneYearContext}
      symbol="AAPL"
      loading={false}
      onSelectRange={() => undefined}
      researchActions={[
        { href: '/orders?symbol=AAPL&side=BUY', label: 'Queue target-price buy' },
        { href: '/watchlist', label: 'Open watchlist workspace' },
      ]}
    />
  );

  assert.match(html, /Research chart/);
  assert.match(html, /MA\(5\)/);
  assert.match(html, /MA\(20\)/);
  assert.match(html, /VWAP/);
  assert.match(html, /52W context/);
  assert.match(html, /Queue target-price buy/);
});

test('stock research chart renders empty state when no history exists', () => {
  const html = renderToStaticMarkup(
    <StockHistoryChart
      range="1M"
      history={{ ...sampleHistory, points: [] }}
      loading={false}
      onSelectRange={() => undefined}
    />
  );

  assert.match(html, /No research chart data available/);
});
