import { render } from '@testing-library/react-native';

import type { PortfolioPerformanceResponse } from '../../services/api/types';
import { PortfolioPerformanceSummary } from '../portfolio/PortfolioPerformanceSummary';

const samplePerformance: PortfolioPerformanceResponse = {
  range: '1M',
  from: '2026-06-05T00:00:00Z',
  to: '2026-07-05T00:00:00Z',
  status: 'READY',
  summary: {
    currentValue: 106000,
    startValue: 100000,
    endValue: 106000,
    absoluteReturn: 6000,
    returnPercent: 6,
    periodReturnPercent: -1.25,
    timeWeightedReturnPercent: 4.5,
    moneyWeightedReturnPercent: 4.25,
    netCashFlow: 0,
    maxDrawdownPercent: 4,
    realizedPnl: 2500,
    unrealizedPnl: 3500,
  },
  allocation: {
    cashValue: 21200,
    cashPercent: 20,
    holdingsValue: 84800,
    holdingsPercent: 80,
  },
  pnlContribution: {
    realizedValue: 2500,
    realizedPercent: 41.67,
    unrealizedValue: 3500,
    unrealizedPercent: 58.33,
  },
  topHoldings: [
    {
      rank: 1,
      symbol: 'AAPL',
      companyName: 'Apple Inc.',
      marketValue: 33920,
      portfolioWeightPercent: 32,
      unrealizedPnl: 3500,
      unrealizedPnlPercent: 11.55,
    },
  ],
  points: [],
};

describe('PortfolioPerformanceSummary', () => {
  it('renders compact performance metrics and contributors', () => {
    const screen = render(
      <PortfolioPerformanceSummary
        range="1M"
        performance={samplePerformance}
        loading={false}
        onSelectRange={() => undefined}
      />
    );

    expect(screen.getByText('Performance')).toBeTruthy();
    expect(screen.getByText('Range return')).toBeTruthy();
    expect(screen.getByText('Time-weighted return')).toBeTruthy();
    expect(screen.getByText('Money-weighted return')).toBeTruthy();
    expect(screen.getByText('Max drawdown')).toBeTruthy();
    expect(screen.getByText('Allocation')).toBeTruthy();
    expect(screen.getByText('AAPL')).toBeTruthy();
  });
});
