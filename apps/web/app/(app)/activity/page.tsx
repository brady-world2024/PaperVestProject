'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { EmptyState } from '@/components/empty-state';
import { InlineNotice } from '@/components/inline-notice';
import { SectionHeader } from '@/components/section-header';
import { queryKeys } from '@/lib/query-keys';
import { webApi } from '@/lib/api';
import { useWorkspaceDensity } from '@/lib/use-workspace-density';
import { sortTrades, type TradeSort } from '@/lib/workspace-grids';
import {
  formatCurrency,
  formatDateTime,
  formatShares,
  formatSignedCurrency,
} from '@/lib/formatters';

export default function ActivityPage() {
  const { density, setDensity } = useWorkspaceDensity('pv-activity-density');
  const [sort, setSort] = useState<TradeSort>('latest');
  const historyQuery = useQuery({
    queryKey: queryKeys.tradeHistory,
    queryFn: webApi.getTradeHistory,
  });
  const trades = sortTrades(historyQuery.data?.trades ?? [], sort);

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
          title="Execution ledger"
          subtitle="A denser trade workspace that behaves more like a ledger than a stack of isolated cards."
          action={
            <AppButtonLink href="/portfolio" variant="ghost">
              Open portfolio
            </AppButtonLink>
          }
        />

        <div className="pv-workspace-toolbar">
          <div className="pv-workspace-toolbar-copy">
            <strong>Ledger controls</strong>
            <span>Scan the latest executions, or sort by the trades that moved realized P&amp;L the most.</span>
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
              <label className="pv-kicker" htmlFor="activity-sort">
                Sort by
              </label>
              <select
                id="activity-sort"
                className="pv-input pv-workspace-select"
                value={sort}
                onChange={(event) => setSort(event.target.value as TradeSort)}
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
            message={webApi.getApiErrorMessage(historyQuery.error, 'Unable to load trade history')}
          />
        ) : trades.length ? (
          <div className={`pv-workspace-table seven-column ${density}`}>
            <div className="pv-workspace-header">
              <span>Trade</span>
              <span>Quantity</span>
              <span>Price</span>
              <span>Gross amount</span>
              <span>Cash after</span>
              <span>Realized</span>
              <span>Executed</span>
            </div>
            {trades.map((trade) => (
              <div className={`pv-workspace-row ${density}`} key={trade.tradeId}>
                <div className="pv-workspace-cell primary">
                  <span className="pv-list-symbol-line">
                    <span className="pv-list-symbol">{trade.symbol}</span>
                    <span className={`pv-chip ${trade.side === 'BUY' ? 'buy' : 'sell'}`}>
                      {trade.side}
                    </span>
                  </span>
                  <span className="pv-list-company">{trade.companyName}</span>
                  {density === 'comfortable' ? (
                    <span className="pv-list-meta-line">
                      <span>Trade ID</span>
                      <span>{trade.tradeId}</span>
                    </span>
                  ) : null}
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
                  <strong>{formatCurrency(trade.cashBalanceAfterTrade)}</strong>
                </div>
                <div className="pv-workspace-cell numeric">
                  <span className={trade.realizedPnl >= 0 ? 'pv-positive' : 'pv-negative'}>
                    {formatSignedCurrency(trade.realizedPnl)}
                  </span>
                </div>
                <div className="pv-workspace-cell">
                  <span className="pv-kicker">{formatDateTime(trade.executedAt)}</span>
                </div>
              </div>
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
