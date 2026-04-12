'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { AppButton } from './app-button';
import { BrandLogo } from './brand-logo';
import { useAuthStore } from '@/state/auth-store';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/orders', label: 'Orders' },
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/activity', label: 'Activity' },
];

const pageMeta = [
  {
    match: (pathname: string) => pathname.startsWith('/dashboard'),
    title: 'Dashboard',
    description: 'Search symbols, review portfolio state, and move into trade entry.',
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

  return (
    <div className="pv-app-shell">
      <aside className="pv-shell-sidebar">
        <div className="pv-shell-sidebar-inner">
          <Link className="pv-shell-brand" href="/dashboard">
            <BrandLogo size="sidebar" caption="Paper trading workspace" priority />
          </Link>

          <nav className="pv-shell-nav" aria-label="Primary">
            {navItems.map((item) => (
              <Link
                key={item.href}
                className="pv-shell-nav-link"
                data-active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                href={item.href}
              >
                <span className="pv-shell-nav-label">{item.label}</span>
                <span className="pv-shell-nav-meta">
                  {item.href === '/dashboard'
                    ? 'Desk overview'
                    : item.href === '/orders'
                      ? 'Target-price orders'
                    : item.href === '/watchlist'
                      ? 'Saved symbols'
                      : item.href === '/portfolio'
                        ? 'Holdings + P&L'
                        : 'Trade ledger'}
                </span>
              </Link>
            ))}
          </nav>

          <section className="pv-shell-sidecard">
            <span className="pv-eyebrow">Signed in</span>
            <div className="pv-shell-user-email">{user?.email}</div>
            <p className="pv-kicker">Backend-managed web session.</p>
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
            <Link className="pv-shell-topbar-link" href="/dashboard">
              Search market
            </Link>
            <Link className="pv-shell-topbar-link" href="/orders">
              Conditional orders
            </Link>
            <Link className="pv-shell-topbar-link" href="/portfolio">
              Portfolio
            </Link>
          </div>
        </header>

        <div className="pv-shell-content">{children}</div>
      </div>
    </div>
  );
}
