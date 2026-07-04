'use client';

import type { FormEvent } from 'react';
import type { CashFlow, CashFlowEntryType, PortfolioResponse } from '@papervest/shared-types';

import { AppButton } from './app-button';
import { InlineNotice } from './inline-notice';
import { MetricCard } from './metric-card';
import { SectionHeader } from './section-header';
import { formatCurrency, formatDateTime, formatSignedCurrency } from '../lib/formatters';

type Props = {
  portfolio?: PortfolioResponse;
  cashFlows: CashFlow[];
  mode: CashFlowEntryType;
  amount: string;
  memo: string;
  amountError?: string | null;
  memoError?: string | null;
  submitting: boolean;
  loading: boolean;
  notice?: string | null;
  errorMessage?: string | null;
  onModeChange: (mode: CashFlowEntryType) => void;
  onAmountChange: (amount: string) => void;
  onMemoChange: (memo: string) => void;
  onSubmit: () => void;
};

export function CashFlowPanel({
  portfolio,
  cashFlows,
  mode,
  amount,
  memo,
  amountError,
  memoError,
  submitting,
  loading,
  notice,
  errorMessage,
  onModeChange,
  onAmountChange,
  onMemoChange,
  onSubmit,
}: Props) {
  return (
    <div className="pv-stack">
      <SectionHeader
        title="Cash movement"
        subtitle="Simulated deposits and withdrawals update buying power and performance cash-flow math."
      />

      <div className="pv-dashboard-summary-grid">
        <MetricCard
          label="Cash balance"
          value={portfolio ? formatCurrency(portfolio.summary.cashBalance) : '...'}
        />
        <MetricCard
          label="Buying power"
          value={portfolio ? formatCurrency(portfolio.summary.availableCashBalance) : '...'}
        />
        <MetricCard
          label="Reserved cash"
          value={portfolio ? formatCurrency(portfolio.summary.reservedCashBalance) : '...'}
        />
      </div>

      {errorMessage ? <InlineNotice tone="error" message={errorMessage} /> : null}
      {notice ? <InlineNotice tone="info" message={notice} /> : null}

      <form
        className="pv-stack"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="pv-action-cluster" role="group" aria-label="Cash movement type">
          <button
            className={mode === 'DEPOSIT' ? 'pv-button secondary' : 'pv-button ghost'}
            type="button"
            onClick={() => onModeChange('DEPOSIT')}
          >
            Deposit
          </button>
          <button
            className={mode === 'WITHDRAWAL' ? 'pv-button secondary' : 'pv-button ghost'}
            type="button"
            onClick={() => onModeChange('WITHDRAWAL')}
          >
            Withdraw
          </button>
        </div>

        <div className="pv-subgrid">
          <label className="pv-field">
            <span>Amount</span>
            <input
              className="pv-input"
              inputMode="decimal"
              min="0"
              name="cash-flow-amount"
              onChange={(event) => onAmountChange(event.target.value)}
              placeholder="250.00"
              value={amount}
            />
            {amountError ? <span className="pv-error-text">{amountError}</span> : null}
          </label>

          <label className="pv-field">
            <span>Memo</span>
            <input
              className="pv-input"
              maxLength={120}
              name="cash-flow-memo"
              onChange={(event) => onMemoChange(event.target.value)}
              placeholder="Optional note"
              value={memo}
            />
            {memoError ? <span className="pv-error-text">{memoError}</span> : null}
          </label>
        </div>

        <div className="pv-auth-actions">
          <AppButton type="submit" loading={submitting}>
            {mode === 'DEPOSIT' ? 'Record deposit' : 'Record withdrawal'}
          </AppButton>
        </div>
      </form>

      <div className="pv-stack">
        <div className="pv-meta-row">
          <span className="pv-kicker">Recent cash flows</span>
          <strong>{loading ? 'Loading' : `${cashFlows.length} shown`}</strong>
        </div>

        {cashFlows.length ? (
          <div className="pv-stack">
            {cashFlows.slice(0, 8).map((flow) => (
              <div className="pv-meta-row" key={flow.id}>
                <span>
                  <span className={`pv-chip ${flow.type === 'DEPOSIT' ? 'buy' : 'danger'}`}>
                    {flow.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'}
                  </span>{' '}
                  {flow.memo ?? 'Simulated cash movement'}
                </span>
                <strong>
                  {formatSignedCurrency(flow.amount)}
                  <span className="pv-muted-inline"> · {formatDateTime(flow.createdAt)}</span>
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <InlineNotice
            tone="info"
            message="No simulated cash movements yet."
          />
        )}
      </div>
    </div>
  );
}
