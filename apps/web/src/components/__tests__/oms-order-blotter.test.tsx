import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { Order } from '@papervest/shared-types';

import { AppButton } from '../app-button';
import { OmsOrderBlotter, OmsOrderRow } from '../orders/oms-order-blotter';

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

test('OMS blotter renders lifecycle and reservation copy', () => {
  const html = renderToStaticMarkup(
    <OmsOrderBlotter
      orders={[baseOrder]}
      density="comfortable"
      loading={false}
      loadErrorMessage={null}
      cancelErrorMessage={null}
      cancellingOrderId={null}
      csrfReady
      onCancel={() => undefined}
    />
  );

  assert.match(html, /Order activity/);
  assert.match(html, /Open order awaiting execution/);
  assert.match(html, /Reserved cash/);
  assert.match(html, /\$202\.00/);
  assert.match(html, /Not triggered yet/);
});

test('OMS blotter exposes cancel only for open orders', () => {
  const filledOrder: Order = {
    ...baseOrder,
    id: 'order-2',
    status: 'FILLED',
    filledQuantity: 2,
    reservedCashAmount: 0,
    completedAt: '2026-07-03T15:00:04Z',
  };

  const element = (
    <OmsOrderBlotter
      orders={[baseOrder, filledOrder]}
      density="comfortable"
      loading={false}
      loadErrorMessage={null}
      cancelErrorMessage={null}
      cancellingOrderId={null}
      csrfReady
      onCancel={() => undefined}
    />
  );
  const html = renderToStaticMarkup(element);

  assert.equal((html.match(/Cancel/g) ?? []).length, 1);
});

test('OMS blotter cancel action forwards the selected order id', () => {
  const calls: string[] = [];
  const element = OmsOrderRow({
    order: baseOrder,
    density: 'comfortable',
    cancelling: false,
    csrfReady: true,
    onCancel: (orderId: string) => calls.push(orderId),
  });

  const appButtonElement = findFirstByType(element, AppButton);
  assert.ok(appButtonElement, 'Expected an AppButton for the cancellable open order');
  appButtonElement.props.onClick();

  assert.deepEqual(calls, ['order-1']);
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
