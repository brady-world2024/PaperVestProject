'use client';

import { useState } from 'react';
import type { StockHistoryRange, StockPriceBar, StockPriceHistory } from '@papervest/shared-types';

import { AppButton, AppButtonLink } from './app-button';
import { EmptyState } from './empty-state';
import { InlineNotice } from './inline-notice';
import { formatCurrency, formatPercent, formatSignedCurrency } from '../lib/formatters';
import { buildResearchSeries, getAverageVolume, getFiftyTwoWeekContext } from '../lib/stock-history-research';

const rangeOptions: StockHistoryRange[] = ['1D', '1W', '1M', '3M', '1Y'];
const tooltipWidth = 208;

type ResearchAction = {
  href: string;
  label: string;
};

type Props = {
  range: StockHistoryRange;
  history?: StockPriceHistory;
  contextHistory?: StockPriceHistory;
  symbol?: string;
  loading: boolean;
  refreshing?: boolean;
  errorMessage?: string | null;
  onSelectRange: (range: StockHistoryRange) => void;
  researchActions?: ResearchAction[];
};

export function StockHistoryChart({
  range,
  history,
  contextHistory,
  symbol,
  loading,
  refreshing = false,
  errorMessage,
  onSelectRange,
  researchActions = [],
}: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showMovingAverage5, setShowMovingAverage5] = useState(true);
  const [showMovingAverage20, setShowMovingAverage20] = useState(true);
  const [showVwap, setShowVwap] = useState(true);

  const points = history?.points ?? [];
  const researchSeries = buildResearchSeries(points);
  const latestPoint = researchSeries[researchSeries.length - 1] ?? null;
  const fiftyTwoWeekSource = range === '1Y' ? history : contextHistory;
  const fiftyTwoWeekContext = latestPoint
    ? getFiftyTwoWeekContext(fiftyTwoWeekSource?.points ?? [], latestPoint.closePrice)
    : null;

  if (loading && !points.length) {
    return (
      <section className="pv-chart-shell">
        <div className="pv-chart-toolbar">
          <div>
            <div className="pv-eyebrow">History</div>
            <h2 className="pv-section-title">Research chart</h2>
          </div>
          <div className="pv-chart-toolbar-stack">
            <div className="pv-range-group">
              {rangeOptions.map((option) => (
                <div key={option} className="pv-range-button" data-active={option === range}>
                  {option}
                </div>
              ))}
            </div>
            <div className="pv-indicator-group">
              <div className="pv-indicator-pill" data-active="true">MA(5)</div>
              <div className="pv-indicator-pill" data-active="true">MA(20)</div>
              <div className="pv-indicator-pill" data-active="true">VWAP</div>
            </div>
          </div>
        </div>
        <div className="pv-skeleton" style={{ minHeight: '430px' }} />
      </section>
    );
  }

  if (!points.length) {
    return (
      <section className="pv-chart-shell">
        <div className="pv-chart-toolbar">
          <div>
            <div className="pv-eyebrow">History</div>
            <h2 className="pv-section-title">Research chart</h2>
          </div>
          <div className="pv-chart-toolbar-stack">
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
        </div>
        {errorMessage ? <InlineNotice tone="error" message={errorMessage} /> : null}
        <EmptyState
          title="No research chart data available"
          description="No price series returned for this range."
        />
      </section>
    );
  }

  const closes = researchSeries.map((point) => point.closePrice);
  const indicatorValues = [
    ...closes,
    ...(showMovingAverage5 ? researchSeries.map((point) => point.movingAverage5 ?? NaN) : []),
    ...(showMovingAverage20 ? researchSeries.map((point) => point.movingAverage20 ?? NaN) : []),
    ...(showVwap ? researchSeries.map((point) => point.vwap ?? NaN) : []),
  ].filter((value) => Number.isFinite(value));
  const high = Math.max(...indicatorValues);
  const low = Math.min(...indicatorValues);
  const first = closes[0] ?? 0;
  const last = closes[closes.length - 1] ?? 0;
  const delta = last - first;
  const deltaPercent = first > 0 ? (delta / first) * 100 : 0;
  const positive = delta >= 0;
  const averageVolume = getAverageVolume(points);
  const activeIndex = hoverIndex ?? points.length - 1;
  const activePoint = researchSeries[activeIndex] ?? latestPoint;

  const width = 920;
  const height = 430;
  const paddingTop = 20;
  const paddingRight = 18;
  const paddingBottom = 28;
  const paddingLeft = 12;
  const volumeHeight = 84;
  const volumeGap = 18;
  const graphWidth = width - paddingLeft - paddingRight;
  const priceGraphHeight = height - paddingTop - paddingBottom - volumeHeight - volumeGap;
  const volumeTop = paddingTop + priceGraphHeight + volumeGap;
  const spread = Math.max(high - low, Math.max(last * 0.02, 0.5));
  const minValue = low - spread * 0.12;
  const maxValue = high + spread * 0.12;
  const volumeMax = Math.max(...points.map((point) => point.volume), 1);

  const coordinates = researchSeries.map((point, index) => {
    const x =
      paddingLeft +
      (researchSeries.length === 1 ? graphWidth / 2 : (index / (researchSeries.length - 1)) * graphWidth);
    const y =
      paddingTop +
      (1 - (point.closePrice - minValue) / Math.max(maxValue - minValue, 1)) * priceGraphHeight;
    return { x, y };
  });

  const movingAverage5Path = buildOverlayPath(researchSeries, (point) => point.movingAverage5, minValue, maxValue, {
    paddingLeft,
    paddingTop,
    graphWidth,
    graphHeight: priceGraphHeight,
  });
  const movingAverage20Path = buildOverlayPath(researchSeries, (point) => point.movingAverage20, minValue, maxValue, {
    paddingLeft,
    paddingTop,
    graphWidth,
    graphHeight: priceGraphHeight,
  });
  const vwapPath = buildOverlayPath(researchSeries, (point) => point.vwap, minValue, maxValue, {
    paddingLeft,
    paddingTop,
    graphWidth,
    graphHeight: priceGraphHeight,
  });

  const linePath = coordinates
    .map((coordinate, index) =>
      `${index === 0 ? 'M' : 'L'} ${coordinate.x.toFixed(2)} ${coordinate.y.toFixed(2)}`
    )
    .join(' ');
  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1]?.x.toFixed(2) ?? width} ${(
    paddingTop + priceGraphHeight
  ).toFixed(2)} L ${coordinates[0]?.x.toFixed(2) ?? paddingLeft} ${(paddingTop + priceGraphHeight).toFixed(2)} Z`;

  const yAxisValues = [maxValue, minValue + (maxValue - minValue) / 2, minValue];
  const axisPoints =
    researchSeries.length === 1
      ? [researchSeries[0], null, null]
      : [
          researchSeries[0],
          researchSeries[Math.floor((researchSeries.length - 1) / 2)],
          researchSeries[researchSeries.length - 1],
        ];
  const activeCoordinate = coordinates[activeIndex] ?? coordinates[coordinates.length - 1];
  const tooltipLeft = Math.min(
    Math.max((activeCoordinate?.x ?? paddingLeft) - tooltipWidth / 2, 12),
    width - tooltipWidth - 12
  );
  const tooltipTop = Math.max((activeCoordinate?.y ?? paddingTop) - 86, 14);

  return (
    <section className="pv-chart-shell">
      <div className="pv-chart-toolbar">
        <div>
          <div className="pv-eyebrow">History</div>
          <h2 className="pv-section-title">Research chart</h2>
          <p className="pv-chart-toolbar-copy">
            {symbol ?? history?.symbol ?? 'This symbol'} now keeps moving averages, VWAP, volume, and hover inspection
            inside the same chart view.
          </p>
        </div>
        <div className="pv-chart-toolbar-stack">
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
          <div className="pv-indicator-group">
            <AppButton
              variant={showMovingAverage5 ? 'secondary' : 'ghost'}
              className="pv-indicator-button"
              onClick={() => setShowMovingAverage5((value) => !value)}
            >
              MA(5)
            </AppButton>
            <AppButton
              variant={showMovingAverage20 ? 'secondary' : 'ghost'}
              className="pv-indicator-button"
              onClick={() => setShowMovingAverage20((value) => !value)}
            >
              MA(20)
            </AppButton>
            <AppButton
              variant={showVwap ? 'secondary' : 'ghost'}
              className="pv-indicator-button"
              onClick={() => setShowVwap((value) => !value)}
            >
              VWAP
            </AppButton>
          </div>
        </div>
      </div>

      {researchActions.length ? (
        <div className="pv-chart-action-row">
          {researchActions.map((action) => (
            <AppButtonLink key={action.href} href={action.href} variant="ghost">
              {action.label}
            </AppButtonLink>
          ))}
        </div>
      ) : null}

      <div className="pv-chart-summary pv-chart-summary-auto">
        <div className="pv-chart-summary-card">
          <span className="pv-kicker">Range move</span>
          <strong className={positive ? 'pv-positive' : 'pv-negative'}>
            {formatSignedCurrency(delta)} · {formatPercent(deltaPercent)}
          </strong>
        </div>
        <div className="pv-chart-summary-card">
          <span className="pv-kicker">Range high</span>
          <strong>{formatCurrency(Math.max(...researchSeries.map((point) => point.highPrice)))}</strong>
        </div>
        <div className="pv-chart-summary-card">
          <span className="pv-kicker">Range low</span>
          <strong>{formatCurrency(Math.min(...researchSeries.map((point) => point.lowPrice)))}</strong>
        </div>
        <div className="pv-chart-summary-card">
          <span className="pv-kicker">Average volume</span>
          <strong>{formatCompactNumber(averageVolume)}</strong>
        </div>
        <div className="pv-chart-summary-card">
          <span className="pv-kicker">Interval</span>
          <strong>{history?.interval ?? '--'}</strong>
        </div>
        <div className="pv-chart-summary-card">
          <span className="pv-kicker">52W context</span>
          <strong>
            {fiftyTwoWeekContext
              ? `${fiftyTwoWeekContext.rangePositionPercent.toFixed(1)}% through range`
              : 'Load 1Y for context'}
          </strong>
        </div>
      </div>

      {errorMessage ? <InlineNotice tone="error" message={errorMessage} /> : null}

      <div className="pv-chart-canvas-wrap">
        {refreshing ? <span className="pv-chart-refreshing">Refreshing…</span> : null}
        {activePoint && activeCoordinate ? (
          <div
            className="pv-chart-tooltip"
            style={{
              left: `${(tooltipLeft / width) * 100}%`,
              top: `${(tooltipTop / height) * 100}%`,
            }}
          >
            <strong>{formatTooltipDate(activePoint.timestamp, range, history?.interval)}</strong>
            <div className="pv-chart-tooltip-grid">
              <span>Open</span>
              <strong>{formatCurrency(activePoint.openPrice)}</strong>
              <span>High</span>
              <strong>{formatCurrency(activePoint.highPrice)}</strong>
              <span>Low</span>
              <strong>{formatCurrency(activePoint.lowPrice)}</strong>
              <span>Close</span>
              <strong>{formatCurrency(activePoint.closePrice)}</strong>
              <span>Volume</span>
              <strong>{formatCompactNumber(activePoint.volume)}</strong>
              {showMovingAverage5 ? (
                <>
                  <span>MA(5)</span>
                  <strong>{activePoint.movingAverage5 == null ? '—' : formatCurrency(activePoint.movingAverage5)}</strong>
                </>
              ) : null}
              {showMovingAverage20 ? (
                <>
                  <span>MA(20)</span>
                  <strong>{activePoint.movingAverage20 == null ? '—' : formatCurrency(activePoint.movingAverage20)}</strong>
                </>
              ) : null}
              {showVwap ? (
                <>
                  <span>VWAP</span>
                  <strong>{activePoint.vwap == null ? '—' : formatCurrency(activePoint.vwap)}</strong>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
        <svg
          className="pv-history-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Historical research chart for ${history?.symbol ?? 'stock'} over ${range}`}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * width;
            const clamped = Math.min(Math.max(x, paddingLeft), width - paddingRight);
            const nextIndex =
              researchSeries.length === 1
                ? 0
                : Math.round(((clamped - paddingLeft) / graphWidth) * (researchSeries.length - 1));
            setHoverIndex(Math.min(Math.max(nextIndex, 0), researchSeries.length - 1));
          }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="pvHistoryAreaGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={positive ? '#1E9E62' : '#C25A44'} stopOpacity="0.34" />
              <stop offset="100%" stopColor={positive ? '#1E9E62' : '#C25A44'} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {yAxisValues.map((value, index) => {
            const y =
              paddingTop + (index / (yAxisValues.length - 1)) * priceGraphHeight;
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

          {showMovingAverage5 && movingAverage5Path ? (
            <path
              d={movingAverage5Path}
              fill="none"
              stroke="#f4d35e"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {showMovingAverage20 && movingAverage20Path ? (
            <path
              d={movingAverage20Path}
              fill="none"
              stroke="#8b6ff0"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {showVwap && vwapPath ? (
            <path
              d={vwapPath}
              fill="none"
              stroke="#1f4460"
              strokeWidth="2.2"
              strokeDasharray="7 8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {researchSeries.map((point, index) => {
            const x =
              paddingLeft +
              (researchSeries.length === 1 ? graphWidth / 2 : (index / (researchSeries.length - 1)) * graphWidth);
            const barHeight = (point.volume / volumeMax) * volumeHeight;
            const barWidth = Math.max(graphWidth / Math.max(researchSeries.length, 1) - 3, 2);

            return (
              <rect
                key={`${point.timestamp}-volume`}
                x={x - barWidth / 2}
                y={volumeTop + (volumeHeight - barHeight)}
                width={barWidth}
                height={barHeight}
                rx="2"
                fill={point.closePrice >= point.openPrice ? 'rgba(30, 158, 98, 0.42)' : 'rgba(194, 90, 68, 0.34)'}
              />
            );
          })}

          <text x={paddingLeft} y={volumeTop - 6} className="pv-chart-axis-label">
            Volume
          </text>
          <text x={width - paddingRight} y={volumeTop - 6} textAnchor="end" className="pv-chart-axis-label">
            Avg {formatCompactNumber(averageVolume)}
          </text>

          {coordinates.length <= 80
            ? coordinates.map((coordinate, index) => (
                <circle
                  key={`${coordinate.x}-${coordinate.y}`}
                  cx={coordinate.x}
                  cy={coordinate.y}
                  r="2.8"
                  fill={positive ? 'var(--pv-color-positive)' : 'var(--pv-color-negative)'}
                  opacity={index === activeIndex ? 1 : 0.22}
                />
              ))
            : null}

          {activePoint && activeCoordinate ? (
            <g>
              <line
                x1={activeCoordinate.x}
                x2={activeCoordinate.x}
                y1={paddingTop}
                y2={volumeTop + volumeHeight}
                stroke="rgba(17, 34, 53, 0.28)"
                strokeDasharray="4 6"
              />
              <line
                x1={paddingLeft}
                x2={width - paddingRight}
                y1={activeCoordinate.y}
                y2={activeCoordinate.y}
                stroke="rgba(17, 34, 53, 0.18)"
                strokeDasharray="4 6"
              />
              <circle
                cx={activeCoordinate.x}
                cy={activeCoordinate.y}
                r="5.2"
                fill="#ffffff"
                stroke={positive ? 'var(--pv-color-positive)' : 'var(--pv-color-negative)'}
                strokeWidth="3"
              />
            </g>
          ) : null}
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

function buildOverlayPath<T extends StockPriceBar>(
  points: T[],
  valueAccessor: (point: T) => number | null,
  minValue: number,
  maxValue: number,
  dimensions: {
    paddingLeft: number;
    paddingTop: number;
    graphWidth: number;
    graphHeight: number;
  }
) {
  let path = '';
  let hasSegment = false;

  points.forEach((point, index) => {
    const value = valueAccessor(point);
    if (value == null) {
      hasSegment = false;
      return;
    }

    const x =
      dimensions.paddingLeft +
      (points.length === 1 ? dimensions.graphWidth / 2 : (index / (points.length - 1)) * dimensions.graphWidth);
    const y =
      dimensions.paddingTop +
      (1 - (value - minValue) / Math.max(maxValue - minValue, 1)) * dimensions.graphHeight;

    path += `${hasSegment ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)} `;
    hasSegment = true;
  });

  return path.trim() || null;
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

function formatTooltipDate(value: string, range: StockHistoryRange, interval?: string) {
  const date = new Date(value);

  if (range === '1D' && interval !== '1d') {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: interval === '1d' ? undefined : 'short',
  }).format(date);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
