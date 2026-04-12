import { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { SkeletonBlock } from '../../components/feedback/SkeletonBlock';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { StockHistoryChart } from '../../components/market/StockHistoryChart';
import { MetricCard } from '../../components/portfolio/MetricCard';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { getApiErrorMessage } from '../../services/api/client';
import {
  addWatchlistItem,
  getPortfolio,
  getStockDetail,
  getStockHistory,
  getWatchlist,
  removeWatchlistItem,
} from '../../services/api/papervestApi';
import { liveQuoteRefreshOptions } from '../../services/api/market-data-refresh';
import { queryKeys } from '../../services/api/queryKeys';
import { appTheme } from '../../theme';
import { formatCurrency, formatPercent, formatShares, formatSignedCurrency } from '../../utils/formatters';

type Props = NativeStackScreenProps<AppStackParamList, 'StockDetail'>;

export function StockDetailScreen({ navigation, route }: Props) {
  const { symbol, companyName } = route.params;
  const [selectedRange, setSelectedRange] = useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1M');
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: queryKeys.stockDetail(symbol),
    queryFn: () => getStockDetail(symbol),
    ...liveQuoteRefreshOptions,
  });

  const watchlistQuery = useQuery({
    queryKey: queryKeys.watchlist,
    queryFn: getWatchlist,
  });

  const portfolioQuery = useQuery({
    queryKey: queryKeys.portfolio,
    queryFn: getPortfolio,
    ...liveQuoteRefreshOptions,
  });

  const historyQuery = useQuery({
    queryKey: queryKeys.stockHistory(symbol, selectedRange),
    queryFn: () => getStockHistory(symbol, selectedRange),
  });

  const addMutation = useMutation({
    mutationFn: () => addWatchlistItem(symbol, detailQuery.data?.companyName ?? companyName),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.watchlist });
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => removeWatchlistItem(symbol),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.watchlist });
    },
  });

  const quote = detailQuery.data;
  const watchlistItem = watchlistQuery.data?.items.find((item) => item.symbol === symbol);
  const holding = portfolioQuery.data?.holdings.find((item) => item.symbol === symbol);
  const isWatchlisted = Boolean(watchlistItem);
  const positive = (quote?.dailyChange ?? 0) >= 0;

  return (
    <ScreenContainer contentStyle={styles.content}>
      {detailQuery.isLoading || !quote ? (
        <>
          <SkeletonBlock height={180} />
          <SkeletonBlock height={140} />
        </>
      ) : (
        <>
          <AppCard strong style={styles.heroCard}>
            <Text style={styles.symbol}>{quote.symbol}</Text>
            <Text style={styles.company}>{quote.companyName}</Text>
            <Text style={styles.price}>{formatCurrency(quote.currentPrice)}</Text>
            <Text style={[styles.change, positive ? styles.positive : styles.negative]}>
              {formatSignedCurrency(quote.dailyChange)} · {formatPercent(quote.dailyChangePercent)}
            </Text>
            <View style={styles.buttonRow}>
              <AppButton
                label={isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
                onPress={() => {
                  void (isWatchlisted ? removeMutation.mutateAsync() : addMutation.mutateAsync());
                }}
                variant="ghost"
                style={styles.flexButton}
                loading={addMutation.isPending || removeMutation.isPending}
              />
            </View>
          </AppCard>

          <View style={styles.section}>
            <StockHistoryChart
              range={selectedRange}
              history={historyQuery.data}
              loading={historyQuery.isLoading}
              refreshing={historyQuery.isRefetching}
              errorMessage={
                historyQuery.isError
                  ? getApiErrorMessage(historyQuery.error, 'Unable to load price history')
                  : null
              }
              onSelectRange={setSelectedRange}
            />
          </View>

          <View style={styles.section}>
            <SectionHeader title="Session metrics" subtitle="Market snapshot from the backend quote response." />
            <View style={styles.metricWrap}>
              <MetricCard label="Open" value={formatCurrency(quote.openPrice)} />
              <MetricCard label="High" value={formatCurrency(quote.highPrice)} />
              <MetricCard label="Low" value={formatCurrency(quote.lowPrice)} />
              <MetricCard label="Prev Close" value={formatCurrency(quote.previousClose)} />
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Your position" subtitle="Trade sizing is validated on the backend before execution." />
            <View style={styles.metricWrap}>
              <MetricCard
                label="Shares owned"
                value={holding ? formatShares(holding.quantity) : '0'}
              />
              <MetricCard
                label="Avg cost"
                value={holding ? formatCurrency(holding.averageCost) : '$0.00'}
              />
              <MetricCard
                label="Unrealized P&L"
                value={holding ? formatSignedCurrency(holding.unrealizedPnl) : '$0.00'}
                tone={(holding?.unrealizedPnl ?? 0) >= 0 ? 'positive' : 'negative'}
              />
            </View>
          </View>

          <View style={styles.tradeRow}>
            <AppButton
              label="Buy"
              onPress={() =>
                navigation.navigate('TradeTicket', {
                  symbol: quote.symbol,
                  companyName: quote.companyName,
                  side: 'BUY',
                })
              }
              style={styles.flexButton}
            />
            <AppButton
              label="Sell"
              onPress={() =>
                navigation.navigate('TradeTicket', {
                  symbol: quote.symbol,
                  companyName: quote.companyName,
                  side: 'SELL',
                })
              }
              variant="secondary"
              style={styles.flexButton}
            />
          </View>
          <AppButton
            label="Set target order"
            variant="ghost"
            onPress={() =>
              navigation.navigate('Orders', {
                symbol: quote.symbol,
                side: 'BUY',
              })
            }
          />
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: appTheme.spacing.md,
  },
  heroCard: {
    gap: appTheme.spacing.sm,
  },
  symbol: {
    color: appTheme.colors.textInverse,
    fontSize: appTheme.typography.display,
    fontWeight: '800',
  },
  company: {
    color: appTheme.colors.textInverse,
    opacity: 0.82,
    fontSize: appTheme.typography.body,
  },
  price: {
    color: appTheme.colors.textInverse,
    fontSize: 34,
    fontWeight: '800',
  },
  change: {
    fontSize: appTheme.typography.heading,
    fontWeight: '700',
  },
  positive: {
    color: '#9AF0BD',
  },
  negative: {
    color: '#FFD4C8',
  },
  section: {
    gap: appTheme.spacing.md,
  },
  metricWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: appTheme.spacing.sm,
  },
  tradeRow: {
    flexDirection: 'row',
    gap: appTheme.spacing.sm,
  },
  buttonRow: {
    marginTop: appTheme.spacing.sm,
  },
  flexButton: {
    flex: 1,
  },
});
