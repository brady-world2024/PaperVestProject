import {
  QUOTE_AUTO_REFRESH_INTERVAL_MS,
  liveQuoteRefreshOptions,
} from '../../services/api/market-data-refresh';

describe('mobile live quote refresh', () => {
  it('uses a 30-second polling interval', () => {
    expect(QUOTE_AUTO_REFRESH_INTERVAL_MS).toBe(30_000);
    expect(liveQuoteRefreshOptions.refetchInterval).toBe(30_000);
    expect(liveQuoteRefreshOptions.refetchIntervalInBackground).toBe(false);
  });
});
