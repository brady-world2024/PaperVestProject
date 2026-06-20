'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { AppButton } from './app-button';
import { BrandLogo } from './brand-logo';
import { webApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/state/auth-store';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', meta: 'Desk overview' },
  { href: '/notifications', label: 'Notifications', meta: 'Order + account inbox' },
  { href: '/orders', label: 'Orders', meta: 'Target-price orders' },
  { href: '/watchlist', label: 'Watchlist', meta: 'Saved symbols' },
  { href: '/portfolio', label: 'Portfolio', meta: 'Holdings + P&L' },
  { href: '/activity', label: 'Activity', meta: 'Trade ledger' },
  { href: '/account', label: 'Account', meta: 'Security + lifecycle' },
  { href: '/admin/support', label: 'Support', meta: 'Admin support console', adminOnly: true },
];

const pageMeta = [
  {
    match: (pathname: string) => pathname.startsWith('/dashboard'),
    title: 'Dashboard',
    description: 'Search symbols, review portfolio state, and move into trade entry.',
  },
  {
    match: (pathname: string) => pathname.startsWith('/notifications'),
    title: 'Notifications',
    description: 'Backend-owned order and account events with unread state and simple inbox controls.',
  },
  {
    match: (pathname: string) => pathname.startsWith('/orders'),
    title: 'Conditional Orders',
    description: 'Target-price orders that trigger in the backend and execute through RabbitMQ.',
  },
  {
    match: (pathname: string) => pathname.startsWith('/watchlist'),
    title: 'Watchlist',
    description: 'Saved symbols with live quote context.',
  },
  {
    match: (pathname: string) => pathname.startsWith('/portfolio'),
    title: 'Portfolio',
    description: 'Backend-calculated cash, holdings, and P&L.',
  },
  {
    match: (pathname: string) => pathname.startsWith('/activity'),
    title: 'Activity',
    description: 'Executed paper trades and timestamps.',
  },
  {
    match: (pathname: string) => pathname.startsWith('/account'),
    title: 'Account',
    description: 'Identity, password rotation, email verification, and lifecycle controls.',
  },
  {
    match: (pathname: string) => pathname.startsWith('/admin/support'),
    title: 'Support Console',
    description: 'Admin-only user lookup for account state, sessions, orders, notifications, and recent trading context.',
  },
  {
    match: (pathname: string) => pathname.startsWith('/stocks/'),
    title: 'Stock Detail',
    description: 'Quote, history, position context, and trade entry.',
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const currentPage = pageMeta.find((entry) => entry.match(pathname));
  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: webApi.getNotifications,
    enabled: Boolean(user),
    refetchInterval: 30000,
  });
  const unreadNotifications = notificationsQuery.data?.unreadCount ?? 0;
  const visibleNavItems = navItems.filter((item) => !item.adminOnly || user?.role === 'ADMIN');
  const topbarLinks = [
    { href: '/dashboard', label: 'Search market' },
    { href: '/notifications', label: 'Notifications' },
    { href: '/orders', label: 'Conditional orders' },
    { href: '/portfolio', label: 'Portfolio' },
    { href: '/account', label: 'Account' },
    ...(user?.role === 'ADMIN' ? [{ href: '/admin/support', label: 'Support console' }] : []),
  ];

  return (
    <div className="pv-app-shell">
      <aside className="pv-shell-sidebar">
        <div className="pv-shell-sidebar-inner">
          <Link className="pv-shell-brand" href="/dashboard">
            <BrandLogo size="sidebar" caption="Paper trading workspace" priority />
          </Link>

          <nav className="pv-shell-nav" aria-label="Primary">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                className="pv-shell-nav-link"
                data-active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                href={item.href}
              >
                <span className="pv-shell-nav-label-row">
                  <span className="pv-shell-nav-label">{item.label}</span>
                  {item.href === '/notifications' && unreadNotifications > 0 ? (
                    <span className="pv-shell-nav-badge">{unreadNotifications}</span>
                  ) : null}
                </span>
                <span className="pv-shell-nav-meta">{item.meta}</span>
              </Link>
            ))}
          </nav>

          <section className="pv-shell-sidecard">
            <span className="pv-eyebrow">Signed in</span>
            <div className="pv-shell-user-email">{user?.email}</div>
            <p className="pv-kicker">
              {user?.role === 'ADMIN' ? 'Admin session with support access.' : 'Backend-managed web session.'}
            </p>
            <AppButton
              variant="ghost"
              className="pv-shell-signout"
              onClick={() => {
                void (async () => {
                  queryClient.clear();
                  await signOut();
                })();
              }}
            >
              Sign out
            </AppButton>
          </section>
        </div>
      </aside>

      <div className="pv-shell-main">
        <header className="pv-shell-topbar">
          <div className="pv-shell-topbar-meta">
            <span className="pv-eyebrow">Workspace</span>
            <h1 className="pv-shell-topbar-title">{currentPage?.title ?? 'Workspace'}</h1>
            <p className="pv-shell-topbar-copy">
              {currentPage?.description ??
                'Authenticated market data, portfolio state, and paper trade execution.'}
            </p>
          </div>
          <div className="pv-shell-topbar-actions">
            {topbarLinks.map((link) => (
              <Link key={link.href} className="pv-shell-topbar-link" href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </header>

        <div className="pv-shell-content">{children}</div>
      </div>
    </div>
  );
}
