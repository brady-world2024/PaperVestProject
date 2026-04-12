import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AppButton } from '../app-button';
import { ConditionalOrderList } from '../conditional-orders/conditional-order-list';
import {
  canCancelConditionalOrder,
  conditionalOrderFailureSummary,
} from '../../lib/conditional-orders/presentation';
import type { ConditionalOrder } from '@papervest/shared-types';
import { conditionalOrderFormSchema } from '../../../../../packages/validation/src/index';

const baseOrder: ConditionalOrder = {
  id: 'order-1',
  symbol: 'AAPL',
  side: 'BUY',
  triggerType: 'TARGET_PRICE',
  targetPrice: 100,
  quantity: 5,
  status: 'ACTIVE',
  failureCode: null,
  failureMessage: null,
  executionKey: 'conditional-order-order-1',
  lastCheckedPrice: 99.5,
  triggeredAt: null,
  executedAt: null,
  expiresAt: null,
  createdAt: '2026-03-30T08:00:00Z',
  updatedAt: '2026-03-30T08:00:00Z',
  version: 0,
};

test('conditional order form schema rejects invalid values', () => {
  const result = conditionalOrderFormSchema.safeParse({
    symbol: '',
    side: 'BUY',
    targetPrice: '0',
    quantity: '-1',
  });

  assert.equal(result.success, false);
  if (!result.success) {
    const messages = result.error.issues.map((issue) => issue.message);
    assert.ok(messages.includes('Enter a stock symbol'));
    assert.ok(messages.includes('Target price must be greater than zero'));
    assert.ok(messages.includes('Quantity must be greater than zero'));
  }
});

test('conditional order list renders failure details and cancel button only for active orders', () => {
  const failedOrder: ConditionalOrder = {
    ...baseOrder,
    id: 'order-2',
    status: 'FAILED',
    failureCode: 'INSUFFICIENT_CASH',
    failureMessage: 'You do not have enough virtual cash to place this order',
  };

  const html = renderToStaticMarkup(
    <ConditionalOrderList
      orders={[baseOrder, failedOrder]}
      cancellingOrderId={null}
      onCancel={() => undefined}
    />
  );

  assert.match(html, /INSUFFICIENT_CASH: You do not have enough virtual cash to place this order/);
  assert.equal((html.match(/Cancel/g) ?? []).length, 1);
});

test('conditional order cancel action forwards the selected order id', () => {
  const calls: string[] = [];
  const element = ConditionalOrderList({
    orders: [baseOrder],
    cancellingOrderId: null,
    onCancel: (orderId) => calls.push(orderId),
  });

  const appButtonElement = findFirstByType(element, AppButton);
  assert.ok(appButtonElement, 'Expected an AppButton to be rendered for an active order');
  appButtonElement.props.onClick();

  assert.deepEqual(calls, ['order-1']);
});

test('conditional order helper functions summarize failure and cancellable states', () => {
  assert.equal(canCancelConditionalOrder('ACTIVE'), true);
  assert.equal(canCancelConditionalOrder('FAILED'), false);
  assert.equal(
    conditionalOrderFailureSummary({
      ...baseOrder,
      failureCode: 'PRICE_CONDITION_NOT_MET_ANYMORE',
      failureMessage: 'Price condition changed while execution was starting',
    }),
    'PRICE_CONDITION_NOT_MET_ANYMORE: Price condition changed while execution was starting'
  );
});

function findFirstByType(node: unknown, componentType: unknown): any | null {
  if (!isReactElement(node)) {
    return null;
  }

  if (node.type === componentType) {
    return node;
  }

  const props = (node as React.ReactElement<{ children?: React.ReactNode }>).props;
  const children = React.Children.toArray(props.children ?? []);
  for (const child of children) {
    const match = findFirstByType(child, componentType);
    if (match) {
      return match;
    }
  }

  return null;
}

function isReactElement(node: unknown): node is React.ReactElement {
  return typeof node === 'object' && node !== null && 'type' in node && 'props' in node;
}
