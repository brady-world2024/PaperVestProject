'use client';

import type {
  PortfolioHistoryRange,
  PortfolioHistoryResponse,
} from '@papervest/shared-types';

import { AppButton } from './app-button';
import { EmptyState } from './empty-state';
import { InlineNotice } from './inline-notice';
import { formatCurrency, formatPercent, formatSignedCurrency } from '../lib/formatters';

const rangeOptions: PortfolioHistoryRange[] = ['1W', '1M', '3M', 'ALL'];

type Props = {
  range: PortfolioHistoryRange;
  history?: PortfolioHistoryResponse;
  loading: boolean;
  refreshing?: boolean;
  errorMessage?: string | null;
  onSelectRange: (range: PortfolioHistoryRange) => void;
};

export function PortfolioHistoryChart({
  range,
  history,
  loading,
  refreshing = false,
  errorMessage,
  onSelectRange,
}: Props) {
  const points = history?.points ?? [];

  if (loading && !points.length) {
    return (
      <section className="pv-chart-shell">
        <div className="pv-chart-toolbar">
          <div>
            <div className="pv-eyebrow">Time series</div>
            <h2 className="pv-section-title">Portfolio history</h2>
          </div>
          <div className="pv-range-group">
            {rangeOptions.map((option) => (
              <div key={option} className="pv-range-button" data-active={option === range}>
                {option}
              </div>
            ))}
          </div>
        </div>
        <div className="pv-skeleton" style={{ minHeight: '360px' }} />
      </section>
    );
  }

  if (!points.length) {
    return (
      <section className="pv-chart-shell">
        <div className="pv-chart-toolbar">
          <div>
            <div className="pv-eyebrow">Time series</div>
            <h2 className="pv-section-title">Portfolio history</h2>
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
        {errorMessage ? <InlineNotice tone="error" message={errorMessage} /> : null}
        <EmptyState
          title="No portfolio snapshots yet"
          description="History points will appear after successful paper trades start recording account snapshots."
        />
      </section>
    );
  }

  const values = points.map((point) => point.totalPortfolioValue);
  const firstValue = values[0] ?? 0;
  const lastValue = values[values.length - 1] ?? 0;
  const delta = lastValue - firstValue;
  const deltaPercent = firstValue > 0 ? (delta / firstValue) * 100 : 0;
  const positive = delta >= 0;
  const high = Math.max(...values);
  const low = Math.min(...values);
  const latest = points[points.length - 1]!;

  const width = 920;
  const height = 360;
  const paddingTop = 20;
  const paddingRight = 18;
  const paddingBottom = 32;
  const paddingLeft = 12;
  const graphWidth = width - paddingLeft - paddingRight;
  const graphHeight = height - paddingTop - paddingBottom;
  const spread = Math.max(high - low, Math.max(lastValue * 0.02, 0.5));
  const minValue = low - spread * 0.12;
  const maxValue = high + spread * 0.12;

  const coordinates = points.map((point, index) => {
    const x =
      paddingLeft +
      (points.length === 1 ? graphWidth / 2 : (index / (points.length - 1)) * graphWidth);
    const y =
      paddingTop +
      (1 - (point.totalPortfolioValue - minValue) / Math.max(maxValue - minValue, 1)) * graphHeight;
    return { x, y };
  });

  const linePath = coordinates
    .map((coordinate, index) =>
      `${index === 0 ? 'M' : 'L'} ${coordinate.x.toFixed(2)} ${coordinate.y.toFixed(2)}`
    )
    .join(' ');
  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1]?.x.toFixed(2) ?? width} ${(
    paddingTop + graphHeight
  ).toFixed(2)} L ${coordinates[0]?.x.toFixed(2) ?? paddingLeft} ${(paddingTop + graphHeight).toFixed(2)} Z`;

  const yAxisValues = [maxValue, minValue + (maxValue - minValue) / 2, minValue];
  const axisPoints =
    points.length === 1
      ? [points[0], null, null]
      : [
          points[0],
          points[Math.floor((points.length - 1) / 2)],
          points[points.length - 1],
        ];

  return (
    <section className="pv-chart-shell">
      <div className="pv-chart-toolbar">
        <div>
          <div className="pv-eyebrow">Time series</div>
          <h2 className="pv-section-title">Portfolio history</h2>
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

      <div className="pv-chart-summary">
        <div className="pv-chart-summary-card">
          <span className="pv-kicker">Range move</span>
          <strong className={positive ? 'pv-positive' : 'pv-negative'}>
            {formatSignedCurrency(delta)} · {formatPercent(deltaPercent)}
          </strong>
        </div>
        <div className="pv-chart-summary-card">
          <span className="pv-kicker">Latest value</span>
          <strong>{formatCurrency(latest.totalPortfolioValue)}</strong>
        </div>
        <div className="pv-chart-summary-card">
          <span className="pv-kicker">Cash balance</span>
          <strong>{formatCurrency(latest.cashBalance)}</strong>
        </div>
        <div className="pv-chart-summary-card">
          <span className="pv-kicker">Holdings value</span>
          <strong>{formatCurrency(latest.holdingsMarketValue)}</strong>
        </div>
      </div>

      {errorMessage ? <InlineNotice tone="error" message={errorMessage} /> : null}

      <div className="pv-chart-canvas-wrap">
        {refreshing ? <span className="pv-chart-refreshing">Refreshing…</span> : null}
        <svg
          className="pv-history-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Portfolio history chart over ${range}`}
        >
          <defs>
            <linearGradient id="pvPortfolioHistoryAreaGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={positive ? '#1E9E62' : '#C25A44'} stopOpacity="0.34" />
              <stop offset="100%" stopColor={positive ? '#1E9E62' : '#C25A44'} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {yAxisValues.map((value, index) => {
            const y = paddingTop + (index / (yAxisValues.length - 1)) * graphHeight;
            return (
              <g key={value}>
                <line
                  x1={paddingLeft}
                  x2={width - paddingRight}
                  y1={y}
                  y2={y}
                  stroke="rgba(94, 109, 120, 0.16)"
                  strokeDasharray="5 8"
                />
                <text
                  x={width - paddingRight}
                  y={y - 8}
                  textAnchor="end"
                  className="pv-chart-axis-label"
                >
                  {formatCurrency(value)}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill="url(#pvPortfolioHistoryAreaGradient)" />
          <path
            d={linePath}
            fill="none"
            stroke={positive ? 'var(--pv-color-positive)' : 'var(--pv-color-negative)'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {coordinates.length <= 80
            ? coordinates.map((coordinate, index) => (
                <circle
                  key={`${coordinate.x}-${coordinate.y}`}
                  cx={coordinate.x}
                  cy={coordinate.y}
                  r="2.8"
                  fill={positive ? 'var(--pv-color-positive)' : 'var(--pv-color-negative)'}
                  opacity={index === coordinates.length - 1 ? 1 : 0.35}
                />
              ))
            : null}
        </svg>
      </div>

      <div className="pv-chart-axis-row">
        {axisPoints.map((point, index) => (
          <span key={`${point?.timestamp ?? index}-${index}`} className="pv-chart-axis-caption">
            {point ? formatAxisLabel(point.timestamp, range) : ''}
          </span>
        ))}
      </div>
    </section>
  );
}

function formatAxisLabel(value: string, range: PortfolioHistoryRange) {
  const date = new Date(value);

  if (range === 'ALL') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}
