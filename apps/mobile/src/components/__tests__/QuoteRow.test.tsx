import { render } from '@testing-library/react-native';

import { QuoteRow } from '../market/QuoteRow';

describe('QuoteRow', () => {
  it('renders a symbol and price information', () => {
    const screen = render(
      <QuoteRow
        quote={{
          symbol: 'AAPL',
          companyName: 'Apple Inc.',
          currentPrice: 198.22,
          dailyChange: 1.52,
          dailyChangePercent: 0.77,
          openPrice: 197.1,
          highPrice: 199.0,
          lowPrice: 196.4,
          previousClose: 196.7,
          quoteTimestamp: '2026-03-20T00:00:00Z',
          stale: false,
        }}
      />
    );

    expect(screen.getByText('AAPL')).toBeTruthy();
    expect(screen.getByText('$198.22')).toBeTruthy();
  });
});
