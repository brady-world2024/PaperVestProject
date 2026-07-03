import type { Order } from '../../services/api/types';
import {
  orderExecutionDetail,
  orderExecutionLabel,
} from '../../utils/orderExecution';

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

describe('order execution presentation', () => {
  it('describes a pending order that has not triggered yet', () => {
    expect(orderExecutionLabel(baseOrder)).toBe('Not triggered yet');
    expect(orderExecutionDetail(baseOrder)).toBe('Waiting for market conditions');
  });

  it('describes a worker-consumed execution request', () => {
    const consumedOrder: Order = {
      ...baseOrder,
      status: 'FILLED',
      execution: {
        id: 'execution-1',
        status: 'CONSUMED',
        triggerPrice: 100,
        executionPrice: 100,
        quoteTimestamp: '2026-07-03T15:00:02Z',
        publishedAt: '2026-07-03T15:00:03Z',
        consumedAt: '2026-07-03T15:00:04Z',
        lastPublishError: null,
        publishAttemptCount: 1,
        createdAt: '2026-07-03T15:00:02Z',
        updatedAt: '2026-07-03T15:00:04Z',
      },
    };

    expect(orderExecutionLabel(consumedOrder)).toBe('Worker filled');
    expect(orderExecutionDetail(consumedOrder)).toContain('Consumed');
  });
});
