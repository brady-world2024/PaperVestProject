'use client';

import type { ConditionalOrder } from '@papervest/shared-types';

import { AppButton } from '../app-button';
import { AppCard } from '../app-card';
import { EmptyState } from '../empty-state';
import { SectionHeader } from '../section-header';
import { formatCurrency, formatDateTime, formatShares } from '../../lib/formatters';
import {
  canCancelConditionalOrder,
  conditionalOrderFailureSummary,
  conditionalOrderStatusTone,
} from '../../lib/conditional-orders/presentation';

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
        description="Create a target-price order and it will appear here while the backend scheduler watches the market."
      />
    );
  }

  return (
    <div className="pv-stack">
      {orders.map((order) => {
        const failureSummary = conditionalOrderFailureSummary(order);
        const tone = conditionalOrderStatusTone(order.status);

        return (
          <AppCard key={order.id} className="pv-order-row-card">
            <div className="pv-order-row-head">
              <div className="pv-list-primary">
                <span className="pv-list-symbol">{order.symbol}</span>
                <span className="pv-list-company">
                  {order.side} · Target {formatCurrency(order.targetPrice)}
                </span>
                <span className="pv-kicker">
                  {formatShares(order.quantity)} shares · Created {formatDateTime(order.createdAt)}
                </span>
              </div>

              <div className="pv-order-row-actions">
                <span className={`pv-chip ${tone}`}>{order.status}</span>
                {canCancelConditionalOrder(order.status) ? (
                  <AppButton
                    variant="ghost"
                    loading={cancellingOrderId === order.id}
                    onClick={() => onCancel(order.id)}
                  >
                    Cancel
                  </AppButton>
                ) : null}
              </div>
            </div>

            <div className="pv-order-detail-grid">
              <div className="pv-meta-row">
                <span className="pv-kicker">Trigger</span>
                <strong>{order.side === 'BUY' ? '<=' : '>='}</strong>
              </div>
              <div className="pv-meta-row">
                <span className="pv-kicker">Execution key</span>
                <strong>{order.executionKey}</strong>
              </div>
              <div className="pv-meta-row">
                <span className="pv-kicker">Last checked</span>
                <strong>
                  {order.lastCheckedPrice == null ? 'Not checked yet' : formatCurrency(order.lastCheckedPrice)}
                </strong>
              </div>
              <div className="pv-meta-row">
                <span className="pv-kicker">Triggered at</span>
                <strong>{order.triggeredAt ? formatDateTime(order.triggeredAt) : 'Waiting'}</strong>
              </div>
              <div className="pv-meta-row">
                <span className="pv-kicker">Executed at</span>
                <strong>{order.executedAt ? formatDateTime(order.executedAt) : 'Not executed'}</strong>
              </div>
              <div className="pv-meta-row">
                <span className="pv-kicker">Version</span>
                <strong>{order.version}</strong>
              </div>
            </div>

            {failureSummary ? (
              <div className="pv-order-failure">{failureSummary}</div>
            ) : null}
          </AppCard>
        );
      })}
    </div>
  );
}
