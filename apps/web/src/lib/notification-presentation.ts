import type { NotificationType, UserNotification } from '@papervest/shared-types';

export function getNotificationChipClass(type: NotificationType) {
  switch (type) {
    case 'CONDITIONAL_ORDER_FILLED':
    case 'EMAIL_VERIFIED':
      return 'positive';
    case 'CONDITIONAL_ORDER_FAILED':
    case 'CONDITIONAL_ORDER_EXPIRED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function getNotificationLabel(type: NotificationType) {
  switch (type) {
    case 'CONDITIONAL_ORDER_CREATED':
      return 'Order created';
    case 'CONDITIONAL_ORDER_TRIGGERED':
      return 'Triggered';
    case 'CONDITIONAL_ORDER_FILLED':
      return 'Filled';
    case 'CONDITIONAL_ORDER_FAILED':
      return 'Failed';
    case 'CONDITIONAL_ORDER_CANCELLED':
      return 'Cancelled';
    case 'CONDITIONAL_ORDER_EXPIRED':
      return 'Expired';
    case 'EMAIL_VERIFIED':
      return 'Verified';
    case 'PASSWORD_CHANGED':
      return 'Password';
    default:
      return 'Update';
  }
}

export function getNotificationActionLabel(notification: UserNotification) {
  if (!notification.actionPath) {
    return null;
  }

  if (notification.type.startsWith('CONDITIONAL_ORDER_')) {
    return 'Open orders';
  }

  return 'Open account';
}

export function countOrderNotifications(notifications: UserNotification[]) {
  return notifications.filter((notification) => notification.type.startsWith('CONDITIONAL_ORDER_')).length;
}

export function countAccountNotifications(notifications: UserNotification[]) {
  return notifications.length - countOrderNotifications(notifications);
}
