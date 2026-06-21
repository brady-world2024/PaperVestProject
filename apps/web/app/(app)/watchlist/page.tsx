'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMarketSessionPresentation } from '@papervest/shared-types';

import { AppButton, AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { EmptyState } from '@/components/empty-state';
import { InlineNotice } from '@/components/inline-notice';
import { SectionHeader } from '@/components/section-header';
import { getStaleQuoteBadge, getStaleQuoteMessage } from '@/lib/market-data-freshness';
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
import { useWorkspaceDensity } from '@/lib/use-workspace-density';
import { sortWatchlistItems, type WatchlistSort } from '@/lib/workspace-grids';

export default function WatchlistPage() {
  const queryClient = useQueryClient();
  const { density, setDensity } = useWorkspaceDensity('pv-watchlist-density');
  const [sort, setSort] = useState<WatchlistSort>('dailyChange');

  const watchlistQuery = useQuery({
    queryKey: queryKeys.watchlist,
    queryFn: webApi.getWatchlist,
    ...liveQuoteRefreshOptions,
  });

  const removeMutation = useMutation({
    mutationFn: async (symbol: string) => {
      await webApi.initializeCsrf();
      return webApi.removeWatchlistItem(symbol);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.watchlist });
    },
  });
  const sortedItems = sortWatchlistItems(watchlistQuery.data?.items ?? [], sort);

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
            subtitle="A denser watch workspace for scanning quotes, sorting momentum, and jumping into stock detail faster."
            action={
              <AppButtonLink href="/dashboard" variant="ghost">
                Search more stocks
              </AppButtonLink>
            }
          />

          <div className="pv-workspace-toolbar">
            <div className="pv-workspace-toolbar-copy">
              <strong>Workspace mode</strong>
              <span>Switch between a compact scan view and a more descriptive comfortable view.</span>
            </div>
            <div className="pv-workspace-controls">
              <div className="pv-density-toggle">
                <AppButton
                  variant={density === 'comfortable' ? 'secondary' : 'ghost'}
                  className="pv-density-button"
                  onClick={() => setDensity('comfortable')}
                >
                  Comfortable
                </AppButton>
                <AppButton
                  variant={density === 'compact' ? 'secondary' : 'ghost'}
                  className="pv-density-button"
                  onClick={() => setDensity('compact')}
                >
                  Compact
                </AppButton>
              </div>
              <div className="pv-workspace-select-wrap">
                <label className="pv-kicker" htmlFor="watchlist-sort">
                  Sort by
                </label>
                <select
                  id="watchlist-sort"
                  className="pv-input pv-workspace-select"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as WatchlistSort)}
                >
                  <option value="dailyChange">Daily change</option>
                  <option value="latest">Latest quote</option>
                  <option value="price">Last price</option>
                  <option value="symbol">Symbol</option>
                </select>
              </div>
            </div>
          </div>

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
            <div className={`pv-workspace-table ${density}`}>
              <div className="pv-workspace-header">
                <span>Symbol</span>
                <span>Last price</span>
                <span>Change</span>
                <span>Session</span>
                <span>Updated</span>
                <span className="actions">Actions</span>
              </div>
              {sortedItems.map((item) => {
                const marketSession = getMarketSessionPresentation(item.marketSession ?? 'CLOSED');

                return (
                  <div className={`pv-workspace-row ${density}`} key={item.symbol}>
                    <div className="pv-workspace-cell primary">
                      <span className="pv-list-symbol-line">
                        <span className="pv-list-symbol">{item.symbol}</span>
                        <span className={`pv-chip ${getMarketSessionChipClass(item.marketSession ?? 'CLOSED')}`}>
                          {marketSession.statusLabel}
                        </span>
                        {getStaleQuoteBadge(item.staleQuote) ? (
                          <span className="pv-chip neutral">{getStaleQuoteBadge(item.staleQuote)}</span>
                        ) : null}
                      </span>
                      <span className="pv-list-company">{item.companyName}</span>
                      {density === 'comfortable' ? (
                        <>
                          {item.quoteTimestamp ? (
                            <span className="pv-list-meta-line">
                              <span>{marketSession.priceLabel}</span>
                              <span>{formatMarketTimestamp(item.quoteTimestamp, item.marketTimezone ?? undefined)}</span>
                            </span>
                          ) : (
                            <span className="pv-kicker">Saved for quick access and trade planning.</span>
                          )}
                          {getStaleQuoteMessage(item.staleQuote) ? (
                            <span className="pv-kicker">{getStaleQuoteMessage(item.staleQuote)}</span>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                    <div className="pv-workspace-cell numeric">
                      <strong>{item.currentPrice == null ? '...' : formatCurrency(item.currentPrice)}</strong>
                    </div>
                    <div className="pv-workspace-cell numeric">
                      {item.dailyChange != null && item.dailyChangePercent != null ? (
                        <span className={item.dailyChange >= 0 ? 'pv-positive' : 'pv-negative'}>
                          {formatSignedCurrency(item.dailyChange)} · {formatPercent(item.dailyChangePercent)}
                        </span>
                      ) : (
                        <span className="pv-kicker">Quote unavailable</span>
                      )}
                    </div>
                    <div className="pv-workspace-cell">
                      <span className="pv-kicker">{marketSession.changeLabel}</span>
                    </div>
                    <div className="pv-workspace-cell">
                      <span className="pv-kicker">
                        {item.quoteTimestamp
                          ? formatMarketTimestamp(item.quoteTimestamp, item.marketTimezone ?? undefined)
                          : 'No quote yet'}
                      </span>
                    </div>
                    <div className="pv-workspace-cell actions">
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
              })}
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
