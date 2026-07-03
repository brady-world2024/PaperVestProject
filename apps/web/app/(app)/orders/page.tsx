'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  conditionalOrderFormSchema,
  normalizeConditionalOrderNumber,
  type ConditionalOrderFormValues,
} from '@papervest/validation';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppField } from '@/components/app-field';
import { InlineNotice } from '@/components/inline-notice';
import { MetricCard } from '@/components/metric-card';
import { SectionHeader } from '@/components/section-header';
import {
  canCancelConditionalOrder,
  conditionalOrderFailureSummary,
  conditionalOrderStatusTone,
} from '@/lib/conditional-orders/presentation';
import { queryKeys } from '@/lib/query-keys';
import { getConditionalOrderAuditSummary } from '@/lib/trust-audit';
import { webApi } from '@/lib/api';
import { useWorkspaceDensity } from '@/lib/use-workspace-density';
import {
  filterConditionalOrders,
  sortConditionalOrders,
  type OrderFilter,
  type OrderSort,
} from '@/lib/workspace-grids';
import {
  formatCurrency,
  formatDateTime,
  formatShares,
} from '@/lib/formatters';

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const symbolPrefill = searchParams.get('symbol') ?? '';
  const sidePrefill = searchParams.get('side') === 'SELL' ? 'SELL' : 'BUY';
  const submitLockRef = useRef(false);
  const csrfBootstrapRef = useRef<Promise<void> | null>(null);
  const [submitLocked, setSubmitLocked] = useState(false);
  const [csrfReady, setCsrfReady] = useState(false);
  const [csrfBootstrapError, setCsrfBootstrapError] = useState<unknown>(null);
  const [orderSort, setOrderSort] = useState<OrderSort>('latest');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');
  const { density, setDensity } = useWorkspaceDensity('pv-orders-density');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ConditionalOrderFormValues>({
    resolver: zodResolver(conditionalOrderFormSchema),
    defaultValues: {
      symbol: symbolPrefill,
      side: sidePrefill,
      targetPrice: '',
      quantity: '1',
    },
  });

  useEffect(() => {
    if (symbolPrefill) {
      setValue('symbol', symbolPrefill);
    }
    setValue('side', sidePrefill);
  }, [setValue, sidePrefill, symbolPrefill]);

  const refreshCsrfBootstrap = useCallback(async () => {
    setCsrfReady(false);
    setCsrfBootstrapError(null);

    const bootstrapPromise = webApi
      .initializeCsrf()
      .then(() => {
        setCsrfReady(true);
        setCsrfBootstrapError(null);
      })
      .catch((error) => {
        setCsrfBootstrapError(error);
      });

    csrfBootstrapRef.current = bootstrapPromise;
    await bootstrapPromise;
  }, []);

  useEffect(() => {
    void refreshCsrfBootstrap();
  }, [refreshCsrfBootstrap]);

  const ordersQuery = useQuery({
    queryKey: queryKeys.conditionalOrders,
    queryFn: webApi.getConditionalOrders,
  });

  const omsOrdersQuery = useQuery({
    queryKey: queryKeys.orders,
    queryFn: webApi.getOrders,
  });

  const createMutation = useMutation({
    mutationFn: async (values: ConditionalOrderFormValues) => {
      await csrfBootstrapRef.current;
      return webApi.createConditionalOrder({
        symbol: values.symbol.trim().toUpperCase(),
        side: values.side,
        targetPrice: normalizeConditionalOrderNumber(values.targetPrice),
        quantity: normalizeConditionalOrderNumber(values.quantity),
      });
    },
    onSuccess: async (_, values) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.conditionalOrders }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
      ]);
      await refreshCsrfBootstrap();
      reset({
        symbol: values.symbol.trim().toUpperCase(),
        side: values.side,
        targetPrice: '',
        quantity: '1',
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await csrfBootstrapRef.current;
      return webApi.cancelConditionalOrder(orderId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.conditionalOrders }),
        queryClient.invalidateQueries({ queryKey: queryKeys.portfolio }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tradeHistory }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
      ]);
      await refreshCsrfBootstrap();
    },
  });

  const cancelOmsOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await csrfBootstrapRef.current;
      return webApi.cancelOrder(orderId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.orders }),
        queryClient.invalidateQueries({ queryKey: queryKeys.portfolio }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tradeHistory }),
      ]);
      await refreshCsrfBootstrap();
    },
  });

  const orders = ordersQuery.data?.orders ?? [];
  const omsOrders = omsOrdersQuery.data?.orders ?? [];
  const orderAuditSummary = getConditionalOrderAuditSummary(orders);
  const visibleOrders = sortConditionalOrders(filterConditionalOrders(orders, orderFilter), orderSort);
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
  const rejectedOmsOrderCount = omsOrders.filter((order) =>
    ['CANCELLED', 'EXPIRED', 'REJECTED'].includes(order.status)
  ).length;
  const reservedCashTotal = omsOrders.reduce((sum, order) => sum + order.reservedCashAmount, 0);
  const reservedShareTotal = omsOrders.reduce((sum, order) => sum + order.reservedQuantity, 0);
  const selectedSide = watch('side');

  return (
    <main className="pv-page pv-stack">
      <section className="pv-grid two">
        <AppCard className="strong">
          <SectionHeader
            title="Target-price orders"
            subtitle="Create backend-managed buy or sell orders that trigger when price crosses your target."
          />

          <form
            className="pv-stack"
            onSubmit={handleSubmit(async (values) => {
              if (submitLockRef.current) {
                return;
              }

              submitLockRef.current = true;
              setSubmitLocked(true);

              try {
                await createMutation.mutateAsync(values);
              } finally {
                submitLockRef.current = false;
                setSubmitLocked(false);
              }
            })}
          >
            {createMutation.isError ? (
              <InlineNotice
                tone="error"
                message={webApi.getApiErrorMessage(createMutation.error, 'Unable to create conditional order')}
              />
            ) : null}
            {csrfBootstrapError ? (
              <InlineNotice
                tone="error"
                message={webApi.getApiErrorMessage(
                  csrfBootstrapError,
                  'Unable to prepare the order form for secure submissions'
                )}
              />
            ) : null}
            {createMutation.isSuccess ? (
              <InlineNotice tone="info" message="Conditional order created." />
            ) : null}

            <div className="pv-grid two">
              <AppField
                label="Symbol"
                placeholder="AAPL"
                error={errors.symbol?.message}
                {...register('symbol')}
              />

              <div className="pv-field">
                <label>
                  <span>Side</span>
                </label>
                <select className="pv-input" {...register('side')}>
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
            </div>

            <div className="pv-grid two">
              <AppField
                label={selectedSide === 'BUY' ? 'Buy when price is at or below' : 'Sell when price is at or above'}
                placeholder="100.00"
                inputMode="decimal"
                error={errors.targetPrice?.message}
                {...register('targetPrice')}
              />

              <AppField
                label="Quantity"
                placeholder="1"
                inputMode="decimal"
                error={errors.quantity?.message}
                {...register('quantity')}
              />
            </div>

            <AppButton
              loading={createMutation.isPending || submitLocked || !csrfReady}
              disabled={submitLocked || !csrfReady}
              type="submit"
            >
              Create conditional order
            </AppButton>
          </form>
        </AppCard>

        <AppCard>
          <SectionHeader title="Order summary" />
          <div className="pv-dashboard-summary-grid">
            <MetricCard label="Active" value={String(activeCount)} />
            <MetricCard label="Triggered / executing" value={String(pendingCount)} />
            <MetricCard label="Terminal" value={String(terminalCount)} />
            <MetricCard label="Total" value={String(orders.length)} />
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">Execution model</span>
            <strong>Scheduler + RabbitMQ + TradeService</strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">Trigger rule</span>
            <strong>{selectedSide === 'BUY' ? 'Market price <= target' : 'Market price >= target'}</strong>
          </div>
          <div className="pv-trust-grid">
            <div className="pv-trust-card">
              <span className="pv-trust-label">Active execution keys</span>
              <strong className="pv-trust-value">{orderAuditSummary.activeExecutionKeys}</strong>
              <span className="pv-trust-copy">
                Every live automation still carries a concrete backend execution key.
              </span>
            </div>
            <div className="pv-trust-card">
              <span className="pv-trust-label">Monitored symbols</span>
              <strong className="pv-trust-value">{orderAuditSummary.monitoredSymbolsCount}</strong>
              <span className="pv-trust-copy">
                Automation is currently spread across this many tracked names.
              </span>
            </div>
            <div className="pv-trust-card">
              <span className="pv-trust-label">Failed runs</span>
              <strong className="pv-trust-value">{orderAuditSummary.failureCount}</strong>
              <span className="pv-trust-copy">
                Failed automations stay visible instead of disappearing from the audit trail.
              </span>
            </div>
            <div className="pv-trust-card">
              <span className="pv-trust-label">Latest lifecycle write</span>
              <strong className="pv-trust-value">
                {orderAuditSummary.latestLifecycleAt
                  ? formatDateTime(orderAuditSummary.latestLifecycleAt)
                  : 'No lifecycle yet'}
              </strong>
              <span className="pv-trust-copy">
                The newest order state transition stays readable alongside the live blotter.
              </span>
            </div>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">Latest failure code</span>
            <strong>{orderAuditSummary.latestFailureCode ?? 'No failure recorded'}</strong>
          </div>
        </AppCard>
      </section>

      <section className="pv-stack">
        <AppCard>
          <SectionHeader
            title="Order activity"
            subtitle="Market fills and pending OMS state now share one backend order audit trail."
          />
          <div className="pv-dashboard-summary-grid">
            <MetricCard label="Open" value={String(openOmsOrderCount)} />
            <MetricCard label="Filled" value={String(filledOmsOrderCount)} />
            <MetricCard label="Cancelled / rejected" value={String(rejectedOmsOrderCount)} />
            <MetricCard label="Reserved cash" value={formatCurrency(reservedCashTotal)} />
            <MetricCard label="Reserved shares" value={formatShares(reservedShareTotal)} />
          </div>
          {omsOrdersQuery.isLoading ? (
            <div className="pv-subgrid">
              <div className="pv-skeleton" />
              <div className="pv-skeleton" />
            </div>
          ) : omsOrdersQuery.isError ? (
            <InlineNotice
              tone="error"
              message={webApi.getApiErrorMessage(omsOrdersQuery.error, 'Unable to load order activity')}
            />
          ) : !omsOrders.length ? (
            <InlineNotice tone="info" message="No OMS orders yet." />
          ) : (
            <>
              {cancelOmsOrderMutation.isError ? (
                <InlineNotice
                  tone="error"
                  message={webApi.getApiErrorMessage(cancelOmsOrderMutation.error, 'Unable to cancel OMS order')}
                />
              ) : null}
              <div className={`pv-workspace-table seven-column ${density}`}>
                <div className="pv-workspace-header">
                  <span>Order</span>
                  <span>Status</span>
                  <span>Type</span>
                  <span>Filled</span>
                  <span>Gross</span>
                  <span>Submitted</span>
                  <span className="actions">Actions</span>
                </div>
                {omsOrders.map((order) => (
                  <div className={`pv-workspace-row ${density}`} key={order.id}>
                    <div className="pv-workspace-cell primary">
                      <span className="pv-list-symbol-line">
                        <span className="pv-list-symbol">{order.symbol}</span>
                        <span className={`pv-chip ${order.side === 'BUY' ? 'buy' : 'sell'}`}>{order.side}</span>
                        <span className="pv-chip neutral">{order.source}</span>
                      </span>
                      <span className="pv-list-company">
                        {order.companyName} · {order.id}
                      </span>
                      {density === 'comfortable' ? (
                        <span className="pv-list-meta-line">
                          <span>Requested</span>
                          <span>{formatShares(order.requestedQuantity)} shares</span>
                        </span>
                      ) : null}
                    </div>
                    <div className="pv-workspace-cell">
                      <span
                        className={`pv-chip ${
                          order.status === 'FILLED' ? 'positive' : order.status === 'REJECTED' ? 'danger' : 'neutral'
                        }`}
                      >
                        {order.status}
                      </span>
                      <span className="pv-kicker">{order.completedAt ? formatDateTime(order.completedAt) : 'Open'}</span>
                    </div>
                    <div className="pv-workspace-cell">
                      <strong>{order.orderType}</strong>
                      <span className="pv-kicker">{order.timeInForce}</span>
                    </div>
                    <div className="pv-workspace-cell numeric">
                      <strong>{formatShares(order.filledQuantity)}</strong>
                    </div>
                    <div className="pv-workspace-cell numeric">
                      <strong>{order.estimatedGrossAmount == null ? '-' : formatCurrency(order.estimatedGrossAmount)}</strong>
                    </div>
                    <div className="pv-workspace-cell">
                      <span className="pv-kicker">{formatDateTime(order.submittedAt)}</span>
                    </div>
                    <div className="pv-workspace-cell actions">
                      {order.status === 'PENDING' ? (
                        <AppButton
                          variant="ghost"
                          loading={cancelOmsOrderMutation.isPending && cancelOmsOrderMutation.variables === order.id}
                          disabled={!csrfReady}
                          onClick={() => {
                            void cancelOmsOrderMutation.mutateAsync(order.id);
                          }}
                        >
                          Cancel
                        </AppButton>
                      ) : (
                        <span className="pv-kicker">Locked</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </AppCard>
      </section>

      <section className="pv-stack">
        <AppCard>
          <SectionHeader
            title="Conditional orders workspace"
            subtitle="Filter active automation, rank by newest or price level, and scan backend-owned state faster."
          />
          <div className="pv-workspace-toolbar">
            <div className="pv-workspace-toolbar-copy">
              <strong>Order workspace</strong>
              <span>Use density, sort, and state filters to scan conditional orders more like a real blotter.</span>
            </div>
            <div className="pv-workspace-controls">
              <div className="pv-density-toggle">
                <AppButton
                  variant={density === 'comfortable' ? 'secondary' : 'ghost'}
                  className="pv-density-button"
                  onClick={() => setDensity('comfortable')}
                >
                  Comfortable
                </AppButton>
                <AppButton
                  variant={density === 'compact' ? 'secondary' : 'ghost'}
                  className="pv-density-button"
                  onClick={() => setDensity('compact')}
                >
                  Compact
                </AppButton>
              </div>
              <div className="pv-workspace-select-wrap">
                <label className="pv-kicker" htmlFor="order-filter">
                  Filter
                </label>
                <select
                  id="order-filter"
                  className="pv-input pv-workspace-select"
                  value={orderFilter}
                  onChange={(event) => setOrderFilter(event.target.value as OrderFilter)}
                >
                  <option value="all">All orders</option>
                  <option value="active">Active / pending</option>
                  <option value="terminal">Terminal states</option>
                </select>
              </div>
              <div className="pv-workspace-select-wrap">
                <label className="pv-kicker" htmlFor="order-sort">
                  Sort by
                </label>
                <select
                  id="order-sort"
                  className="pv-input pv-workspace-select"
                  value={orderSort}
                  onChange={(event) => setOrderSort(event.target.value as OrderSort)}
                >
                  <option value="latest">Newest created</option>
                  <option value="status">Status</option>
                  <option value="targetPrice">Target price</option>
                  <option value="symbol">Symbol</option>
                </select>
              </div>
            </div>
          </div>
          {ordersQuery.isLoading ? (
            <div className="pv-subgrid">
              <div className="pv-skeleton" />
              <div className="pv-skeleton" />
            </div>
          ) : ordersQuery.isError ? (
            <InlineNotice
              tone="error"
              message={webApi.getApiErrorMessage(ordersQuery.error, 'Unable to load conditional orders')}
            />
          ) : !visibleOrders.length ? (
            <InlineNotice
              tone="info"
              message={
                orderFilter === 'all'
                  ? 'No conditional orders yet.'
                  : `No ${orderFilter === 'active' ? 'active' : 'terminal'} conditional orders match this filter right now.`
              }
            />
          ) : (
            <div className={`pv-workspace-table seven-column ${density}`}>
              <div className="pv-workspace-header">
                <span>Order</span>
                <span>Status</span>
                <span>Target</span>
                <span>Last checked</span>
                <span>Triggered</span>
                <span>Created</span>
                <span className="actions">Actions</span>
              </div>
              {visibleOrders.map((order) => {
                const failureSummary = conditionalOrderFailureSummary(order);
                const tone = conditionalOrderStatusTone(order.status);

                return (
                  <div className={`pv-workspace-row ${density}`} key={order.id}>
                    <div className="pv-workspace-cell primary">
                      <span className="pv-list-symbol-line">
                        <span className="pv-list-symbol">{order.symbol}</span>
                        <span className={`pv-chip ${order.side === 'BUY' ? 'buy' : 'sell'}`}>{order.side}</span>
                        <span className={`pv-chip ${tone}`}>{order.status}</span>
                      </span>
                      <span className="pv-list-company">
                        {formatShares(order.quantity)} shares · Execution key {order.executionKey}
                      </span>
                      {density === 'comfortable' ? (
                        <>
                          <span className="pv-list-meta-line">
                            <span>Trigger</span>
                            <span>{order.side === 'BUY' ? 'Market price <= target' : 'Market price >= target'}</span>
                          </span>
                          <span className="pv-list-meta-line">
                            <span>Version</span>
                            <span>v{order.version} · Updated {formatDateTime(order.updatedAt)}</span>
                          </span>
                          {order.failureCode ? (
                            <span className="pv-list-meta-line">
                              <span>Failure code</span>
                              <span>{order.failureCode}</span>
                            </span>
                          ) : null}
                          {failureSummary ? <span className="pv-kicker">{failureSummary}</span> : null}
                        </>
                      ) : null}
                    </div>
                    <div className="pv-workspace-cell">
                      <span className={`pv-chip ${tone}`}>{order.status}</span>
                    </div>
                    <div className="pv-workspace-cell numeric">
                      <strong>{formatCurrency(order.targetPrice)}</strong>
                    </div>
                    <div className="pv-workspace-cell numeric">
                      <span className="pv-kicker">
                        {order.lastCheckedPrice == null ? 'Not checked yet' : formatCurrency(order.lastCheckedPrice)}
                      </span>
                    </div>
                    <div className="pv-workspace-cell">
                      <span className="pv-kicker">{order.triggeredAt ? formatDateTime(order.triggeredAt) : 'Waiting'}</span>
                    </div>
                    <div className="pv-workspace-cell">
                      <span className="pv-kicker">{formatDateTime(order.createdAt)}</span>
                    </div>
                    <div className="pv-workspace-cell actions">
                      {canCancelConditionalOrder(order.status) ? (
                        <AppButton
                          variant="ghost"
                          loading={cancelMutation.isPending && cancelMutation.variables === order.id}
                          onClick={() => {
                            void cancelMutation.mutateAsync(order.id);
                          }}
                        >
                          Cancel
                        </AppButton>
                      ) : (
                        <span className="pv-kicker">Locked</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AppCard>
      </section>
    </main>
  );
}
