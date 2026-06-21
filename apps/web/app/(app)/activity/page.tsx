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
import { getExecutionAuditSummary } from '@/lib/trust-audit';
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
  const allTrades = historyQuery.data?.trades ?? [];
  const trades = sortTrades(allTrades, sort);
  const executionAuditSummary = getExecutionAuditSummary(allTrades);

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
          title="Execution trust rail"
          subtitle="Read execution history as a ledger with replay posture, concrete trade IDs, and visible latest-write timing."
        />
        <div className="pv-trust-grid">
          <div className="pv-trust-card">
            <span className="pv-trust-label">Latest execution</span>
            <strong className="pv-trust-value">
              {executionAuditSummary.latestExecutionAt
                ? formatDateTime(executionAuditSummary.latestExecutionAt)
                : 'No fill yet'}
            </strong>
            <span className="pv-trust-copy">
              The freshest backend execution timestamp anchors the current top of the ledger.
            </span>
          </div>
          <div className="pv-trust-card">
            <span className="pv-trust-label">Latest trade ID</span>
            <strong className="pv-trust-value">{executionAuditSummary.latestTradeId ?? 'No ID yet'}</strong>
            <span className="pv-trust-copy">
              Trade IDs stay visible so every row can be discussed as a concrete ledger event.
            </span>
          </div>
          <div className="pv-trust-card">
            <span className="pv-trust-label">Replay-safe fills</span>
            <strong className="pv-trust-value">{executionAuditSummary.verifiedFillCount}</strong>
            <span className="pv-trust-copy">
              These rows were recorded as primary executions rather than idempotent replays.
            </span>
          </div>
          <div className="pv-trust-card">
            <span className="pv-trust-label">Replay events</span>
            <strong className="pv-trust-value">{executionAuditSummary.replayCount}</strong>
            <span className="pv-trust-copy">
              Replays remain visible instead of being silently merged away from the audit story.
            </span>
          </div>
        </div>
        <div className="pv-audit-note">
          <strong>Ledger discipline</strong>
          <span>
            This page keeps the execution record separate from portfolio math, so you can audit fills before interpreting account-level P&amp;L.
          </span>
        </div>
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
                      <span className={`pv-chip ${trade.idempotentReplay ? 'neutral' : 'positive'}`}>
                        {trade.idempotentReplay ? 'Replay' : 'Primary fill'}
                      </span>
                    </span>
                    <span className="pv-list-company">{trade.companyName}</span>
                    {density === 'comfortable' ? (
                      <>
                        <span className="pv-list-meta-line">
                          <span>Trade ID</span>
                          <span>{trade.tradeId}</span>
                        </span>
                        <span className="pv-list-meta-line">
                          <span>Audit posture</span>
                          <span>{trade.idempotentReplay ? 'Idempotent replay' : 'Primary execution'}</span>
                        </span>
                      </>
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
