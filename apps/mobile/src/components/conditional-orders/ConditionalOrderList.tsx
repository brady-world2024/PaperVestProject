import { StyleSheet, Text, View } from 'react-native';

import type { ConditionalOrder } from '../../services/api/types';
import { appTheme } from '../../theme';
import { formatCurrency, formatDateTime, formatShares } from '../../utils/formatters';
import {
  canCancelConditionalOrder,
  conditionalOrderFailureSummary,
  conditionalOrderStatusTone,
} from '../../utils/conditionalOrders';
import { AppButton } from '../common/AppButton';
import { AppCard } from '../common/AppCard';
import { EmptyState } from '../feedback/EmptyState';

type Props = {
  orders: ConditionalOrder[];
  cancellingOrderId?: string | null;
  onCancel: (orderId: string) => void;
};

export function ConditionalOrderList({
  orders,
  cancellingOrderId,
  onCancel,
}: Props) {
  if (!orders.length) {
    return (
      <EmptyState
        title="No conditional orders yet"
        description="Create a target-price order and it will appear here while the backend watches the market."
      />
    );
  }

  return (
    <View style={styles.container}>
      {orders.map((order) => {
        const failureSummary = conditionalOrderFailureSummary(order);
        const tone = conditionalOrderStatusTone(order.status);

        return (
          <AppCard key={order.id} style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.primary}>
                <Text style={styles.symbol}>{order.symbol}</Text>
                <Text style={styles.metaLine}>
                  {order.side} · Target {formatCurrency(order.targetPrice)}
                </Text>
                <Text style={styles.caption}>
                  {formatShares(order.quantity)} shares · Created {formatDateTime(order.createdAt)}
                </Text>
              </View>

              <View style={styles.actionColumn}>
                <StatusChip status={order.status} tone={tone} />
                {canCancelConditionalOrder(order.status) ? (
                  <AppButton
                    label="Cancel"
                    variant="ghost"
                    loading={cancellingOrderId === order.id}
                    onPress={() => onCancel(order.id)}
                  />
                ) : null}
              </View>
            </View>

            <View style={styles.detailGrid}>
              <DetailRow label="Trigger" value={order.side === 'BUY' ? '<=' : '>='} />
              <DetailRow
                label="Last checked"
                value={order.lastCheckedPrice == null ? 'Not checked yet' : formatCurrency(order.lastCheckedPrice)}
              />
              <DetailRow
                label="Triggered at"
                value={order.triggeredAt ? formatDateTime(order.triggeredAt) : 'Waiting'}
              />
              <DetailRow
                label="Executed at"
                value={order.executedAt ? formatDateTime(order.executedAt) : 'Not executed'}
              />
            </View>

            {failureSummary ? <Text style={styles.failure}>{failureSummary}</Text> : null}
          </AppCard>
        );
      })}
    </View>
  );
}

function StatusChip({
  status,
  tone,
}: {
  status: ConditionalOrder['status'];
  tone: ReturnType<typeof conditionalOrderStatusTone>;
}) {
  return (
    <View
      style={[
        styles.chip,
        tone === 'positive' && styles.chipPositive,
        tone === 'negative' && styles.chipNegative,
        tone === 'warning' && styles.chipWarning,
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          tone === 'positive' && styles.chipLabelPositive,
          tone === 'negative' && styles.chipLabelNegative,
          tone === 'warning' && styles.chipLabelWarning,
        ]}
      >
        {status}
      </Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: appTheme.spacing.md,
  },
  card: {
    gap: appTheme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    gap: appTheme.spacing.md,
    alignItems: 'flex-start',
  },
  primary: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  symbol: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.heading,
    fontWeight: '800',
  },
  metaLine: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.body,
    fontWeight: '600',
  },
  caption: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.caption,
  },
  actionColumn: {
    width: 112,
    alignItems: 'stretch',
    gap: appTheme.spacing.sm,
  },
  chip: {
    alignSelf: 'flex-end',
    borderRadius: appTheme.radius.pill,
    paddingHorizontal: appTheme.spacing.sm,
    paddingVertical: 6,
    backgroundColor: appTheme.colors.surfaceMuted,
  },
  chipPositive: {
    backgroundColor: appTheme.colors.positiveSoft,
  },
  chipNegative: {
    backgroundColor: appTheme.colors.negativeSoft,
  },
  chipWarning: {
    backgroundColor: '#F8E7C7',
  },
  chipLabel: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.micro,
    fontWeight: '800',
  },
  chipLabelPositive: {
    color: appTheme.colors.positive,
  },
  chipLabelNegative: {
    color: appTheme.colors.negative,
  },
  chipLabelWarning: {
    color: appTheme.colors.warning,
  },
  detailGrid: {
    gap: appTheme.spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: appTheme.spacing.md,
  },
  detailLabel: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.caption,
  },
  detailValue: {
    flexShrink: 1,
    textAlign: 'right',
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.caption,
    fontWeight: '700',
  },
  failure: {
    color: appTheme.colors.negative,
    fontSize: appTheme.typography.caption,
    fontWeight: '600',
    lineHeight: 18,
  },
});
