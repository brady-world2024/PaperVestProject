'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMarketSessionPresentation, type PortfolioHistoryRange } from '@papervest/shared-types';

import { AppButton } from '@/components/app-button';
import { AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { EmptyState } from '@/components/empty-state';
import { InlineNotice } from '@/components/inline-notice';
import { MetricCard } from '@/components/metric-card';
import { PortfolioHistoryChart } from '@/components/portfolio-history-chart';
import { SectionHeader } from '@/components/section-header';
import { getStaleQuoteBadge, getStaleQuoteMessage } from '@/lib/market-data-freshness';
import { liveQuoteRefreshOptions } from '@/lib/market-data-refresh';
import { getMarketSessionChipClass } from '@/lib/market-session';
import { queryKeys } from '@/lib/query-keys';
import {
  getPortfolioSnapshotSourceLabel,
  getPortfolioTrustSummary,
} from '@/lib/trust-audit';
import { webApi } from '@/lib/api';
import {
  formatCurrency,
  formatDateTime,
  formatMarketTimestamp,
  formatPercent,
  formatShares,
  formatSignedCurrency,
} from '@/lib/formatters';
import { useWorkspaceDensity } from '@/lib/use-workspace-density';
import { sortHoldings, sortTrades, type HoldingSort, type TradeSort } from '@/lib/workspace-grids';

export default function PortfolioPage() {
  const [historyRange, setHistoryRange] = useState<PortfolioHistoryRange>('1M');
  const [holdingSort, setHoldingSort] = useState<HoldingSort>('marketValue');
  const [tradeSort, setTradeSort] = useState<TradeSort>('latest');
  const { density, setDensity } = useWorkspaceDensity('pv-portfolio-density');
  const portfolioQuery = useQuery({
    queryKey: queryKeys.portfolio,
    queryFn: webApi.getPortfolio,
    ...liveQuoteRefreshOptions,
  });

  const historyQuery = useQuery({
    queryKey: queryKeys.tradeHistory,
    queryFn: webApi.getTradeHistory,
  });

  const portfolioHistoryQuery = useQuery({
    queryKey: queryKeys.portfolioHistory(historyRange),
    queryFn: () => webApi.getPortfolioHistory(historyRange),
    placeholderData: (previousData) => previousData,
  });

  const allTrades = historyQuery.data?.trades ?? [];
  const summary = portfolioQuery.data?.summary;
  const holdings = sortHoldings(portfolioQuery.data?.holdings ?? [], holdingSort);
  const recentTrades = sortTrades(allTrades, tradeSort).slice(0, 6);
  const portfolioTrustSummary = getPortfolioTrustSummary({
    holdings: portfolioQuery.data?.holdings ?? [],
    historyPoints: portfolioHistoryQuery.data?.points ?? [],
    trades: allTrades,
  });
  const portfolioHistoryErrorMessage = portfolioHistoryQuery.isError
    ? webApi.getApiErrorMessage(portfolioHistoryQuery.error, 'Unable to load portfolio history right now')
    : null;

  return (
    <main className="pv-page pv-stack">
      <section className="pv-portfolio-hero">
        <AppCard className="strong pv-portfolio-hero-card">
          <div className="pv-eyebrow">Portfolio</div>
          <h1 className="pv-title">{summary ? formatCurrency(summary.totalPortfolioValue) : '...'}</h1>
          <p className="pv-copy inverse">Cash, market value, and P&amp;L are calculated in the backend.</p>

          <div className="pv-dashboard-summary-grid">
            <MetricCard label="Cash balance" value={summary ? formatCurrency(summary.cashBalance) : '...'} />
            <MetricCard
              label="Daily move"
              value={summary ? formatSignedCurrency(summary.dailyChange) : '...'}
              tone={(summary?.dailyChange ?? 0) >= 0 ? 'positive' : 'negative'}
            />
            <MetricCard
              label="Unrealized P&L"
              value={summary ? formatSignedCurrency(summary.unrealizedPnl) : '...'}
              tone={(summary?.unrealizedPnl ?? 0) >= 0 ? 'positive' : 'negative'}
            />
            <MetricCard
              label="Realized P&L"
              value={summary ? formatSignedCurrency(summary.realizedPnl) : '...'}
              tone={(summary?.realizedPnl ?? 0) >= 0 ? 'positive' : 'negative'}
            />
          </div>
        </AppCard>

        <AppCard className="pv-portfolio-sidecard">
          <SectionHeader
            title="Allocation snapshot"
            subtitle="Current capital split."
          />
          <div className="pv-meta-row">
            <span className="pv-kicker">Initial cash</span>
            <strong>{summary ? formatCurrency(summary.initialCash) : '...'}</strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">Holdings market value</span>
            <strong>{summary ? formatCurrency(summary.holdingsMarketValue) : '...'}</strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">Total P&amp;L</span>
            <strong className={(summary?.totalPnl ?? 0) >= 0 ? 'pv-positive' : 'pv-negative'}>
              {summary ? formatSignedCurrency(summary.totalPnl) : '...'}
            </strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">Total return</span>
            <strong className={(summary?.totalReturnPercent ?? 0) >= 0 ? 'pv-positive' : 'pv-negative'}>
              {summary ? formatPercent(summary.totalReturnPercent) : '...'}
            </strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">Latest holdings quote</span>
            <strong>
              {portfolioTrustSummary.latestQuoteTimestamp
                ? formatDateTime(portfolioTrustSummary.latestQuoteTimestamp)
                : 'Waiting for quotes'}
            </strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">Latest portfolio snapshot</span>
            <strong>
              {portfolioTrustSummary.latestSnapshotTimestamp
                ? formatDateTime(portfolioTrustSummary.latestSnapshotTimestamp)
                : 'No snapshot yet'}
            </strong>
          </div>
          <div className="pv-action-cluster" style={{ marginTop: '18px' }}>
            <AppButtonLink href="/activity" variant="ghost">
              Activity
            </AppButtonLink>
            <AppButtonLink href="/dashboard" variant="secondary">
              Dashboard
            </AppButtonLink>
          </div>
        </AppCard>
      </section>

      <AppCard className="pv-chart-card">
        <PortfolioHistoryChart
          range={historyRange}
          history={portfolioHistoryQuery.data}
          loading={portfolioHistoryQuery.isLoading}
          refreshing={portfolioHistoryQuery.isFetching && Boolean(portfolioHistoryQuery.data?.points.length)}
          errorMessage={portfolioHistoryErrorMessage}
          onSelectRange={setHistoryRange}
        />
      </AppCard>

      <section className="pv-portfolio-layout">
        <AppCard className="pv-portfolio-holdings-card">
          <SectionHeader
            title="Holdings"
            subtitle="Positions ranked and scanned like a compact workspace instead of a loose card stack."
          />
          <div className="pv-workspace-toolbar">
            <div className="pv-workspace-toolbar-copy">
              <strong>Holdings workspace</strong>
              <span>Sort positions by exposure or performance, and switch density depending on whether you are scanning or reviewing.</span>
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
                <label className="pv-kicker" htmlFor="holding-sort">
                  Sort by
                </label>
                <select
                  id="holding-sort"
                  className="pv-input pv-workspace-select"
                  value={holdingSort}
                  onChange={(event) => setHoldingSort(event.target.value as HoldingSort)}
                >
                  <option value="marketValue">Market value</option>
                  <option value="unrealizedPnl">Unrealized P&amp;L</option>
                  <option value="quantity">Quantity</option>
                  <option value="symbol">Symbol</option>
                </select>
              </div>
            </div>
          </div>
          {portfolioQuery.isLoading ? (
            <div className="pv-subgrid">
              <div className="pv-skeleton" />
              <div className="pv-skeleton" />
            </div>
          ) : portfolioQuery.isError ? (
            <InlineNotice
              tone="error"
              message={webApi.getApiErrorMessage(portfolioQuery.error, 'Unable to load portfolio holdings')}
            />
          ) : holdings.length ? (
            <div className={`pv-workspace-table ${density}`}>
              <div className="pv-workspace-header">
                <span>Holding</span>
                <span>Quantity</span>
                <span>Last price</span>
                <span>Market value</span>
                <span>Unrealized</span>
                <span>Updated</span>
              </div>
              {holdings.map((holding) => {
                const marketSession = getMarketSessionPresentation(holding.marketSession ?? 'CLOSED');

                return (
                  <Link
                    key={holding.symbol}
                    className={`pv-workspace-row ${density}`}
                    href={`/stocks/${holding.symbol}?companyName=${encodeURIComponent(holding.companyName)}`}
                  >
                    <div className="pv-workspace-cell primary">
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
                      {density === 'comfortable' ? (
                        <>
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
                        </>
                      ) : null}
                    </div>
                    <div className="pv-workspace-cell numeric">
                      <strong>{formatShares(holding.quantity)}</strong>
                    </div>
                    <div className="pv-workspace-cell numeric">
                      <strong>{formatCurrency(holding.currentPrice)}</strong>
                    </div>
                    <div className="pv-workspace-cell numeric">
                      <strong>{formatCurrency(holding.marketValue)}</strong>
                    </div>
                    <div className="pv-workspace-cell numeric">
                      <span className={holding.unrealizedPnl >= 0 ? 'pv-positive' : 'pv-negative'}>
                        {formatSignedCurrency(holding.unrealizedPnl)} · {formatPercent(holding.unrealizedPnlPercent)}
                      </span>
                    </div>
                    <div className="pv-workspace-cell">
                      <span className="pv-kicker">
                        {holding.quoteTimestamp
                          ? formatMarketTimestamp(holding.quoteTimestamp, holding.marketTimezone ?? undefined)
                          : 'No quote yet'}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No holdings yet"
              description="Place a simulated buy order from a stock detail page and your holdings will appear here."
            />
          )}
        </AppCard>

        <div className="pv-stack">
          <AppCard>
            <SectionHeader
              title="Recent executions"
              subtitle="Recent fills in a denser execution strip."
            />
            <div className="pv-workspace-toolbar">
              <div className="pv-workspace-toolbar-copy">
                <strong>Execution sort</strong>
                <span>Flip between newest fills and the trades with the largest realized effect.</span>
              </div>
              <div className="pv-workspace-controls">
                <div className="pv-workspace-select-wrap">
                  <label className="pv-kicker" htmlFor="trade-sort">
                    Sort by
                  </label>
                  <select
                    id="trade-sort"
                    className="pv-input pv-workspace-select"
                    value={tradeSort}
                    onChange={(event) => setTradeSort(event.target.value as TradeSort)}
                  >
                    <option value="latest">Latest execution</option>
                    <option value="realizedPnl">Realized P&amp;L</option>
                    <option value="grossAmount">Gross amount</option>
                    <option value="symbol">Symbol</option>
                  </select>
                </div>
              </div>
            </div>
            {historyQuery.isLoading ? (
              <div className="pv-subgrid">
                <div className="pv-skeleton" />
                <div className="pv-skeleton" />
              </div>
            ) : historyQuery.isError ? (
              <InlineNotice
                tone="error"
                message={webApi.getApiErrorMessage(historyQuery.error, 'Unable to load recent executions')}
              />
            ) : recentTrades.length ? (
              <div className={`pv-workspace-table ${density}`}>
                <div className="pv-workspace-header">
                  <span>Trade</span>
                  <span>Quantity</span>
                  <span>Price</span>
                  <span>Gross</span>
                  <span>Realized</span>
                  <span>Executed</span>
                </div>
                {recentTrades.map((trade) => (
                  <Link
                    key={trade.tradeId}
                    className={`pv-workspace-row ${density}`}
                    href={`/stocks/${trade.symbol}?companyName=${encodeURIComponent(trade.companyName)}`}
                  >
                    <div className="pv-workspace-cell primary">
                      <span className="pv-list-symbol-line">
                        <span className="pv-list-symbol">{trade.symbol}</span>
                        <span className={`pv-chip ${trade.side === 'BUY' ? 'buy' : 'sell'}`}>
                          {trade.side}
                        </span>
                      </span>
                      <span className="pv-list-company">{trade.companyName}</span>
                    </div>
                    <div className="pv-workspace-cell numeric">
                      <strong>{formatShares(trade.quantity)}</strong>
                    </div>
                    <div className="pv-workspace-cell numeric">
                      <strong>{formatCurrency(trade.executedPrice)}</strong>
                    </div>
                    <div className="pv-workspace-cell numeric">
                      <strong>{formatCurrency(trade.grossAmount)}</strong>
                    </div>
                    <div className="pv-workspace-cell numeric">
                      <span className={trade.realizedPnl >= 0 ? 'pv-positive' : 'pv-negative'}>
                        {formatSignedCurrency(trade.realizedPnl)}
                      </span>
                    </div>
                    <div className="pv-workspace-cell">
                      <span className="pv-kicker">{formatDateTime(trade.executedAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No executions yet"
                description="Your simulated buy and sell history will appear here once orders are placed."
              />
            )}
          </AppCard>

          <AppCard>
            <SectionHeader
              title="Trust and valuation audit"
              subtitle="Read how backend snapshots, holdings quotes, and execution ledger entries currently support this portfolio view."
            />
            <div className="pv-trust-grid">
              <div className="pv-trust-card">
                <span className="pv-trust-label">Snapshot source</span>
                <strong className="pv-trust-value">
                  {getPortfolioSnapshotSourceLabel(portfolioTrustSummary.latestSnapshotSource)}
                </strong>
                <span className="pv-trust-copy">
                  Portfolio history currently advances from trade-driven account snapshots.
                </span>
              </div>
              <div className="pv-trust-card">
                <span className="pv-trust-label">Holdings tracked</span>
                <strong className="pv-trust-value">{portfolioTrustSummary.trackedHoldingsCount}</strong>
                <span className="pv-trust-copy">
                  Each position is enriched with the latest backend-managed quote state.
                </span>
              </div>
              <div className="pv-trust-card">
                <span className="pv-trust-label">Stale quotes</span>
                <strong className="pv-trust-value">{portfolioTrustSummary.staleQuoteCount}</strong>
                <span className="pv-trust-copy">
                  Cached quotes stay visible, but they are counted explicitly here instead of being hidden.
                </span>
              </div>
              <div className="pv-trust-card">
                <span className="pv-trust-label">Latest ledger link</span>
                <strong className="pv-trust-value">
                  {portfolioTrustSummary.latestLedgerTradeId ?? 'No trade yet'}
                </strong>
                <span className="pv-trust-copy">
                  The freshest trade ID links account valuation back to a concrete execution record.
                </span>
              </div>
            </div>
            <div className="pv-meta-row">
              <span className="pv-kicker">Latest snapshot timestamp</span>
              <strong>
                {portfolioTrustSummary.latestSnapshotTimestamp
                  ? formatDateTime(portfolioTrustSummary.latestSnapshotTimestamp)
                  : 'Awaiting first snapshot'}
              </strong>
            </div>
            <div className="pv-meta-row">
              <span className="pv-kicker">Latest holdings quote timestamp</span>
              <strong>
                {portfolioTrustSummary.latestQuoteTimestamp
                  ? formatDateTime(portfolioTrustSummary.latestQuoteTimestamp)
                  : 'Awaiting first quote'}
              </strong>
            </div>
            <div className="pv-meta-row">
              <span className="pv-kicker">Latest ledger trade</span>
              <strong>{portfolioTrustSummary.latestLedgerTradeId ?? 'No ledger entry yet'}</strong>
            </div>
            <div className="pv-meta-row">
              <span className="pv-kicker">Audit note</span>
              <strong>Quotes, trade history, and snapshots are shown as distinct provenance layers.</strong>
            </div>
          </AppCard>
        </div>
      </section>
    </main>
  );
}
