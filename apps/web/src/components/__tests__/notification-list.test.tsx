import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { NotificationList } from '../notifications/notification-list';
import type { UserNotification } from '@papervest/shared-types';

const sampleNotifications: UserNotification[] = [
  {
    id: 'created-1',
    type: 'CONDITIONAL_ORDER_CREATED',
    title: 'Conditional order created',
    message: 'BUY AAPL order for 3 shares at $100.00 is now active.',
    actionPath: '/orders',
    read: false,
    readAt: null,
    createdAt: '2026-06-20T08:15:00Z',
  },
  {
    id: 'verified-1',
    type: 'EMAIL_VERIFIED',
    title: 'Email verified',
    message: 'Your email address has been confirmed.',
    actionPath: '/account',
    read: true,
    readAt: '2026-06-20T08:20:00Z',
    createdAt: '2026-06-20T08:18:00Z',
  },
];

test('notification list renders unread actions and related links', () => {
  const html = renderToStaticMarkup(
    <NotificationList
      notifications={sampleNotifications}
      markingNotificationId={null}
      onMarkRead={() => undefined}
    />
  );

  assert.match(html, /Conditional order created/);
  assert.match(html, /Mark read/);
  assert.match(html, /Open orders/);
  assert.match(html, /Unread notification/);
});

test('notification list renders account notification labels and read state', () => {
  const html = renderToStaticMarkup(
    <NotificationList
      notifications={sampleNotifications}
      markingNotificationId={null}
      onMarkRead={() => undefined}
    />
  );

  assert.match(html, /Email verified/);
  assert.match(html, />Verified</);
  assert.match(html, /Open account/);
  assert.match(html, /Read/);
});
