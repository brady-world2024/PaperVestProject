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
import { formatCurrency, formatDateTime, formatShares } from '../../utils/formatters';

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
                <Text style={styles.symbol}>{trade.symbol}</Text>
                <Text style={styles.company}>{trade.companyName}</Text>
              </View>
              <View
                style={[
                  styles.sidePill,
                  trade.side === 'BUY' ? styles.buyPill : styles.sellPill,
                ]}
              >
                <Text style={styles.sideText}>{trade.side}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Quantity</Text>
              <Text style={styles.infoValue}>{formatShares(trade.quantity)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Executed price</Text>
              <Text style={styles.infoValue}>{formatCurrency(trade.executedPrice)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Gross amount</Text>
              <Text style={styles.infoValue}>{formatCurrency(trade.grossAmount)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Time</Text>
              <Text style={styles.infoValue}>{formatDateTime(trade.executedAt)}</Text>
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: appTheme.spacing.xs,
  },
  infoLabel: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.body,
  },
  infoValue: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.body,
    fontWeight: '600',
  },
});
