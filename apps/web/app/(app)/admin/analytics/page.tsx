'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ProductAnalyticsWindowDays } from '@papervest/shared-types';

import { AppButton, AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { EmptyState } from '@/components/empty-state';
import { InlineNotice } from '@/components/inline-notice';
import { MetricCard } from '@/components/metric-card';
import { SectionHeader } from '@/components/section-header';
import { webApi } from '@/lib/api';
import { formatDateTime } from '@/lib/formatters';
import {
  formatProductAnalyticsEventName,
  formatProductAnalyticsPath,
  formatProductAnalyticsWindowLabel,
} from '@/lib/product-analytics';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/state/auth-store';

const analyticsWindows: ProductAnalyticsWindowDays[] = [7, 30, 90];

export default function AdminAnalyticsPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const [windowDays, setWindowDays] = useState<ProductAnalyticsWindowDays>(30);

  const analyticsQuery = useQuery({
    queryKey: queryKeys.adminAnalyticsOverview(windowDays),
    queryFn: () => webApi.getAdminAnalyticsOverview(windowDays),
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <main className="pv-page pv-stack">
        <AppCard className="strong">
          <div className="pv-eyebrow">Restricted area</div>
          <h1 className="pv-title">Product analytics</h1>
          <p className="pv-copy inverse">
            This workspace is reserved for admin sessions because it exposes cross-user adoption and behavior signals.
          </p>
        </AppCard>

        <AppCard>
          <InlineNotice
            tone="error"
            message="Your current session does not have analytics access. Ask an existing admin to bootstrap your email for this environment."
          />
          <div className="pv-action-cluster" style={{ marginTop: '18px' }}>
            <AppButtonLink href="/dashboard" variant="secondary">
              Back to dashboard
            </AppButtonLink>
            <AppButtonLink href="/account" variant="ghost">
              Account center
            </AppButtonLink>
          </div>
        </AppCard>
      </main>
    );
  }

  const overview = analyticsQuery.data;
  const summary = overview?.summary;

  return (
    <main className="pv-page pv-stack">
      <section className="pv-dashboard-hero">
        <AppCard className="strong pv-dashboard-hero-card">
          <div className="pv-eyebrow">Product analytics</div>
          <div className="pv-dashboard-hero-head">
            <div>
              <h1 className="pv-title">Signal ledger</h1>
              <p className="pv-copy inverse">
                First-party event data from authenticated browser behavior and backend-owned product actions, shaped for quick adoption reviews.
              </p>
            </div>
            <div className="pv-action-cluster">
              <AppButtonLink href="/admin/support" variant="secondary">
                Support console
              </AppButtonLink>
              <AppButtonLink href="/notifications" variant="ghost">
                Notifications
              </AppButtonLink>
            </div>
          </div>

          <div className="pv-action-cluster" style={{ marginBottom: '18px', flexWrap: 'wrap' }}>
            {analyticsWindows.map((option) => (
              <AppButton
                key={option}
                type="button"
                variant={windowDays === option ? 'primary' : 'ghost'}
                onClick={() => {
                  setWindowDays(option);
                }}
              >
                {formatProductAnalyticsWindowLabel(option)}
              </AppButton>
            ))}
          </div>

          <div className="pv-dashboard-summary-grid">
            <MetricCard label="Tracked events" value={summary ? String(summary.totalEvents) : '...'} />
            <MetricCard label="Active users" value={summary ? String(summary.uniqueUsers) : '...'} />
            <MetricCard label="Page views" value={summary ? String(summary.pageViews) : '...'} />
            <MetricCard label="Trades executed" value={summary ? String(summary.tradesExecuted) : '...'} />
          </div>

          {overview ? (
            <div className="pv-meta-row" style={{ marginTop: '16px' }}>
              <span className="pv-kicker">Window</span>
              <strong>
                {formatDateTime(overview.from)} to {formatDateTime(overview.to)}
              </strong>
            </div>
          ) : null}

          {analyticsQuery.isError ? (
            <InlineNotice
              tone="error"
              message={webApi.getApiErrorMessage(analyticsQuery.error, 'Unable to load the analytics overview')}
            />
          ) : null}
        </AppCard>

        <AppCard className="pv-account-sidecard">
          <SectionHeader
            title="Tracked scope"
            subtitle="A disciplined first version before full funnel tooling."
          />
          <div className="pv-meta-row">
            <span className="pv-kicker">Browser signals</span>
            <strong>Page views + stock search</strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">Domain actions</span>
            <strong>Register, login, watchlist, trades, orders</strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">Storage</span>
            <strong>First-party Postgres event ledger</strong>
          </div>
        </AppCard>
      </section>

      {analyticsQuery.isLoading ? (
        <section className="pv-dashboard-subgrid">
          <AppCard>
            <div className="pv-subgrid">
              <div className="pv-skeleton" />
              <div className="pv-skeleton" />
              <div className="pv-skeleton" />
            </div>
          </AppCard>
        </section>
      ) : overview && overview.summary.totalEvents === 0 ? (
        <AppCard>
          <EmptyState
            title="No analytics captured yet"
            description="Once users navigate the workspace or backend-owned actions happen, this dashboard will start showing product signals."
          />
        </AppCard>
      ) : overview ? (
        <>
          <section className="pv-dashboard-subgrid">
            <AppCard>
              <SectionHeader
                title="Event mix"
                subtitle="Useful for seeing where product energy is concentrated in the selected window."
              />
              <div className="pv-dashboard-summary-grid">
                <MetricCard label="Registrations" value={String(overview.summary.registrations)} />
                <MetricCard label="Logins" value={String(overview.summary.logins)} />
                <MetricCard label="Searches" value={String(overview.summary.stockSearches)} />
                <MetricCard
                  label="Watchlist changes"
                  value={String(overview.summary.watchlistAdds + overview.summary.watchlistRemovals)}
                />
              </div>
            </AppCard>

            <AppCard>
              <SectionHeader
                title="Behavior funnel"
                subtitle="A compact progression from general usage into higher-intent investing actions."
              />
              <div className="pv-dashboard-summary-grid">
                <MetricCard label="Users seen" value={String(overview.funnel.usersSeen)} />
                <MetricCard label="Viewed pages" value={String(overview.funnel.usersWithPageViews)} />
                <MetricCard label="Searched market" value={String(overview.funnel.usersWithSearches)} />
                <MetricCard label="Placed trades" value={String(overview.funnel.usersWithTrades)} />
              </div>
              <div className="pv-meta-row" style={{ marginTop: '16px' }}>
                <span className="pv-kicker">Order intent</span>
                <strong>{overview.funnel.usersWithConditionalOrders} users created or managed conditional orders</strong>
              </div>
            </AppCard>
          </section>

          <section className="pv-account-grid">
            <AppCard>
              <SectionHeader
                title="Daily activity"
                subtitle="A lightweight ledger view for recent usage without introducing a heavier chart dependency."
              />
              <div className="pv-stack">
                {overview.dailyActivity.map((point) => (
                  <div key={point.day} className="pv-card">
                    <div className="pv-meta-row">
                      <strong>{point.day}</strong>
                      <span className="pv-kicker">{point.totalEvents} events</span>
                    </div>
                    <div className="pv-dashboard-summary-grid" style={{ marginTop: '14px' }}>
                      <MetricCard label="Users" value={String(point.uniqueUsers)} />
                      <MetricCard label="Views" value={String(point.pageViews)} />
                      <MetricCard label="Searches" value={String(point.stockSearches)} />
                      <MetricCard label="Trades" value={String(point.tradesExecuted)} />
                    </div>
                  </div>
                ))}
              </div>
            </AppCard>

            <AppCard>
              <SectionHeader
                title="Top pages"
                subtitle="Most-viewed routes based on authenticated page-view tracking."
              />
              {overview.topPages.length ? (
                <div className="pv-list">
                  {overview.topPages.map((page) => (
                    <div key={page.path} className="pv-list-row">
                      <div className="pv-list-primary">
                        <span className="pv-list-symbol">{formatProductAnalyticsPath(page.path)}</span>
                        <span className="pv-list-company">{page.path}</span>
                      </div>
                      <div className="pv-list-secondary">
                        <strong>{page.views}</strong>
                        <span className="pv-kicker">views</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No page views yet"
                  description="Page-view signals will populate here as authenticated users move through the web workspace."
                />
              )}
            </AppCard>
          </section>

          <AppCard>
            <SectionHeader
              title="Event breakdown"
              subtitle="Backend actions and browser events, ordered by activity volume."
            />
            <div className="pv-list">
              {overview.eventBreakdown.map((entry) => (
                <div key={entry.eventName} className="pv-list-row">
                  <div className="pv-list-primary">
                    <span className="pv-list-symbol">{formatProductAnalyticsEventName(entry.eventName)}</span>
                    <span className="pv-list-company">
                      {entry.eventName === 'PAGE_VIEWED'
                        ? 'Browser navigation signal'
                        : entry.eventName === 'STOCK_SEARCH_PERFORMED'
                          ? 'Search behavior signal'
                          : 'Backend-owned product action'}
                    </span>
                  </div>
                  <div className="pv-list-secondary">
                    <strong>{entry.count}</strong>
                    <span className="pv-kicker">events</span>
                  </div>
                </div>
              ))}
            </div>
          </AppCard>
        </>
      ) : null}
    </main>
  );
}
