import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { ConditionalOrderComposer } from '../../components/conditional-orders/ConditionalOrderComposer';
import { ConditionalOrderList } from '../../components/conditional-orders/ConditionalOrderList';
import { EmptyState } from '../../components/feedback/EmptyState';
import { InlineNotice } from '../../components/feedback/InlineNotice';
import { SkeletonBlock } from '../../components/feedback/SkeletonBlock';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { MetricCard } from '../../components/portfolio/MetricCard';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { getApiErrorMessage } from '../../services/api/client';
import {
  cancelOrder,
  cancelConditionalOrder,
  createConditionalOrder,
  getConditionalOrders,
  getOrders,
} from '../../services/api/papervestApi';
import { queryKeys } from '../../services/api/queryKeys';
import { appTheme } from '../../theme';
import { formatCurrency, formatDateTime, formatShares } from '../../utils/formatters';
import {
  orderExecutionDetail,
  orderExecutionLabel,
  orderExecutionTone,
} from '../../utils/orderExecution';

type Props = NativeStackScreenProps<AppStackParamList, 'Orders'>;

export function OrdersScreen({ route }: Props) {
  const queryClient = useQueryClient();
  const initialSymbol = route.params?.symbol ?? '';
  const initialSide = route.params?.side ?? 'BUY';

  const ordersQuery = useQuery({
    queryKey: queryKeys.conditionalOrders,
    queryFn: getConditionalOrders,
  });

  const omsOrdersQuery = useQuery({
    queryKey: queryKeys.orders,
    queryFn: getOrders,
  });

  const createMutation = useMutation({
    mutationFn: createConditionalOrder,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelConditionalOrder,
  });

  const cancelOmsOrderMutation = useMutation({
    mutationFn: cancelOrder,
  });

  const orders = ordersQuery.data?.orders ?? [];
  const omsOrders = omsOrdersQuery.data?.orders ?? [];
  const activeCount = orders.filter((order) => order.status === 'ACTIVE').length;
  const pendingCount = orders.filter(
    (order) => order.status === 'TRIGGERED' || order.status === 'EXECUTING'
  ).length;
  const terminalCount = orders.filter(
    (order) =>
      order.status === 'FILLED' ||
      order.status === 'FAILED' ||
      order.status === 'CANCELLED' ||
      order.status === 'EXPIRED'
  ).length;
  const openOmsOrderCount = omsOrders.filter((order) =>
    ['CREATED', 'ACCEPTED', 'PENDING', 'PARTIALLY_FILLED'].includes(order.status)
  ).length;
  const filledOmsOrderCount = omsOrders.filter((order) => order.status === 'FILLED').length;

  const onRefresh = async () => {
    await Promise.all([ordersQuery.refetch(), omsOrdersQuery.refetch()]);
  };

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl
          refreshing={ordersQuery.isRefetching}
          onRefresh={() => {
            void onRefresh();
          }}
        />
      }
      contentStyle={styles.content}
    >
      <View style={styles.section}>
        <SectionHeader
          title="Target-price orders"
          subtitle="Create backend-managed buy or sell orders that wait for your price."
        />
        <ConditionalOrderComposer
          initialSymbol={initialSymbol}
          initialSide={initialSide}
          busy={createMutation.isPending}
          errorMessage={
            createMutation.isError
              ? getApiErrorMessage(createMutation.error, 'Unable to create conditional order')
              : null
          }
          onSubmitOrder={async (payload) => {
            await createMutation.mutateAsync(payload);
            await queryClient.invalidateQueries({ queryKey: queryKeys.conditionalOrders });
          }}
        />
      </View>

      <View style={styles.metricWrap}>
        <MetricCard label="Active" value={String(activeCount)} />
        <MetricCard label="Triggered / executing" value={String(pendingCount)} />
        <MetricCard label="Terminal" value={String(terminalCount)} />
        <MetricCard label="Total" value={String(orders.length)} />
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Order activity"
          subtitle="Market fills and open OMS orders from the backend order trail."
        />
        <View style={styles.metricWrap}>
          <MetricCard label="Open OMS" value={String(openOmsOrderCount)} />
          <MetricCard label="Filled OMS" value={String(filledOmsOrderCount)} />
        </View>
        {omsOrdersQuery.isLoading ? (
          <>
            <SkeletonBlock height={132} />
            <SkeletonBlock height={132} />
          </>
        ) : omsOrdersQuery.isError ? (
          <InlineNotice
            tone="error"
            message={getApiErrorMessage(omsOrdersQuery.error, 'Unable to load order activity')}
          />
        ) : omsOrders.length ? (
          <>
            {cancelOmsOrderMutation.isError ? (
              <InlineNotice
                tone="error"
                message={getApiErrorMessage(cancelOmsOrderMutation.error, 'Unable to cancel OMS order')}
              />
            ) : null}
            {omsOrders.map((order) => (
              <AppCard key={order.id}>
                <View style={styles.orderTop}>
                  <View style={styles.orderMain}>
                    <View style={styles.symbolRow}>
                      <Text style={styles.symbol}>{order.symbol}</Text>
                      <View style={[styles.sidePill, order.side === 'BUY' ? styles.buyPill : styles.sellPill]}>
                        <Text style={styles.sideText}>{order.side}</Text>
                      </View>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusText}>{order.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.company}>{order.companyName}</Text>
                    <Text style={styles.metaLine}>
                      {order.orderType} · {order.timeInForce} · Submitted {formatDateTime(order.submittedAt)}
                    </Text>
                  </View>
                  <View style={styles.valueColumn}>
                    <Text style={styles.value}>{formatShares(order.filledQuantity)}</Text>
                    <Text style={styles.metaLine}>filled</Text>
                  </View>
                </View>
                <View style={styles.detailGrid}>
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Requested</Text>
                    <Text style={styles.detailValue}>{formatShares(order.requestedQuantity)}</Text>
                  </View>
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Gross</Text>
                    <Text style={styles.detailValue}>
                      {order.estimatedGrossAmount == null ? '-' : formatCurrency(order.estimatedGrossAmount)}
                    </Text>
                  </View>
                </View>
                <View style={styles.executionCard}>
                  <View style={styles.executionRow}>
                    <View style={[styles.executionPill, executionToneStyle(orderExecutionTone(order))]}>
                      <Text style={styles.executionText}>{orderExecutionLabel(order)}</Text>
                    </View>
                    <Text style={styles.executionDetail}>{orderExecutionDetail(order)}</Text>
                  </View>
                </View>
                {order.status === 'PENDING' ? (
                  <AppButton
                    label="Cancel order"
                    variant="ghost"
                    loading={cancelOmsOrderMutation.isPending && cancelOmsOrderMutation.variables === order.id}
                    style={styles.cancelButton}
                    onPress={() => {
                      void (async () => {
                        await cancelOmsOrderMutation.mutateAsync(order.id);
                        await Promise.all([
                          queryClient.invalidateQueries({ queryKey: queryKeys.orders }),
                          queryClient.invalidateQueries({ queryKey: queryKeys.portfolio }),
                          queryClient.invalidateQueries({ queryKey: queryKeys.tradeHistory }),
                        ]);
                      })();
                    }}
                  />
                ) : null}
              </AppCard>
            ))}
          </>
        ) : (
          <EmptyState
            title="No OMS orders yet"
            description="Filled and open backend orders will appear here after the first paper trade."
          />
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Conditional orders" />
        {ordersQuery.isLoading ? (
          <>
            <SkeletonBlock height={164} />
            <SkeletonBlock height={164} />
          </>
        ) : ordersQuery.isError ? (
          <InlineNotice
            tone="error"
            message={getApiErrorMessage(ordersQuery.error, 'Unable to load conditional orders')}
          />
        ) : (
          <>
            {cancelMutation.isError ? (
              <InlineNotice
                tone="error"
                message={getApiErrorMessage(cancelMutation.error, 'Unable to cancel conditional order')}
              />
            ) : null}
            <ConditionalOrderList
              orders={orders}
              cancellingOrderId={cancelMutation.isPending ? cancelMutation.variables : null}
              onCancel={(orderId) => {
                void (async () => {
                  await cancelMutation.mutateAsync(orderId);
                  await Promise.all([
                    queryClient.invalidateQueries({ queryKey: queryKeys.conditionalOrders }),
                    queryClient.invalidateQueries({ queryKey: queryKeys.portfolio }),
                    queryClient.invalidateQueries({ queryKey: queryKeys.tradeHistory }),
                  ]);
                })();
              }}
            />
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: appTheme.spacing.md,
  },
  section: {
    gap: appTheme.spacing.md,
  },
  metricWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: appTheme.spacing.sm,
  },
  orderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: appTheme.spacing.md,
    marginBottom: appTheme.spacing.md,
  },
  orderMain: {
    flex: 1,
    gap: 4,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: appTheme.spacing.sm,
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
  metaLine: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.micro,
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
  statusPill: {
    borderRadius: appTheme.radius.pill,
    paddingHorizontal: appTheme.spacing.sm,
    paddingVertical: 6,
    backgroundColor: '#F9F6EE',
  },
  statusText: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.caption,
    fontWeight: '800',
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
  executionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EEE8DC',
    borderRadius: appTheme.radius.md,
    borderWidth: 1,
    marginTop: appTheme.spacing.sm,
    paddingHorizontal: appTheme.spacing.md,
    paddingVertical: appTheme.spacing.sm,
  },
  executionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: appTheme.spacing.sm,
  },
  executionPill: {
    borderRadius: appTheme.radius.pill,
    paddingHorizontal: appTheme.spacing.sm,
    paddingVertical: 6,
  },
  executionText: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.caption,
    fontWeight: '800',
  },
  executionDetail: {
    color: appTheme.colors.textSecondary,
    flexShrink: 1,
    fontSize: appTheme.typography.micro,
  },
  cancelButton: {
    marginTop: appTheme.spacing.md,
  },
});

function executionToneStyle(tone: ReturnType<typeof orderExecutionTone>) {
  switch (tone) {
    case 'positive':
      return { backgroundColor: appTheme.colors.positiveSoft };
    case 'warning':
      return { backgroundColor: '#FFF7D6' };
    case 'danger':
      return { backgroundColor: appTheme.colors.negativeSoft };
    case 'neutral':
      return { backgroundColor: '#F9F6EE' };
  }
}
