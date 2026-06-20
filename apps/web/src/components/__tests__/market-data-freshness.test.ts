import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getDegradedHomeMarketMessage,
  getStaleQuoteBadge,
  getStaleQuoteMessage,
} from '../../lib/market-data-freshness';

test('stale quote helpers return cached copy for degraded quotes', () => {
  assert.equal(getStaleQuoteBadge(true), 'Cached');
  assert.equal(
    getStaleQuoteMessage(true),
    'Using the most recent cached quote while live market data recovers.'
  );
});

test('fresh quotes keep stale messaging hidden', () => {
  assert.equal(getStaleQuoteBadge(false), null);
  assert.equal(getStaleQuoteMessage(false), null);
});

test('degraded home market message is only shown when the board is partial or stale', () => {
  assert.equal(getDegradedHomeMarketMessage(false), null);
  assert.equal(
    getDegradedHomeMarketMessage(true),
    'Some home-market quotes are temporarily unavailable or are being served from cached market data.'
  );
});
