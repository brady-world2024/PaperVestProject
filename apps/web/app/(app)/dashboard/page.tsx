'use client';

import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMarketSessionPresentation } from '@papervest/shared-types';

import { AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppField } from '@/components/app-field';
import { EmptyState } from '@/components/empty-state';
import { InlineNotice } from '@/components/inline-notice';
import { MetricCard } from '@/components/metric-card';
import { QuoteRow } from '@/components/quote-row';
import { SectionHeader } from '@/components/section-header';
import { liveQuoteRefreshOptions } from '@/lib/market-data-refresh';
import { queryKeys } from '@/lib/query-keys';
import { webApi } from '@/lib/api';
import {
  formatCurrency,
  formatDateTime,
  formatMarketTimestamp,
  formatPercent,
  formatShares,
  formatSignedCurrency,
} from '@/lib/formatters';
import { getMarketSessionChipClass } from '@/lib/market-session';

export default function DashboardPage() {
  const [searchText, setSearchText] = useState('');
  const deferredSearch = useDeferredValue(searchText.trim());

  const homeQuery = useQuery({
    queryKey: queryKeys.home,
    queryFn: webApi.getHomeMarket,
    ...liveQuoteRefreshOptions,
  });

  const portfolioQuery = useQuery({
    queryKey: queryKeys.portfolio,
    queryFn: webApi.getPortfolio,
    ...liveQuoteRefreshOptions,
  });

  const watchlistQuery = useQuery({
    queryKey: queryKeys.watchlist,
    queryFn: webApi.getWatchlist,
    ...liveQuoteRefreshOptions,
  });

  const historyQuery = useQuery({
    queryKey: queryKeys.tradeHistory,
    queryFn: webApi.getTradeHistory,
  });

  const searchQuery = useQuery({
    queryKey: queryKeys.stockSearch(deferredSearch),
    queryFn: () => webApi.searchStocks(deferredSearch),
    enabled: deferredSearch.length > 0,
  });

  const summary = portfolioQuery.data?.summary;
  const holdings = portfolioQuery.data?.holdings ?? [];
  const watchlistItems = watchlistQuery.data?.items ?? [];
  const recentTrades = historyQuery.data?.trades.slice(0, 4) ?? [];

  return (
    <main className="pv-page pv-stack">
      <section className="pv-dashboard-hero">
        <AppCard className="strong pv-dashboard-hero-card">
          <div className="pv-eyebrow">Overview</div>
          <div className="pv-dashboard-hero-head">
            <div>
              <h1 className="pv-title">Trading desk</h1>
              <p className="pv-copy inverse">Portfolio totals, watchlist state, and quotes stay in sync with the backend.</p>
            </div>
            <div className="pv-action-cluster">
              <AppButtonLink href="/portfolio" variant="secondary">
                Portfolio
              </AppButtonLink>
              <AppButtonLink href="/activity" variant="ghost">
                Activity
              </AppButtonLink>
            </div>
          </div>

          <div className="pv-dashboard-summary-grid">
            <MetricCard
              label="Portfolio value"
              value={summary ? formatCurrency(summary.totalPortfolioValue) : '...'}
            />
            <MetricCard
              label="Cash balance"
              value={summary ? formatCurrency(summary.cashBalance) : '...'}
            />
            <MetricCard
              label="Daily move"
              value={summary ? formatSignedCurrency(summary.dailyChange) : '...'}
              tone={(summary?.dailyChange ?? 0) >= 0 ? 'positive' : 'negative'}
            />
            <MetricCard
              label="Total return"
              value={summary ? formatPercent(summary.totalReturnPercent) : '...'}
              tone={(summary?.totalReturnPercent ?? 0) >= 0 ? 'positive' : 'negative'}
            />
          </div>

          {portfolioQuery.isError ? (
            <InlineNotice
              tone="error"
              message={webApi.getApiErrorMessage(portfolioQuery.error, 'Unable to load the portfolio summary')}
            />
          ) : null}
        </AppCard>

        <AppCard className="pv-command-card">
          <SectionHeader
            title="Market search"
            subtitle="Search by ticker or company."
          />
          <div className="pv-stack">
            <AppField
              label="Symbol or company"
              placeholder="AAPL, Apple, NVIDIA..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            {deferredSearch.length > 0 ? (
              searchQuery.isLoading ? (
                <div className="pv-subgrid">
                  <div className="pv-skeleton" />
                  <div className="pv-skeleton" />
                </div>
              ) : searchQuery.isError ? (
                <InlineNotice
                  tone="error"
                  message={webApi.getApiErrorMessage(searchQuery.error, 'Unable to search stocks right now')}
                />
              ) : searchQuery.data?.results.length ? (
                <div className="pv-list">
                  {searchQuery.data.results.map((result) => (
                    <Link
                      key={result.symbol}
                      className="pv-list-row"
                      href={`/stocks/${result.symbol}?companyName=${encodeURIComponent(result.companyName)}`}
                    >
                      <div className="pv-list-primary">
                        <span className="pv-list-symbol">{result.symbol}</span>
                        <span className="pv-list-company">{result.companyName}</span>
                      </div>
                      <div className="pv-list-secondary">
                        <span className="pv-kicker">{result.type}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No symbols matched that search"
                  description="Try a ticker like AAPL or a company name like Microsoft."
                />
              )
            ) : (
              <div className="pv-command-panel-copy">
                <p className="pv-copy">Results appear as soon as you type.</p>
                <div className="pv-command-highlights">
                  <span className="pv-chip buy">Quotes</span>
                  <span className="pv-chip buy">Watchlist</span>
                  <span className="pv-chip buy">Trade ticket</span>
                </div>
              </div>
            )}
          </div>
        </AppCard>
      </section>

      <section className="pv-dashboard-subgrid">
        <AppCard>
          <SectionHeader
            title="Watchlist snapshot"
            subtitle="Saved symbols with live quote context."
            action={
              <AppButtonLink href="/watchlist" variant="ghost">
                Open watchlist
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
              message={webApi.getApiErrorMessage(watchlistQuery.error, 'Unable to load the watchlist')}
            />
          ) : watchlistItems.length ? (
            <div className="pv-list">
              {watchlistItems.slice(0, 4).map((item) => (
                (() => {
                  const marketSession = getMarketSessionPresentation(item.marketSession ?? 'CLOSED');

                  return (
                    <Link
                      key={item.symbol}
                      className="pv-list-row"
                      href={`/stocks/${item.symbol}?companyName=${encodeURIComponent(item.companyName)}`}
                    >
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
                        ) : null}
                      </div>
                      <div className="pv-list-secondary">
                        <strong>{item.currentPrice == null ? '...' : formatCurrency(item.currentPrice)}</strong>
                        {item.dailyChange != null && item.dailyChangePercent != null ? (
                          <span className={item.dailyChange >= 0 ? 'pv-positive' : 'pv-negative'}>
                            {formatSignedCurrency(item.dailyChange)} · {formatPercent(item.dailyChangePercent)}
                          </span>
                        ) : (
                          <span className="pv-kicker">Quote unavailable</span>
                        )}
                        <span className="pv-kicker">{marketSession.changeLabel}</span>
                      </div>
                    </Link>
                  );
                })()
              ))}
            </div>
          ) : (
            <EmptyState
              title="No saved names yet"
              description="Use search or stock detail to pin a symbol to your watchlist."
            />
          )}
        </AppCard>

        <AppCard>
          <SectionHeader
            title="Recent activity"
            subtitle="Latest simulated executions."
            action={
              <AppButtonLink href="/activity" variant="ghost">
                Full history
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
              message={webApi.getApiErrorMessage(historyQuery.error, 'Unable to load recent trades')}
            />
          ) : recentTrades.length ? (
            <div className="pv-list">
              {recentTrades.map((trade) => (
                <Link
                  key={trade.tradeId}
                  className="pv-list-row"
                  href={`/stocks/${trade.symbol}?companyName=${encodeURIComponent(trade.companyName)}`}
                >
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
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No trades yet"
              description="Your last few buys and sells will appear here after the first executed order."
            />
          )}
        </AppCard>
      </section>

      <section className="pv-dashboard-board">
        <AppCard className="pv-market-board-card">
          <SectionHeader
            title="Major US names"
            subtitle="Home-market quotes from the backend."
            action={
              <AppButtonLink href="/watchlist" variant="ghost">
                Watchlist
              </AppButtonLink>
            }
          />
          {homeQuery.isLoading ? (
            <div className="pv-subgrid">
              <div className="pv-skeleton" />
              <div className="pv-skeleton" />
              <div className="pv-skeleton" />
            </div>
          ) : homeQuery.isError ? (
            <InlineNotice
              tone="error"
              message={webApi.getApiErrorMessage(homeQuery.error, 'Unable to load the home market board')}
            />
          ) : (
            <div className="pv-list">
              {homeQuery.data?.quotes.map((quote) => (
                <QuoteRow key={quote.symbol} quote={quote} />
              ))}
            </div>
          )}
        </AppCard>

        <div className="pv-stack">
          <AppCard>
            <SectionHeader
              title="Holdings pulse"
              subtitle="Open positions and unrealized performance."
            />
            {portfolioQuery.isLoading ? (
              <div className="pv-subgrid">
                <div className="pv-skeleton" />
                <div className="pv-skeleton" />
              </div>
            ) : holdings.length ? (
              <div className="pv-list">
              {holdings.slice(0, 4).map((holding) => (
                (() => {
                  const marketSession = getMarketSessionPresentation(holding.marketSession ?? 'CLOSED');

                  return (
                    <Link
                      key={holding.symbol}
                      className="pv-list-row"
                      href={`/stocks/${holding.symbol}?companyName=${encodeURIComponent(holding.companyName)}`}
                    >
                      <div className="pv-list-primary">
                        <span className="pv-list-symbol-line">
                          <span className="pv-list-symbol">{holding.symbol}</span>
                          <span className={`pv-chip ${getMarketSessionChipClass(holding.marketSession ?? 'CLOSED')}`}>
                            {marketSession.statusLabel}
                          </span>
                        </span>
                        <span className="pv-list-company">{holding.companyName}</span>
                        <span className="pv-list-meta-line">
                          <span>{formatShares(holding.quantity)} shares</span>
                          <span>Avg {formatCurrency(holding.averageCost)}</span>
                        </span>
                        {holding.quoteTimestamp ? (
                          <span className="pv-list-meta-line">
                            <span>{marketSession.priceLabel}</span>
                            <span>{formatMarketTimestamp(holding.quoteTimestamp, holding.marketTimezone ?? undefined)}</span>
                          </span>
                        ) : null}
                      </div>
                      <div className="pv-list-secondary">
                        <strong>{formatCurrency(holding.marketValue)}</strong>
                        <span className={holding.unrealizedPnl >= 0 ? 'pv-positive' : 'pv-negative'}>
                          {formatSignedCurrency(holding.unrealizedPnl)} · {formatPercent(holding.unrealizedPnlPercent)}
                        </span>
                      </div>
                    </Link>
                  );
                })()
              ))}
            </div>
          ) : (
              <EmptyState
                title="No holdings yet"
                description="Place a simulated buy order from any stock detail page and positions will show up here."
              />
            )}
          </AppCard>

          <AppCard>
            <SectionHeader
              title="Capital stack"
              subtitle="Cash, exposure, and P&L."
            />
            <div className="pv-meta-row">
              <span className="pv-kicker">Cash</span>
              <strong>{summary ? formatCurrency(summary.cashBalance) : '...'}</strong>
            </div>
            <div className="pv-meta-row">
              <span className="pv-kicker">Holdings market value</span>
              <strong>{summary ? formatCurrency(summary.holdingsMarketValue) : '...'}</strong>
            </div>
            <div className="pv-meta-row">
              <span className="pv-kicker">Realized P&amp;L</span>
              <strong className={(summary?.realizedPnl ?? 0) >= 0 ? 'pv-positive' : 'pv-negative'}>
                {summary ? formatSignedCurrency(summary.realizedPnl) : '...'}
              </strong>
            </div>
            <div className="pv-meta-row">
              <span className="pv-kicker">Unrealized P&amp;L</span>
              <strong className={(summary?.unrealizedPnl ?? 0) >= 0 ? 'pv-positive' : 'pv-negative'}>
                {summary ? formatSignedCurrency(summary.unrealizedPnl) : '...'}
              </strong>
            </div>
          </AppCard>
        </div>
      </section>
    </main>
  );
}
