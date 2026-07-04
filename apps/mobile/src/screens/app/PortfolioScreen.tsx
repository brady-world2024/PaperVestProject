import { useState } from 'react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { PortfolioPerformanceRange } from '@papervest/shared-types';

import { AppCard } from '../../components/common/AppCard';
import { EmptyState } from '../../components/feedback/EmptyState';
import { SkeletonBlock } from '../../components/feedback/SkeletonBlock';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { MarketSessionBadge } from '../../components/market/MarketSessionBadge';
import { MetricCard } from '../../components/portfolio/MetricCard';
import { PortfolioPerformanceSummary } from '../../components/portfolio/PortfolioPerformanceSummary';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { getPortfolio, getPortfolioPerformance } from '../../services/api/papervestApi';
import { liveQuoteRefreshOptions } from '../../services/api/market-data-refresh';
import { queryKeys } from '../../services/api/queryKeys';
import { appTheme } from '../../theme';
import {
  formatCurrency,
  formatMarketTimestamp,
  formatPercent,
  formatShares,
  formatSignedCurrency,
} from '../../utils/formatters';
import { describeMarketSession } from '../../utils/marketSession';

export function PortfolioScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [performanceRange, setPerformanceRange] = useState<PortfolioPerformanceRange>('1M');

  const portfolioQuery = useQuery({
    queryKey: queryKeys.portfolio,
    queryFn: getPortfolio,
    ...liveQuoteRefreshOptions,
  });

  const portfolioPerformanceQuery = useQuery({
    queryKey: queryKeys.portfolioPerformance(performanceRange),
    queryFn: () => getPortfolioPerformance(performanceRange),
    ...liveQuoteRefreshOptions,
    placeholderData: (previousData) => previousData,
  });

  const summary = portfolioQuery.data?.summary;

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl
          refreshing={portfolioQuery.isRefetching}
          onRefresh={() => {
            void portfolioQuery.refetch();
            void portfolioPerformanceQuery.refetch();
          }}
        />
      }
      contentStyle={styles.content}
    >
      {summary ? (
        <LinearGradient
          colors={['#FFF8EB', '#EDE2D3', '#DCEEE7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroLabel}>Total portfolio value</Text>
          <Text style={styles.heroValue}>{formatCurrency(summary.totalPortfolioValue)}</Text>
          <Text
            style={[
              styles.heroChange,
              summary.totalPnl >= 0 ? styles.positive : styles.negative,
            ]}
          >
            {formatSignedCurrency(summary.totalPnl)} · {formatPercent(summary.totalReturnPercent)}
          </Text>
        </LinearGradient>
      ) : (
        <SkeletonBlock height={180} />
      )}

      <View style={styles.metricWrap}>
        {summary ? (
          <>
            <MetricCard label="Buying power" value={formatCurrency(summary.availableCashBalance)} />
            <MetricCard label="Reserved cash" value={formatCurrency(summary.reservedCashBalance)} />
            <MetricCard
              label="Unrealized P&L"
              value={formatSignedCurrency(summary.unrealizedPnl)}
              tone={summary.unrealizedPnl >= 0 ? 'positive' : 'negative'}
            />
            <MetricCard
              label="Realized P&L"
              value={formatSignedCurrency(summary.realizedPnl)}
              tone={summary.realizedPnl >= 0 ? 'positive' : 'negative'}
            />
          </>
        ) : (
          <>
            <SkeletonBlock height={110} />
            <SkeletonBlock height={110} />
          </>
        )}
      </View>

      <PortfolioPerformanceSummary
        range={performanceRange}
        performance={portfolioPerformanceQuery.data}
        loading={portfolioPerformanceQuery.isLoading}
        errorMessage={portfolioPerformanceQuery.isError ? 'Unable to load performance right now.' : null}
        onSelectRange={setPerformanceRange}
      />

      <View style={styles.section}>
        <SectionHeader
          title="Holdings"
          subtitle="Current market value, cost basis, and unrealized performance."
        />

        {portfolioQuery.isLoading ? (
          <>
            <SkeletonBlock height={110} />
            <SkeletonBlock height={110} />
          </>
        ) : portfolioQuery.data?.holdings.length ? (
          portfolioQuery.data.holdings.map((holding) => (
            (() => {
              const marketSession = describeMarketSession(holding.marketSession ?? 'CLOSED');

              return (
                <AppCard key={holding.symbol}>
                  <View style={styles.rowTop}>
                    <View style={styles.flex}>
                      <View style={styles.symbolRow}>
                        <Text
                          onPress={() =>
                            navigation.navigate('StockDetail', {
                              symbol: holding.symbol,
                              companyName: holding.companyName,
                            })
                          }
                          style={styles.symbol}
                        >
                          {holding.symbol}
                        </Text>
                        <MarketSessionBadge session={holding.marketSession ?? 'CLOSED'} />
                      </View>
                      <Text style={styles.company}>{holding.companyName}</Text>
                      {holding.quoteTimestamp ? (
                        <Text style={styles.quoteMeta}>
                          {marketSession.priceLabel} · {formatMarketTimestamp(holding.quoteTimestamp, holding.marketTimezone ?? undefined)}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.valueColumn}>
                      <Text style={styles.value}>{formatCurrency(holding.marketValue)}</Text>
                      <Text
                        style={[
                          styles.pnl,
                          holding.unrealizedPnl >= 0 ? styles.positive : styles.negative,
                        ]}
                      >
                        {formatSignedCurrency(holding.unrealizedPnl)} · {formatPercent(holding.unrealizedPnlPercent)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.holdingStats}>
                    <MetricCard
                      label="Available"
                      value={formatShares(holding.availableQuantity)}
                      style={styles.holdingStatCard}
                      labelStyle={styles.holdingStatLabel}
                      valueStyle={styles.holdingStatValue}
                      valueNumberOfLines={1}
                    />
                    <MetricCard
                      label="Reserved"
                      value={formatShares(holding.reservedQuantity)}
                      style={styles.holdingStatCard}
                      labelStyle={styles.holdingStatLabel}
                      valueStyle={styles.holdingStatValue}
                      valueNumberOfLines={1}
                    />
                    <MetricCard
                      label="Avg cost"
                      value={formatCurrency(holding.averageCost)}
                      style={styles.holdingStatCard}
                      labelStyle={styles.holdingStatLabel}
                      valueStyle={styles.holdingStatValue}
                      valueNumberOfLines={1}
                    />
                    <MetricCard
                      label="Price"
                      value={formatCurrency(holding.currentPrice)}
                      style={styles.holdingStatCard}
                      labelStyle={styles.holdingStatLabel}
                      valueStyle={styles.holdingStatValue}
                      valueNumberOfLines={1}
                    />
                  </View>
                </AppCard>
              );
            })()
          ))
        ) : (
          <EmptyState
            title="No holdings yet"
            description="Buy a stock from the Home or detail screens and it will show up here."
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: appTheme.spacing.md,
  },
  hero: {
    borderRadius: appTheme.radius.lg,
    padding: appTheme.spacing.xl,
    gap: appTheme.spacing.xs,
  },
  heroLabel: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.caption,
    fontWeight: '700',
  },
  heroValue: {
    color: appTheme.colors.textPrimary,
    fontSize: 34,
    fontWeight: '800',
  },
  heroChange: {
    fontSize: appTheme.typography.heading,
    fontWeight: '700',
  },
  metricWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: appTheme.spacing.sm,
  },
  section: {
    gap: appTheme.spacing.md,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: appTheme.spacing.md,
  },
  flex: {
    flex: 1,
    gap: 4,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: appTheme.spacing.sm,
    flexWrap: 'wrap',
  },
  symbol: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.heading,
    fontWeight: '800',
  },
  company: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.caption,
  },
  quoteMeta: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.micro,
  },
  valueColumn: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  value: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.heading,
    fontWeight: '700',
    textAlign: 'right',
  },
  pnl: {
    fontSize: appTheme.typography.caption,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
  },
  holdingStats: {
    flexDirection: 'row',
    gap: appTheme.spacing.sm,
    marginTop: appTheme.spacing.md,
    alignItems: 'stretch',
  },
  holdingStatCard: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: appTheme.spacing.sm,
    paddingVertical: appTheme.spacing.sm,
  },
  holdingStatLabel: {
    fontSize: appTheme.typography.micro,
  },
  holdingStatValue: {
    fontSize: appTheme.typography.body,
    lineHeight: 20,
    fontWeight: '700',
  },
  positive: {
    color: appTheme.colors.positive,
  },
  negative: {
    color: appTheme.colors.negative,
  },
});
