import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { StockHistoryRange, StockPriceBar, StockPriceHistory } from '../../services/api/types';
import { appTheme } from '../../theme';
import { formatCurrency, formatPercent, formatSignedCurrency } from '../../utils/formatters';
import { AppCard } from '../common/AppCard';
import { EmptyState } from '../feedback/EmptyState';
import { InlineNotice } from '../feedback/InlineNotice';
import { SkeletonBlock } from '../feedback/SkeletonBlock';

const rangeOptions: StockHistoryRange[] = ['1D', '1W', '1M', '3M', '1Y'];
const chartHeight = 180;

type Props = {
  range: StockHistoryRange;
  history?: StockPriceHistory;
  loading: boolean;
  refreshing?: boolean;
  errorMessage?: string | null;
  onSelectRange: (range: StockHistoryRange) => void;
};

type ChartPoint = {
  x: number;
  y: number;
  closePrice: number;
  timestamp: string;
};

export function StockHistoryChart({
  range,
  history,
  loading,
  refreshing = false,
  errorMessage,
  onSelectRange,
}: Props) {
  const [chartWidth, setChartWidth] = useState(300);
  const points = history?.points ?? [];
  const chartPoints = useMemo(
    () => buildChartPoints(points, chartWidth, chartHeight),
    [points, chartWidth]
  );

  if (loading && !points.length) {
    return (
      <AppCard style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Price history</Text>
          <RangeSelector range={range} onSelectRange={onSelectRange} />
        </View>
        <SkeletonBlock height={chartHeight + 48} />
      </AppCard>
    );
  }

  if (!points.length) {
    return (
      <AppCard style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Price history</Text>
          <RangeSelector range={range} onSelectRange={onSelectRange} />
        </View>
        {errorMessage ? <InlineNotice tone="error" message={errorMessage} /> : null}
        <EmptyState
          title="No history available"
          description="No price series was returned for this range."
        />
      </AppCard>
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
  const yAxis = [high, low + (high - low) / 2, low];
  const axisPoints =
    chartPoints.length === 1
      ? [chartPoints[0], null, null]
      : [
          chartPoints[0],
          chartPoints[Math.floor((chartPoints.length - 1) / 2)],
          chartPoints[chartPoints.length - 1],
        ];

  return (
    <AppCard style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Price history</Text>
        <RangeSelector range={range} onSelectRange={onSelectRange} />
      </View>

      <View style={styles.summaryRow}>
        <SummaryBlock
          label="Range move"
          value={`${formatSignedCurrency(delta)} · ${formatPercent(deltaPercent)}`}
          tone={positive ? 'positive' : 'negative'}
        />
        <SummaryBlock label="High" value={formatCurrency(high)} />
        <SummaryBlock label="Low" value={formatCurrency(low)} />
      </View>

      {errorMessage ? <InlineNotice tone="error" message={errorMessage} /> : null}

      <View
        style={styles.chartShell}
        onLayout={(event: LayoutChangeEvent) => {
          const nextWidth = Math.max(event.nativeEvent.layout.width - 12, 240);
          setChartWidth(nextWidth);
        }}
      >
        {refreshing ? <Text style={styles.refreshing}>Refreshing...</Text> : null}

        {yAxis.map((value, index) => (
          <View
            key={`${value}-${index}`}
            style={[
              styles.gridLine,
              { top: (index / Math.max(yAxis.length - 1, 1)) * chartHeight },
            ]}
          >
            <Text style={styles.axisValue}>{formatCurrency(value)}</Text>
          </View>
        ))}

        <View style={styles.chartCanvas}>
          {chartPoints.slice(1).map((point, index) => {
            const previous = chartPoints[index];
            const distance = Math.sqrt(
              Math.pow(point.x - previous.x, 2) + Math.pow(point.y - previous.y, 2)
            );
            const angle = Math.atan2(point.y - previous.y, point.x - previous.x);
            const midX = (previous.x + point.x) / 2;
            const midY = (previous.y + point.y) / 2;
            return (
              <View
                key={`${previous.timestamp}-${point.timestamp}`}
                style={[
                  styles.segment,
                  positive ? styles.segmentPositive : styles.segmentNegative,
                  {
                    left: midX - distance / 2,
                    top: midY - 1.5,
                    width: Math.max(distance, 2),
                    transform: [{ rotate: `${angle}rad` }],
                  },
                ]}
              />
            );
          })}

          {chartPoints.map((point, index) => (
            <View
              key={`${point.timestamp}-${index}`}
              style={[
                styles.dot,
                positive ? styles.dotPositive : styles.dotNegative,
                index === chartPoints.length - 1 && styles.dotActive,
                {
                  left: point.x - 3,
                  top: point.y - 3,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.axisRow}>
        {axisPoints.map((point, index) => (
          <Text key={`${point?.timestamp ?? index}-${index}`} style={styles.axisLabel}>
            {point ? formatAxisLabel(point.timestamp, range, history?.interval) : ''}
          </Text>
        ))}
      </View>
    </AppCard>
  );
}

function RangeSelector({
  range,
  onSelectRange,
}: {
  range: StockHistoryRange;
  onSelectRange: (range: StockHistoryRange) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangeRow}>
      {rangeOptions.map((option) => {
        const active = option === range;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            onPress={() => onSelectRange(option)}
            style={[styles.rangeButton, active && styles.rangeButtonActive]}
          >
            <Text style={[styles.rangeLabel, active && styles.rangeLabelActive]}>{option}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function SummaryBlock({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'negative';
}) {
  return (
    <View style={styles.summaryBlock}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          tone === 'positive' && styles.summaryValuePositive,
          tone === 'negative' && styles.summaryValueNegative,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function buildChartPoints(
  rawPoints: StockPriceBar[],
  width: number,
  height: number
): ChartPoint[] {
  if (!rawPoints.length) {
    return [];
  }

  const sampled = samplePoints(rawPoints, 48);
  const closes = sampled.map((point) => point.closePrice);
  const high = Math.max(...closes);
  const low = Math.min(...closes);
  const spread = Math.max(high - low, 0.5);

  return sampled.map((point, index) => {
    const x = sampled.length === 1 ? width / 2 : (index / (sampled.length - 1)) * width;
    const y = ((high - point.closePrice) / spread) * (height - 12) + 6;
    return {
      x,
      y,
      closePrice: point.closePrice,
      timestamp: point.timestamp,
    };
  });
}

function samplePoints(points: StockPriceBar[], maxPoints: number) {
  if (points.length <= maxPoints) {
    return points;
  }

  const step = (points.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => {
    if (index === maxPoints - 1) {
      return points[points.length - 1];
    }
    return points[Math.round(index * step)];
  });
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

const styles = StyleSheet.create({
  container: {
    gap: appTheme.spacing.md,
  },
  header: {
    gap: appTheme.spacing.sm,
  },
  title: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.heading,
    fontWeight: '800',
  },
  rangeRow: {
    gap: appTheme.spacing.xs,
  },
  rangeButton: {
    minWidth: 48,
    minHeight: 34,
    paddingHorizontal: appTheme.spacing.sm,
    borderRadius: appTheme.radius.pill,
    backgroundColor: appTheme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeButtonActive: {
    backgroundColor: appTheme.colors.surfaceStrong,
  },
  rangeLabel: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.caption,
    fontWeight: '700',
  },
  rangeLabelActive: {
    color: appTheme.colors.textInverse,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: appTheme.spacing.sm,
  },
  summaryBlock: {
    flex: 1,
    minWidth: 92,
    padding: appTheme.spacing.sm,
    borderRadius: appTheme.radius.md,
    backgroundColor: appTheme.colors.surfaceMuted,
    gap: 4,
  },
  summaryLabel: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.micro,
    fontWeight: '700',
  },
  summaryValue: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.caption,
    fontWeight: '800',
  },
  summaryValuePositive: {
    color: appTheme.colors.positive,
  },
  summaryValueNegative: {
    color: appTheme.colors.negative,
  },
  chartShell: {
    position: 'relative',
    minHeight: chartHeight + 12,
    paddingTop: appTheme.spacing.sm,
  },
  refreshing: {
    position: 'absolute',
    top: 0,
    right: 0,
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.micro,
    zIndex: 3,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: appTheme.colors.border,
  },
  axisValue: {
    position: 'absolute',
    right: 0,
    top: -18,
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.micro,
    backgroundColor: appTheme.colors.surface,
    paddingHorizontal: 4,
  },
  chartCanvas: {
    position: 'relative',
    height: chartHeight,
    overflow: 'hidden',
  },
  segment: {
    position: 'absolute',
    height: 3,
    borderRadius: 999,
  },
  segmentPositive: {
    backgroundColor: appTheme.colors.positive,
  },
  segmentNegative: {
    backgroundColor: appTheme.colors.negative,
  },
  dot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 999,
    opacity: 0.4,
  },
  dotPositive: {
    backgroundColor: appTheme.colors.positive,
  },
  dotNegative: {
    backgroundColor: appTheme.colors.negative,
  },
  dotActive: {
    opacity: 1,
    width: 10,
    height: 10,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: appTheme.spacing.sm,
  },
  axisLabel: {
    flex: 1,
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.micro,
  },
});
