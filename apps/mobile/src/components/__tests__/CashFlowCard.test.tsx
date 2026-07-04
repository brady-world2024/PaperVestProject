import { render } from '@testing-library/react-native';

import type { CashFlow, PortfolioResponse } from '../../services/api/types';
import { CashFlowCard } from '../account/CashFlowCard';

const portfolio: PortfolioResponse = {
  summary: {
    initialCash: 100000,
    cashBalance: 103000,
    reservedCashBalance: 500,
    availableCashBalance: 102500,
    holdingsMarketValue: 18000,
    totalPortfolioValue: 121000,
    unrealizedPnl: 5000,
    realizedPnl: 1500,
    totalPnl: 6500,
    totalReturnPercent: 6.5,
    dailyChange: 100,
  },
  holdings: [],
};

const cashFlows: CashFlow[] = [
  {
    id: 'flow-1',
    type: 'DEPOSIT',
    amount: 3000,
    cashBalanceAfter: 103000,
    reservedCashAfter: 500,
    memo: 'Monthly cash',
    createdAt: '2026-07-05T15:30:00Z',
    idempotentReplay: false,
  },
];

describe('CashFlowCard', () => {
  it('renders balances, action controls, and recent flows', () => {
    const screen = render(
      <CashFlowCard
        portfolio={portfolio}
        cashFlows={cashFlows}
        mode="DEPOSIT"
        amount="250"
        memo="Simulation"
        amountError={null}
        memoError={null}
        loading={false}
        submitting={false}
        notice="Simulated deposit recorded."
        errorMessage={null}
        onModeChange={() => undefined}
        onAmountChange={() => undefined}
        onMemoChange={() => undefined}
        onSubmit={() => undefined}
      />
    );

    expect(screen.getByText('Cash movement')).toBeTruthy();
    expect(screen.getByText('Buying power')).toBeTruthy();
    expect(screen.getByText('$102,500.00')).toBeTruthy();
    expect(screen.getAllByText('Deposit').length).toBeGreaterThan(0);
    expect(screen.getByText('Withdraw')).toBeTruthy();
    expect(screen.getByText('Simulated deposit recorded.')).toBeTruthy();
    expect(screen.getByText('Monthly cash')).toBeTruthy();
    expect(screen.getByText('+$3,000.00')).toBeTruthy();
  });
});
