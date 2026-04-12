import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ConditionalOrderComposer } from '../conditional-orders/ConditionalOrderComposer';

describe('ConditionalOrderComposer', () => {
  it('shows validation messages for empty fields', async () => {
    const onSubmitOrder = jest.fn().mockResolvedValue(undefined);
    const screen = render(<ConditionalOrderComposer onSubmitOrder={onSubmitOrder} />);

    fireEvent.changeText(screen.getByPlaceholderText('1'), '');
    fireEvent.press(screen.getByText('Create conditional order'));

    await waitFor(() => {
      expect(screen.getByText('Enter a stock symbol')).toBeTruthy();
      expect(screen.getByText('Enter a target price')).toBeTruthy();
      expect(screen.getByText('Enter the quantity to trade')).toBeTruthy();
    });
    expect(onSubmitOrder).not.toHaveBeenCalled();
  });

  it('normalizes values and submits a conditional order', async () => {
    const onSubmitOrder = jest.fn().mockResolvedValue(undefined);
    const screen = render(
      <ConditionalOrderComposer initialSymbol="aapl" initialSide="SELL" onSubmitOrder={onSubmitOrder} />
    );

    fireEvent.changeText(screen.getByDisplayValue('aapl'), 'msft');
    fireEvent.changeText(screen.getByPlaceholderText('100.00'), '245.5');
    fireEvent.changeText(screen.getByPlaceholderText('1'), '3');
    fireEvent.press(screen.getByText('Create conditional order'));

    await waitFor(() => {
      expect(onSubmitOrder).toHaveBeenCalledWith({
        symbol: 'MSFT',
        side: 'SELL',
        targetPrice: 245.5,
        quantity: 3,
      });
    });

    expect(screen.getByText('Conditional order created.')).toBeTruthy();
  });
});
