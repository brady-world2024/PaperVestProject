// Finnhub's official pricing page currently lists the free plan at 60 API calls/minute.
// The backend already caches quotes for 30 seconds, so mobile polls every 30 seconds
// to align with the freshest backend quote snapshot on active quote screens.
export const QUOTE_AUTO_REFRESH_INTERVAL_MS = 30_000;

export const liveQuoteRefreshOptions = {
  refetchInterval: QUOTE_AUTO_REFRESH_INTERVAL_MS,
  refetchIntervalInBackground: false,
} as const;
