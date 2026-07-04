import assert from 'node:assert/strict';
import test from 'node:test';

import type { Order, OrderExecutionSummary, OrderStatus } from '@papervest/shared-types';
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
} from '@papervest/shared-types';

const baseOrder: Order = {
  id: 'order-1',
  symbol: 'AAPL',
  companyName: 'Apple Inc.',
  side: 'BUY',
  orderType: 'LIMIT',
  timeInForce: 'DAY',
  status: 'PENDING',
  source: 'USER',
  sourceRefId: null,
  requestedQuantity: 2,
  filledQuantity: 0,
  limitPrice: 101,
  stopPrice: null,
  estimatedGrossAmount: 202,
  reservedCashAmount: 202,
  reservedQuantity: 0,
  rejectionCode: null,
  rejectionMessage: null,
  submittedAt: '2026-07-03T15:00:00Z',
  acceptedAt: '2026-07-03T15:00:01Z',
  completedAt: null,
  cancelledAt: null,
  expiresAt: '2026-07-03T20:00:00Z',
  createdAt: '2026-07-03T15:00:00Z',
  updatedAt: '2026-07-03T15:00:02Z',
  execution: null,
};

function executionWith(overrides: Partial<OrderExecutionSummary>): OrderExecutionSummary {
  return {
    id: 'execution-1',
    status: 'PENDING',
    triggerPrice: 100,
    executionPrice: 100,
    quoteTimestamp: null,
    publishedAt: null,
    consumedAt: null,
    lastPublishError: null,
    publishAttemptCount: 1,
    createdAt: '2026-07-03T15:00:02Z',
    updatedAt: '2026-07-03T15:00:03Z',
    ...overrides,
  };
}

test('open buy order shows active cash reservation and can be cancelled', () => {
  assert.equal(getOmsOrderStatusGroup(baseOrder), 'open');
  assert.equal(canCancelOmsOrder(baseOrder), true);
  assert.equal(getOmsOrderTone(baseOrder), 'warning');
  assert.equal(getOmsOrderHeadline(baseOrder), 'Open order awaiting execution');
  assert.deepEqual(getOmsReservationSummary(baseOrder), {
    label: 'Reserved cash',
    value: '$202.00',
    detail: 'Held until the order fills, is cancelled, or expires.',
    active: true,
  });
});

test('created, accepted, pending, and partial statuses are open but only pending can be cancelled', () => {
  const expectations: Array<{ status: OrderStatus; cancellable: boolean }> = [
    { status: 'CREATED', cancellable: false },
    { status: 'ACCEPTED', cancellable: false },
    { status: 'PENDING', cancellable: true },
    { status: 'PARTIALLY_FILLED', cancellable: false },
  ];

  for (const expectation of expectations) {
    const order: Order = {
      ...baseOrder,
      status: expectation.status,
    };

    assert.equal(getOmsOrderStatusGroup(order), 'open');
    assert.equal(canCancelOmsOrder(order), expectation.cancellable);
  }

  assert.equal(
    getOmsOrderHeadline({ ...baseOrder, status: 'PARTIALLY_FILLED' }),
    'Partially filled, remainder still open'
  );
});

test('open sell order shows active share reservation', () => {
  const sellOrder: Order = {
    ...baseOrder,
    id: 'order-2',
    side: 'SELL',
    reservedCashAmount: 0,
    reservedQuantity: 1.5,
  };

  assert.deepEqual(getOmsReservationSummary(sellOrder), {
    label: 'Reserved shares',
    value: '1.5',
    detail: 'Held until the order fills, is cancelled, or expires.',
    active: true,
  });
});

test('filled order is terminal, positive, and consumes reservation', () => {
  const filledOrder: Order = {
    ...baseOrder,
    status: 'FILLED',
    filledQuantity: 2,
    reservedCashAmount: 0,
    completedAt: '2026-07-03T15:00:04Z',
  };

  assert.equal(getOmsOrderStatusGroup(filledOrder), 'filled');
  assert.equal(canCancelOmsOrder(filledOrder), false);
  assert.equal(getOmsOrderTone(filledOrder), 'positive');
  assert.equal(getOmsOrderHeadline(filledOrder), 'Order filled');
  assert.equal(getOmsReservationSummary(filledOrder).value, 'Consumed');
});

