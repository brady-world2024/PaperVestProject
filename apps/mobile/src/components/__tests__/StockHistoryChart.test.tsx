import { fireEvent, render } from '@testing-library/react-native';

import type { StockPriceHistory } from '../../services/api/types';
import { StockHistoryChart } from '../market/StockHistoryChart';

const history: StockPriceHistory = {
  symbol: 'AAPL',
  range: '1M',
  interval: '1d',
  from: '2026-03-01T00:00:00Z',
  to: '2026-04-01T00:00:00Z',
  points: [
    {
      timestamp: '2026-03-01T00:00:00Z',
      openPrice: 190,
      highPrice: 194,
      lowPrice: 188,
      closePrice: 192,
      volume: 1000,
    },
    {
      timestamp: '2026-03-15T00:00:00Z',
      openPrice: 195,
      highPrice: 198,
      lowPrice: 193,
      closePrice: 197,
      volume: 1200,
    },
    {
      timestamp: '2026-04-01T00:00:00Z',
      openPrice: 199,
      highPrice: 202,
      lowPrice: 198,
      closePrice: 201,
      volume: 1300,
    },
  ],
};

describe('StockHistoryChart', () => {
  it('renders range summary and notifies when the range changes', () => {
    const onSelectRange = jest.fn();
    const screen = render(
      <StockHistoryChart
        range="1M"
        history={history}
        loading={false}
        onSelectRange={onSelectRange}
      />
    );

    expect(screen.getByText('Price history')).toBeTruthy();
    expect(screen.getByText('Range move')).toBeTruthy();

    fireEvent.press(screen.getByText('1W'));
    expect(onSelectRange).toHaveBeenCalledWith('1W');
  });

  it('shows the empty state and error message when no points are returned', () => {
    const screen = render(
      <StockHistoryChart
        range="1D"
        history={{
          ...history,
          range: '1D',
          interval: '5m',
          points: [],
        }}
        loading={false}
        errorMessage="Unable to load price history"
        onSelectRange={jest.fn()}
      />
    );

    expect(screen.getByText('Unable to load price history')).toBeTruthy();
    expect(screen.getByText('No history available')).toBeTruthy();
  });
});
