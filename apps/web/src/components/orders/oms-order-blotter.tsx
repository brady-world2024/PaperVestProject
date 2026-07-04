'use client';

import { useMemo, useState } from 'react';
import type { Order } from '@papervest/shared-types';
import {
  canCancelOmsOrder,
  getOmsLifecycleSummary,
  getOmsOrderHeadline,
  getOmsOrderStatusGroup,
  getOmsOrderTone,
  getOmsReservationSummary,
  orderExecutionDetail,
  orderExecutionLabel,
  orderExecutionTone,
  type OmsOrderStatusGroup,
} from '@papervest/shared-types';

import { AppButton } from '../app-button';
import { AppCard } from '../app-card';
import { InlineNotice } from '../inline-notice';
import { MetricCard } from '../metric-card';
import { SectionHeader } from '../section-header';
import { formatCurrency, formatShares } from '../../lib/formatters';
import type { WorkspaceDensity } from '../../lib/use-workspace-density';

type Props = {
  orders: Order[];
  density: WorkspaceDensity;
  loading: boolean;
  loadErrorMessage: string | null;
  cancelErrorMessage: string | null;
  cancellingOrderId: string | null;
  csrfReady: boolean;
  onCancel: (orderId: string) => void;
};

type Filter = 'all' | OmsOrderStatusGroup | 'terminal';
type Sort = 'latest' | 'status' | 'symbol' | 'reservation';

export function OmsOrderBlotter({
  orders,
  density,
  loading,
  loadErrorMessage,
  cancelErrorMessage,
  cancellingOrderId,
  csrfReady,
  onCancel,
}: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('latest');
  const openOrders = orders.filter((order) => getOmsOrderStatusGroup(order) === 'open');
  const filledOrders = orders.filter((order) => getOmsOrderStatusGroup(order) === 'filled');
  const terminalOrders = orders.filter((order) =>
    ['filled', 'cancelled', 'expired', 'rejected'].includes(getOmsOrderStatusGroup(order))
  );
  const reservedCashTotal = openOrders.reduce((sum, order) => sum + order.reservedCashAmount, 0);
  const reservedShareTotal = openOrders.reduce((sum, order) => sum + order.reservedQuantity, 0);

  const visibleOrders = useMemo(
    () => sortOmsOrders(filterOmsOrders(orders, filter), sort),
    [filter, orders, sort]
  );

  return (
    <section className="pv-stack">
      <AppCard>
        <SectionHeader
          title="Order activity"
          subtitle="Follow OMS state from submission through reservation, execution, cancellation, expiration, or rejection."
        />
        <div className="pv-dashboard-summary-grid">
          <MetricCard label="Open" value={String(openOrders.length)} />
          <MetricCard label="Filled" value={String(filledOrders.length)} />
          <MetricCard label="Terminal" value={String(terminalOrders.length)} />
          <MetricCard label="Reserved cash" value={formatCurrency(reservedCashTotal)} />
          <MetricCard label="Reserved shares" value={formatShares(reservedShareTotal)} />
        </div>

        <div className="pv-workspace-toolbar">
          <div className="pv-workspace-toolbar-copy">
            <strong>OMS blotter</strong>
            <span>Scan lifecycle state, active reservations, and async worker progress from one order trail.</span>
          </div>
          <div className="pv-workspace-controls">
            <div className="pv-workspace-select-wrap">
              <label className="pv-kicker" htmlFor="oms-filter">
                Filter
              </label>
              <select
                id="oms-filter"
                className="pv-input pv-workspace-select"
                value={filter}
                onChange={(event) => setFilter(event.target.value as Filter)}
              >
                <option value="all">All orders</option>
                <option value="open">Open</option>
                <option value="filled">Filled</option>
                <option value="terminal">Terminal</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="pv-workspace-select-wrap">
              <label className="pv-kicker" htmlFor="oms-sort">
                Sort by
              </label>
              <select
                id="oms-sort"
                className="pv-input pv-workspace-select"
                value={sort}
                onChange={(event) => setSort(event.target.value as Sort)}
              >
                <option value="latest">Latest update</option>
                <option value="status">Status</option>
                <option value="symbol">Symbol</option>
                <option value="reservation">Reservation</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="pv-subgrid">
            <div className="pv-skeleton" />
            <div className="pv-skeleton" />
          </div>
        ) : loadErrorMessage ? (
          <InlineNotice tone="error" message={loadErrorMessage} />
        ) : !visibleOrders.length ? (
          <InlineNotice tone="info" message="No OMS orders match this view." />
        ) : (
          <>
            {cancelErrorMessage ? <InlineNotice tone="error" message={cancelErrorMessage} /> : null}
            <div className={`pv-workspace-table eight-column ${density}`}>
              <div className="pv-workspace-header">
                <span>Order</span>
                <span>Status</span>
                <span>Type</span>
                <span>Execution</span>
                <span>Filled</span>
                <span>Reservation</span>
                <span>Lifecycle</span>
                <span className="actions">Actions</span>
              </div>
              {visibleOrders.map((order) => (
                <OmsOrderRow
                  key={order.id}
                  order={order}
                  density={density}
                  cancelling={cancellingOrderId === order.id}
                  csrfReady={csrfReady}
                  onCancel={onCancel}
                />
              ))}
            </div>
          </>
        )}
      </AppCard>
    </section>
  );
}

