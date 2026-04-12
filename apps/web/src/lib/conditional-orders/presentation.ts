import type {
  ConditionalOrder,
  ConditionalOrderStatus,
} from '@papervest/shared-types';

export function canCancelConditionalOrder(status: ConditionalOrderStatus) {
  return status === 'ACTIVE';
}

export function conditionalOrderStatusTone(status: ConditionalOrderStatus) {
  switch (status) {
    case 'FILLED':
      return 'positive';
    case 'FAILED':
    case 'CANCELLED':
    case 'EXPIRED':
      return 'negative';
    default:
      return 'neutral';
  }
}

export function conditionalOrderFailureSummary(order: ConditionalOrder) {
  if (!order.failureCode && !order.failureMessage) {
    return null;
  }
  if (order.failureCode && order.failureMessage) {
    return `${order.failureCode}: ${order.failureMessage}`;
  }
  return order.failureMessage ?? order.failureCode ?? null;
}