test('cancelled and expired orders show released reservation', () => {
  const cancelledOrder: Order = {
    ...baseOrder,
    status: 'CANCELLED',
    reservedCashAmount: 0,
    cancelledAt: '2026-07-03T16:00:00Z',
    completedAt: '2026-07-03T16:00:00Z',
  };
  const expiredOrder: Order = {
    ...baseOrder,
    status: 'EXPIRED',
    reservedCashAmount: 0,
    completedAt: '2026-07-03T20:00:00Z',
  };

  assert.equal(getOmsOrderStatusGroup(cancelledOrder), 'cancelled');
  assert.equal(getOmsReservationSummary(cancelledOrder).value, 'Released');
  assert.equal(getOmsOrderStatusGroup(expiredOrder), 'expired');
  assert.equal(getOmsReservationSummary(expiredOrder).value, 'Released');
});

test('rejected order shows rejection copy and danger tone', () => {
  const rejectedOrder: Order = {
    ...baseOrder,
    status: 'REJECTED',
    rejectionCode: 'INSUFFICIENT_CASH',
    rejectionMessage: 'Buying power is not enough for this order.',
    reservedCashAmount: 0,
    completedAt: '2026-07-03T15:00:03Z',
  };

  assert.equal(getOmsOrderStatusGroup(rejectedOrder), 'rejected');
  assert.equal(getOmsOrderTone(rejectedOrder), 'danger');
  assert.equal(getOmsOrderHeadline(rejectedOrder), 'Rejected: Buying power is not enough for this order.');
  assert.equal(getOmsReservationSummary(rejectedOrder).value, 'None');
});

test('lifecycle summary keeps submitted, accepted, expiry, and terminal timestamps readable', () => {
  const summary = getOmsLifecycleSummary(baseOrder);

  assert.deepEqual(summary, [
    { label: 'Submitted', value: 'Jul 3, 2026, 3:00 PM' },
    { label: 'Accepted', value: 'Jul 3, 2026, 3:00 PM' },
    { label: 'Expires', value: 'Jul 3, 2026, 8:00 PM' },
  ]);
});

test('lifecycle summary includes cancelled and completed timestamps in UTC', () => {
  const cancelledOrder: Order = {
    ...baseOrder,
    status: 'CANCELLED',
    cancelledAt: '2026-07-03T16:00:00Z',
    completedAt: '2026-07-03T16:00:00Z',
  };
  const completedOrder: Order = {
    ...baseOrder,
    status: 'FILLED',
    submittedAt: '2026-07-03T23:30:00Z',
    acceptedAt: null,
    completedAt: '2026-07-04T00:15:00Z',
    expiresAt: null,
  };

  assert.deepEqual(getOmsLifecycleSummary(cancelledOrder), [
    { label: 'Submitted', value: 'Jul 3, 2026, 3:00 PM' },
    { label: 'Accepted', value: 'Jul 3, 2026, 3:00 PM' },
    { label: 'Cancelled', value: 'Jul 3, 2026, 4:00 PM' },
  ]);
  assert.deepEqual(getOmsLifecycleSummary(completedOrder), [
    { label: 'Submitted', value: 'Jul 3, 2026, 11:30 PM' },
    { label: 'Completed', value: 'Jul 4, 2026, 12:15 AM' },
  ]);
});

