import { StyleSheet, Text, View } from 'react-native';

import type {
  PortfolioPerformanceRange,
  PortfolioPerformanceResponse,
} from '../../services/api/types';
import { AppButton } from '../common/AppButton';
import { AppCard } from '../common/AppCard';
import { InlineNotice } from '../feedback/InlineNotice';
import { SkeletonBlock } from '../feedback/SkeletonBlock';
import { SectionHeader } from '../layout/SectionHeader';
import { appTheme } from '../../theme';
import {
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
} from '../../utils/formatters';
import { MetricCard } from './MetricCard';

const ranges: PortfolioPerformanceRange[] = ['1W', '1M', '3M', 'ALL'];

type Props = {
  range: PortfolioPerformanceRange;
  performance?: PortfolioPerformanceResponse;
  loading: boolean;
  errorMessage?: string | null;
  onSelectRange: (range: PortfolioPerformanceRange) => void;
};

export function PortfolioPerformanceSummary({
  range,
  performance,
  loading,
  errorMessage,
  onSelectRange,
}: Props) {
  if (loading && !performance) {
    return <SkeletonBlock height={280} />;
  }

  return (
    <AppCard style={styles.card}>
      <View style={styles.headerRow}>
        <SectionHeader title="Performance" subtitle="Backend-calculated range metrics." />
        <View style={styles.rangeRow}>
          {ranges.map((option) => (
            <AppButton
              key={option}
              label={option}
              variant={option === range ? 'secondary' : 'ghost'}
              onPress={() => onSelectRange(option)}
              style={styles.rangeButton}
            />
          ))}
        </View>
      </View>

      {errorMessage ? <InlineNotice tone="error" message={errorMessage} /> : null}

      {performance ? (
        <>
          {performance.status === 'INSUFFICIENT_HISTORY' ? (
            <InlineNotice message="Performance history is limited until this range has snapshots." />
          ) : null}

          <View style={styles.metrics}>
            <MetricCard
              label="Range return"
              value={`${formatSignedCurrency(performance.summary.absoluteReturn)} · ${formatPercent(performance.summary.returnPercent)}`}
              tone={performance.summary.absoluteReturn >= 0 ? 'positive' : 'negative'}
              valueNumberOfLines={1}
            />
            <MetricCard
              label="Max drawdown"
              value={formatPercent(performance.summary.maxDrawdownPercent)}
              valueNumberOfLines={1}
            />
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Allocation</Text>
            <PerformanceRow
              label="Cash"
              value={formatCurrency(performance.allocation.cashValue)}
              percent={performance.allocation.cashPercent}
            />
            <PerformanceRow
              label="Holdings"
              value={formatCurrency(performance.allocation.holdingsValue)}
              percent={performance.allocation.holdingsPercent}
            />
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Top contributors</Text>
            {performance.topHoldings.slice(0, 3).map((holding) => (
              <View key={holding.symbol} style={styles.contributorRow}>
                <View style={styles.contributorIdentity}>
                  <Text style={styles.symbol}>{holding.symbol}</Text>
                  <Text style={styles.company} numberOfLines={1}>
                    {holding.companyName}
                  </Text>
                </View>
                <View style={styles.contributorValue}>
                  <Text
                    style={[
                      styles.pnl,
                      holding.unrealizedPnl >= 0 ? styles.positive : styles.negative,
                    ]}
                  >
                    {formatSignedCurrency(holding.unrealizedPnl)}
                  </Text>
                  <Text style={styles.meta}>{formatPercent(holding.portfolioWeightPercent)}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </AppCard>
  );
}

function PerformanceRow({
  label,
  value,
  percent,
}: {
  label: string;
  value: string;
  percent: number;
}) {
  return (
    <View style={styles.performanceRow}>
      <Text style={styles.meta}>{label}</Text>
      <Text style={styles.performanceValue}>
        {value} · {formatPercent(percent)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: appTheme.spacing.md,
  },
  headerRow: {
    gap: appTheme.spacing.md,
  },
  rangeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: appTheme.spacing.xs,
  },
  rangeButton: {
    minHeight: 36,
    paddingHorizontal: appTheme.spacing.md,
  },
  metrics: {
    flexDirection: 'row',
    gap: appTheme.spacing.sm,
  },
  panel: {
    gap: appTheme.spacing.sm,
    backgroundColor: appTheme.colors.surfaceMuted,
    borderRadius: appTheme.radius.md,
    padding: appTheme.spacing.md,
  },
  panelTitle: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.body,
    fontWeight: '800',
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: appTheme.spacing.md,
  },
  performanceValue: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.caption,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
  },
  contributorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: appTheme.spacing.md,
  },
  contributorIdentity: {
    flex: 1,
    minWidth: 0,
  },
  symbol: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.body,
    fontWeight: '800',
  },
  company: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.caption,
  },
  contributorValue: {
    alignItems: 'flex-end',
  },
  pnl: {
    fontSize: appTheme.typography.caption,
    fontWeight: '800',
  },
  meta: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.caption,
    fontWeight: '600',
  },
  positive: {
    color: appTheme.colors.positive,
  },
  negative: {
    color: appTheme.colors.negative,
  },
});
