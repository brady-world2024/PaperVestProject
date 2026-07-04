import {
  canCancelOmsOrder,
  getOmsLifecycleSummary,
  getOmsOrderHeadline,
  getOmsOrderTone,
  getOmsReservationSummary,
  orderExecutionDetail,
  orderExecutionLabel,
  orderExecutionTone,
  type OmsOrderTone,
} from '@papervest/shared-types';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import type { Order } from '../../services/api/types';
import { appTheme } from '../../theme';
import { formatCurrency, formatDateTime, formatShares } from '../../utils/formatters';
import { AppButton } from '../common/AppButton';
import { AppCard } from '../common/AppCard';

type Props = {
  order: Order;
  cancelling: boolean;
  onCancel: (orderId: string) => void;
  style?: StyleProp<ViewStyle>;
};

export function OmsOrderCard({ order, cancelling, onCancel, style }: Props) {
  const lifecycleItems = getOmsLifecycleSummary(order);
  const reservation = getOmsReservationSummary(order);
  const orderTone = getOmsOrderTone(order);
  const executionTone = orderExecutionTone(order);

  return (
    <AppCard style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <View style={styles.primary}>
          <View style={styles.symbolRow}>
            <Text style={styles.symbol}>{order.symbol}</Text>
            <View style={[styles.sidePill, order.side === 'BUY' ? styles.buyPill : styles.sellPill]}>
              <Text style={styles.sideText}>{order.side}</Text>
            </View>
          </View>
          <Text style={styles.company}>{order.companyName}</Text>
          <Text style={styles.metaLine}>
            {order.orderType} · {order.timeInForce} · Submitted {formatDateTime(order.submittedAt)}
          </Text>
        </View>

        <TonePill tone={orderTone} label={order.status} />
      </View>

      <Text style={styles.headline}>{getOmsOrderHeadline(order)}</Text>

      <View style={styles.detailGrid}>
        <DetailBlock label="Requested" value={formatShares(order.requestedQuantity)} />
        <DetailBlock label="Filled" value={formatShares(order.filledQuantity)} />
        <DetailBlock
          label="Gross"
          value={order.estimatedGrossAmount == null ? '-' : formatCurrency(order.estimatedGrossAmount)}
        />
      </View>

      <View style={[styles.summaryPanel, reservation.active && styles.activeReservationPanel]}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryLabel}>{reservation.label}</Text>
          <Text style={styles.summaryValue}>{reservation.value}</Text>
        </View>
        <Text style={styles.summaryDetail}>{reservation.detail}</Text>
      </View>

      <View style={styles.executionPanel}>
        <TonePill tone={executionTone} label={orderExecutionLabel(order)} />
        <Text style={styles.executionDetail}>{orderExecutionDetail(order)}</Text>
      </View>

      <View style={styles.lifecycleGrid}>
        {lifecycleItems.map((item) => (
          <View key={item.label} style={styles.lifecycleItem}>
            <Text style={styles.lifecycleLabel}>{item.label}</Text>
            <Text style={styles.lifecycleValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      {canCancelOmsOrder(order) ? (
        <AppButton
          label="Cancel order"
          variant="ghost"
          loading={cancelling}
          onPress={() => onCancel(order.id)}
        />
      ) : null}
    </AppCard>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailBlock}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function TonePill({ tone, label }: { tone: OmsOrderTone; label: string }) {
  return (
    <View style={[styles.tonePill, toneStyle(tone)]}>
      <Text style={[styles.toneText, toneTextStyle(tone)]}>{label}</Text>
    </View>
  );
}

function toneStyle(tone: OmsOrderTone) {
  switch (tone) {
    case 'positive':
      return styles.tonePositive;
    case 'warning':
      return styles.toneWarning;
    case 'danger':
      return styles.toneDanger;
    case 'neutral':
      return styles.toneNeutral;
  }
}

function toneTextStyle(tone: OmsOrderTone) {
  switch (tone) {
    case 'positive':
      return styles.toneTextPositive;
    case 'warning':
      return styles.toneTextWarning;
    case 'danger':
      return styles.toneTextDanger;
    case 'neutral':
      return styles.toneTextNeutral;
  }
}

const styles = StyleSheet.create({
  card: {
    gap: appTheme.spacing.md,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: appTheme.spacing.md,
  },
  primary: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  symbolRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: appTheme.spacing.sm,
  },
  symbol: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.heading,
    fontWeight: '800',
  },
  company: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.caption,
  },
  metaLine: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.micro,
    lineHeight: 16,
  },
  sidePill: {
    borderRadius: appTheme.radius.pill,
    paddingHorizontal: appTheme.spacing.sm,
    paddingVertical: 6,
  },
  buyPill: {
    backgroundColor: appTheme.colors.positiveSoft,
  },
  sellPill: {
    backgroundColor: appTheme.colors.negativeSoft,
  },
  sideText: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.micro,
    fontWeight: '800',
  },
  headline: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.body,
    fontWeight: '800',
    lineHeight: 22,
  },
  detailGrid: {
    flexDirection: 'row',
    gap: appTheme.spacing.sm,
  },
  detailBlock: {
    backgroundColor: appTheme.colors.surfaceMuted,
    borderRadius: appTheme.radius.md,
    flex: 1,
    gap: 4,
    paddingHorizontal: appTheme.spacing.sm,
    paddingVertical: appTheme.spacing.sm,
  },
  detailLabel: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.micro,
  },
  detailValue: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.body,
    fontWeight: '800',
  },
  summaryPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: appTheme.colors.border,
    borderRadius: appTheme.radius.md,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: appTheme.spacing.md,
    paddingVertical: appTheme.spacing.sm,
  },
  activeReservationPanel: {
    borderColor: '#E8D4AA',
    backgroundColor: '#FFF9EA',
  },
  summaryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: appTheme.spacing.md,
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.caption,
    fontWeight: '700',
  },
  summaryValue: {
    color: appTheme.colors.textPrimary,
    flexShrink: 1,
    fontSize: appTheme.typography.body,
    fontWeight: '800',
    textAlign: 'right',
  },
  summaryDetail: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.micro,
    lineHeight: 16,
  },
  executionPanel: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: appTheme.colors.border,
    borderRadius: appTheme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: appTheme.spacing.sm,
    paddingHorizontal: appTheme.spacing.md,
    paddingVertical: appTheme.spacing.sm,
  },
  executionDetail: {
    color: appTheme.colors.textSecondary,
    flexShrink: 1,
    fontSize: appTheme.typography.micro,
    lineHeight: 16,
  },
  lifecycleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: appTheme.spacing.sm,
  },
  lifecycleItem: {
    backgroundColor: appTheme.colors.surfaceMuted,
    borderRadius: appTheme.radius.md,
    flexGrow: 1,
    minWidth: 120,
    paddingHorizontal: appTheme.spacing.sm,
    paddingVertical: appTheme.spacing.sm,
  },
  lifecycleLabel: {
    color: appTheme.colors.textSecondary,
    fontSize: appTheme.typography.micro,
  },
  lifecycleValue: {
    color: appTheme.colors.textPrimary,
    fontSize: appTheme.typography.caption,
    fontWeight: '700',
    marginTop: 2,
  },
  tonePill: {
    alignSelf: 'flex-start',
    borderRadius: appTheme.radius.pill,
    paddingHorizontal: appTheme.spacing.sm,
    paddingVertical: 6,
  },
  toneNeutral: {
    backgroundColor: appTheme.colors.surfaceMuted,
  },
  tonePositive: {
    backgroundColor: appTheme.colors.positiveSoft,
  },
  toneWarning: {
    backgroundColor: '#F8E7C7',
  },
  toneDanger: {
    backgroundColor: appTheme.colors.negativeSoft,
  },
  toneText: {
    fontSize: appTheme.typography.micro,
    fontWeight: '800',
  },
  toneTextNeutral: {
    color: appTheme.colors.textPrimary,
  },
  toneTextPositive: {
    color: appTheme.colors.positive,
  },
  toneTextWarning: {
    color: appTheme.colors.warning,
  },
  toneTextDanger: {
    color: appTheme.colors.negative,
  },
});
