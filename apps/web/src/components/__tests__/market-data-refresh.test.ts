import test from 'node:test';
import assert from 'node:assert/strict';

import {
  QUOTE_AUTO_REFRESH_INTERVAL_MS,
  liveQuoteRefreshOptions,
} from '../../lib/market-data-refresh';

test('web live quote refresh uses a 30-second polling interval', () => {
  assert.equal(QUOTE_AUTO_REFRESH_INTERVAL_MS, 30_000);
  assert.equal(liveQuoteRefreshOptions.refetchInterval, 30_000);
  assert.equal(liveQuoteRefreshOptions.refetchIntervalInBackground, false);
});