test('execution presentation covers orders without async execution requests', () => {
  assert.equal(orderExecutionLabel(baseOrder), 'Not triggered yet');
  assert.equal(orderExecutionTone(baseOrder), 'neutral');
  assert.equal(orderExecutionDetail(baseOrder), 'Waiting for market conditions');

  const filledOrder: Order = {
    ...baseOrder,
    status: 'FILLED',
  };
  const expiredOrder: Order = {
    ...baseOrder,
    status: 'EXPIRED',
  };
  const cancelledOrder: Order = {
    ...baseOrder,
    status: 'CANCELLED',
  };
  const rejectedOrder: Order = {
    ...baseOrder,
    status: 'REJECTED',
  };
  const acceptedOrder: Order = {
    ...baseOrder,
    status: 'ACCEPTED',
  };
  const partiallyFilledOrder: Order = {
    ...baseOrder,
    status: 'PARTIALLY_FILLED',
  };

  assert.equal(orderExecutionLabel(filledOrder), 'Immediate fill');
  assert.equal(orderExecutionTone(filledOrder), 'positive');
  assert.equal(orderExecutionDetail(filledOrder), 'No async execution request');
  assert.equal(orderExecutionLabel(expiredOrder), 'Expired');
  assert.equal(orderExecutionTone(expiredOrder), 'neutral');
  assert.equal(orderExecutionDetail(expiredOrder), 'Reservation released');
  assert.equal(orderExecutionLabel(cancelledOrder), 'Cancelled before fill');
  assert.equal(orderExecutionTone(cancelledOrder), 'neutral');
  assert.equal(orderExecutionDetail(cancelledOrder), 'Reservation released');
  assert.equal(orderExecutionLabel(rejectedOrder), 'Order rejected');
  assert.equal(orderExecutionTone(rejectedOrder), 'danger');
  assert.equal(orderExecutionDetail(rejectedOrder), 'Order rejected before execution');
  assert.equal(orderExecutionLabel(acceptedOrder), 'Not triggered yet');
  assert.equal(orderExecutionTone(acceptedOrder), 'neutral');
  assert.equal(orderExecutionDetail(acceptedOrder), 'Waiting for market conditions');
  assert.equal(orderExecutionLabel(partiallyFilledOrder), 'Partially filled');
  assert.equal(orderExecutionTone(partiallyFilledOrder), 'neutral');
  assert.equal(orderExecutionDetail(partiallyFilledOrder), 'Waiting for remaining quantity');
});

test('execution presentation covers queued, published, consumed, and cancelled requests', () => {
  const pendingExecutionOrder: Order = {
    ...baseOrder,
    execution: executionWith({ status: 'PENDING', publishAttemptCount: 1 }),
  };
  const publishedExecutionOrder: Order = {
    ...baseOrder,
    execution: executionWith({
      status: 'PUBLISHED',
      publishedAt: '2026-07-03T15:00:03Z',
    }),
  };
  const consumedExecutionOrder: Order = {
    ...baseOrder,
    execution: executionWith({
      status: 'CONSUMED',
      consumedAt: '2026-07-03T15:00:04Z',
      publishedAt: '2026-07-03T15:00:03Z',
    }),
  };
  const cancelledExecutionOrder: Order = {
    ...baseOrder,
    execution: executionWith({ status: 'CANCELLED', publishAttemptCount: 3 }),
  };

  assert.equal(orderExecutionLabel(pendingExecutionOrder), 'Queued for dispatch');
  assert.equal(orderExecutionTone(pendingExecutionOrder), 'neutral');
  assert.equal(orderExecutionDetail(pendingExecutionOrder), 'Execution attempts 1');
  assert.equal(orderExecutionLabel(publishedExecutionOrder), 'Sent to queue');
  assert.equal(orderExecutionTone(publishedExecutionOrder), 'warning');
  assert.equal(orderExecutionDetail(publishedExecutionOrder), 'Published Jul 3, 2026, 3:00 PM');
  assert.equal(orderExecutionLabel(consumedExecutionOrder), 'Worker filled');
  assert.equal(orderExecutionTone(consumedExecutionOrder), 'positive');
  assert.equal(orderExecutionDetail(consumedExecutionOrder), 'Consumed Jul 3, 2026, 3:00 PM');
  assert.equal(orderExecutionLabel(cancelledExecutionOrder), 'Cancelled before fill');
  assert.equal(orderExecutionTone(cancelledExecutionOrder), 'neutral');
  assert.equal(orderExecutionDetail(cancelledExecutionOrder), 'Execution attempts 3');
});

test('execution presentation covers async publish failure', () => {
  const failedExecutionOrder: Order = {
    ...baseOrder,
    execution: executionWith({
      status: 'FAILED',
      quoteTimestamp: '2026-07-03T15:00:02Z',
      lastPublishError: 'RabbitMQ unavailable',
      publishAttemptCount: 2,
    }),
  };

  assert.equal(orderExecutionLabel(failedExecutionOrder), 'Publish failed');
  assert.equal(orderExecutionTone(failedExecutionOrder), 'danger');
  assert.equal(orderExecutionDetail(failedExecutionOrder), 'RabbitMQ unavailable');
});
