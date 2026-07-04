import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { TradeOrderCard } from '../trade-order-card';

test('trade order card renders quick size controls and impact preview', () => {
  const html = renderToStaticMarkup(
    <TradeOrderCard
      symbol="AAPL"
      side="BUY"
      title="Buy shares"
      subtitle="Preview the trade before execution."
      submitLabel="Place buy order"
      currentPrice={200}
      cashBalance={10000}
      totalPortfolioValue={15000}
      holdingQuantity={10}
      holdingAverageCost={180}
      holdingMarketValue={2000}
      availableLabel="Available cash"
      availableValue="$10,000.00"
      supportLabel="Execution source"
      supportValue="Current backend quote"
      followThroughAction={{
        href: '/orders?symbol=AAPL&side=SELL',
        label: 'Plan a target-price exit',
        copy: 'Queue the follow-through order after entry.',
      }}
      pending={false}
      onSubmitQuantity={async () => undefined}
    />
  );

  assert.match(html, /Impact preview/);
  assert.match(html, /Quick size/);
  assert.match(html, /Cash after/);
  assert.match(html, /Position weight/);
  assert.match(html, /Plan a target-price exit/);
});

test('trade order card renders success follow-through only after a successful trade', () => {
  const html = renderToStaticMarkup(
    <TradeOrderCard
      symbol="AAPL"
      side="BUY"
      title="Buy shares"
      submitLabel="Place buy order"
      currentPrice={100}
      cashBalance={1000}
      totalPortfolioValue={1000}
      holdingQuantity={0}
      holdingAverageCost={0}
      holdingMarketValue={0}
      availableLabel="Buying power"
      availableValue="$1,000.00"
      supportLabel="Execution source"
      supportValue="Current backend quote"
      pending={false}
      successMessage="Buy order filled. OMS id order-1."
      successAction={{
        href: '/orders',
        label: 'View order lifecycle',
        copy: 'Open the OMS blotter to inspect fill and reservation state.',
      }}
      onSubmitQuantity={async () => undefined}
    />
  );

  assert.match(html, /View order lifecycle/);
  assert.match(html, /Open the OMS blotter/);
});
