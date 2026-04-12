'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StockHistoryRange } from '@papervest/shared-types';

import { AppButton, AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { InlineNotice } from '@/components/inline-notice';
import { MetricCard } from '@/components/metric-card';
import { SectionHeader } from '@/components/section-header';
import { StockHistoryChart } from '@/components/stock-history-chart';
import { TradeOrderCard } from '@/components/trade-order-card';
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

export default function StockDetailPage() {
  const queryClient = useQueryClient();
  const params = useParams<{ symbol: string }>();
  const searchParams = useSearchParams();
  const symbol = params.symbol;
  const companyName = searchParams.get('companyName') ?? undefined;
  const [historyRange, setHistoryRange] = useState<StockHistoryRange>('1M');

  const detailQuery = useQuery({
    queryKey: queryKeys.stockDetail(symbol),
    queryFn: () => webApi.getStockDetail(symbol),
    ...liveQuoteRefreshOptions,
  });

  const historyQuery = useQuery({
    queryKey: queryKeys.stockHistory(symbol, historyRange),
    queryFn: () => webApi.getStockHistory(symbol, historyRange),
    placeholderData: (previousData) => previousData,
  });

  const watchlistQuery = useQuery({
    queryKey: queryKeys.watchlist,
    queryFn: webApi.getWatchlist,
  });

  const portfolioQuery = useQuery({
    queryKey: queryKeys.portfolio,
    queryFn: webApi.getPortfolio,
    ...liveQuoteRefreshOptions,
  });

  const refreshTradeQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio }),
      queryClient.invalidateQueries({ queryKey: queryKeys.home }),
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlist }),
      queryClient.invalidateQueries({ queryKey: queryKeys.tradeHistory }),
      queryClient.invalidateQueries({ queryKey: queryKeys.stockDetail(symbol) }),
    ]);
  };

  const addWatchlistMutation = useMutation({
    mutationFn: async () =>
      webApi.addWatchlistItem(symbol, detailQuery.data?.companyName ?? companyName),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.watchlist });
    },
  });

  const removeWatchlistMutation = useMutation({
    mutationFn: async () => webApi.removeWatchlistItem(symbol),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.watchlist });
    },
  });

  const buyMutation = useMutation({
    mutationFn: async (payload: { quantity: number }) =>
      webApi.buyStock(
        {
          symbol,
          companyName: detailQuery.data?.companyName ?? companyName,
          quantity: payload.quantity,
        },
        `web-buy-${symbol}-${Date.now()}`
      ),
    onSuccess: refreshTradeQueries,
  });

  const sellMutation = useMutation({
    mutationFn: async (payload: { quantity: number }) =>
      webApi.sellStock(
        {
          symbol,
          companyName: detailQuery.data?.companyName ?? companyName,
          quantity: payload.quantity,
        },
        `web-sell-${symbol}-${Date.now()}`
      ),
    onSuccess: refreshTradeQueries,
  });

  const quote = detailQuery.data;
  const watchlistItem = watchlistQuery.data?.items.find((item) => item.symbol === symbol);
  const holding = portfolioQuery.data?.holdings.find((item) => item.symbol === symbol);
  const isWatchlisted = Boolean(watchlistItem);
  const currentPrice = quote?.currentPrice ?? 0;
  const cashBalance = portfolioQuery.data?.summary.cashBalance ?? 0;
  const availableToSell = holding?.quantity ?? 0;
  const detailErrorMessage = detailQuery.isError
    ? webApi.getApiErrorMessage(detailQuery.error, 'Unable to load this stock right now')
    : null;
  const chartErrorMessage = historyQuery.isError
    ? webApi.getApiErrorMessage(historyQuery.error, 'Unable to load historical prices right now')
    : null;
  const watchlistErrorMessage = addWatchlistMutation.isError
    ? webApi.getApiErrorMessage(addWatchlistMutation.error, 'Unable to add symbol to watchlist')
    : removeWatchlistMutation.isError
      ? webApi.getApiErrorMessage(removeWatchlistMutation.error, 'Unable to remove symbol from watchlist')
      : null;
  const secondaryErrorMessage = portfolioQuery.isError
    ? webApi.getApiErrorMessage(portfolioQuery.error, 'Unable to load your portfolio context')
    : watchlistQuery.isError
      ? webApi.getApiErrorMessage(watchlistQuery.error, 'Unable to load watchlist state')
      : null;

  if (detailQuery.isLoading) {
    return (
      <main className="pv-page pv-stock-layout">
        <section className="pv-stack">
          <div className="pv-skeleton" style={{ minHeight: '220px' }} />
          <div className="pv-skeleton" style={{ minHeight: '420px' }} />
          <div className="pv-grid two">
            <div className="pv-skeleton" style={{ minHeight: '220px' }} />
            <div className="pv-skeleton" style={{ minHeight: '220px' }} />
          </div>
        </section>
        <section className="pv-stack">
          <div className="pv-skeleton" style={{ minHeight: '240px' }} />
          <div className="pv-skeleton" style={{ minHeight: '300px' }} />
          <div className="pv-skeleton" style={{ minHeight: '300px' }} />
        </section>
      </main>
    );
  }

  if (detailErrorMessage || !quote) {
    return (
      <main className="pv-page pv-stack">
        <AppCard>
          <SectionHeader
            title="Stock detail unavailable"
            subtitle="Quote data is unavailable right now."
            action={
              <AppButtonLink href="/dashboard" variant="ghost">
                Back to dashboard
              </AppButtonLink>
            }
          />
          <InlineNotice
            tone="error"
            message={detailErrorMessage ?? 'No quote data is available for this symbol right now.'}
          />
        </AppCard>
      </main>
    );
  }

  return (
    <main className="pv-page pv-stock-layout">
      <section className="pv-stack">
        <AppCard className="strong pv-stock-hero-card">
          <div className="pv-stock-hero-head">
            <div className="pv-stock-identity">
              <div className="pv-eyebrow">Stock</div>
              <h1 className="pv-stock-symbol">{quote.symbol}</h1>
              <p className="pv-copy inverse">{quote.companyName ?? companyName ?? symbol}</p>
            </div>

            <div className="pv-action-cluster">
              <AppButton
                variant={isWatchlisted ? 'danger' : 'ghost'}
                loading={addWatchlistMutation.isPending || removeWatchlistMutation.isPending}
                onClick={() => {
                  void (isWatchlisted
                    ? removeWatchlistMutation.mutateAsync()
                    : addWatchlistMutation.mutateAsync());
                }}
              >
                {isWatchlisted ? 'Remove' : 'Watchlist'}
              </AppButton>
              <AppButtonLink href="/watchlist" variant="secondary">
                Watchlist
              </AppButtonLink>
            </div>
          </div>

          <div className="pv-stock-hero-grid">
            <div className="pv-stock-price-panel">
              <div className="pv-stock-price">{formatCurrency(currentPrice)}</div>
              <div className={quote.dailyChange >= 0 ? 'pv-positive' : 'pv-negative'}>
                {formatSignedCurrency(quote.dailyChange)} · {formatPercent(quote.dailyChangePercent)}
              </div>
              <span className="pv-kicker pv-kicker-inverse">
                Last updated {formatDateTime(quote.quoteTimestamp)}
              </span>
            </div>

            <div className="pv-stock-hero-metrics">
              <MetricCard label="Open" value={formatCurrency(quote.openPrice)} />
              <MetricCard label="Session high" value={formatCurrency(quote.highPrice)} />
              <MetricCard label="Previous close" value={formatCurrency(quote.previousClose)} />
              <MetricCard label="Shares owned" value={holding ? formatShares(holding.quantity) : '0'} />
            </div>
          </div>

          {watchlistErrorMessage ? <InlineNotice tone="error" message={watchlistErrorMessage} /> : null}
        </AppCard>

        <AppCard className="pv-chart-card">
          <StockHistoryChart
            range={historyRange}
            history={historyQuery.data}
            loading={historyQuery.isLoading}
            refreshing={historyQuery.isFetching && Boolean(historyQuery.data)}
            errorMessage={chartErrorMessage}
            onSelectRange={setHistoryRange}
          />
        </AppCard>

        <div className="pv-grid two">
          <AppCard>
            <SectionHeader title="Quote metrics" />
            <div className="pv-stock-metric-grid">
              <MetricCard label="Open" value={formatCurrency(quote.openPrice)} />
              <MetricCard label="High" value={formatCurrency(quote.highPrice)} />
              <MetricCard label="Low" value={formatCurrency(quote.lowPrice)} />
              <MetricCard label="Previous close" value={formatCurrency(quote.previousClose)} />
              <MetricCard
                label="Daily change"
                value={formatSignedCurrency(quote.dailyChange)}
                tone={quote.dailyChange >= 0 ? 'positive' : 'negative'}
              />
              <MetricCard
                label="Daily return"
                value={formatPercent(quote.dailyChangePercent)}
                tone={quote.dailyChangePercent >= 0 ? 'positive' : 'negative'}
              />
            </div>
          </AppCard>

          <AppCard>
            <SectionHeader title="Position" />
            <div className="pv-meta-row">
              <span className="pv-kicker">Available cash</span>
              <strong>{formatCurrency(cashBalance)}</strong>
            </div>
            <div className="pv-meta-row">
              <span className="pv-kicker">Average cost</span>
              <strong>{holding ? formatCurrency(holding.averageCost) : '$0.00'}</strong>
            </div>
            <div className="pv-meta-row">
              <span className="pv-kicker">Market value</span>
              <strong>{holding ? formatCurrency(holding.marketValue) : '$0.00'}</strong>
            </div>
            <div className="pv-meta-row">
              <span className="pv-kicker">Shares owned</span>
              <strong>{holding ? formatShares(holding.quantity) : '0'}</strong>
            </div>
            <div className="pv-meta-row">
              <span className="pv-kicker">Unrealized P&amp;L</span>
              <strong className={(holding?.unrealizedPnl ?? 0) >= 0 ? 'pv-positive' : 'pv-negative'}>
                {holding ? formatSignedCurrency(holding.unrealizedPnl) : '$0.00'}
              </strong>
            </div>
          </AppCard>
        </div>
      </section>

      <section className="pv-stack pv-stock-sidebar">
        {secondaryErrorMessage ? (
          <InlineNotice tone="error" message={secondaryErrorMessage} />
        ) : null}

        <AppCard>
          <SectionHeader title="Trade" />
          <div className="pv-meta-row">
            <span className="pv-kicker">Current quote</span>
            <strong>{formatCurrency(currentPrice)}</strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">Cash available</span>
            <strong>{formatCurrency(cashBalance)}</strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">Shares available</span>
            <strong>{formatShares(availableToSell)}</strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">Quote timestamp</span>
            <strong>{formatDateTime(quote.quoteTimestamp)}</strong>
          </div>
        </AppCard>

        <TradeOrderCard
          title="Buy shares"
          submitLabel="Place buy order"
          currentPrice={currentPrice}
          availableLabel="Available cash"
          availableValue={formatCurrency(cashBalance)}
          estimateLabel="Estimated total"
          supportLabel="Execution source"
          supportValue="Current backend quote"
          pending={buyMutation.isPending}
          errorMessage={
            buyMutation.isError
              ? webApi.getApiErrorMessage(buyMutation.error, 'Unable to place buy order')
              : null
          }
          successMessage={
            buyMutation.isSuccess
              ? 'Buy order simulated successfully.'
              : null
          }
          getBlockingMessage={(quantity) =>
            quantity * currentPrice > cashBalance
              ? 'This estimated order is larger than your available virtual cash.'
              : null
          }
          onSubmitQuantity={async (quantity) => {
            await buyMutation.mutateAsync({ quantity });
          }}
        />

        <TradeOrderCard
          title="Sell shares"
          submitLabel="Place sell order"
          currentPrice={currentPrice}
          availableLabel="Shares available"
          availableValue={formatShares(availableToSell)}
          estimateLabel="Estimated proceeds"
          supportLabel="Position source"
          supportValue="Current backend holdings"
          buttonVariant="secondary"
          pending={sellMutation.isPending}
          errorMessage={
            sellMutation.isError
              ? webApi.getApiErrorMessage(sellMutation.error, 'Unable to place sell order')
              : null
          }
          successMessage={
            sellMutation.isSuccess
              ? 'Sell order simulated successfully.'
              : null
          }
          getBlockingMessage={(quantity) =>
            quantity > availableToSell
              ? 'You cannot sell more shares than the backend reports in your holdings.'
              : null
          }
          onSubmitQuantity={async (quantity) => {
            await sellMutation.mutateAsync({ quantity });
          }}
        />
      </section>
    </main>
  );
}
