'use client';

import type {
  PortfolioPerformanceRange,
  PortfolioPerformanceResponse,
} from '@papervest/shared-types';

import { AppButton } from './app-button';
import { EmptyState } from './empty-state';
import { InlineNotice } from './inline-notice';
import { formatCurrency, formatPercent, formatSignedCurrency } from '../lib/formatters';

const rangeOptions: PortfolioPerformanceRange[] = ['1W', '1M', '3M', 'ALL'];

type Props = {
  range: PortfolioPerformanceRange;
  performance?: PortfolioPerformanceResponse;
  loading: boolean;
  refreshing?: boolean;
  errorMessage?: string | null;
  onSelectRange: (range: PortfolioPerformanceRange) => void;
};

export function PortfolioPerformanceCenter({
  range,
  performance,
  loading,
  refreshing = false,
  errorMessage,
  onSelectRange,
}: Props) {
  if (loading && !performance) {
    return (
      <section className="pv-chart-shell">
        <PerformanceToolbar range={range} onSelectRange={onSelectRange} />
        <div className="pv-skeleton" style={{ minHeight: '280px' }} />
      </section>
    );
  }

  if (!performance) {
    return (
      <section className="pv-chart-shell">
        <PerformanceToolbar range={range} onSelectRange={onSelectRange} />
        {errorMessage ? <InlineNotice tone="error" message={errorMessage} /> : null}
        <EmptyState
          title="No performance data yet"
          description="Performance metrics appear after the portfolio valuation service can read your account."
        />
      </section>
    );
  }

  const positiveReturn = performance.summary.absoluteReturn >= 0;
  const hasContributors = performance.topHoldings.length > 0;

  return (
    <section className="pv-chart-shell">
      <PerformanceToolbar range={range} onSelectRange={onSelectRange} />

      {performance.status === 'INSUFFICIENT_HISTORY' ? (
        <InlineNotice
          tone="info"
          message="Performance history is limited until portfolio snapshots are recorded in this range."
        />
      ) : null}
      {errorMessage ? <InlineNotice tone="error" message={errorMessage} /> : null}
      {refreshing ? <span className="pv-chart-refreshing">Refreshing...</span> : null}

      <div className="pv-chart-summary">
        <div className="pv-chart-summary-card">
          <span className="pv-kicker">Range return</span>
          <strong className={positiveReturn ? 'pv-positive' : 'pv-negative'}>
            {formatSignedCurrency(performance.summary.absoluteReturn)} · {formatPercent(performance.summary.returnPercent)}
          </strong>
        </div>
        <div className="pv-chart-summary-card">
          <span className="pv-kicker">Max drawdown</span>
          <strong>{formatPercent(performance.summary.maxDrawdownPercent)}</strong>
        </div>
        <div className="pv-chart-summary-card">
          <span className="pv-kicker">Current value</span>
          <strong>{formatCurrency(performance.summary.currentValue)}</strong>
        </div>
        <div className="pv-chart-summary-card">
          <span className="pv-kicker">Range baseline</span>
          <strong>{formatCurrency(performance.summary.startValue)}</strong>
        </div>
      </div>

      <div className="pv-performance-grid">
        <div className="pv-performance-panel">
          <div>
            <div className="pv-eyebrow">Allocation</div>
            <h3 className="pv-subtitle">Cash and holdings</h3>
          </div>
          <AllocationRow
            label="Cash"
            value={performance.allocation.cashValue}
            percent={performance.allocation.cashPercent}
          />
          <AllocationRow
            label="Holdings"
            value={performance.allocation.holdingsValue}
            percent={performance.allocation.holdingsPercent}
          />
        </div>

        <div className="pv-performance-panel">
          <div>
            <div className="pv-eyebrow">P&amp;L contribution</div>
            <h3 className="pv-subtitle">Realized and unrealized</h3>
          </div>
          <AllocationRow
            label="Realized"
            value={performance.pnlContribution.realizedValue}
            percent={performance.pnlContribution.realizedPercent}
            signed
          />
          <AllocationRow
            label="Unrealized"
            value={performance.pnlContribution.unrealizedValue}
            percent={performance.pnlContribution.unrealizedPercent}
            signed
          />
        </div>
      </div>

      <div className="pv-performance-panel">
        <div className="pv-chart-toolbar">
          <div>
            <div className="pv-eyebrow">Top contributors</div>
            <h3 className="pv-subtitle">Holdings ranked by unrealized P&amp;L</h3>
          </div>
        </div>

        {hasContributors ? (
          <div className="pv-workspace-table pv-performance-contributors">
            <div className="pv-workspace-header">
              <span>Holding</span>
              <span>Weight</span>
              <span>Market value</span>
              <span>Unrealized</span>
            </div>
            {performance.topHoldings.map((holding) => (
              <div className="pv-workspace-row compact" key={holding.symbol}>
                <div className="pv-workspace-cell primary">
                  <span className="pv-list-symbol-line">
                    <span className="pv-list-symbol">{holding.symbol}</span>
                    <span className="pv-chip neutral">#{holding.rank}</span>
                  </span>
                  <span className="pv-list-company">{holding.companyName}</span>
                </div>
                <div className="pv-workspace-cell numeric">
                  <strong>{formatPercent(holding.portfolioWeightPercent)}</strong>
                </div>
                <div className="pv-workspace-cell numeric">
                  <strong>{formatCurrency(holding.marketValue)}</strong>
                </div>
                <div className="pv-workspace-cell numeric">
                  <span className={holding.unrealizedPnl >= 0 ? 'pv-positive' : 'pv-negative'}>
                    {formatSignedCurrency(holding.unrealizedPnl)} · {formatPercent(holding.unrealizedPnlPercent)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No contributors yet"
            description="Open positions will appear here once holdings have market value."
          />
        )}
      </div>
    </section>
  );
}

function PerformanceToolbar({
  range,
  onSelectRange,
}: {
  range: PortfolioPerformanceRange;
  onSelectRange: (range: PortfolioPerformanceRange) => void;
}) {
  return (
    <div className="pv-chart-toolbar">
      <div>
        <div className="pv-eyebrow">Performance</div>
        <h2 className="pv-section-title">Performance center</h2>
      </div>
      <div className="pv-range-group">
        {rangeOptions.map((option) => (
          <AppButton
            key={option}
            variant={option === range ? 'secondary' : 'ghost'}
            className="pv-range-button"
            onClick={() => onSelectRange(option)}
          >
            {option}
          </AppButton>
        ))}
      </div>
    </div>
  );
}

function AllocationRow({
  label,
  value,
  percent,
  signed = false,
}: {
  label: string;
  value: number;
  percent: number;
  signed?: boolean;
}) {
  const width = `${Math.min(Math.max(Math.abs(percent), 0), 100)}%`;
  const formattedValue = signed ? formatSignedCurrency(value) : formatCurrency(value);

  return (
    <div className="pv-performance-row">
      <div className="pv-performance-row-head">
        <span>{label}</span>
        <strong className={signed && value < 0 ? 'pv-negative' : signed && value > 0 ? 'pv-positive' : undefined}>
          {formattedValue} · {formatPercent(percent)}
        </strong>
      </div>
      <div className="pv-performance-meter" aria-hidden="true">
        <span style={{ width }} />
      </div>
    </div>
  );
}
