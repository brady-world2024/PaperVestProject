import assert from 'node:assert/strict';
import test from 'node:test';

import {
  countSupportActiveSessions,
  countSupportUsersNeedingAttention,
} from '../../lib/support-console';
import type { SupportUserSummary } from '@papervest/shared-types';

const supportUsers: SupportUserSummary[] = [
  {
    userId: 'user-1',
    email: 'admin@example.com',
    role: 'ADMIN',
    emailVerified: true,
    createdAt: '2026-06-20T08:00:00Z',
    cashBalance: 100000,
    realizedPnl: 0,
    holdingsCount: 0,
    watchlistCount: 0,
    activeConditionalOrdersCount: 0,
    activeSessionsCount: 2,
    unreadNotificationsCount: 0,
    lastTradeAt: null,
  },
  {
    userId: 'user-2',
    email: 'pending@example.com',
    role: 'USER',
    emailVerified: false,
    createdAt: '2026-06-20T09:00:00Z',
    cashBalance: 99500,
    realizedPnl: 100,
    holdingsCount: 1,
    watchlistCount: 2,
    activeConditionalOrdersCount: 1,
    activeSessionsCount: 1,
    unreadNotificationsCount: 3,
    lastTradeAt: '2026-06-20T09:15:00Z',
  },
];

test('support console helper counts users that need attention', () => {
  assert.equal(countSupportUsersNeedingAttention(supportUsers), 1);
});

test('support console helper totals active sessions across visible users', () => {
  assert.equal(countSupportActiveSessions(supportUsers), 3);
});
