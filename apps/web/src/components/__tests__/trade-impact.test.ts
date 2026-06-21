import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getTradeImpactPreview,
  getTradeQuantityPresets,
} from '../../lib/trade-impact';

test('buy impact preview projects cash, size, and blended average cost', () => {
  const preview = getTradeImpactPreview({
    side: 'BUY',
    quantity: 5,
    currentPrice: 200,
    cashBalance: 10000,
    totalPortfolioValue: 15000,
    holdingQuantity: 10,
    holdingAverageCost: 180,
    holdingMarketValue: 2000,
  });

  assert.equal(preview.estimatedNotional, 1000);
  assert.equal(preview.estimatedCashAfter, 9000);
  assert.equal(preview.estimatedSharesAfter, 15);
  assert.equal(preview.estimatedPositionValueAfter, 3000);
  assert.equal(preview.estimatedAverageCostAfter, 186.66666666666666);
  assert.equal(preview.insight?.kind, 'averaging-in');
});

test('sell impact preview reports realized pnl and full-exit guidance', () => {
  const preview = getTradeImpactPreview({
    side: 'SELL',
    quantity: 10,
    currentPrice: 210,
    cashBalance: 4000,
    totalPortfolioValue: 6100,
    holdingQuantity: 10,
    holdingAverageCost: 180,
    holdingMarketValue: 2100,
  });

  assert.equal(preview.estimatedCashAfter, 6100);
  assert.equal(preview.estimatedSharesAfter, 0);
  assert.equal(preview.estimatedRealizedPnl, 300);
  assert.equal(preview.insight?.kind, 'full-exit');
});

test('buy and sell presets expose quick sizing options', () => {
  const buyPresets = getTradeQuantityPresets({
    side: 'BUY',
    currentPrice: 100,
    cashBalance: 10000,
    holdingQuantity: 0,
  });
  const sellPresets = getTradeQuantityPresets({
    side: 'SELL',
    currentPrice: 100,
    cashBalance: 10000,
    holdingQuantity: 12,
  });

  assert.equal(buyPresets.at(-1)?.label, 'Max');
  assert.equal(buyPresets.at(-1)?.quantity, 100);
  assert.deepEqual(
    sellPresets.map((preset) => preset.label),
    ['25%', '50%', 'All out']
  );
});
