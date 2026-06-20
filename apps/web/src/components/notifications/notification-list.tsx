import type { UserNotification } from '@papervest/shared-types';

import { formatDateTime } from '../../lib/formatters';
import {
  getNotificationActionLabel,
  getNotificationChipClass,
  getNotificationLabel,
} from '../../lib/notification-presentation';

export function NotificationList({
  notifications,
  markingNotificationId,
  onMarkRead,
}: {
  notifications: UserNotification[];
  markingNotificationId?: string | null;
  onMarkRead: (notificationId: string) => void;
}) {
  return (
    <div className="pv-list">
      {notifications.map((notification) => {
        const actionLabel = getNotificationActionLabel(notification);

        return (
          <article
            key={notification.id}
            className="pv-list-row pv-list-row-wrap pv-notification-row"
            data-read={notification.read}
          >
            <div className="pv-list-primary">
              <span className="pv-list-symbol-line">
                <span className={`pv-chip ${getNotificationChipClass(notification.type)}`}>
                  {getNotificationLabel(notification.type)}
                </span>
                {!notification.read ? (
                  <span className="pv-notification-unread-dot" aria-label="Unread notification" />
                ) : null}
              </span>
              <strong className="pv-notification-title">{notification.title}</strong>
              <span className="pv-notification-copy">{notification.message}</span>
              <span className="pv-list-meta-line">
                <span>{formatDateTime(notification.createdAt)}</span>
                <span>{notification.read ? 'Read' : 'Unread'}</span>
              </span>
            </div>

            <div className="pv-order-row-actions">
              {actionLabel && notification.actionPath ? (
                <a className="pv-button ghost" href={notification.actionPath}>
                  {actionLabel}
                </a>
              ) : null}
              {!notification.read ? (
                <button
                  className="pv-button secondary"
                  disabled={markingNotificationId === notification.id}
                  onClick={() => onMarkRead(notification.id)}
                  type="button"
                >
                  {markingNotificationId === notification.id ? 'Working...' : 'Mark read'}
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
