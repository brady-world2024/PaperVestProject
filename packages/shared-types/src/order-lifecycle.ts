import type { Order, OrderStatus } from './index';

export type OmsOrderStatusGroup =
  | 'open'
  | 'filled'
  | 'cancelled'
  | 'expired'
  | 'rejected'
  | 'other';

export type OmsOrderTone = 'neutral' | 'positive' | 'warning' | 'danger';

export type OmsReservationSummary = {
  label: string;
  value: string;
  detail: string;
  active: boolean;
};

export type OmsLifecycleSummaryItem = {
  label: string;
  value: string;
};

export type OrderExecutionTone = OmsOrderTone;

const openStatuses = new Set<OrderStatus>([
  'CREATED',
  'ACCEPTED',
  'PENDING',
  'PARTIALLY_FILLED',
]);

const cancellableStatuses = new Set<OrderStatus>(['PENDING']);

export function getOmsOrderStatusGroup(order: Pick<Order, 'status'>): OmsOrderStatusGroup {
  if (openStatuses.has(order.status)) {
    return 'open';
  }

  switch (order.status) {
    case 'FILLED':
      return 'filled';
    case 'CANCELLED':
      return 'cancelled';
    case 'EXPIRED':
      return 'expired';
    case 'REJECTED':
      return 'rejected';
    default:
      return 'other';
  }
}

export function canCancelOmsOrder(order: Pick<Order, 'status'>) {
  return cancellableStatuses.has(order.status);
}

export function getOmsOrderTone(order: Pick<Order, 'status' | 'execution'>): OmsOrderTone {
  if (order.execution?.status === 'FAILED') {
    return 'danger';
  }

  switch (getOmsOrderStatusGroup(order)) {
    case 'open':
      return 'warning';
    case 'filled':
      return 'positive';
    case 'rejected':
      return 'danger';
    case 'cancelled':
    case 'expired':
    case 'other':
      return 'neutral';
  }
}

export function getOmsOrderHeadline(
  order: Pick<Order, 'status' | 'rejectionMessage' | 'rejectionCode'>
) {
  switch (getOmsOrderStatusGroup(order)) {
    case 'open':
      return order.status === 'PARTIALLY_FILLED'
        ? 'Partially filled, remainder still open'
        : 'Open order awaiting execution';
    case 'filled':
      return 'Order filled';
    case 'cancelled':
      return 'Order cancelled';
    case 'expired':
      return 'Order expired';
    case 'rejected':
      return `Rejected: ${order.rejectionMessage ?? order.rejectionCode ?? 'Order could not be accepted.'}`;
    case 'other':
      return order.status;
  }
}

export function getOmsReservationSummary(
  order: Pick<Order, 'side' | 'status' | 'reservedCashAmount' | 'reservedQuantity'>
): OmsReservationSummary {
  const group = getOmsOrderStatusGroup(order);

  if (group === 'open') {
    if (order.side === 'BUY') {
      return {
        label: 'Reserved cash',
        value: formatCurrency(order.reservedCashAmount),
        detail: 'Held until the order fills, is cancelled, or expires.',
        active: order.reservedCashAmount > 0,
      };
    }

    return {
      label: 'Reserved shares',
      value: formatShares(order.reservedQuantity),
      detail: 'Held until the order fills, is cancelled, or expires.',
      active: order.reservedQuantity > 0,
    };
  }

  if (group === 'filled') {
    return {
      label: 'Reservation',
      value: 'Consumed',
      detail: 'The reservation was consumed by the fill.',
      active: false,
    };
  }

  if (group === 'cancelled' || group === 'expired') {
    return {
      label: 'Reservation',
      value: 'Released',
      detail: 'The held cash or shares were returned to available buying power.',
      active: false,
    };
  }

  if (group === 'rejected') {
    return {
      label: 'Reservation',
      value: 'None',
      detail: 'The order was rejected before an active reservation remained.',
      active: false,
    };
  }

  return {
    label: 'Reservation',
    value: 'Unknown',
    detail: 'Reservation state is not available for this order status.',
    active: false,
  };
}

export function getOmsLifecycleSummary(
  order: Pick<Order, 'submittedAt' | 'acceptedAt' | 'completedAt' | 'cancelledAt' | 'expiresAt'>
): OmsLifecycleSummaryItem[] {
  const items: OmsLifecycleSummaryItem[] = [
    { label: 'Submitted', value: formatDateTime(order.submittedAt) },
  ];

  if (order.acceptedAt) {
    items.push({ label: 'Accepted', value: formatDateTime(order.acceptedAt) });
  }
  if (order.cancelledAt) {
    items.push({ label: 'Cancelled', value: formatDateTime(order.cancelledAt) });
  } else if (order.completedAt) {
    items.push({ label: 'Completed', value: formatDateTime(order.completedAt) });
  } else if (order.expiresAt) {
    items.push({ label: 'Expires', value: formatDateTime(order.expiresAt) });
  }

  return items;
}

export function orderExecutionLabel(order: Pick<Order, 'status' | 'execution'>) {
  if (!order.execution) {
    if (order.status === 'EXPIRED') {
      return 'Expired';
    }
    return order.status === 'PENDING' ? 'Not triggered yet' : 'Immediate fill';
  }

  switch (order.execution.status) {
    case 'PENDING':
      return 'Queued for dispatch';
    case 'PUBLISHED':
      return 'Sent to queue';
    case 'CONSUMED':
      return 'Worker filled';
    case 'CANCELLED':
      return 'Cancelled before fill';
    case 'FAILED':
      return 'Publish failed';
  }
}

export function orderExecutionDetail(order: Pick<Order, 'status' | 'execution'>) {
  if (!order.execution) {
    if (order.status === 'EXPIRED') {
      return 'Reservation released';
    }
    return order.status === 'PENDING' ? 'Waiting for market conditions' : 'No async execution request';
  }

  const execution = order.execution;
  if (execution.lastPublishError) {
    return execution.lastPublishError;
  }
  if (execution.consumedAt) {
    return `Consumed ${formatDateTime(execution.consumedAt)}`;
  }
  if (execution.publishedAt) {
    return `Published ${formatDateTime(execution.publishedAt)}`;
  }
  if (execution.quoteTimestamp) {
    return `Triggered at ${formatDateTime(execution.quoteTimestamp)}`;
  }
  return `Execution attempts ${execution.publishAttemptCount}`;
}

export function orderExecutionTone(order: Pick<Order, 'status' | 'execution'>): OrderExecutionTone {
  if (!order.execution) {
    if (order.status === 'EXPIRED') {
      return 'neutral';
    }
    return order.status === 'PENDING' ? 'neutral' : 'positive';
  }

  switch (order.execution.status) {
    case 'PENDING':
      return 'neutral';
    case 'PUBLISHED':
      return 'warning';
    case 'CONSUMED':
      return 'positive';
    case 'CANCELLED':
      return 'neutral';
    case 'FAILED':
      return 'danger';
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function formatShares(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 4,
  }).format(value ?? 0);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}
