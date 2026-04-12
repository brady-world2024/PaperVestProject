// Finnhub's official pricing page currently lists the free plan at 60 API calls/minute.
// The backend already caches quotes for 30 seconds, so the web client polls every
// 30 seconds to align with fresh backend quote snapshots across quote-heavy screens.
export const QUOTE_AUTO_REFRESH_INTERVAL_MS = 30_000;

export const liveQuoteRefreshOptions = {
  refetchInterval: QUOTE_AUTO_REFRESH_INTERVAL_MS,
  refetchIntervalInBackground: false,
} as const;
