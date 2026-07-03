import type { Order } from '@papervest/shared-types';

import { formatDateTime } from '../formatters';

export type OrderExecutionTone = 'neutral' | 'positive' | 'warning' | 'danger';

export function orderExecutionLabel(order: Order) {
  if (!order.execution) {
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

export function orderExecutionDetail(order: Order) {
  if (!order.execution) {
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

export function orderExecutionTone(order: Order): OrderExecutionTone {
  if (!order.execution) {
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
