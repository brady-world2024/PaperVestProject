import type {
  ConditionalOrder,
  ConditionalOrderStatus,
} from '../services/api/types';

export function canCancelConditionalOrder(status: ConditionalOrderStatus) {
  return status === 'ACTIVE';
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

export function conditionalOrderStatusTone(status: ConditionalOrderStatus) {
  switch (status) {
    case 'FILLED':
      return 'positive';
    case 'FAILED':
    case 'CANCELLED':
    case 'EXPIRED':
      return 'negative';
    case 'TRIGGERED':
    case 'EXECUTING':
      return 'warning';
    default:
      return 'neutral';
  }
}
