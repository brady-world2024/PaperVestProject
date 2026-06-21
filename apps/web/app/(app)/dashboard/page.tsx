'use client';

import Link from 'next/link';
import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getMarketSessionPresentation,
  type PortfolioHistoryRange,
} from '@papervest/shared-types';

import { AppButton, AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { DashboardModuleCard } from '@/components/dashboard-module-card';
import { AppField } from '@/components/app-field';
import { EmptyState } from '@/components/empty-state';
import { InlineNotice } from '@/components/inline-notice';
import { MetricCard } from '@/components/metric-card';
import { PortfolioHistoryChart } from '@/components/portfolio-history-chart';
import { QuoteRow } from '@/components/quote-row';
import { SectionHeader } from '@/components/section-header';
import {
  getDashboardModuleMeta,
  getDashboardModulesForColumn,
  getHiddenDashboardModules,
  type DashboardModuleColumn,
  type DashboardModuleId,
  type DashboardModulePreference,
} from '@/lib/dashboard-workspace';
import {
  getActiveCommandCenterOrders,
  getCommandCenterDecisionSupport,
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
import {
  formatRelativeRefreshTime,
  getLatestTimestamp,
  getLiveFeedbackStatus,
} from '@/lib/live-feedback';
import { getDegradedHomeMarketMessage, getStaleQuoteBadge, getStaleQuoteMessage } from '@/lib/market-data-freshness';
import { liveQuoteRefreshOptions, QUOTE_AUTO_REFRESH_INTERVAL_MS } from '@/lib/market-data-refresh';
import { getMarketSessionChipClass } from '@/lib/market-session';
import { queryKeys } from '@/lib/query-keys';
import { useLiveNow } from '@/lib/use-live-now';
import { useDashboardWorkspace } from '@/lib/use-dashboard-workspace';

export default function DashboardPage() {
  const now = useLiveNow();
  const [searchText, setSearchText] = useState('');
  const [historyRange, setHistoryRange] = useState<PortfolioHistoryRange>('1M');
  const deferredSearch = useDeferredValue(searchText.trim());
  const lastTrackedSearchRef = useRef<string | null>(null);
  const dashboardWorkspace = useDashboardWorkspace();

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

  const homeQuotes = homeQuery.data?.quotes ?? [];
  const homeDegraded = homeQuery.data?.degraded ?? false;
  const portfolioHistoryPoints = portfolioHistoryQuery.data?.points ?? [];
  const summary = portfolioQuery.data?.summary;
  const holdings = portfolioQuery.data?.holdings ?? [];
  const watchlistItems = watchlistQuery.data?.items ?? [];
  const recentTrades = historyQuery.data?.trades.slice(0, 4) ?? [];
  const activeConditionalOrders = getActiveCommandCenterOrders(conditionalOrdersQuery.data?.orders ?? []);
  const exposureSummary = getCommandCenterExposureSummary(summary, holdings);
  const marketSummary = getCommandCenterMarketSummary(homeQuotes, homeDegraded);
  const nextActions = getCommandCenterNextActions({
    holdings,
    watchlistItems,
    activeConditionalOrders,
    marketSummary,
  });
  const decisionSignals = getCommandCenterDecisionSupport({
    summary,
    holdings,
    watchlistItems,
    activeConditionalOrders,
    recentTrades,
  });
  const primaryModules = getDashboardModulesForColumn(
    dashboardWorkspace.preferences,
    'primary'
  );
  const secondaryModules = getDashboardModulesForColumn(
    dashboardWorkspace.preferences,
    'secondary'
  );
  const hiddenModules = getHiddenDashboardModules(dashboardWorkspace.preferences);
  const topExposureHoldings = [...holdings]
    .sort((left, right) => right.marketValue - left.marketValue)
    .slice(0, 3);
  const degradedHomeMarketMessage = getDegradedHomeMarketMessage(homeDegraded);
  const liveRefreshInFlight =
    homeQuery.isFetching ||
    portfolioQuery.isFetching ||
    portfolioHistoryQuery.isFetching ||
    watchlistQuery.isFetching ||
    conditionalOrdersQuery.isFetching;
  const quoteStalePresent =
    homeQuotes.some((quote) => quote.stale) ||
    watchlistItems.some((item) => item.staleQuote) ||
    holdings.some((holding) => holding.staleQuote);
  const dashboardFeedStatus = getLiveFeedbackStatus({
    subject: 'command center',
    timestamps: [
      ...homeQuotes.map((quote) => quote.quoteTimestamp),
      ...watchlistItems.map((item) => item.quoteTimestamp),
      ...holdings.map((holding) => holding.quoteTimestamp),
      ...portfolioHistoryPoints.map((point) => point.timestamp),
      ...activeConditionalOrders.map((order) => order.updatedAt ?? order.createdAt),
      ...recentTrades.map((trade) => trade.executedAt),
    ],
    now,
    refreshIntervalMs: QUOTE_AUTO_REFRESH_INTERVAL_MS,
    isRefreshing: liveRefreshInFlight,
    stale: quoteStalePresent,
    degraded: homeDegraded,
  });
  const marketBoardStatus = getLiveFeedbackStatus({
    subject: 'market board',
    timestamps: homeQuotes.map((quote) => quote.quoteTimestamp),
    now,
    refreshIntervalMs: QUOTE_AUTO_REFRESH_INTERVAL_MS,
    isRefreshing: homeQuery.isFetching,
    stale: homeQuotes.some((quote) => quote.stale),
    degraded: homeDegraded,
  });
  const watchlistStatus = getLiveFeedbackStatus({
    subject: 'watchlist quotes',
    timestamps: watchlistItems.map((item) => item.quoteTimestamp),
    now,
    refreshIntervalMs: QUOTE_AUTO_REFRESH_INTERVAL_MS,
    isRefreshing: watchlistQuery.isFetching,
    stale: watchlistItems.some((item) => item.staleQuote),
  });
  const holdingsStatus = getLiveFeedbackStatus({
    subject: 'holdings pulse',
    timestamps: holdings.map((holding) => holding.quoteTimestamp),
    now,
    refreshIntervalMs: QUOTE_AUTO_REFRESH_INTERVAL_MS,
    isRefreshing: portfolioQuery.isFetching,
    stale: holdings.some((holding) => holding.staleQuote),
  });
  const orderMonitorStatus = getLiveFeedbackStatus({
    subject: 'conditional order monitor',
    timestamps: activeConditionalOrders.map((order) => order.updatedAt ?? order.createdAt),
    now,
    refreshIntervalMs: QUOTE_AUTO_REFRESH_INTERVAL_MS,
    isRefreshing: conditionalOrdersQuery.isFetching,
  });
  const portfolioHistoryStatus = getLiveFeedbackStatus({
    subject: 'portfolio history',
    timestamps: portfolioHistoryQuery.data?.points.map((point) => point.timestamp) ?? [],
    now,
    refreshIntervalMs: QUOTE_AUTO_REFRESH_INTERVAL_MS,
    isRefreshing: portfolioHistoryQuery.isFetching,
  });
  const latestTradeTimestamp = getLatestTimestamp(recentTrades.map((trade) => trade.executedAt));
  const latestTradeRelativeLabel = latestTradeTimestamp
    ? formatRelativeRefreshTime(latestTradeTimestamp, now)
    : null;

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

  const renderCollapsedPreview = (moduleId: DashboardModuleId) => {
    const meta = getDashboardModuleMeta(moduleId);

    return (
      <div className="pv-module-collapsed-preview">
        <span className="pv-kicker">Collapsed module</span>
        <strong>{meta.shortLabel}</strong>
        <span>{meta.description}</span>
      </div>
    );
  };

  const renderWorkspaceEmptyState = (column: DashboardModuleColumn) => (
    <AppCard className="pv-dashboard-empty-column">
      <EmptyState
        title={column === 'primary' ? 'Primary lane is empty' : 'Secondary lane is empty'}
        description="Restore a hidden module or move one across from the other lane to rebuild this side of the workspace."
      />
    </AppCard>
  );

  const renderModule = (preference: DashboardModulePreference) => {
    const columnModules = preference.column === 'primary' ? primaryModules : secondaryModules;
    const moduleIndex = columnModules.findIndex((module) => module.id === preference.id);
    const meta = getDashboardModuleMeta(preference.id);
    const commonProps = {
      title: meta.label,
      subtitle: meta.description,
      collapsed: preference.collapsed,
      className: preference.id === 'nextActions' ? 'strong pv-command-next-card' : undefined,
      canMoveUp: moduleIndex > 0,
      canMoveDown: moduleIndex >= 0 && moduleIndex < columnModules.length - 1,
      canMoveAcross: true,
      moveAcrossLabel:
        preference.column === 'primary' ? 'Send right' : 'Send left',
      onToggleCollapse: () => dashboardWorkspace.toggleCollapsed(preference.id),
      onMoveUp: () => dashboardWorkspace.moveWithinColumn(preference.id, 'up'),
      onMoveDown: () => dashboardWorkspace.moveWithinColumn(preference.id, 'down'),
      onMoveAcross: () =>
        dashboardWorkspace.moveToColumn(
          preference.id,
          preference.column === 'primary' ? 'secondary' : 'primary'
        ),
      onHide: () => dashboardWorkspace.toggleVisibility(preference.id, false),
      collapsedPreview: renderCollapsedPreview(preference.id),
    };

    switch (preference.id) {
      case 'history':
        return (
          <DashboardModuleCard
            key={preference.id}
            {...commonProps}
          >
            <div className={`pv-live-status-banner ${portfolioHistoryStatus.tone}`}>
              <div className="pv-live-status-meta">
                <span className="pv-live-status-chipline">
                  <span
                    aria-hidden="true"
                    className={`pv-live-dot ${portfolioHistoryStatus.pulse ? 'pulse' : ''}`}
                  />
                  <strong>{portfolioHistoryStatus.chip}</strong>
                  <span>{portfolioHistoryStatus.relativeLabel}</span>
                </span>
                <span>{portfolioHistoryStatus.detail}</span>
              </div>
              <span className="pv-live-status-cadence">{portfolioHistoryStatus.cadenceLabel}</span>
            </div>
            <PortfolioHistoryChart
              range={historyRange}
              history={portfolioHistoryQuery.data}
              loading={portfolioHistoryQuery.isLoading}
              refreshing={portfolioHistoryQuery.isFetching}
              errorMessage={
                portfolioHistoryQuery.isError
                  ? webApi.getApiErrorMessage(
                      portfolioHistoryQuery.error,
                      'Unable to load portfolio history'
                    )
                  : null
              }
              onSelectRange={setHistoryRange}
            />
          </DashboardModuleCard>
        );
      case 'watchlist':
        return (
          <DashboardModuleCard
            key={preference.id}
            {...commonProps}
            action={
              <AppButtonLink href="/watchlist" variant="ghost">
                Open watchlist
              </AppButtonLink>
            }
          >
            <div className={`pv-live-status-banner ${watchlistStatus.tone}`}>
              <div className="pv-live-status-meta">
                <span className="pv-live-status-chipline">
                  <span
                    aria-hidden="true"
                    className={`pv-live-dot ${watchlistStatus.pulse ? 'pulse' : ''}`}
                  />
                  <strong>{watchlistStatus.chip}</strong>
                  <span>{watchlistStatus.relativeLabel}</span>
                </span>
                <span>{watchlistStatus.detail}</span>
              </div>
              <span className="pv-live-status-cadence">{watchlistStatus.cadenceLabel}</span>
            </div>
            {watchlistQuery.isLoading ? (
              <div className="pv-subgrid">
                <div className="pv-skeleton" />
                <div className="pv-skeleton" />
              </div>
            ) : watchlistQuery.isError ? (
              <InlineNotice
                tone="error"
                message={webApi.getApiErrorMessage(
                  watchlistQuery.error,
                  'Unable to load the watchlist'
                )}
              />
            ) : watchlistItems.length ? (
              <div className="pv-list">
                {watchlistItems.slice(0, 4).map((item) => {
                  const marketSession = getMarketSessionPresentation(
                    item.marketSession ?? 'CLOSED'
                  );

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
                            <span>
                              {formatMarketTimestamp(
                                item.quoteTimestamp,
                                item.marketTimezone ?? undefined
                              )}
                            </span>
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
          </DashboardModuleCard>
        );
      case 'activity':
        return (
          <DashboardModuleCard
            key={preference.id}
            {...commonProps}
            action={
              <AppButtonLink href="/activity" variant="ghost">
                Full history
              </AppButtonLink>
            }
          >
            {historyQuery.isLoading ? (
              <div className="pv-subgrid">
                <div className="pv-skeleton" />
                <div className="pv-skeleton" />
              </div>
            ) : historyQuery.isError ? (
              <InlineNotice
                tone="error"
                message={webApi.getApiErrorMessage(
                  historyQuery.error,
                  'Unable to load recent trades'
                )}
              />
            ) : recentTrades.length ? (
              <div className="pv-list">
                {recentTrades.map((trade) => (
                  <Link
                    key={trade.tradeId}
                    className="pv-list-row"
                    href={`/stocks/${trade.symbol}?companyName=${encodeURIComponent(
                      trade.companyName
                    )}`}
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
          </DashboardModuleCard>
        );
      case 'marketBoard':
        return (
          <DashboardModuleCard
            key={preference.id}
            {...commonProps}
            action={
              <AppButtonLink href="/watchlist" variant="ghost">
                Watchlist
              </AppButtonLink>
            }
          >
            {homeQuery.isLoading ? (
              <div className="pv-subgrid">
                <div className="pv-skeleton" />
                <div className="pv-skeleton" />
                <div className="pv-skeleton" />
              </div>
            ) : homeQuery.isError ? (
              <InlineNotice
                tone="error"
                message={webApi.getApiErrorMessage(
                  homeQuery.error,
                  'Unable to load the home market board'
                )}
              />
            ) : (
              <>
                {degradedHomeMarketMessage ? (
                  <div style={{ marginBottom: '12px' }}>
                    <InlineNotice tone="info" message={degradedHomeMarketMessage} />
                  </div>
                ) : null}
                <div className="pv-list">
                  <div className={`pv-live-status-banner ${marketBoardStatus.tone}`}>
                    <div className="pv-live-status-meta">
                      <span className="pv-live-status-chipline">
                        <span
                          aria-hidden="true"
                          className={`pv-live-dot ${marketBoardStatus.pulse ? 'pulse' : ''}`}
                        />
                        <strong>{marketBoardStatus.chip}</strong>
                        <span>{marketBoardStatus.relativeLabel}</span>
                      </span>
                      <span>{marketBoardStatus.detail}</span>
                    </div>
                    <span className="pv-live-status-cadence">{marketBoardStatus.cadenceLabel}</span>
                  </div>
                  {homeQuotes.map((quote) => (
                    <QuoteRow
                      key={quote.symbol}
                      quote={quote}
                      now={now}
                      refreshing={homeQuery.isFetching}
                    />
                  ))}
                </div>
              </>
            )}
          </DashboardModuleCard>
        );
      case 'nextActions':
        return (
          <DashboardModuleCard key={preference.id} {...commonProps}>
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
          </DashboardModuleCard>
        );
      case 'decisionSupport':
        return (
          <DashboardModuleCard key={preference.id} {...commonProps}>
            <div className="pv-decision-support-grid">
              {decisionSignals.map((signal) => (
                <Link
                  key={signal.id}
                  className={`pv-decision-card ${signal.tone}`}
                  href={signal.href}
                >
                  <span className="pv-decision-label">{signal.title}</span>
                  <strong className="pv-decision-metric">{signal.metric}</strong>
                  <span className="pv-decision-copy">{signal.description}</span>
                  <span className="pv-decision-link">{signal.label}</span>
                </Link>
              ))}
            </div>
          </DashboardModuleCard>
        );
      case 'exposure':
        return (
          <DashboardModuleCard
            key={preference.id}
            {...commonProps}
            action={
              <AppButtonLink href="/portfolio" variant="ghost">
                Portfolio detail
              </AppButtonLink>
            }
          >
            <div className="pv-exposure-bar" aria-hidden="true">
              <span
                className="pv-exposure-segment cash"
                style={{ width: `${exposureSummary.cashWeight}%` }}
              />
              <span
                className="pv-exposure-segment invested"
                style={{ width: `${exposureSummary.investedWeight}%` }}
              />
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
                    ? `${exposureSummary.topHolding.symbol} · ${formatPercent(
                        exposureSummary.topHoldingWeight
                      )}`
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
                    href={`/stocks/${holding.symbol}?companyName=${encodeURIComponent(
                      holding.companyName
                    )}`}
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
                        )}{' '}
                        of book
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
          </DashboardModuleCard>
        );
      case 'activeOrders':
        return (
          <DashboardModuleCard
            key={preference.id}
            {...commonProps}
            action={
              <AppButtonLink href="/orders" variant="ghost">
                Open orders
              </AppButtonLink>
            }
          >
            <div className={`pv-live-status-banner ${orderMonitorStatus.tone}`}>
              <div className="pv-live-status-meta">
                <span className="pv-live-status-chipline">
                  <span
                    aria-hidden="true"
                    className={`pv-live-dot ${orderMonitorStatus.pulse ? 'pulse' : ''}`}
                  />
                  <strong>{orderMonitorStatus.chip}</strong>
                  <span>{orderMonitorStatus.relativeLabel}</span>
                </span>
                <span>{orderMonitorStatus.detail}</span>
              </div>
              <span className="pv-live-status-cadence">{orderMonitorStatus.cadenceLabel}</span>
            </div>
            {conditionalOrdersQuery.isLoading ? (
              <div className="pv-subgrid">
                <div className="pv-skeleton" />
                <div className="pv-skeleton" />
              </div>
            ) : conditionalOrdersQuery.isError ? (
              <InlineNotice
                tone="error"
                message={webApi.getApiErrorMessage(
                  conditionalOrdersQuery.error,
                  'Unable to load conditional orders'
                )}
              />
            ) : activeConditionalOrders.length ? (
              <div className="pv-list">
                {activeConditionalOrders.slice(0, 3).map((order) => (
                  <Link key={order.id} className="pv-list-row" href="/orders">
                    <div className="pv-list-primary">
                      <span className="pv-list-symbol-line">
                        <span className="pv-list-symbol">{order.symbol}</span>
                        <span className={`pv-chip ${order.side === 'BUY' ? 'buy' : 'sell'}`}>
                          {order.side}
                        </span>
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
                        {order.triggeredAt
                          ? `Triggered ${formatDateTime(order.triggeredAt)}`
                          : 'Still armed'}
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
          </DashboardModuleCard>
        );
      case 'holdingsPulse':
        return (
          <DashboardModuleCard key={preference.id} {...commonProps}>
            <div className={`pv-live-status-banner ${holdingsStatus.tone}`}>
              <div className="pv-live-status-meta">
                <span className="pv-live-status-chipline">
                  <span
                    aria-hidden="true"
                    className={`pv-live-dot ${holdingsStatus.pulse ? 'pulse' : ''}`}
                  />
                  <strong>{holdingsStatus.chip}</strong>
                  <span>{holdingsStatus.relativeLabel}</span>
                </span>
                <span>{holdingsStatus.detail}</span>
              </div>
              <span className="pv-live-status-cadence">{holdingsStatus.cadenceLabel}</span>
            </div>
            {portfolioQuery.isLoading ? (
              <div className="pv-subgrid">
                <div className="pv-skeleton" />
                <div className="pv-skeleton" />
              </div>
            ) : holdings.length ? (
              <div className="pv-list">
                {holdings.slice(0, 4).map((holding) => {
                  const marketSession = getMarketSessionPresentation(
                    holding.marketSession ?? 'CLOSED'
                  );

                  return (
                    <Link
                      key={holding.symbol}
                      className="pv-list-row"
                      href={`/stocks/${holding.symbol}?companyName=${encodeURIComponent(
                        holding.companyName
                      )}`}
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
                            <span>
                              {formatMarketTimestamp(
                                holding.quoteTimestamp,
                                holding.marketTimezone ?? undefined
                              )}
                            </span>
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
          </DashboardModuleCard>
        );
      default:
        return null;
    }
  };

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
            <div className={`pv-command-status-card ${dashboardFeedStatus.tone}`}>
              <span className="pv-command-status-label">Feed heartbeat</span>
              <strong className="pv-command-status-value pv-live-value">
                <span
                  aria-hidden="true"
                  className={`pv-live-dot ${dashboardFeedStatus.pulse ? 'pulse' : ''}`}
                />
                {dashboardFeedStatus.chip}
              </strong>
              <span className="pv-command-status-copy">
                {dashboardFeedStatus.relativeLabel}. {dashboardFeedStatus.cadenceLabel}
              </span>
            </div>
            <div className="pv-command-status-card">
              <span className="pv-command-status-label">Positions open</span>
              <strong className="pv-command-status-value">{holdings.length}</strong>
              <span className="pv-command-status-copy">
                {holdings.length
                  ? `Exposure and P&L are synchronized to ${holdingsStatus.relativeLabel.toLowerCase()}.`
                  : 'The account is still all cash.'}
              </span>
            </div>
            <div className="pv-command-status-card">
              <span className="pv-command-status-label">Watchlist tracked</span>
              <strong className="pv-command-status-value">{watchlistItems.length}</strong>
              <span className="pv-command-status-copy">
                {watchlistItems.length
                  ? `Saved symbols are ready for quote review and trade launch, with the latest read ${watchlistStatus.relativeLabel.toLowerCase()}.`
                  : 'No symbols pinned yet.'}
              </span>
            </div>
            <div className="pv-command-status-card">
              <span className="pv-command-status-label">Orders armed</span>
              <strong className="pv-command-status-value">{activeConditionalOrders.length}</strong>
              <span className="pv-command-status-copy">
                {activeConditionalOrders.length
                  ? `Active conditional orders are still watching market levels, last touched ${orderMonitorStatus.relativeLabel.toLowerCase()}.`
                  : latestTradeRelativeLabel
                    ? `No target-price automation is guarding the book yet, even though the latest execution landed ${latestTradeRelativeLabel}.`
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

      <AppCard className="pv-dashboard-settings-card">
        <SectionHeader
          title="Workspace settings"
          subtitle="Save a layout that matches how you use the command center. Presets rebalance order and collapse state, while hidden modules stay under your control."
        />
        <div className="pv-dashboard-settings-grid">
          <div className="pv-dashboard-settings-block">
            <span className="pv-kicker">Workspace presets</span>
            <div className="pv-dashboard-preset-row">
              <AppButton
                className="pv-module-button"
                variant="ghost"
                onClick={() => dashboardWorkspace.applyPreset('balanced')}
              >
                Balanced
              </AppButton>
              <AppButton
                className="pv-module-button"
                variant="ghost"
                onClick={() => dashboardWorkspace.applyPreset('research')}
              >
                Research
              </AppButton>
              <AppButton
                className="pv-module-button"
                variant="ghost"
                onClick={() => dashboardWorkspace.applyPreset('execution')}
              >
                Execution
              </AppButton>
              <AppButton
                className="pv-module-button"
                variant="secondary"
                onClick={() => dashboardWorkspace.reset()}
              >
                Reset defaults
              </AppButton>
            </div>
          </div>

          <div className="pv-dashboard-settings-block">
            <span className="pv-kicker">Visible now</span>
            <strong className="pv-dashboard-settings-value">
              {primaryModules.length + secondaryModules.length} modules active
            </strong>
            <span className="pv-copy">
              Primary lane: {primaryModules.length} · Secondary lane: {secondaryModules.length}
            </span>
          </div>

          <div className="pv-dashboard-settings-block">
            <span className="pv-kicker">Hidden modules</span>
            {hiddenModules.length ? (
              <div className="pv-hidden-module-row">
                {hiddenModules.map((module) => {
                  const meta = getDashboardModuleMeta(module.id);

                  return (
                    <button
                      key={module.id}
                      className="pv-hidden-module-chip"
                      type="button"
                      onClick={() => dashboardWorkspace.toggleVisibility(module.id, true)}
                    >
                      <strong>{meta.shortLabel}</strong>
                      <span>Restore</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="pv-copy">No modules hidden right now.</span>
            )}
          </div>
        </div>
      </AppCard>

      <section className="pv-command-center-grid">
        <div className="pv-stack">
          {primaryModules.length ? primaryModules.map(renderModule) : renderWorkspaceEmptyState('primary')}
        </div>

        <div className="pv-stack">
          {secondaryModules.length ? secondaryModules.map(renderModule) : renderWorkspaceEmptyState('secondary')}
        </div>
      </section>
    </main>
  );
}
