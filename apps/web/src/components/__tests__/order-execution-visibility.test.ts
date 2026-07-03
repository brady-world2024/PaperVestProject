import assert from 'node:assert/strict';
import test from 'node:test';

import type { Order } from '@papervest/shared-types';

import {
  orderExecutionDetail,
  orderExecutionLabel,
  orderExecutionTone,
} from '../../lib/orders/execution-presentation';

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
  expiresAt: null,
  createdAt: '2026-07-03T15:00:00Z',
  updatedAt: '2026-07-03T15:00:02Z',
  execution: null,
};

test('order execution presentation describes pending orders without a trigger request', () => {
  assert.equal(orderExecutionLabel(baseOrder), 'Not triggered yet');
  assert.equal(orderExecutionDetail(baseOrder), 'Waiting for market conditions');
  assert.equal(orderExecutionTone(baseOrder), 'neutral');
});

test('order execution presentation describes published and consumed execution requests', () => {
  const publishedOrder: Order = {
    ...baseOrder,
    execution: {
      id: 'execution-1',
      status: 'PUBLISHED',
      triggerPrice: 100,
      executionPrice: 100,
      quoteTimestamp: '2026-07-03T15:00:02Z',
      publishedAt: '2026-07-03T15:00:03Z',
      consumedAt: null,
      lastPublishError: null,
      publishAttemptCount: 1,
      createdAt: '2026-07-03T15:00:02Z',
      updatedAt: '2026-07-03T15:00:03Z',
    },
  };
  const consumedOrder: Order = {
    ...publishedOrder,
    status: 'FILLED',
    execution: {
      ...publishedOrder.execution!,
      status: 'CONSUMED',
      consumedAt: '2026-07-03T15:00:04Z',
    },
  };

  assert.equal(orderExecutionLabel(publishedOrder), 'Sent to queue');
  assert.equal(orderExecutionTone(publishedOrder), 'warning');
  assert.match(orderExecutionDetail(publishedOrder), /Published/);
  assert.equal(orderExecutionLabel(consumedOrder), 'Worker filled');
  assert.equal(orderExecutionTone(consumedOrder), 'positive');
  assert.match(orderExecutionDetail(consumedOrder), /Consumed/);
});
