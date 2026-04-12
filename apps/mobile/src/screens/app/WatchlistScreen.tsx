import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { EmptyState } from '../../components/feedback/EmptyState';
import { SkeletonBlock } from '../../components/feedback/SkeletonBlock';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { getWatchlist, removeWatchlistItem } from '../../services/api/papervestApi';
import { liveQuoteRefreshOptions } from '../../services/api/market-data-refresh';
import { queryKeys } from '../../services/api/queryKeys';
import { appTheme } from '../../theme';
import { formatCurrency, formatPercent } from '../../utils/formatters';

export function WatchlistScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const queryClient = useQueryClient();

  const watchlistQuery = useQuery({
    queryKey: queryKeys.watchlist,
    queryFn: getWatchlist,
    ...liveQuoteRefreshOptions,
  });

  const removeMutation = useMutation({
    mutationFn: removeWatchlistItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.watchlist });
    },
  });

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl
          refreshing={watchlistQuery.isRefetching}
          onRefresh={() => {
            void watchlistQuery.refetch();
          }}
        />
      }
      contentStyle={styles.content}
    >
      <SectionHeader
        title="Watchlist"
        subtitle="Save symbols worth monitoring and jump back into details fast."
      />

      {watchlistQuery.isLoading ? (
        <>
          <SkeletonBlock height={110} />
          <SkeletonBlock height={110} />
        </>
      ) : watchlistQuery.data?.items.length ? (
        watchlistQuery.data.items.map((item) => {
          const positive = (item.dailyChange ?? 0) >= 0;
          return (
            <AppCard key={item.symbol}>
              <View style={styles.cardTop}>
                <View style={styles.flex}>
                  <Text
                    onPress={() =>
                      navigation.navigate('StockDetail', {
                        symbol: item.symbol,
                        companyName: item.companyName,
                      })
                    }
                    style={styles.symbol}
                  >
                    {item.symbol}
                  </Text>
                  <Text style={styles.company}>{item.companyName}</Text>
                </View>
                <View style={styles.actionColumn}>
                  <Text style={styles.price}>
                    {item.currentPrice == null ? '...' : formatCurrency(item.currentPrice)}
                  </Text>
                  {item.dailyChange != null && item.dailyChangePercent != null ? (
                    <Text style={[styles.change, positive ? styles.positive : styles.negative]}>
                      {formatCurrency(item.dailyChange)} · {formatPercent(item.dailyChangePercent)}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.actionRow}>
                <AppButton
                  label="Open"
                  onPress={() =>
                    navigation.navigate('StockDetail', {
                      symbol: item.symbol,
                      companyName: item.companyName,
                    })
                  }
                  variant="ghost"
                  style={styles.flexButton}
                />
                <AppButton
                  label="Remove"
                  onPress={() => {
                    void removeMutation.mutateAsync(item.symbol);
                  }}
                  variant="danger"
                  style={styles.flexButton}
                />
              </View>
            </AppCard>
          );
        })
      ) : (
        <EmptyState
          title="No symbols in your watchlist yet"
          description="Add a stock from Home or the detail screen so you can monitor it here."
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: appTheme.spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: appTheme.spacing.md,
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
  actionColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },
  price: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.heading,
    fontWeight: '700',
  },
  change: {
    fontSize: appTheme.typography.caption,
    fontWeight: '700',
  },
  positive: {
    color: appTheme.colors.positive,
  },
  negative: {
    color: appTheme.colors.negative,
  },
  actionRow: {
    flexDirection: 'row',
    gap: appTheme.spacing.sm,
    marginTop: appTheme.spacing.md,
  },
  flexButton: {
    flex: 1,
  },
});
