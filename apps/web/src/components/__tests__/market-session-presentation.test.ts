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

test('market timestamps are rendered in ET-friendly copy', () => {
  assert.equal(
    formatMarketTimestamp('2026-01-02T21:00:00Z', 'America/New_York'),
    'Updated at 4:00 PM ET'
  );
});
