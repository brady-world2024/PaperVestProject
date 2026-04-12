import { fireEvent, render } from '@testing-library/react-native';

import type { ConditionalOrder } from '../../services/api/types';
import { ConditionalOrderList } from '../conditional-orders/ConditionalOrderList';

const baseOrder: ConditionalOrder = {
  id: 'order-1',
  symbol: 'AAPL',
  side: 'BUY',
  triggerType: 'TARGET_PRICE',
  targetPrice: 200,
  quantity: 2,
  status: 'ACTIVE',
  failureCode: null,
  failureMessage: null,
  executionKey: 'conditional-order-order-1',
  lastCheckedPrice: 198.55,
  triggeredAt: null,
  executedAt: null,
  expiresAt: null,
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
  version: 1,
};

describe('ConditionalOrderList', () => {
  it('renders failure messages for failed orders', () => {
    const screen = render(
      <ConditionalOrderList
        orders={[
          {
            ...baseOrder,
            id: 'order-2',
            status: 'FAILED',
            failureCode: 'INSUFFICIENT_CASH',
            failureMessage: 'Need more virtual cash before this order can execute.',
          },
        ]}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByText('INSUFFICIENT_CASH: Need more virtual cash before this order can execute.')).toBeTruthy();
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  it('calls onCancel for active orders', () => {
    const onCancel = jest.fn();
    const screen = render(
      <ConditionalOrderList orders={[baseOrder]} onCancel={onCancel} />
    );

    fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledWith('order-1');
  });
});
