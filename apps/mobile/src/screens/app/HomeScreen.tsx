import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useDeferredValue, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';

import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { SkeletonBlock } from '../../components/feedback/SkeletonBlock';
import { AppTextField } from '../../components/form/AppTextField';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { QuoteRow } from '../../components/market/QuoteRow';
import { MetricCard } from '../../components/portfolio/MetricCard';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { getHomeMarket, getPortfolio, searchStocks } from '../../services/api/papervestApi';
import { liveQuoteRefreshOptions } from '../../services/api/market-data-refresh';
import { queryKeys } from '../../services/api/queryKeys';
import { StockSearchResult } from '../../services/api/types';
import { appTheme } from '../../theme';
import { formatCurrency, formatPercent, formatSignedCurrency } from '../../utils/formatters';

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [searchText, setSearchText] = useState('');
  const deferredSearch = useDeferredValue(searchText.trim());

  const homeQuery = useQuery({
    queryKey: queryKeys.home,
    queryFn: getHomeMarket,
    ...liveQuoteRefreshOptions,
  });

  const portfolioQuery = useQuery({
    queryKey: queryKeys.portfolio,
    queryFn: getPortfolio,
    ...liveQuoteRefreshOptions,
  });

  const searchQuery = useQuery({
    queryKey: queryKeys.stockSearch(deferredSearch),
    queryFn: () => searchStocks(deferredSearch),
    enabled: deferredSearch.length > 0,
  });

  const refreshing = homeQuery.isRefetching || portfolioQuery.isRefetching;
  const searchResults = useMemo(
    () => searchQuery.data?.results ?? [],
    [searchQuery.data]
  );

  const onRefresh = async () => {
    await Promise.all([homeQuery.refetch(), portfolioQuery.refetch()]);
    if (deferredSearch.length > 0) {
      await searchQuery.refetch();
    }
  };

  return (
    <ScreenContainer
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>Market Board</Text>
        <Text style={styles.title}>Practice with live-backed quotes and a portfolio that updates like a real product.</Text>
        <View style={styles.headerActions}>
          <AppButton
            label="Target Orders"
            variant="ghost"
            onPress={() => navigation.navigate('Orders')}
          />
        </View>
      </View>

      <LinearGradient
        colors={['#153249', '#215B5A', '#4CA28F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroLabel}>Portfolio snapshot</Text>
        <Text style={styles.heroValue}>
          {portfolioQuery.data
            ? formatCurrency(portfolioQuery.data.summary.totalPortfolioValue)
            : '...'}
        </Text>
        <View style={styles.metricGrid}>
          <MetricCard
            label="Today's move"
            value={
              portfolioQuery.data
                ? formatSignedCurrency(portfolioQuery.data.summary.dailyChange)
                : '...'
            }
            tone={
              (portfolioQuery.data?.summary.dailyChange ?? 0) >= 0 ? 'positive' : 'negative'
            }
          />
          <MetricCard
            label="Total return"
            value={
              portfolioQuery.data
                ? formatPercent(portfolioQuery.data.summary.totalReturnPercent)
                : '...'
            }
            tone={
              (portfolioQuery.data?.summary.totalReturnPercent ?? 0) >= 0
                ? 'positive'
                : 'negative'
            }
          />
        </View>
      </LinearGradient>

      <AppTextField
        label="Search symbols or company names"
        value={searchText}
        onChangeText={setSearchText}
        placeholder="AAPL, Apple, NVIDIA..."
        autoCapitalize="characters"
      />

      {deferredSearch.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            title="Search results"
            subtitle="Jump straight into a stock detail view."
          />
          {searchQuery.isLoading ? (
            <>
              <SkeletonBlock height={82} />
              <SkeletonBlock height={82} />
            </>
          ) : searchResults.length === 0 ? (
            <EmptyState
              title="No symbols matched that search"
              description="Try a ticker like AAPL or a company name like Microsoft."
            />
          ) : (
            searchResults.map((result) => (
              <SearchResultCard
                key={result.symbol}
                result={result}
                onPress={() =>
                  navigation.navigate('StockDetail', {
                    symbol: result.symbol,
                    companyName: result.companyName,
                  })
                }
              />
            ))
          )}
        </View>
      ) : (
        <View style={styles.section}>
          <SectionHeader
            title="Major US names"
            subtitle="A quick pulse check on the stocks most users track first."
          />
          {homeQuery.isLoading
            ? [0, 1, 2].map((key) => <SkeletonBlock key={key} height={82} />)
            : homeQuery.data?.quotes.map((quote) => (
                <QuoteRow
                  key={quote.symbol}
                  quote={quote}
                  onPress={() =>
                    navigation.navigate('StockDetail', {
                      symbol: quote.symbol,
                      companyName: quote.companyName,
                    })
                  }
                />
              ))}
        </View>
      )}
    </ScreenContainer>
  );
}

function SearchResultCard({
  result,
  onPress,
}: {
  result: StockSearchResult;
  onPress: () => void;
}) {
  return (
    <AppCard>
      <Text onPress={onPress} style={styles.searchSymbol}>
        {result.symbol}
      </Text>
      <Text onPress={onPress} style={styles.searchCompany}>
        {result.companyName}
      </Text>
      <Text onPress={onPress} style={styles.searchType}>
        {result.type}
      </Text>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: appTheme.spacing.md,
  },
  header: {
    gap: appTheme.spacing.xs,
  },
  kicker: {
    color: appTheme.colors.accent,
    fontSize: appTheme.typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.title,
    lineHeight: 30,
    fontWeight: '800',
  },
  headerActions: {
    alignItems: 'flex-start',
    marginTop: appTheme.spacing.xs,
  },
  hero: {
    borderRadius: appTheme.radius.lg,
    padding: appTheme.spacing.xl,
    gap: appTheme.spacing.md,
  },
  heroLabel: {
    color: appTheme.colors.textInverse,
    fontSize: appTheme.typography.caption,
    opacity: 0.85,
  },
  heroValue: {
    color: appTheme.colors.textInverse,
    fontSize: 34,
    fontWeight: '800',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: appTheme.spacing.sm,
  },
  section: {
    gap: appTheme.spacing.md,
  },
  searchSymbol: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.heading,
    fontWeight: '800',
  },
  searchCompany: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.body,
    fontWeight: '600',
    marginTop: 6,
  },
  searchType: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.caption,
    marginTop: 4,
  },
});
