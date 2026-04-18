'use client';

import { useQuery } from '@tanstack/react-query';

import { AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { EmptyState } from '@/components/empty-state';
import { InlineNotice } from '@/components/inline-notice';
import { SectionHeader } from '@/components/section-header';
import { queryKeys } from '@/lib/query-keys';
import { webApi } from '@/lib/api';
import {
  formatCurrency,
  formatDateTime,
  formatShares,
  formatSignedCurrency,
} from '@/lib/formatters';

export default function ActivityPage() {
  const historyQuery = useQuery({
    queryKey: queryKeys.tradeHistory,
    queryFn: webApi.getTradeHistory,
  });

  return (
    <main className="pv-page pv-stack">
      <section className="pv-card strong">
        <div className="pv-eyebrow">Execution ledger</div>
        <h1 className="pv-title">Trade history</h1>
        <p className="pv-copy inverse">
          Every simulated buy and sell is listed here with execution price, gross amount, realized P&amp;L, and timestamp from the backend record.
        </p>
      </section>

      <section className="pv-card">
        <SectionHeader
          title="Recent trades"
          subtitle="This route mirrors the mobile activity tab and reads the same `/api/trades/history` response."
          action={
            <AppButtonLink href="/portfolio" variant="ghost">
              Open portfolio
            </AppButtonLink>
          }
        />

        {historyQuery.isLoading ? (
          <div className="pv-subgrid">
            <div className="pv-skeleton" />
            <div className="pv-skeleton" />
          </div>
        ) : historyQuery.isError ? (
          <InlineNotice
            tone="error"
            message={webApi.getApiErrorMessage(historyQuery.error, 'Unable to load trade history')}
          />
        ) : historyQuery.data?.trades.length ? (
          <div className="pv-subgrid">
            {historyQuery.data.trades.map((trade) => (
              <AppCard key={trade.tradeId}>
                <div className="pv-list-row-head">
                  <div className="pv-list-primary">
                    <span className="pv-list-symbol-line">
                      <span className="pv-list-symbol">{trade.symbol}</span>
                      <span className={`pv-chip ${trade.side === 'BUY' ? 'buy' : 'sell'}`}>
                        {trade.side}
                      </span>
                    </span>
                    <span className="pv-list-company">{trade.companyName}</span>
                    <span className="pv-list-meta-line">
                      <span>{formatShares(trade.quantity)}</span>
                      <span>{formatDateTime(trade.executedAt)}</span>
                    </span>
                  </div>
                  <div className="pv-list-secondary">
                    <strong>{formatCurrency(trade.executedPrice)}</strong>
                    <span className={trade.realizedPnl >= 0 ? 'pv-positive' : 'pv-negative'}>
                      {formatSignedCurrency(trade.realizedPnl)}
                    </span>
                  </div>
                </div>

                <div className="pv-activity-detail-grid">
                  <div className="pv-activity-detail-cell">
                    <span className="pv-kicker">Gross amount</span>
                    <strong>{formatCurrency(trade.grossAmount)}</strong>
                  </div>
                  <div className="pv-activity-detail-cell">
                    <span className="pv-kicker">Cash after trade</span>
                    <strong>{formatCurrency(trade.cashBalanceAfterTrade)}</strong>
                  </div>
                  <div className="pv-activity-detail-cell">
                    <span className="pv-kicker">Realized P&amp;L</span>
                    <strong className={trade.realizedPnl >= 0 ? 'pv-positive' : 'pv-negative'}>
                      {formatSignedCurrency(trade.realizedPnl)}
                    </strong>
                  </div>
                </div>
              </AppCard>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No trades yet"
            description="Your simulated buys and sells will appear here after the first executed order."
          />
        )}
      </section>
    </main>
  );
}
