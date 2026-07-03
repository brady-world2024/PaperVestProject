import { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { InlineNotice } from '../../components/feedback/InlineNotice';
import { SkeletonBlock } from '../../components/feedback/SkeletonBlock';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { MarketSessionBadge } from '../../components/market/MarketSessionBadge';
import { StockHistoryChart } from '../../components/market/StockHistoryChart';
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
import { formatCurrency, formatMarketTimestamp, formatPercent, formatShares, formatSignedCurrency } from '../../utils/formatters';
import { describeMarketSession } from '../../utils/marketSession';
import { getTradeAvailability } from '../../utils/tradeAvailability';

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
  const tradeAvailability = getTradeAvailability(portfolioQuery.data?.summary, holding);
  const isWatchlisted = Boolean(watchlistItem);
  const positive = (quote?.dailyChange ?? 0) >= 0;
  const marketSession = quote ? describeMarketSession(quote.marketSession) : null;
  const tradingBlockedMessage = quote && !quote.tradingEnabled
    ? `${marketSession?.statusLabel} session. Paper trading is only available during regular market hours.`
    : null;

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
            <View style={styles.sessionRow}>
              <MarketSessionBadge session={quote.marketSession} />
              <Text style={styles.sessionCopy}>{marketSession?.priceLabel}</Text>
            </View>
            <Text style={styles.price}>{formatCurrency(quote.currentPrice)}</Text>
            <Text style={[styles.change, positive ? styles.positive : styles.negative]}>
              {formatSignedCurrency(quote.dailyChange)} · {formatPercent(quote.dailyChangePercent)}
            </Text>
            <Text style={styles.heroMeta}>{marketSession?.changeLabel}</Text>
            <Text style={styles.heroMeta}>
              {formatMarketTimestamp(quote.quoteTimestamp, quote.marketTimezone)}
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
            {tradingBlockedMessage ? <InlineNotice message={tradingBlockedMessage} /> : null}
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
            <AppCard style={styles.terminalCard}>
              <View style={styles.terminalHead}>
                <MarketSessionBadge session={quote.marketSession} />
                <Text style={styles.terminalHeadMeta}>
                  {marketSession?.priceLabel} · {formatMarketTimestamp(quote.quoteTimestamp, quote.marketTimezone)}
                </Text>
              </View>
              <View style={styles.terminalGrid}>
                <View style={styles.terminalCell}>
                  <Text style={styles.terminalLabel}>Open</Text>
                  <Text style={styles.terminalValue}>{formatCurrency(quote.openPrice)}</Text>
                </View>
                <View style={styles.terminalCell}>
                  <Text style={styles.terminalLabel}>Previous close</Text>
                  <Text style={styles.terminalValue}>{formatCurrency(quote.previousClose)}</Text>
                </View>
                <View style={styles.terminalCell}>
                  <Text style={styles.terminalLabel}>Session high</Text>
                  <Text style={styles.terminalValue}>{formatCurrency(quote.highPrice)}</Text>
                </View>
                <View style={styles.terminalCell}>
                  <Text style={styles.terminalLabel}>Session low</Text>
                  <Text style={styles.terminalValue}>{formatCurrency(quote.lowPrice)}</Text>
                </View>
                <View style={styles.terminalCell}>
                  <Text style={styles.terminalLabel}>{marketSession?.changeLabel}</Text>
                  <Text style={[styles.terminalValue, positive ? styles.positiveText : styles.negativeText]}>
                    {formatSignedCurrency(quote.dailyChange)}
                  </Text>
                </View>
                <View style={styles.terminalCell}>
                  <Text style={styles.terminalLabel}>Change percent</Text>
                  <Text style={[styles.terminalValue, positive ? styles.positiveText : styles.negativeText]}>
                    {formatPercent(quote.dailyChangePercent)}
                  </Text>
                </View>
              </View>
            </AppCard>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Your position" subtitle="Trade sizing is validated on the backend before execution." />
            <AppCard style={styles.terminalCard}>
              <View style={styles.terminalHead}>
                <View style={styles.positionChip}>
                  <Text style={styles.positionChipText}>{holding ? 'Position live' : 'No position'}</Text>
                </View>
                <Text style={styles.terminalHeadMeta}>
                  Position source · {formatMarketTimestamp(quote.quoteTimestamp, quote.marketTimezone)}
                </Text>
              </View>
              <View style={styles.terminalGrid}>
                <View style={styles.terminalCell}>
                  <Text style={styles.terminalLabel}>Shares owned</Text>
                  <Text style={styles.terminalValue}>{holding ? formatShares(holding.quantity) : '0'}</Text>
                </View>
                <View style={styles.terminalCell}>
                  <Text style={styles.terminalLabel}>Buying power</Text>
                  <Text style={styles.terminalValue}>
                    {formatCurrency(tradeAvailability.availableCashBalance)}
                  </Text>
                </View>
                <View style={styles.terminalCell}>
                  <Text style={styles.terminalLabel}>Shares available</Text>
                  <Text style={styles.terminalValue}>
                    {formatShares(tradeAvailability.availableQuantity)}
                  </Text>
                </View>
                <View style={styles.terminalCell}>
                  <Text style={styles.terminalLabel}>Reserved shares</Text>
                  <Text style={styles.terminalValue}>
                    {formatShares(tradeAvailability.reservedQuantity)}
                  </Text>
                </View>
                <View style={styles.terminalCell}>
                  <Text style={styles.terminalLabel}>Average cost</Text>
                  <Text style={styles.terminalValue}>{holding ? formatCurrency(holding.averageCost) : '$0.00'}</Text>
                </View>
                <View style={styles.terminalCell}>
                  <Text style={styles.terminalLabel}>Market value</Text>
                  <Text style={styles.terminalValue}>{holding ? formatCurrency(holding.marketValue) : '$0.00'}</Text>
                </View>
                <View style={styles.terminalCell}>
                  <Text style={styles.terminalLabel}>Current mark</Text>
                  <Text style={styles.terminalValue}>{formatCurrency(quote.currentPrice)}</Text>
                </View>
                <View style={styles.terminalCell}>
                  <Text style={styles.terminalLabel}>Unrealized P&amp;L</Text>
                  <Text
                    style={[
                      styles.terminalValue,
                      (holding?.unrealizedPnl ?? 0) >= 0 ? styles.positiveText : styles.negativeText,
                    ]}
                  >
                    {holding ? formatSignedCurrency(holding.unrealizedPnl) : '$0.00'}
                  </Text>
                </View>
              </View>
            </AppCard>
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
              disabled={!quote.tradingEnabled}
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
              disabled={!quote.tradingEnabled}
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
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: appTheme.spacing.sm,
    flexWrap: 'wrap',
  },
  sessionCopy: {
    color: appTheme.colors.textInverse,
    opacity: 0.84,
    fontSize: appTheme.typography.caption,
    fontWeight: '700',
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
  heroMeta: {
    color: appTheme.colors.textInverse,
    opacity: 0.78,
    fontSize: appTheme.typography.caption,
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
  terminalCard: {
    gap: appTheme.spacing.md,
  },
  terminalHead: {
    gap: appTheme.spacing.xs,
    paddingBottom: appTheme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E5DBCD',
  },
  terminalHeadMeta: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.micro,
  },
  terminalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: appTheme.spacing.sm,
  },
  terminalCell: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: '#F9F6EE',
    borderRadius: appTheme.radius.md,
    borderWidth: 1,
    borderColor: '#E5DBCD',
    paddingHorizontal: appTheme.spacing.md,
    paddingVertical: appTheme.spacing.sm,
    gap: 4,
  },
  terminalLabel: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.micro,
  },
  terminalValue: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.body,
    fontWeight: '700',
  },
  positiveText: {
    color: appTheme.colors.positive,
  },
  negativeText: {
    color: appTheme.colors.negative,
  },
  positionChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#EDE5D7',
    borderRadius: appTheme.radius.pill,
    paddingHorizontal: appTheme.spacing.sm,
    paddingVertical: 6,
  },
  positionChipText: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.caption,
    fontWeight: '700',
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
