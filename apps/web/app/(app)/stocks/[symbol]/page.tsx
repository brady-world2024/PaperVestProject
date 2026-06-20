'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMarketSessionPresentation, type StockHistoryRange } from '@papervest/shared-types';

import { AppButton, AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { InlineNotice } from '@/components/inline-notice';
import { MetricCard } from '@/components/metric-card';
import { SectionHeader } from '@/components/section-header';
import { StockHistoryChart } from '@/components/stock-history-chart';
import { TradeOrderCard } from '@/components/trade-order-card';
import { getStaleQuoteBadge, getStaleQuoteMessage } from '@/lib/market-data-freshness';
import { liveQuoteRefreshOptions } from '@/lib/market-data-refresh';
import { describeMarketSession, getMarketSessionChipClass } from '@/lib/market-session';
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
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioHistoryRoot }),
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

  const marketSession = describeMarketSession(quote.marketSession);
  const tradingBlockedMessage = quote.tradingEnabled
    ? null
    : `${marketSession.statusLabel} session. Paper trading is only available during regular market hours.`;
  const staleQuoteMessage = getStaleQuoteMessage(quote.stale);

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
              <div className="pv-stock-status-row">
                <span className={`pv-chip ${getMarketSessionChipClass(quote.marketSession)}`}>
                  {marketSession.statusLabel}
                </span>
                {getStaleQuoteBadge(quote.stale) ? (
                  <span className="pv-chip neutral">{getStaleQuoteBadge(quote.stale)}</span>
                ) : null}
                <span className="pv-kicker pv-kicker-inverse">{marketSession.priceLabel}</span>
              </div>
              <div className="pv-stock-price">{formatCurrency(currentPrice)}</div>
              <div className={quote.dailyChange >= 0 ? 'pv-positive' : 'pv-negative'}>
                {formatSignedCurrency(quote.dailyChange)} · {formatPercent(quote.dailyChangePercent)}
              </div>
              <span className="pv-kicker pv-kicker-inverse">
                {marketSession.changeLabel}
              </span>
              <span className="pv-kicker pv-kicker-inverse">
                {formatMarketTimestamp(quote.quoteTimestamp, quote.marketTimezone)}
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
          {staleQuoteMessage ? <InlineNotice tone="info" message={staleQuoteMessage} /> : null}
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
            <SectionHeader
              title="Quote summary"
              subtitle="Current session context and key quote marks."
            />
            <div className="pv-stock-terminal">
              <div className="pv-stock-terminal-head">
                <span className={`pv-chip ${getMarketSessionChipClass(quote.marketSession)}`}>
                  {marketSession.statusLabel}
                </span>
                {getStaleQuoteBadge(quote.stale) ? (
                  <span className="pv-chip neutral">{getStaleQuoteBadge(quote.stale)}</span>
                ) : null}
                <span className="pv-kicker">
                  {marketSession.priceLabel} · {formatMarketTimestamp(quote.quoteTimestamp, quote.marketTimezone)}
                </span>
              </div>
              <div className="pv-stock-terminal-grid">
                <div className="pv-stock-terminal-row">
                  <span className="pv-stock-terminal-label">Open</span>
                  <strong className="pv-stock-terminal-value">{formatCurrency(quote.openPrice)}</strong>
                </div>
                <div className="pv-stock-terminal-row">
                  <span className="pv-stock-terminal-label">Previous close</span>
                  <strong className="pv-stock-terminal-value">{formatCurrency(quote.previousClose)}</strong>
                </div>
                <div className="pv-stock-terminal-row">
                  <span className="pv-stock-terminal-label">Session high</span>
                  <strong className="pv-stock-terminal-value">{formatCurrency(quote.highPrice)}</strong>
                </div>
                <div className="pv-stock-terminal-row">
                  <span className="pv-stock-terminal-label">Session low</span>
                  <strong className="pv-stock-terminal-value">{formatCurrency(quote.lowPrice)}</strong>
                </div>
                <div className="pv-stock-terminal-row">
                  <span className="pv-stock-terminal-label">{marketSession.changeLabel}</span>
                  <strong className={`pv-stock-terminal-value ${quote.dailyChange >= 0 ? 'pv-positive' : 'pv-negative'}`}>
                    {formatSignedCurrency(quote.dailyChange)}
                  </strong>
                </div>
                <div className="pv-stock-terminal-row">
                  <span className="pv-stock-terminal-label">Change percent</span>
                  <strong className={`pv-stock-terminal-value ${quote.dailyChangePercent >= 0 ? 'pv-positive' : 'pv-negative'}`}>
                    {formatPercent(quote.dailyChangePercent)}
                  </strong>
                </div>
              </div>
            </div>
          </AppCard>

          <AppCard>
            <SectionHeader
              title="Position summary"
              subtitle="Holding state and sizing context from the backend."
            />
            <div className="pv-stock-terminal">
              <div className="pv-stock-terminal-head">
                <span className={`pv-chip ${getMarketSessionChipClass(quote.marketSession)}`}>
                  {holding ? 'Position live' : 'No position'}
                </span>
                <span className="pv-kicker">
                  Position source · {formatMarketTimestamp(quote.quoteTimestamp, quote.marketTimezone)}
                </span>
              </div>
              <div className="pv-stock-terminal-grid">
                <div className="pv-stock-terminal-row">
                  <span className="pv-stock-terminal-label">Shares owned</span>
                  <strong className="pv-stock-terminal-value">{holding ? formatShares(holding.quantity) : '0'}</strong>
                </div>
                <div className="pv-stock-terminal-row">
                  <span className="pv-stock-terminal-label">Available cash</span>
                  <strong className="pv-stock-terminal-value">{formatCurrency(cashBalance)}</strong>
                </div>
                <div className="pv-stock-terminal-row">
                  <span className="pv-stock-terminal-label">Average cost</span>
                  <strong className="pv-stock-terminal-value">{holding ? formatCurrency(holding.averageCost) : '$0.00'}</strong>
                </div>
                <div className="pv-stock-terminal-row">
                  <span className="pv-stock-terminal-label">Market value</span>
                  <strong className="pv-stock-terminal-value">{holding ? formatCurrency(holding.marketValue) : '$0.00'}</strong>
                </div>
                <div className="pv-stock-terminal-row">
                  <span className="pv-stock-terminal-label">Current mark</span>
                  <strong className="pv-stock-terminal-value">{formatCurrency(currentPrice)}</strong>
                </div>
                <div className="pv-stock-terminal-row">
                  <span className="pv-stock-terminal-label">Unrealized P&amp;L</span>
                  <strong className={`pv-stock-terminal-value ${(holding?.unrealizedPnl ?? 0) >= 0 ? 'pv-positive' : 'pv-negative'}`}>
                    {holding ? formatSignedCurrency(holding.unrealizedPnl) : '$0.00'}
                  </strong>
                </div>
              </div>
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
              <span className="pv-kicker">{marketSession.priceLabel}</span>
              <strong>{formatCurrency(currentPrice)}</strong>
            </div>
            <div className="pv-meta-row">
              <span className="pv-kicker">Market session</span>
              <strong>{marketSession.statusLabel}</strong>
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
              <strong>{formatMarketTimestamp(quote.quoteTimestamp, quote.marketTimezone)}</strong>
            </div>
            {tradingBlockedMessage ? (
              <InlineNotice tone="info" message={tradingBlockedMessage} />
            ) : null}
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
          externalBlockingMessage={tradingBlockedMessage}
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
          externalBlockingMessage={tradingBlockedMessage}
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
