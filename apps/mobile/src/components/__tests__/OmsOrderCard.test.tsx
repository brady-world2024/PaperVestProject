import { fireEvent, render } from '@testing-library/react-native';

import type { Order } from '../../services/api/types';
import { OmsOrderCard } from '../orders/OmsOrderCard';

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

describe('OmsOrderCard', () => {
  it('renders open order lifecycle, reservation copy, and cancel action', () => {
    const onCancel = jest.fn();
    const screen = render(
      <OmsOrderCard order={baseOrder} cancelling={false} onCancel={onCancel} />
    );

    expect(screen.getByText('Open order awaiting execution')).toBeTruthy();
    expect(screen.getByText('Reserved cash')).toBeTruthy();
    expect(screen.getAllByText('$202.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Not triggered yet')).toBeTruthy();

    fireEvent.press(screen.getByText('Cancel order'));

    expect(onCancel).toHaveBeenCalledWith('order-1');
  });

  it('hides cancel for filled orders and shows consumed reservation state', () => {
    const screen = render(
      <OmsOrderCard
        order={{
          ...baseOrder,
          status: 'FILLED',
          filledQuantity: 2,
          reservedCashAmount: 0,
          completedAt: '2026-07-03T15:00:04Z',
        }}
        cancelling={false}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByText('Order filled')).toBeTruthy();
    expect(screen.getByText('Reservation')).toBeTruthy();
    expect(screen.getByText('Consumed')).toBeTruthy();
    expect(screen.queryByText('Cancel order')).toBeNull();
  });
});
