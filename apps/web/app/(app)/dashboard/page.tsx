'use client';

import Link from 'next/link';
import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getMarketSessionPresentation,
  type PortfolioHistoryRange,
} from '@papervest/shared-types';

import { AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppField } from '@/components/app-field';
import { EmptyState } from '@/components/empty-state';
import { InlineNotice } from '@/components/inline-notice';
import { MetricCard } from '@/components/metric-card';
import { PortfolioHistoryChart } from '@/components/portfolio-history-chart';
import { QuoteRow } from '@/components/quote-row';
import { SectionHeader } from '@/components/section-header';
import {
  getActiveCommandCenterOrders,
  getCommandCenterExposureSummary,
  getCommandCenterMarketSummary,
  getCommandCenterNextActions,
} from '@/lib/dashboard-command-center';
import {
  formatCurrency,
  formatDateTime,
  formatMarketTimestamp,
  formatPercent,
  formatShares,
  formatSignedCurrency,
} from '@/lib/formatters';
import { webApi } from '@/lib/api';
import { getDegradedHomeMarketMessage, getStaleQuoteBadge, getStaleQuoteMessage } from '@/lib/market-data-freshness';
import { liveQuoteRefreshOptions } from '@/lib/market-data-refresh';
import { getMarketSessionChipClass } from '@/lib/market-session';
import { queryKeys } from '@/lib/query-keys';

