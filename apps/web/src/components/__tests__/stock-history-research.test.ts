import assert from 'node:assert/strict';
import test from 'node:test';

import type { StockPriceBar } from '@papervest/shared-types';

import {
  buildResearchSeries,
  getAverageVolume,
  getFiftyTwoWeekContext,
} from '../../lib/stock-history-research';

const samplePoints: StockPriceBar[] = [
  { timestamp: '2026-01-01T10:00:00Z', openPrice: 10, highPrice: 12, lowPrice: 9, closePrice: 11, volume: 100 },
  { timestamp: '2026-01-02T10:00:00Z', openPrice: 11, highPrice: 13, lowPrice: 10, closePrice: 12, volume: 110 },
  { timestamp: '2026-01-03T10:00:00Z', openPrice: 12, highPrice: 14, lowPrice: 11, closePrice: 13, volume: 120 },
  { timestamp: '2026-01-04T10:00:00Z', openPrice: 13, highPrice: 15, lowPrice: 12, closePrice: 14, volume: 130 },
  { timestamp: '2026-01-05T10:00:00Z', openPrice: 14, highPrice: 16, lowPrice: 13, closePrice: 15, volume: 140 },
];

test('research series adds moving averages and vwap progressively', () => {
  const series = buildResearchSeries(samplePoints);

  assert.equal(series.length, 5);
  assert.equal(series[0]?.movingAverage5, null);
  assert.equal(series[3]?.movingAverage5, null);
  assert.equal(series[4]?.movingAverage5, 13);
  assert.equal(series[4]?.movingAverage20, null);
  assert.ok(series[4]?.vwap != null);
  assert.ok(Math.abs((series[4]?.vwap ?? 0) - 12.8333) < 0.02);
});

test('average volume summarizes the full series', () => {
  assert.equal(getAverageVolume(samplePoints), 120);
});

test('52-week context reports current position inside the historical band', () => {
  const context = getFiftyTwoWeekContext(samplePoints, 15);

  assert.ok(context);
  assert.equal(context?.high, 16);
  assert.equal(context?.low, 9);
  assert.ok(Math.abs((context?.rangePositionPercent ?? 0) - 85.7142857) < 0.001);
  assert.ok(Math.abs((context?.distanceFromHighPercent ?? 0) - 6.25) < 0.001);
});
