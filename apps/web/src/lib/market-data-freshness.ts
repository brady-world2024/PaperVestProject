export function getStaleQuoteBadge(stale: boolean) {
  return stale ? 'Cached' : null;
}

export function getStaleQuoteMessage(stale: boolean) {
  return stale ? 'Using the most recent cached quote while live market data recovers.' : null;
}

export function getDegradedHomeMarketMessage(degraded: boolean) {
  return degraded
    ? 'Some home-market quotes are temporarily unavailable or are being served from cached market data.'
    : null;
}
