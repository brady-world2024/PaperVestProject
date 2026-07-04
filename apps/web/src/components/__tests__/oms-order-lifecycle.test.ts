import assert from 'node:assert/strict';
import test from 'node:test';

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

test('execution presentation covers async publish failure', () => {
  const failedExecutionOrder: Order = {
    ...baseOrder,
    execution: {
      id: 'execution-1',
      status: 'FAILED',
      triggerPrice: 100,
      executionPrice: 100,
      quoteTimestamp: '2026-07-03T15:00:02Z',
      publishedAt: null,
      consumedAt: null,
      lastPublishError: 'RabbitMQ unavailable',
      publishAttemptCount: 2,
      createdAt: '2026-07-03T15:00:02Z',
      updatedAt: '2026-07-03T15:00:03Z',
    },
  };

  assert.equal(orderExecutionLabel(failedExecutionOrder), 'Publish failed');
  assert.equal(orderExecutionTone(failedExecutionOrder), 'danger');
  assert.equal(orderExecutionDetail(failedExecutionOrder), 'RabbitMQ unavailable');
});
