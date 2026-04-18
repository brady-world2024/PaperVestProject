'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMarketSessionPresentation } from '@papervest/shared-types';

import { AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { EmptyState } from '@/components/empty-state';
import { InlineNotice } from '@/components/inline-notice';
import { SectionHeader } from '@/components/section-header';
import { liveQuoteRefreshOptions } from '@/lib/market-data-refresh';
import { getMarketSessionChipClass } from '@/lib/market-session';
import { queryKeys } from '@/lib/query-keys';
import { webApi } from '@/lib/api';
import {
  formatCurrency,
  formatMarketTimestamp,
  formatPercent,
  formatSignedCurrency,
} from '@/lib/formatters';

export default function WatchlistPage() {
  const queryClient = useQueryClient();

  const watchlistQuery = useQuery({
    queryKey: queryKeys.watchlist,
    queryFn: webApi.getWatchlist,
    ...liveQuoteRefreshOptions,
  });

  const removeMutation = useMutation({
    mutationFn: async (symbol: string) => webApi.removeWatchlistItem(symbol),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.watchlist });
    },
  });

  return (
    <main className="pv-page pv-stack">
      <section className="pv-hero">
        <AppCard className="strong">
          <div className="pv-eyebrow">Saved symbols</div>
          <h1 className="pv-title">Watchlist</h1>
          <p className="pv-copy inverse">
            The web app now reads, removes, and navigates through the same backend watchlist state as mobile.
          </p>
          <div className="pv-metrics" style={{ marginTop: '20px' }}>
            <div className="pv-metric-card">
              <div className="pv-metric-label">Saved symbols</div>
              <div className="pv-metric-value">{watchlistQuery.data?.items.length ?? '...'}</div>
            </div>
            <div className="pv-metric-card">
              <div className="pv-metric-label">Quote source</div>
              <div className="pv-metric-value">Backend-enriched</div>
            </div>
            <div className="pv-metric-card">
              <div className="pv-metric-label">Best entry point</div>
              <div className="pv-metric-value">Stock detail toggle</div>
            </div>
          </div>
        </AppCard>

        <AppCard>
          <SectionHeader
            title="Manage your symbols"
            subtitle="Open a saved stock, or remove it and let TanStack Query refresh the shared watchlist state."
            action={
              <AppButtonLink href="/dashboard" variant="ghost">
                Search more stocks
              </AppButtonLink>
            }
          />

          {watchlistQuery.isLoading ? (
            <div className="pv-subgrid">
              <div className="pv-skeleton" />
              <div className="pv-skeleton" />
            </div>
          ) : watchlistQuery.isError ? (
            <InlineNotice
              tone="error"
              message={webApi.getApiErrorMessage(watchlistQuery.error, 'Unable to load your watchlist')}
            />
          ) : watchlistQuery.data?.items.length ? (
            <div className="pv-list">
              {watchlistQuery.data.items.map((item) => (
                (() => {
                  const marketSession = getMarketSessionPresentation(item.marketSession ?? 'CLOSED');

                  return (
                    <div className="pv-list-row pv-list-row-wrap" key={item.symbol}>
                      <div className="pv-list-primary">
                        <span className="pv-list-symbol-line">
                          <span className="pv-list-symbol">{item.symbol}</span>
                          <span className={`pv-chip ${getMarketSessionChipClass(item.marketSession ?? 'CLOSED')}`}>
                            {marketSession.statusLabel}
                          </span>
                        </span>
                        <span className="pv-list-company">{item.companyName}</span>
                        {item.quoteTimestamp ? (
                          <span className="pv-list-meta-line">
                            <span>{marketSession.priceLabel}</span>
                            <span>{formatMarketTimestamp(item.quoteTimestamp, item.marketTimezone ?? undefined)}</span>
                          </span>
                        ) : (
                          <span className="pv-kicker">Saved for quick access and trade planning.</span>
                        )}
                      </div>
                      <div className="pv-list-secondary">
                        <strong>
                          {item.currentPrice == null ? '...' : formatCurrency(item.currentPrice)}
                        </strong>
                        {item.dailyChange != null && item.dailyChangePercent != null ? (
                          <span className={item.dailyChange >= 0 ? 'pv-positive' : 'pv-negative'}>
                            {formatSignedCurrency(item.dailyChange)} · {formatPercent(item.dailyChangePercent)}
                          </span>
                        ) : (
                          <span className="pv-kicker">Quote unavailable</span>
                        )}
                        <span className="pv-kicker">{marketSession.changeLabel}</span>
                      </div>
                      <div className="pv-action-cluster">
                        <AppButtonLink
                          href={`/stocks/${item.symbol}?companyName=${encodeURIComponent(item.companyName)}`}
                          variant="secondary"
                        >
                          Open
                        </AppButtonLink>
                        <button
                          className="pv-button danger"
                          disabled={removeMutation.isPending}
                          onClick={() => {
                            void removeMutation.mutateAsync(item.symbol);
                          }}
                        >
                          {removeMutation.isPending ? 'Working...' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  );
                })()
              ))}
            </div>
          ) : (
            <EmptyState
              title="No symbols in your watchlist yet"
              description="Add a stock from search or the stock detail page so it shows up here."
            />
          )}

          {removeMutation.isError ? (
            <div style={{ marginTop: '16px' }}>
              <InlineNotice
                tone="error"
                message={webApi.getApiErrorMessage(removeMutation.error, 'Unable to remove the symbol')}
              />
            </div>
          ) : null}
        </AppCard>
      </section>
    </main>
  );
}
