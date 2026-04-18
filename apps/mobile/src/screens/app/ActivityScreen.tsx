import { useQuery } from '@tanstack/react-query';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '../../components/common/AppCard';
import { EmptyState } from '../../components/feedback/EmptyState';
import { SkeletonBlock } from '../../components/feedback/SkeletonBlock';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { getTradeHistory } from '../../services/api/papervestApi';
import { queryKeys } from '../../services/api/queryKeys';
import { appTheme } from '../../theme';
import {
  formatCurrency,
  formatDateTime,
  formatShares,
  formatSignedCurrency,
} from '../../utils/formatters';

export function ActivityScreen() {
  const historyQuery = useQuery({
    queryKey: queryKeys.tradeHistory,
    queryFn: getTradeHistory,
  });

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl
          refreshing={historyQuery.isRefetching}
          onRefresh={() => {
            void historyQuery.refetch();
          }}
        />
      }
      contentStyle={styles.content}
    >
      <SectionHeader
        title="Trade history"
        subtitle="Every buy and sell is recorded with quantity, executed price, and timestamp."
      />

      {historyQuery.isLoading ? (
        <>
          <SkeletonBlock height={110} />
          <SkeletonBlock height={110} />
        </>
      ) : historyQuery.data?.trades.length ? (
        historyQuery.data.trades.map((trade) => (
          <AppCard key={trade.tradeId}>
            <View style={styles.rowTop}>
              <View style={styles.flex}>
                <View style={styles.symbolRow}>
                  <Text style={styles.symbol}>{trade.symbol}</Text>
                  <View
                    style={[
                      styles.sidePill,
                      trade.side === 'BUY' ? styles.buyPill : styles.sellPill,
                    ]}
                  >
                    <Text style={styles.sideText}>{trade.side}</Text>
                  </View>
                </View>
                <Text style={styles.company}>{trade.companyName}</Text>
                <Text style={styles.metaLine}>
                  {formatShares(trade.quantity)} · {formatDateTime(trade.executedAt)}
                </Text>
              </View>
              <View style={styles.valueColumn}>
                <Text style={styles.value}>{formatCurrency(trade.executedPrice)}</Text>
                <Text
                  style={[
                    styles.change,
                    trade.realizedPnl >= 0 ? styles.positive : styles.negative,
                  ]}
                >
                  {formatSignedCurrency(trade.realizedPnl)}
                </Text>
              </View>
            </View>

            <View style={styles.detailGrid}>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Gross amount</Text>
                <Text style={styles.detailValue}>{formatCurrency(trade.grossAmount)}</Text>
              </View>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Cash after trade</Text>
                <Text style={styles.detailValue}>{formatCurrency(trade.cashBalanceAfterTrade)}</Text>
              </View>
            </View>
          </AppCard>
        ))
      ) : (
        <EmptyState
          title="No trades yet"
          description="Your buys and sells will appear here once you place your first paper order."
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: appTheme.spacing.md,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: appTheme.spacing.md,
    marginBottom: appTheme.spacing.md,
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
  sidePill: {
    borderRadius: appTheme.radius.pill,
    paddingHorizontal: appTheme.spacing.sm,
    paddingVertical: 6,
  },
  buyPill: {
    backgroundColor: appTheme.colors.positiveSoft,
  },
  sellPill: {
    backgroundColor: appTheme.colors.negativeSoft,
  },
  sideText: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.caption,
    fontWeight: '800',
  },
  metaLine: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.micro,
  },
  valueColumn: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 1,
  },
  value: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.heading,
    fontWeight: '700',
    textAlign: 'right',
  },
  change: {
    fontSize: appTheme.typography.caption,
    fontWeight: '700',
    textAlign: 'right',
  },
  positive: {
    color: appTheme.colors.positive,
  },
  negative: {
    color: appTheme.colors.negative,
  },
  detailGrid: {
    flexDirection: 'row',
    gap: appTheme.spacing.sm,
    marginTop: appTheme.spacing.md,
  },
  detailCard: {
    flex: 1,
    backgroundColor: '#F9F6EE',
    borderRadius: appTheme.radius.md,
    paddingHorizontal: appTheme.spacing.md,
    paddingVertical: appTheme.spacing.sm,
    gap: 4,
  },
  detailLabel: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.micro,
  },
  detailValue: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.body,
    fontWeight: '700',
  },
});
