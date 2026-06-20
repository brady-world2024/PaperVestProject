'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton, AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { EmptyState } from '@/components/empty-state';
import { InlineNotice } from '@/components/inline-notice';
import { MetricCard } from '@/components/metric-card';
import { NotificationList } from '@/components/notifications/notification-list';
import { SectionHeader } from '@/components/section-header';
import { webApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import {
  countAccountNotifications,
  countOrderNotifications,
} from '@/lib/notification-presentation';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: webApi.getNotifications,
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => webApi.markNotificationRead(notificationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => webApi.markAllNotificationsRead(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });

  const notifications = notificationsQuery.data?.notifications ?? [];
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;
  const orderNotificationCount = countOrderNotifications(notifications);
  const accountNotificationCount = countAccountNotifications(notifications);

  return (
    <main className="pv-page pv-stack">
      <section className="pv-dashboard-hero">
        <AppCard className="strong pv-dashboard-hero-card">
          <div className="pv-eyebrow">Inbox</div>
          <div className="pv-dashboard-hero-head">
            <div>
              <h1 className="pv-title">Notifications center</h1>
              <p className="pv-copy inverse">
                Backend-owned account and order events stay visible after refresh, login rotation, and async order execution.
              </p>
            </div>
            <div className="pv-action-cluster">
              <AppButtonLink href="/orders" variant="secondary">
                Open orders
              </AppButtonLink>
              <AppButtonLink href="/account" variant="ghost">
                Account center
              </AppButtonLink>
            </div>
          </div>

          <div className="pv-dashboard-summary-grid">
            <MetricCard label="Unread" value={String(unreadCount)} />
            <MetricCard label="Total" value={String(notifications.length)} />
            <MetricCard label="Order events" value={String(orderNotificationCount)} />
            <MetricCard label="Account events" value={String(accountNotificationCount)} />
          </div>
        </AppCard>

        <AppCard className="pv-account-sidecard">
          <SectionHeader
            title="Delivery model"
            subtitle="Simple first-version inbox designed for reliable regression and release validation."
          />
          <div className="pv-meta-row">
            <span className="pv-kicker">Source of truth</span>
            <strong>Persisted backend notifications</strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">Refresh model</span>
            <strong>On demand + 30 second polling</strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">Current scope</span>
            <strong>Conditional orders and account lifecycle</strong>
          </div>
          <div className="pv-action-cluster" style={{ marginTop: '18px' }}>
            <AppButton
              variant="secondary"
              disabled={unreadCount === 0}
              loading={markAllReadMutation.isPending}
              onClick={() => {
                void markAllReadMutation.mutateAsync();
              }}
              type="button"
            >
              Mark all read
            </AppButton>
          </div>
        </AppCard>
      </section>

      <section className="pv-stack">
        <AppCard>
          <SectionHeader
            title="Latest notifications"
            subtitle="Newest items first, with direct links back into the workspace."
          />

          {notificationsQuery.isLoading ? (
            <div className="pv-subgrid">
              <div className="pv-skeleton" />
              <div className="pv-skeleton" />
            </div>
          ) : notificationsQuery.isError ? (
            <InlineNotice
              tone="error"
              message={webApi.getApiErrorMessage(notificationsQuery.error, 'Unable to load notifications')}
            />
          ) : notifications.length ? (
            <NotificationList
              notifications={notifications}
              markingNotificationId={markReadMutation.isPending ? markReadMutation.variables : null}
              onMarkRead={(notificationId) => {
                void markReadMutation.mutateAsync(notificationId);
              }}
            />
          ) : (
            <EmptyState
              title="No notifications yet"
              description="Order events and account lifecycle updates will appear here as soon as they are created."
            />
          )}
        </AppCard>
      </section>
    </main>
  );
}