export default function DashboardPage() {
  const [searchText, setSearchText] = useState('');
  const [historyRange, setHistoryRange] = useState<PortfolioHistoryRange>('1M');
  const deferredSearch = useDeferredValue(searchText.trim());
  const lastTrackedSearchRef = useRef<string | null>(null);

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

  const portfolioHistoryQuery = useQuery({
    queryKey: queryKeys.portfolioHistory(historyRange),
    queryFn: () => webApi.getPortfolioHistory(historyRange),
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

  const conditionalOrdersQuery = useQuery({
    queryKey: queryKeys.conditionalOrders,
    queryFn: webApi.getConditionalOrders,
    ...liveQuoteRefreshOptions,
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
  const activeConditionalOrders = getActiveCommandCenterOrders(conditionalOrdersQuery.data?.orders ?? []);
  const exposureSummary = getCommandCenterExposureSummary(summary, holdings);
  const marketSummary = getCommandCenterMarketSummary(
    homeQuery.data?.quotes ?? [],
    homeQuery.data?.degraded ?? false
  );
  const nextActions = getCommandCenterNextActions({
    holdings,
    watchlistItems,
    activeConditionalOrders,
    marketSummary,
  });
  const topExposureHoldings = [...holdings]
    .sort((left, right) => right.marketValue - left.marketValue)
    .slice(0, 3);
  const degradedHomeMarketMessage = getDegradedHomeMarketMessage(homeQuery.data?.degraded ?? false);

  useEffect(() => {
    if (!deferredSearch || !searchQuery.isSuccess || !searchQuery.data) {
      return;
    }

    const trackingKey = `${deferredSearch.toLowerCase()}:${searchQuery.data.results.length}`;
    if (lastTrackedSearchRef.current === trackingKey) {
      return;
    }

    lastTrackedSearchRef.current = trackingKey;
    void webApi.trackProductAnalyticsEvent({
      eventName: 'STOCK_SEARCH_PERFORMED',
      path: '/dashboard',
      metadata: {
        queryLength: deferredSearch.length,
        resultsCount: searchQuery.data.results.length,
      },
    });
  }, [deferredSearch, searchQuery.data, searchQuery.isSuccess]);

  return (
    <main className="pv-page pv-stack">
      <section className="pv-dashboard-hero">
        <AppCard className="strong pv-dashboard-hero-card">
          <div className="pv-eyebrow">Command center</div>
          <div className="pv-dashboard-hero-head">
            <div>
              <h1 className="pv-title">PaperVest cockpit</h1>
              <p className="pv-copy inverse">
                Market context, account health, portfolio history, and the next best actions all stay wired into the
                same authenticated workspace.
              </p>
            </div>
            <div className="pv-action-cluster">
              <AppButtonLink href="/portfolio" variant="secondary">
                Portfolio
              </AppButtonLink>
              <AppButtonLink href="/orders" variant="ghost">
                Conditional orders
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

          <div className="pv-command-status-strip">
            <div className={`pv-command-status-card ${marketSummary.tone}`}>
              <span className="pv-command-status-label">Market status</span>
              <strong className="pv-command-status-value">
                {homeQuery.isLoading ? 'Refreshing…' : marketSummary.chip}
              </strong>
              <span className="pv-command-status-copy">{marketSummary.detail}</span>
            </div>
            <div className="pv-command-status-card">
              <span className="pv-command-status-label">Positions open</span>
              <strong className="pv-command-status-value">{holdings.length}</strong>
              <span className="pv-command-status-copy">
                {holdings.length ? 'Holdings are feeding exposure and P&L in real time.' : 'The account is still all cash.'}
              </span>
            </div>
            <div className="pv-command-status-card">
              <span className="pv-command-status-label">Watchlist tracked</span>
              <strong className="pv-command-status-value">{watchlistItems.length}</strong>
              <span className="pv-command-status-copy">
                {watchlistItems.length ? 'Saved symbols are ready for quote review and trade launch.' : 'No symbols pinned yet.'}
              </span>
            </div>
            <div className="pv-command-status-card">
              <span className="pv-command-status-label">Orders armed</span>
              <strong className="pv-command-status-value">{activeConditionalOrders.length}</strong>
              <span className="pv-command-status-copy">
                {activeConditionalOrders.length
                  ? 'Active conditional orders are still watching market levels.'
                  : 'No target-price automation is guarding the book yet.'}
              </span>
            </div>
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
            title="Search + launch"
            subtitle="Jump straight from research into stock detail, watchlist, or the trade ticket."
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
                        <strong>{result.type}</strong>
                        <span className="pv-kicker">Open stock detail</span>
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
                <p className="pv-copy">
                  Use the command center as the launch point for research, watchlist changes, and first-trade setup.
                </p>
                <div className="pv-command-highlights">
                  <span className="pv-chip buy">Quotes</span>
                  <span className="pv-chip buy">Watchlist</span>
                  <span className="pv-chip buy">Trade ticket</span>
                  <span className="pv-chip neutral">Conditional orders</span>
                </div>
              </div>
            )}
          </div>
        </AppCard>
      </section>

      <section className="pv-command-center-grid">
        <div className="pv-stack">
          <AppCard className="pv-chart-card">
            <PortfolioHistoryChart
              range={historyRange}
              history={portfolioHistoryQuery.data}
              loading={portfolioHistoryQuery.isLoading}
              refreshing={portfolioHistoryQuery.isFetching}
              errorMessage={
                portfolioHistoryQuery.isError
                  ? webApi.getApiErrorMessage(portfolioHistoryQuery.error, 'Unable to load portfolio history')
                  : null
              }
              onSelectRange={setHistoryRange}
            />
          </AppCard>

          <section className="pv-dashboard-subgrid">
            <AppCard>
              <SectionHeader
                title="Watchlist preview"
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
                  {watchlistItems.slice(0, 4).map((item) => {
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
                            {getStaleQuoteBadge(item.staleQuote) ? (
                              <span className="pv-chip neutral">{getStaleQuoteBadge(item.staleQuote)}</span>
                            ) : null}
                          </span>
                          <span className="pv-list-company">{item.companyName}</span>
                          {item.quoteTimestamp ? (
                            <span className="pv-list-meta-line">
                              <span>{marketSession.priceLabel}</span>
                              <span>{formatMarketTimestamp(item.quoteTimestamp, item.marketTimezone ?? undefined)}</span>
                            </span>
                          ) : null}
                          {getStaleQuoteMessage(item.staleQuote) ? (
                            <span className="pv-kicker">{getStaleQuoteMessage(item.staleQuote)}</span>
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
                  })}
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
                          <span className={`pv-chip ${trade.side === 'BUY' ? 'buy' : 'sell'}`}>{trade.side}</span>
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

          <AppCard className="pv-market-board-card">
            <SectionHeader
              title="Market board"
              subtitle="Major US names with backend-managed quote context."
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
              <>
                {degradedHomeMarketMessage ? (
                  <div style={{ marginBottom: '12px' }}>
                    <InlineNotice tone="info" message={degradedHomeMarketMessage} />
                  </div>
                ) : null}
                <div className="pv-list">
                  {homeQuery.data?.quotes.map((quote) => (
                    <QuoteRow key={quote.symbol} quote={quote} />
                  ))}
                </div>
              </>
            )}
          </AppCard>
        </div>

        <div className="pv-stack">
          <AppCard className="strong pv-command-next-card">
            <SectionHeader
              title="Next actions"
              subtitle="The fastest moves to keep the account progressing."
            />
            <div className="pv-next-actions">
              {nextActions.map((action) => (
                <Link
                  key={action.id}
                  className={`pv-next-action-card ${action.tone}`}
                  href={action.href}
                >
                  <span className="pv-next-action-title">{action.title}</span>
                  <span className="pv-next-action-copy">{action.description}</span>
                  <span className="pv-next-action-link">{action.label}</span>
                </Link>
              ))}
            </div>
          </AppCard>

          <AppCard>
            <SectionHeader
              title="Exposure summary"
              subtitle="Cash allocation, holdings concentration, and top position weight."
              action={
                <AppButtonLink href="/portfolio" variant="ghost">
                  Portfolio detail
                </AppButtonLink>
              }
            />

            <div className="pv-exposure-bar" aria-hidden="true">
              <span className="pv-exposure-segment cash" style={{ width: `${exposureSummary.cashWeight}%` }} />
              <span className="pv-exposure-segment invested" style={{ width: `${exposureSummary.investedWeight}%` }} />
            </div>

            <div className="pv-grid two">
              <div className="pv-chart-summary-card">
                <span className="pv-kicker">Cash allocation</span>
                <strong>{formatPercent(exposureSummary.cashWeight)}</strong>
              </div>
              <div className="pv-chart-summary-card">
                <span className="pv-kicker">Invested allocation</span>
                <strong>{formatPercent(exposureSummary.investedWeight)}</strong>
              </div>
              <div className="pv-chart-summary-card">
                <span className="pv-kicker">Largest position</span>
                <strong>
                  {exposureSummary.topHolding
                    ? `${exposureSummary.topHolding.symbol} · ${formatPercent(exposureSummary.topHoldingWeight)}`
                    : 'No position yet'}
                </strong>
              </div>
              <div className="pv-chart-summary-card">
                <span className="pv-kicker">Top 3 concentration</span>
                <strong>{formatPercent(exposureSummary.topThreeWeight)}</strong>
              </div>
            </div>

            {topExposureHoldings.length ? (
              <div className="pv-list">
                {topExposureHoldings.map((holding) => (
                  <Link
                    key={holding.symbol}
                    className="pv-list-row"
                    href={`/stocks/${holding.symbol}?companyName=${encodeURIComponent(holding.companyName)}`}
                  >
                    <div className="pv-list-primary">
                      <span className="pv-list-symbol">{holding.symbol}</span>
                      <span className="pv-list-company">{holding.companyName}</span>
                    </div>
                    <div className="pv-list-secondary">
                      <strong>{formatCurrency(holding.marketValue)}</strong>
                      <span className="pv-kicker">
                        {formatPercent(
                          summary?.totalPortfolioValue
                            ? (holding.marketValue / summary.totalPortfolioValue) * 100
                            : 0
                        )}
                        {' '}of book
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Exposure will appear after the first buy"
                description="Once holdings exist, this panel will highlight concentration and capital balance."
              />
            )}
          </AppCard>

          <AppCard>
            <SectionHeader
              title="Active conditional orders"
              subtitle="Target-price automation still armed against the live book."
              action={
                <AppButtonLink href="/orders" variant="ghost">
                  Open orders
                </AppButtonLink>
              }
            />
            {conditionalOrdersQuery.isLoading ? (
              <div className="pv-subgrid">
                <div className="pv-skeleton" />
                <div className="pv-skeleton" />
              </div>
            ) : conditionalOrdersQuery.isError ? (
              <InlineNotice
                tone="error"
                message={webApi.getApiErrorMessage(conditionalOrdersQuery.error, 'Unable to load conditional orders')}
              />
            ) : activeConditionalOrders.length ? (
              <div className="pv-list">
                {activeConditionalOrders.slice(0, 3).map((order) => (
                  <Link key={order.id} className="pv-list-row" href="/orders">
                    <div className="pv-list-primary">
                      <span className="pv-list-symbol-line">
                        <span className="pv-list-symbol">{order.symbol}</span>
                        <span className={`pv-chip ${order.side === 'BUY' ? 'buy' : 'sell'}`}>{order.side}</span>
                        <span className="pv-chip neutral">{order.status}</span>
                      </span>
                      <span className="pv-list-company">
                        Target {formatCurrency(order.targetPrice)} · {formatShares(order.quantity)} shares
                      </span>
                      <span className="pv-list-meta-line">
                        <span>Created {formatDateTime(order.createdAt)}</span>
                        <span>
                          {order.lastCheckedPrice == null
                            ? 'Waiting for first price check'
                            : `Last check ${formatCurrency(order.lastCheckedPrice)}`}
                        </span>
                      </span>
                    </div>
                    <div className="pv-list-secondary">
                      <strong>{order.executionKey}</strong>
                      <span className="pv-kicker">
                        {order.triggeredAt ? `Triggered ${formatDateTime(order.triggeredAt)}` : 'Still armed'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No active conditional orders"
                description="Create a target-price buy or sell order to turn the dashboard into a more automated command center."
              />
            )}
          </AppCard>

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
                {holdings.slice(0, 4).map((holding) => {
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
                          {getStaleQuoteBadge(holding.staleQuote) ? (
                            <span className="pv-chip neutral">{getStaleQuoteBadge(holding.staleQuote)}</span>
                          ) : null}
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
                        {getStaleQuoteMessage(holding.staleQuote) ? (
                          <span className="pv-kicker">{getStaleQuoteMessage(holding.staleQuote)}</span>
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
                })}
              </div>
            ) : (
              <EmptyState
                title="No holdings yet"
                description="Place a simulated buy order from any stock detail page and positions will show up here."
              />
            )}
          </AppCard>
        </div>
      </section>
    </main>
  );
}
