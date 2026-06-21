import Link from 'next/link';

import type { Quote } from '@papervest/shared-types';

import { formatCurrency, formatMarketTimestamp, formatPercent, formatSignedCurrency } from '@/lib/formatters';
import { getLiveFeedbackStatus } from '@/lib/live-feedback';
import { getStaleQuoteBadge, getStaleQuoteMessage } from '@/lib/market-data-freshness';
import { QUOTE_AUTO_REFRESH_INTERVAL_MS } from '@/lib/market-data-refresh';
import { describeMarketSession, getMarketSessionChipClass } from '@/lib/market-session';

export function QuoteRow({
  quote,
  now,
  refreshing = false,
}: {
  quote: Quote;
  now: number;
  refreshing?: boolean;
}) {
  const marketSession = describeMarketSession(quote.marketSession);
  const staleBadge = getStaleQuoteBadge(quote.stale);
  const staleMessage = getStaleQuoteMessage(quote.stale);
  const liveStatus = getLiveFeedbackStatus({
    subject: `${quote.symbol} quote`,
    timestamps: [quote.quoteTimestamp],
    now,
    refreshIntervalMs: QUOTE_AUTO_REFRESH_INTERVAL_MS,
    isRefreshing: refreshing,
    stale: quote.stale,
  });

  return (
    <Link
      className="pv-list-row"
      href={`/stocks/${quote.symbol}?companyName=${encodeURIComponent(quote.companyName)}`}
    >
      <div className="pv-list-primary">
        <span className="pv-list-symbol-line">
          <span className="pv-list-symbol">{quote.symbol}</span>
          <span className={`pv-chip ${getMarketSessionChipClass(quote.marketSession)}`}>
            {marketSession.statusLabel}
          </span>
          {staleBadge ? <span className="pv-chip neutral">{staleBadge}</span> : null}
        </span>
        <span className="pv-list-company">{quote.companyName}</span>
        <span className="pv-kicker">{marketSession.priceLabel}</span>
        {staleMessage ? <span className="pv-kicker">{staleMessage}</span> : null}
        <span className={`pv-live-inline ${liveStatus.tone}`}>
          <span
            aria-hidden="true"
            className={`pv-live-dot ${liveStatus.pulse ? 'pulse' : ''}`}
          />
          <span>{liveStatus.chip}</span>
          <span className="pv-live-inline-copy">{liveStatus.relativeLabel}</span>
        </span>
      </div>
      <div className="pv-list-secondary">
        <strong>{formatCurrency(quote.currentPrice)}</strong>
        <span className={quote.dailyChange >= 0 ? 'pv-positive' : 'pv-negative'}>
          {formatSignedCurrency(quote.dailyChange)} · {formatPercent(quote.dailyChangePercent)}
        </span>
        <span className="pv-kicker">
          {marketSession.changeLabel} · {formatMarketTimestamp(quote.quoteTimestamp, quote.marketTimezone)}
        </span>
      </div>
    </Link>
  );
}