export function OmsOrderRow({
  order,
  density,
  cancelling,
  csrfReady,
  onCancel,
}: {
  order: Order;
  density: WorkspaceDensity;
  cancelling: boolean;
  csrfReady: boolean;
  onCancel: (orderId: string) => void;
}) {
  const statusTone = getOmsOrderTone(order);
  const reservation = getOmsReservationSummary(order);
  const lifecycle = getOmsLifecycleSummary(order);

  return (
    <div className={`pv-workspace-row ${density}`}>
      <div className="pv-workspace-cell primary">
        <span className="pv-list-symbol-line">
          <span className="pv-list-symbol">{order.symbol}</span>
          <span className={`pv-chip ${order.side === 'BUY' ? 'buy' : 'sell'}`}>{order.side}</span>
          <span className="pv-chip neutral">{order.source}</span>
        </span>
        <span className="pv-list-company">
          {order.companyName} · {order.id.slice(0, 8)}
        </span>
        {density === 'comfortable' ? (
          <span className="pv-list-meta-line">
            <span>Requested</span>
            <span>{formatShares(order.requestedQuantity)} shares</span>
          </span>
        ) : null}
      </div>
      <div className="pv-workspace-cell">
        <span className={`pv-chip ${statusTone}`}>{order.status}</span>
        <span className="pv-kicker">{getOmsOrderHeadline(order)}</span>
      </div>
      <div className="pv-workspace-cell">
        <strong>{order.orderType}</strong>
        <span className="pv-kicker">{order.timeInForce}</span>
      </div>
      <div className="pv-workspace-cell">
        <span className={`pv-chip ${orderExecutionTone(order)}`}>{orderExecutionLabel(order)}</span>
        <span className="pv-kicker">{orderExecutionDetail(order)}</span>
      </div>
      <div className="pv-workspace-cell numeric">
        <strong>{formatShares(order.filledQuantity)}</strong>
        <span className="pv-kicker">of {formatShares(order.requestedQuantity)}</span>
      </div>
      <div className="pv-workspace-cell">
        <strong>{reservation.value}</strong>
        <span className="pv-kicker">{reservation.label}</span>
        {density === 'comfortable' ? <span className="pv-kicker">{reservation.detail}</span> : null}
      </div>
      <div className="pv-workspace-cell">
        {lifecycle.map((item) => (
          <span key={`${order.id}-${item.label}`} className="pv-kicker">
            {item.label}: {item.value}
          </span>
        ))}
      </div>
      <div className="pv-workspace-cell actions">
        {canCancelOmsOrder(order) ? (
          <AppButton
            variant="ghost"
            loading={cancelling}
            disabled={!csrfReady}
            onClick={() => onCancel(order.id)}
          >
            Cancel
          </AppButton>
        ) : (
          <span className="pv-kicker">Locked</span>
        )}
      </div>
    </div>
  );
}

function filterOmsOrders(orders: Order[], filter: Filter) {
  if (filter === 'all') {
    return orders;
  }
  if (filter === 'terminal') {
    return orders.filter((order) =>
      ['filled', 'cancelled', 'expired', 'rejected'].includes(getOmsOrderStatusGroup(order))
    );
  }
  return orders.filter((order) => getOmsOrderStatusGroup(order) === filter);
}

function sortOmsOrders(orders: Order[], sort: Sort) {
  const copy = [...orders];

  switch (sort) {
    case 'status':
      return copy.sort((left, right) => left.status.localeCompare(right.status) || compareDates(right.updatedAt, left.updatedAt));
    case 'symbol':
      return copy.sort((left, right) => left.symbol.localeCompare(right.symbol) || compareDates(right.updatedAt, left.updatedAt));
    case 'reservation':
      return copy.sort((left, right) => reservationAmount(right) - reservationAmount(left));
    case 'latest':
    default:
      return copy.sort((left, right) => compareDates(right.updatedAt, left.updatedAt));
  }
}

function reservationAmount(order: Order) {
  return order.reservedCashAmount + order.reservedQuantity;
}

function compareDates(left: string | null, right: string | null) {
  return toEpoch(left) - toEpoch(right);
}

function toEpoch(value: string | null) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }
  return new Date(value).getTime();
}
