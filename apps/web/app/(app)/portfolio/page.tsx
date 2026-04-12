'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { EmptyState } from '@/components/empty-state';
import { InlineNotice } from '@/components/inline-notice';
import { MetricCard } from '@/components/metric-card';
import { SectionHeader } from '@/components/section-header';
import { liveQuoteRefreshOptions } from '@/lib/market-data-refresh';
import { queryKeys } from '@/lib/query-keys';
import { webApi } from '@/lib/api';
import {
  formatCurrency,
  formatDateTime,
  formatPercent,
  formatShares,
  formatSignedCurrency,
} from '@/lib/formatters';

export default function PortfolioPage() {
  const portfolioQuery = useQuery({
    queryKey: queryKeys.portfolio,
    queryFn: webApi.getPortfolio,
    ...liveQuoteRefreshOptions,
  });

  const historyQuery = useQuery({
    queryKey: queryKeys.tradeHistory,
    queryFn: webApi.getTradeHistory,
  });

  const summary = portfolioQuery.data?.summary;
  const holdings = portfolioQuery.data?.holdings ?? [];
  const recentTrades = historyQuery.data?.trades.slice(0, 5) ?? [];

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

      <section className="pv-portfolio-layout">
        <AppCard className="pv-portfolio-holdings-card">
          <SectionHeader
            title="Holdings"
            subtitle="Positions with market value and unrealized P&amp;L."
          />
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
            <div className="pv-list">
              {holdings.map((holding) => (
                <Link
                  key={holding.symbol}
                  className="pv-list-row"
                  href={`/stocks/${holding.symbol}?companyName=${encodeURIComponent(holding.companyName)}`}
                >
                  <div className="pv-list-primary">
                    <span className="pv-list-symbol">{holding.symbol}</span>
                    <span className="pv-list-company">{holding.companyName}</span>
                    <span className="pv-kicker">
                      {formatShares(holding.quantity)} shares · Avg {formatCurrency(holding.averageCost)}
                    </span>
                  </div>
                  <div className="pv-list-secondary">
                    <strong>{formatCurrency(holding.marketValue)}</strong>
                    <span className={holding.unrealizedPnl >= 0 ? 'pv-positive' : 'pv-negative'}>
                      {formatSignedCurrency(holding.unrealizedPnl)} · {formatPercent(holding.unrealizedPnlPercent)}
                    </span>
                  </div>
                </Link>
              ))}
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
              subtitle="Latest paper trades."
            />
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
              <div className="pv-list">
                {recentTrades.map((trade) => (
                  <Link
                    key={trade.tradeId}
                    className="pv-list-row"
                    href={`/stocks/${trade.symbol}?companyName=${encodeURIComponent(trade.companyName)}`}
                  >
                    <div className="pv-list-primary">
                      <span className="pv-list-symbol">{trade.symbol}</span>
                      <span className="pv-list-company">{trade.companyName}</span>
                      <span className="pv-kicker">{formatDateTime(trade.executedAt)}</span>
                    </div>
                    <div className="pv-list-secondary">
                      <strong>{formatShares(trade.quantity)} shares</strong>
                      <span className={trade.realizedPnl >= 0 ? 'pv-positive' : 'pv-negative'}>
                        {formatSignedCurrency(trade.realizedPnl)}
                      </span>
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
              title="Portfolio math"
              subtitle="Shared backend account metrics."
            />
            <div className="pv-meta-row">
              <span className="pv-kicker">Holdings count</span>
              <strong>{holdings.length}</strong>
            </div>
            <div className="pv-meta-row">
              <span className="pv-kicker">Cash balance</span>
              <strong>{summary ? formatCurrency(summary.cashBalance) : '...'}</strong>
            </div>
            <div className="pv-meta-row">
              <span className="pv-kicker">Holdings market value</span>
              <strong>{summary ? formatCurrency(summary.holdingsMarketValue) : '...'}</strong>
            </div>
            <div className="pv-meta-row">
              <span className="pv-kicker">Daily change</span>
              <strong className={(summary?.dailyChange ?? 0) >= 0 ? 'pv-positive' : 'pv-negative'}>
                {summary ? formatSignedCurrency(summary.dailyChange) : '...'}
              </strong>
            </div>
          </AppCard>
        </div>
      </section>
    </main>
  );
}
