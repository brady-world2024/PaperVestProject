import { getOmsOrderStatusGroup } from '@papervest/shared-types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { ConditionalOrderComposer } from '../../components/conditional-orders/ConditionalOrderComposer';
import { ConditionalOrderList } from '../../components/conditional-orders/ConditionalOrderList';
import { EmptyState } from '../../components/feedback/EmptyState';
import { InlineNotice } from '../../components/feedback/InlineNotice';
import { SkeletonBlock } from '../../components/feedback/SkeletonBlock';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { OmsOrderCard } from '../../components/orders/OmsOrderCard';
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
import { formatCurrency, formatShares } from '../../utils/formatters';

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
  const openOmsOrderCount = omsOrders.filter((order) => getOmsOrderStatusGroup(order) === 'open').length;
  const filledOmsOrderCount = omsOrders.filter((order) => getOmsOrderStatusGroup(order) === 'filled').length;
  const terminalOmsOrderCount = omsOrders.filter((order) =>
    ['filled', 'cancelled', 'expired', 'rejected'].includes(getOmsOrderStatusGroup(order))
  ).length;
  const reservedCashTotal = omsOrders.reduce(
    (total, order) => total + (getOmsOrderStatusGroup(order) === 'open' ? order.reservedCashAmount : 0),
    0
  );
  const reservedShareTotal = omsOrders.reduce(
    (total, order) => total + (getOmsOrderStatusGroup(order) === 'open' ? order.reservedQuantity : 0),
    0
  );

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
          <MetricCard label="Terminal OMS" value={String(terminalOmsOrderCount)} />
          <MetricCard label="Reserved cash" value={formatCurrency(reservedCashTotal)} />
          <MetricCard label="Reserved shares" value={formatShares(reservedShareTotal)} />
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
              <OmsOrderCard
                key={order.id}
                order={order}
                cancelling={cancelOmsOrderMutation.isPending && cancelOmsOrderMutation.variables === order.id}
                onCancel={(orderId) => {
                  void (async () => {
                    await cancelOmsOrderMutation.mutateAsync(orderId);
                    await Promise.all([
                      queryClient.invalidateQueries({ queryKey: queryKeys.orders }),
                      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio }),
                      queryClient.invalidateQueries({ queryKey: queryKeys.tradeHistory }),
                    ]);
                  })();
                }}
              />
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
});
