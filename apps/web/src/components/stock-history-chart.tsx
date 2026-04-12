'use client';

import type { StockHistoryRange, StockPriceHistory } from '@papervest/shared-types';

import { AppButton } from './app-button';
import { EmptyState } from './empty-state';
import { InlineNotice } from './inline-notice';
import { formatCurrency, formatPercent, formatSignedCurrency } from '@/lib/formatters';

const rangeOptions: StockHistoryRange[] = ['1D', '1W', '1M', '3M', '1Y'];

type Props = {
  range: StockHistoryRange;
  history?: StockPriceHistory;
  loading: boolean;
  refreshing?: boolean;
  errorMessage?: string | null;
  onSelectRange: (range: StockHistoryRange) => void;
};

export function StockHistoryChart({
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
            <div className="pv-eyebrow">History</div>
            <h2 className="pv-section-title">Price history</h2>
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
            <div className="pv-eyebrow">History</div>
            <h2 className="pv-section-title">Price history</h2>
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
          title="No history available"
          description="No price series returned for this range."
        />
      </section>
    );
  }

  const closes = points.map((point) => point.closePrice);
  const high = Math.max(...closes);
  const low = Math.min(...closes);
  const first = closes[0] ?? 0;
  const last = closes[closes.length - 1] ?? 0;
  const delta = last - first;
  const deltaPercent = first > 0 ? (delta / first) * 100 : 0;
  const positive = delta >= 0;

  const width = 920;
  const height = 360;
  const paddingTop = 20;
  const paddingRight = 18;
  const paddingBottom = 32;
  const paddingLeft = 12;
  const graphWidth = width - paddingLeft - paddingRight;
  const graphHeight = height - paddingTop - paddingBottom;
  const spread = Math.max(high - low, Math.max(last * 0.02, 0.5));
  const minValue = low - spread * 0.12;
  const maxValue = high + spread * 0.12;

  const coordinates = points.map((point, index) => {
    const x =
      paddingLeft +
      (points.length === 1 ? graphWidth / 2 : (index / (points.length - 1)) * graphWidth);
    const y =
      paddingTop +
      (1 - (point.closePrice - minValue) / Math.max(maxValue - minValue, 1)) * graphHeight;
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
          <div className="pv-eyebrow">History</div>
          <h2 className="pv-section-title">Price history</h2>
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
          <span className="pv-kicker">High</span>
          <strong>{formatCurrency(high)}</strong>
        </div>
        <div className="pv-chart-summary-card">
          <span className="pv-kicker">Low</span>
          <strong>{formatCurrency(low)}</strong>
        </div>
        <div className="pv-chart-summary-card">
          <span className="pv-kicker">Interval</span>
          <strong>{history?.interval ?? '--'}</strong>
        </div>
      </div>

      {errorMessage ? <InlineNotice tone="error" message={errorMessage} /> : null}

      <div className="pv-chart-canvas-wrap">
        {refreshing ? <span className="pv-chart-refreshing">Refreshing…</span> : null}
        <svg
          className="pv-history-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Historical price chart for ${history?.symbol ?? 'stock'} over ${range}`}
        >
          <defs>
            <linearGradient id="pvHistoryAreaGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={positive ? '#1E9E62' : '#C25A44'} stopOpacity="0.34" />
              <stop offset="100%" stopColor={positive ? '#1E9E62' : '#C25A44'} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {yAxisValues.map((value, index) => {
            const y =
              paddingTop + (index / (yAxisValues.length - 1)) * graphHeight;
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

          <path d={areaPath} fill="url(#pvHistoryAreaGradient)" />
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
            {point ? formatAxisLabel(point.timestamp, range, history?.interval) : ''}
          </span>
        ))}
      </div>
    </section>
  );
}

function formatAxisLabel(value: string, range: StockHistoryRange, interval?: string) {
  const date = new Date(value);

  if (interval === '1d') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  if (range === '1D') {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  if (range === '1W') {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      hour: 'numeric',
    }).format(date);
  }

  if (range === '1Y') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: '2-digit',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}
