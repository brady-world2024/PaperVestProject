import assert from 'node:assert/strict';
import test from 'node:test';

import { getMarketSessionPresentation } from '@papervest/shared-types';

import { formatMarketTimestamp } from '../../lib/formatters';
import { getMarketSessionChipClass } from '../../lib/market-session';

test('after-hours quotes use production-style labels', () => {
  assert.deepEqual(getMarketSessionPresentation('AFTER_HOURS'), {
    statusLabel: 'After Hours',
    priceLabel: 'After-hours price',
    changeLabel: 'After-hours change',
  });
  assert.equal(getMarketSessionChipClass('AFTER_HOURS'), 'session-extended');
});

test('open-session quotes keep real-time copy and success styling', () => {
  assert.deepEqual(getMarketSessionPresentation('OPEN'), {
    statusLabel: 'Open',
    priceLabel: 'Real-time price',
    changeLabel: 'vs previous close',
  });
  assert.equal(getMarketSessionChipClass('OPEN'), 'session-open');
});

test('closed-session quotes preserve last-price copy', () => {
  assert.deepEqual(getMarketSessionPresentation('CLOSED'), {
    statusLabel: 'Closed',
    priceLabel: 'Last price · Market closed',
    changeLabel: 'vs previous close',
  });
  assert.equal(getMarketSessionChipClass('CLOSED'), 'session-closed');
});

test('market timestamps are rendered in ET-friendly copy', () => {
  assert.equal(
    formatMarketTimestamp('2026-01-02T21:00:00Z', 'America/New_York'),
    'Updated at 4:00 PM ET'
  );
});
