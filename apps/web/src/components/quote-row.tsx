import Link from 'next/link';

import type { Quote } from '@papervest/shared-types';

import { formatCurrency, formatPercent, formatSignedCurrency } from '@/lib/formatters';

export function QuoteRow({ quote }: { quote: Quote }) {
  return (
    <Link
      className="pv-list-row"
      href={`/stocks/${quote.symbol}?companyName=${encodeURIComponent(quote.companyName)}`}
    >
      <div className="pv-list-primary">
        <span className="pv-list-symbol">{quote.symbol}</span>
        <span className="pv-list-company">{quote.companyName}</span>
      </div>
      <div className="pv-list-secondary">
        <strong>{formatCurrency(quote.currentPrice)}</strong>
        <span className={quote.dailyChange >= 0 ? 'pv-positive' : 'pv-negative'}>
          {formatSignedCurrency(quote.dailyChange)} · {formatPercent(quote.dailyChangePercent)}
        </span>
      </div>
    </Link>
  );
}
