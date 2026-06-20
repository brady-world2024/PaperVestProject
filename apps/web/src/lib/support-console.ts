import type { SupportUserSummary } from '@papervest/shared-types';

export function countSupportUsersNeedingAttention(users: SupportUserSummary[]) {
  return users.filter(
    (user) =>
      !user.emailVerified ||
      user.unreadNotificationsCount > 0 ||
      user.activeConditionalOrdersCount > 0
  ).length;
}

export function countSupportActiveSessions(users: SupportUserSummary[]) {
  return users.reduce((total, user) => total + user.activeSessionsCount, 0);
}
