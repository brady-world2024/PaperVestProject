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
import { ConditionalOrderList } from '@/components/conditional-orders/conditional-order-list';
import { InlineNotice } from '@/components/inline-notice';
import { MetricCard } from '@/components/metric-card';
import { SectionHeader } from '@/components/section-header';
import { queryKeys } from '@/lib/query-keys';
import { webApi } from '@/lib/api';

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
      await queryClient.invalidateQueries({ queryKey: queryKeys.conditionalOrders });
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
      ]);
      await refreshCsrfBootstrap();
    },
  });

  const orders = ordersQuery.data?.orders ?? [];
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
        </AppCard>
      </section>

      <section className="pv-stack">
        <AppCard>
          <SectionHeader title="Conditional orders" />
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
          ) : (
            <ConditionalOrderList
              orders={orders}
              cancellingOrderId={cancelMutation.isPending ? cancelMutation.variables : null}
              onCancel={(orderId) => {
                void cancelMutation.mutateAsync(orderId);
              }}
            />
          )}
        </AppCard>
      </section>
    </main>
  );
}
