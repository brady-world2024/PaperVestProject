import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CashFlowPanel } from '../cash-flow-panel';
import type { CashFlow, PortfolioResponse } from '@papervest/shared-types';

const portfolio: PortfolioResponse = {
  summary: {
    initialCash: 100000,
    cashBalance: 104000,
    reservedCashBalance: 250,
    availableCashBalance: 103750,
    holdingsMarketValue: 12000,
    totalPortfolioValue: 116000,
    unrealizedPnl: 4000,
    realizedPnl: 1500,
    totalPnl: 5500,
    totalReturnPercent: 5.5,
    dailyChange: 250,
  },
  holdings: [],
};

const cashFlows: CashFlow[] = [
  {
    id: 'flow-2',
    type: 'WITHDRAWAL',
    amount: -500,
    cashBalanceAfter: 104000,
    reservedCashAfter: 250,
    memo: 'Transfer out',
    createdAt: '2026-07-05T15:30:00Z',
    idempotentReplay: false,
  },
  {
    id: 'flow-1',
    type: 'DEPOSIT',
    amount: 2500,
    cashBalanceAfter: 104500,
    reservedCashAfter: 250,
    memo: 'Monthly allocation',
    createdAt: '2026-07-04T15:30:00Z',
    idempotentReplay: false,
  },
];

test('cash flow panel renders balances, controls, and recent cash flows', () => {
  const html = renderToStaticMarkup(
    <CashFlowPanel
      portfolio={portfolio}
      cashFlows={cashFlows}
      mode="DEPOSIT"
      amount="250"
      memo="Simulation"
      amountError={null}
      memoError={null}
      submitting={false}
      loading={false}
      notice="Cash movement recorded."
      errorMessage={null}
      onModeChange={() => undefined}
      onAmountChange={() => undefined}
      onMemoChange={() => undefined}
      onSubmit={() => undefined}
    />
  );

  assert.match(html, /Cash movement/);
  assert.match(html, /Buying power/);
  assert.match(html, /\$103,750\.00/);
  assert.match(html, /Deposit/);
  assert.match(html, /Withdraw/);
  assert.match(html, /Cash movement recorded/);
  assert.match(html, /Recent cash flows/);
  assert.match(html, /Transfer out/);
  assert.match(html, /Monthly allocation/);
  assert.match(html, /-\$500\.00/);
  assert.match(html, /\+\$2,500\.00/);
});

test('cash flow panel renders validation and empty states', () => {
  const html = renderToStaticMarkup(
    <CashFlowPanel
      portfolio={undefined}
      cashFlows={[]}
      mode="WITHDRAWAL"
      amount="0"
      memo=""
      amountError="Amount must be greater than zero"
      memoError={null}
      submitting={false}
      loading={false}
      notice={null}
      errorMessage="Unable to load cash flows"
      onModeChange={() => undefined}
      onAmountChange={() => undefined}
      onMemoChange={() => undefined}
      onSubmit={() => undefined}
    />
  );

  assert.match(html, /Unable to load cash flows/);
  assert.match(html, /Amount must be greater than zero/);
  assert.match(html, /No simulated cash movements yet/);
});
