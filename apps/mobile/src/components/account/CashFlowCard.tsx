import { StyleSheet, Text, View } from 'react-native';
import type { CashFlow, CashFlowEntryType, PortfolioResponse } from '@papervest/shared-types';

import { AppButton } from '../common/AppButton';
import { AppCard } from '../common/AppCard';
import { InlineNotice } from '../feedback/InlineNotice';
import { AppTextField } from '../form/AppTextField';
import { SectionHeader } from '../layout/SectionHeader';
import { appTheme } from '../../theme';
import { formatCurrency, formatDateTime, formatSignedCurrency } from '../../utils/formatters';

type Props = {
  portfolio?: PortfolioResponse;
  cashFlows: CashFlow[];
  mode: CashFlowEntryType;
  amount: string;
  memo: string;
  amountError?: string | null;
  memoError?: string | null;
  loading: boolean;
  submitting: boolean;
  notice?: string | null;
  errorMessage?: string | null;
  onModeChange: (mode: CashFlowEntryType) => void;
  onAmountChange: (value: string) => void;
  onMemoChange: (value: string) => void;
  onSubmit: () => void;
};

export function CashFlowCard({
  portfolio,
  cashFlows,
  mode,
  amount,
  memo,
  amountError,
  memoError,
  loading,
  submitting,
  notice,
  errorMessage,
  onModeChange,
  onAmountChange,
  onMemoChange,
  onSubmit,
}: Props) {
  const summary = portfolio?.summary;

  return (
    <AppCard>
      <SectionHeader
        title="Cash movement"
        subtitle="Simulated cash flows update buying power and performance math."
      />

      <View style={styles.metricGrid}>
        <CashMetric label="Cash balance" value={summary ? formatCurrency(summary.cashBalance) : '...'} />
        <CashMetric label="Buying power" value={summary ? formatCurrency(summary.availableCashBalance) : '...'} />
        <CashMetric label="Reserved cash" value={summary ? formatCurrency(summary.reservedCashBalance) : '...'} />
      </View>

      {errorMessage ? <InlineNotice tone="error" message={errorMessage} /> : null}
      {notice ? <InlineNotice message={notice} /> : null}

      <View style={styles.segmentRow}>
        <AppButton
          label="Deposit"
          onPress={() => onModeChange('DEPOSIT')}
          variant={mode === 'DEPOSIT' ? 'secondary' : 'ghost'}
          style={styles.segmentButton}
        />
        <AppButton
          label="Withdraw"
          onPress={() => onModeChange('WITHDRAWAL')}
          variant={mode === 'WITHDRAWAL' ? 'secondary' : 'ghost'}
          style={styles.segmentButton}
        />
      </View>

      <AppTextField
        label="Amount"
        value={amount}
        onChangeText={onAmountChange}
        keyboardType="decimal-pad"
        error={amountError ?? undefined}
        placeholder="250.00"
      />
      <AppTextField
        label="Memo"
        value={memo}
        onChangeText={onMemoChange}
        error={memoError ?? undefined}
        placeholder="Optional note"
      />

      <AppButton
        label={mode === 'DEPOSIT' ? 'Record Deposit' : 'Record Withdrawal'}
        onPress={onSubmit}
        loading={submitting}
      />

      <View style={styles.recentBlock}>
        <View style={styles.recentHeader}>
          <Text style={styles.recentTitle}>Recent cash flows</Text>
          <Text style={styles.recentCount}>{loading ? 'Loading' : `${cashFlows.length} shown`}</Text>
        </View>

        {cashFlows.length ? (
          cashFlows.slice(0, 6).map((flow) => (
            <View key={flow.id} style={styles.flowRow}>
              <View style={styles.flowLabelGroup}>
                <Text style={styles.flowType}>{flow.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'}</Text>
                <Text style={styles.flowMemo}>{flow.memo ?? 'Simulated cash movement'}</Text>
              </View>
              <View style={styles.flowValueGroup}>
                <Text
                  style={[
                    styles.flowAmount,
                    flow.amount >= 0 ? styles.positive : styles.negative,
                  ]}
                >
                  {formatSignedCurrency(flow.amount)}
                </Text>
                <Text style={styles.flowDate}>{formatDateTime(flow.createdAt)}</Text>
              </View>
            </View>
          ))
        ) : (
          <InlineNotice message="No simulated cash movements yet." />
        )}
      </View>
    </AppCard>
  );
}

function CashMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metricGrid: {
    gap: appTheme.spacing.sm,
    marginBottom: appTheme.spacing.md,
  },
  metric: {
    borderRadius: appTheme.radius.md,
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    padding: appTheme.spacing.sm,
    backgroundColor: appTheme.colors.surfaceMuted,
  },
  metricLabel: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.caption,
    fontWeight: '700',
  },
  metricValue: {
    marginTop: 2,
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.body,
    fontWeight: '800',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: appTheme.spacing.sm,
    marginTop: appTheme.spacing.md,
  },
  segmentButton: {
    flex: 1,
  },
  recentBlock: {
    gap: appTheme.spacing.sm,
    marginTop: appTheme.spacing.md,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentTitle: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.body,
    fontWeight: '800',
  },
  recentCount: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.caption,
    fontWeight: '700',
  },
  flowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: appTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: appTheme.colors.border,
    paddingTop: appTheme.spacing.sm,
  },
  flowLabelGroup: {
    flex: 1,
    gap: 2,
  },
  flowType: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.caption,
    fontWeight: '700',
  },
  flowMemo: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.body,
    fontWeight: '700',
  },
  flowValueGroup: {
    alignItems: 'flex-end',
    gap: 2,
  },
  flowAmount: {
    fontSize: appTheme.typography.body,
    fontWeight: '800',
  },
  positive: {
    color: appTheme.colors.positive,
  },
  negative: {
    color: appTheme.colors.negative,
  },
  flowDate: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.micro,
    fontWeight: '600',
  },
});
