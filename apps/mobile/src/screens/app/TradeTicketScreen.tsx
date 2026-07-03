import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { Alert, StyleSheet, Text, View } from 'react-native';
import {
  normalizeTradeQuantity,
  tradeFormSchema,
  type TradeFormValues,
} from '@papervest/validation';

import { AppButton } from '../../components/common/AppButton';
import { InlineNotice } from '../../components/feedback/InlineNotice';
import { AppTextField } from '../../components/form/AppTextField';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { MarketSessionBadge } from '../../components/market/MarketSessionBadge';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { getApiErrorMessage } from '../../services/api/client';
import {
  buyStock,
  getPortfolio,
  getStockDetail,
  sellStock,
} from '../../services/api/papervestApi';
import { liveQuoteRefreshOptions } from '../../services/api/market-data-refresh';
import { queryKeys } from '../../services/api/queryKeys';
import { appTheme } from '../../theme';
import { formatCurrency, formatMarketTimestamp, formatShares } from '../../utils/formatters';
import { describeMarketSession } from '../../utils/marketSession';

type Props = NativeStackScreenProps<AppStackParamList, 'TradeTicket'>;

export function TradeTicketScreen({ navigation, route }: Props) {
  const { symbol, companyName, side } = route.params;
  const queryClient = useQueryClient();

  const stockQuery = useQuery({
    queryKey: queryKeys.stockDetail(symbol),
    queryFn: () => getStockDetail(symbol),
    ...liveQuoteRefreshOptions,
  });

  const portfolioQuery = useQuery({
    queryKey: queryKeys.portfolio,
    queryFn: getPortfolio,
  });

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<TradeFormValues>({
    resolver: zodResolver(tradeFormSchema),
    defaultValues: {
      quantity: '1',
    },
  });

  const tradeMutation = useMutation({
    mutationFn: async (payload: { quantity: number }) => {
      const request = {
        symbol,
        companyName,
        quantity: payload.quantity,
      };

      const idempotencyKey = `${side.toLowerCase()}-${symbol}-${Date.now()}`;
      return side === 'BUY'
        ? buyStock(request, idempotencyKey)
        : sellStock(request, idempotencyKey);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.portfolio }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tradeHistory }),
        queryClient.invalidateQueries({ queryKey: queryKeys.orders }),
        queryClient.invalidateQueries({ queryKey: queryKeys.watchlist }),
        queryClient.invalidateQueries({ queryKey: queryKeys.home }),
        queryClient.invalidateQueries({ queryKey: queryKeys.stockDetail(symbol) }),
      ]);
      navigation.goBack();
    },
  });

  const currentPrice = stockQuery.data?.currentPrice ?? 0;
  const quantity = normalizeTradeQuantity(watch('quantity') || '0');
  const estimatedTotal = quantity * currentPrice;
  const holding = portfolioQuery.data?.holdings.find((item) => item.symbol === symbol);
  const cashBalance = portfolioQuery.data?.summary.cashBalance ?? 0;
  const maxSellableQuantity = holding?.quantity ?? 0;
  const marketSession = stockQuery.data ? describeMarketSession(stockQuery.data.marketSession) : null;
  const tradingBlockedMessage = stockQuery.data && !stockQuery.data.tradingEnabled
    ? `${marketSession?.statusLabel} session. Paper trading is only available during regular market hours.`
    : null;

  const onSubmit = handleSubmit(({ quantity: rawQuantity }) => {
    const normalizedQuantity = normalizeTradeQuantity(rawQuantity);

    if (tradingBlockedMessage) {
      Alert.alert('Market closed', tradingBlockedMessage);
      return;
    }

    if (side === 'BUY' && estimatedTotal > cashBalance) {
      Alert.alert('Not enough virtual cash', 'Lower the quantity or choose a less expensive stock.');
      return;
    }

    if (side === 'SELL' && normalizedQuantity > maxSellableQuantity) {
      Alert.alert('Too many shares', 'You cannot sell more shares than you currently own.');
      return;
    }

    Alert.alert(
      `Confirm ${side.toLowerCase()} order`,
      `${side === 'BUY' ? 'Buy' : 'Sell'} ${formatShares(normalizedQuantity)} shares of ${symbol} for an estimated ${formatCurrency(estimatedTotal)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: side === 'BUY' ? 'Buy Shares' : 'Sell Shares',
          style: side === 'BUY' ? 'default' : 'destructive',
          onPress: () => {
            void tradeMutation.mutateAsync({ quantity: normalizedQuantity });
          },
        },
      ]
    );
  });

  return (
    <ScreenContainer contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {side === 'BUY' ? 'Buy' : 'Sell'} {symbol}
        </Text>
        <Text style={styles.subtitle}>
          The backend validates cash, holdings, and records the simulated execution price.
        </Text>
      </View>

      {tradeMutation.isError ? (
        <InlineNotice
          tone="error"
          message={getApiErrorMessage(tradeMutation.error, 'Unable to place trade')}
        />
      ) : null}
      {tradingBlockedMessage ? <InlineNotice message={tradingBlockedMessage} /> : null}

      <View style={styles.summaryCard}>
        {stockQuery.data ? (
          <View style={styles.summarySessionRow}>
            <MarketSessionBadge session={stockQuery.data.marketSession} />
            <Text style={styles.summaryLabel}>{marketSession?.priceLabel}</Text>
          </View>
        ) : (
          <Text style={styles.summaryLabel}>Estimated execution</Text>
        )}
        <Text style={styles.summaryPrice}>{formatCurrency(currentPrice)}</Text>
        <Text style={styles.summaryCaption}>{companyName ?? stockQuery.data?.companyName ?? symbol}</Text>
        {stockQuery.data ? (
          <>
            <Text style={styles.summaryCaption}>{marketSession?.changeLabel}</Text>
            <Text style={styles.summaryCaption}>
              {formatMarketTimestamp(stockQuery.data.quoteTimestamp, stockQuery.data.marketTimezone)}
            </Text>
          </>
        ) : null}
      </View>

      <Controller
        control={control}
        name="quantity"
        render={({ field: { onChange, onBlur, value } }) => (
          <AppTextField
            label="Quantity"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            keyboardType="decimal-pad"
            error={errors.quantity?.message}
            placeholder="1"
          />
        )}
      />

      <View style={styles.infoCard}>
        <InfoRow
          label={side === 'BUY' ? 'Available cash' : 'Shares available'}
          value={
            side === 'BUY'
              ? formatCurrency(cashBalance)
              : formatShares(maxSellableQuantity)
          }
        />
        <InfoRow label="Estimated total" value={formatCurrency(estimatedTotal || 0)} />
      </View>

      <AppButton
        label={side === 'BUY' ? 'Review Buy Order' : 'Review Sell Order'}
        onPress={() => {
          void onSubmit();
        }}
        loading={tradeMutation.isPending}
        disabled={Boolean(tradingBlockedMessage)}
      />
    </ScreenContainer>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: appTheme.spacing.xl,
  },
  header: {
    gap: appTheme.spacing.xs,
  },
  title: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.title,
    fontWeight: '800',
  },
  subtitle: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.body,
    lineHeight: 22,
  },
  summaryCard: {
    borderRadius: appTheme.radius.lg,
    backgroundColor: appTheme.colors.surfaceStrong,
    padding: appTheme.spacing.xl,
    gap: appTheme.spacing.xs,
  },
  summarySessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: appTheme.spacing.sm,
    flexWrap: 'wrap',
  },
  summaryLabel: {
    color: appTheme.colors.textInverse,
    opacity: 0.84,
    fontSize: appTheme.typography.caption,
  },
  summaryPrice: {
    color: appTheme.colors.textInverse,
    fontSize: 34,
    fontWeight: '800',
  },
  summaryCaption: {
    color: appTheme.colors.textInverse,
    opacity: 0.88,
    fontSize: appTheme.typography.caption,
  },
  infoCard: {
    backgroundColor: appTheme.colors.surface,
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    borderRadius: appTheme.radius.md,
    padding: appTheme.spacing.md,
    gap: appTheme.spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.body,
  },
  infoValue: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.body,
    fontWeight: '700',
  },
});
