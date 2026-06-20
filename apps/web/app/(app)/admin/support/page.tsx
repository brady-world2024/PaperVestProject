'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { AppButtonLink } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppField } from '@/components/app-field';
import { EmptyState } from '@/components/empty-state';
import { InlineNotice } from '@/components/inline-notice';
import { MetricCard } from '@/components/metric-card';
import { SectionHeader } from '@/components/section-header';
import { webApi } from '@/lib/api';
import { formatCurrency, formatDateTime, formatShares } from '@/lib/formatters';
import { queryKeys } from '@/lib/query-keys';
import { countSupportActiveSessions, countSupportUsersNeedingAttention } from '@/lib/support-console';
import { useAuthStore } from '@/state/auth-store';

export default function AdminSupportPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const [searchInput, setSearchInput] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(searchInput.trim());

  const supportUsersQuery = useQuery({
    queryKey: queryKeys.adminSupportUsers(deferredQuery || 'recent'),
    queryFn: () => webApi.getSupportUsers(deferredQuery || undefined),
    enabled: isAdmin,
  });

  useEffect(() => {
    const users = supportUsersQuery.data?.users ?? [];
    if (!users.length) {
      setSelectedUserId(null);
      return;
    }
    if (!selectedUserId || !users.some((entry) => entry.userId === selectedUserId)) {
      setSelectedUserId(users[0].userId);
    }
  }, [selectedUserId, supportUsersQuery.data]);

  const supportDetailQuery = useQuery({
    queryKey: queryKeys.adminSupportUser(selectedUserId ?? 'none'),
    queryFn: () => webApi.getSupportUserDetail(selectedUserId!),
    enabled: isAdmin && Boolean(selectedUserId),
  });

  const supportUsers = supportUsersQuery.data?.users ?? [];
  const attentionCount = useMemo(
    () => countSupportUsersNeedingAttention(supportUsers),
    [supportUsers]
  );
  const activeSessionCount = useMemo(
    () => countSupportActiveSessions(supportUsers),
    [supportUsers]
  );
  const adminCount = useMemo(
    () => supportUsers.filter((entry) => entry.role === 'ADMIN').length,
    [supportUsers]
  );

  if (!isAdmin) {
    return (
      <main className="pv-page pv-stack">
        <AppCard className="strong">
          <div className="pv-eyebrow">Restricted area</div>
          <h1 className="pv-title">Admin support console</h1>
          <p className="pv-copy inverse">
            This workspace is only available to admin users bootstrapped through the backend admin configuration.
          </p>
        </AppCard>

        <AppCard>
          <InlineNotice
            tone="error"
            message="Your current session does not have admin access. Ask an existing admin to add your email to the bootstrap admin list for this environment."
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

  const detail = supportDetailQuery.data;

  return (
    <main className="pv-page pv-stack">
      <section className="pv-dashboard-hero">
        <AppCard className="strong pv-dashboard-hero-card">
          <div className="pv-eyebrow">Admin / support</div>
          <div className="pv-dashboard-hero-head">
            <div>
              <h1 className="pv-title">Support command desk</h1>
              <p className="pv-copy inverse">
                Search recent users, inspect account state, and review sessions, trades, orders, and inbox events without leaving the authenticated workspace.
              </p>
            </div>
            <div className="pv-action-cluster">
              <AppButtonLink href="/notifications" variant="secondary">
                Notifications
              </AppButtonLink>
              <AppButtonLink href="/account" variant="ghost">
                Account center
              </AppButtonLink>
            </div>
          </div>

          <div className="pv-dashboard-summary-grid">
            <MetricCard label="Visible users" value={String(supportUsers.length)} />
            <MetricCard label="Admins in result" value={String(adminCount)} />
            <MetricCard label="Need attention" value={String(attentionCount)} />
            <MetricCard label="Active sessions" value={String(activeSessionCount)} />
          </div>
        </AppCard>

        <AppCard className="pv-account-sidecard">
          <SectionHeader
            title="Read-only v1"
            subtitle="Safe support slice before adding write-side admin actions."
          />
          <div className="pv-meta-row">
            <span className="pv-kicker">Current scope</span>
            <strong>User lookup + account inspection</strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">Included data</span>
            <strong>Sessions, trades, orders, inbox, watchlist</strong>
          </div>
          <div className="pv-meta-row">
            <span className="pv-kicker">Guardrail</span>
            <strong>Admin-only backend endpoints</strong>
          </div>
        </AppCard>
      </section>

      <section className="pv-account-grid">
        <AppCard>
          <SectionHeader
            title="User search"
            subtitle="Search by email or leave blank to inspect the 25 most recent users."
          />

          <div className="pv-stack">
            <AppField
              label="Search users"
              name="support-user-search"
              placeholder="alice@example.com"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
              }}
            />

            {supportUsersQuery.isLoading ? (
              <div className="pv-subgrid">
                <div className="pv-skeleton" />
                <div className="pv-skeleton" />
              </div>
            ) : supportUsersQuery.isError ? (
              <InlineNotice
                tone="error"
                message={webApi.getApiErrorMessage(supportUsersQuery.error, 'Unable to load support users')}
              />
            ) : supportUsers.length ? (
              <div className="pv-stack">
                {supportUsers.map((entry) => {
                  const isSelected = entry.userId === selectedUserId;
                  return (
                    <button
                      key={entry.userId}
                      type="button"
                      className="pv-card"
                      data-active={isSelected}
                      onClick={() => {
                        setSelectedUserId(entry.userId);
                      }}
                      style={{
                        textAlign: 'left',
                        border: isSelected ? '1px solid rgba(34, 197, 94, 0.45)' : undefined,
                        boxShadow: isSelected ? '0 0 0 1px rgba(34, 197, 94, 0.25) inset' : undefined,
                        cursor: 'pointer',
                      }}
                    >
                      <div className="pv-stack" style={{ gap: '10px' }}>
                        <div className="pv-meta-row">
                          <strong>{entry.email}</strong>
                          <span className={`pv-chip ${entry.role === 'ADMIN' ? 'buy' : 'neutral'}`}>
                            {entry.role}
                          </span>
                        </div>
                        <div className="pv-meta-row">
                          <span className="pv-kicker">Verification</span>
                          <strong>{entry.emailVerified ? 'Verified' : 'Pending'}</strong>
                        </div>
                        <div className="pv-meta-row">
                          <span className="pv-kicker">Cash balance</span>
                          <strong>{formatCurrency(entry.cashBalance)}</strong>
                        </div>
                        <div className="pv-meta-row">
                          <span className="pv-kicker">Signals</span>
                          <strong>
                            {entry.activeConditionalOrdersCount} open orders · {entry.unreadNotificationsCount} unread
                          </strong>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No users found"
                description="Try another email fragment or remove the filter to inspect the newest accounts."
              />
            )}
          </div>
        </AppCard>

        <AppCard>
          <SectionHeader
            title="Selected user detail"
            subtitle="Account state, session hygiene, and the most recent support signals."
          />

          {!selectedUserId ? (
            <EmptyState
              title="Pick a user"
              description="Select a user from the search panel to load holdings, sessions, recent trades, and notifications."
            />
          ) : supportDetailQuery.isLoading ? (
            <div className="pv-subgrid">
              <div className="pv-skeleton" />
              <div className="pv-skeleton" />
              <div className="pv-skeleton" />
            </div>
          ) : supportDetailQuery.isError ? (
            <InlineNotice
              tone="error"
              message={webApi.getApiErrorMessage(supportDetailQuery.error, 'Unable to load support detail')}
            />
          ) : detail ? (
            <div className="pv-stack">
              <div className="pv-dashboard-summary-grid">
                <MetricCard label="Email" value={detail.user.email} />
                <MetricCard label="Role" value={detail.user.role} />
                <MetricCard
                  label="Verification"
                  value={detail.user.emailVerified ? 'Verified' : 'Pending'}
                  tone={detail.user.emailVerified ? 'positive' : undefined}
                />
                <MetricCard label="Cash balance" value={formatCurrency(detail.account.cashBalance)} />
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: '18px',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                }}
              >
                <AppCard>
                  <SectionHeader
                    title="Account summary"
                    subtitle="Useful for fast support triage."
                  />
                  <div className="pv-stack" style={{ gap: '12px' }}>
                    <div className="pv-meta-row">
                      <span className="pv-kicker">Joined</span>
                      <strong>{formatDateTime(detail.user.createdAt)}</strong>
                    </div>
                    <div className="pv-meta-row">
                      <span className="pv-kicker">Initial cash</span>
                      <strong>{formatCurrency(detail.account.initialCash)}</strong>
                    </div>
                    <div className="pv-meta-row">
                      <span className="pv-kicker">Realized P&amp;L</span>
                      <strong>{formatCurrency(detail.account.realizedPnl)}</strong>
                    </div>
                    <div className="pv-meta-row">
                      <span className="pv-kicker">Unread notifications</span>
                      <strong>{detail.unreadNotificationsCount}</strong>
                    </div>
                  </div>
                </AppCard>

                <AppCard>
                  <SectionHeader
                    title="Position + watchlist"
                    subtitle="Current holdings and saved symbols without live market enrichment."
                  />
                  <div className="pv-stack" style={{ gap: '12px' }}>
                    <div className="pv-meta-row">
                      <span className="pv-kicker">Holdings</span>
                      <strong>{detail.holdingsCount}</strong>
                    </div>
                    <div className="pv-meta-row">
                      <span className="pv-kicker">Watchlist</span>
                      <strong>{detail.watchlistCount}</strong>
                    </div>
                    {detail.holdings.length ? (
                      detail.holdings.map((holding) => (
                        <div key={holding.symbol} className="pv-meta-row">
                          <span className="pv-kicker">
                            {holding.symbol} · {formatShares(holding.quantity)} sh
                          </span>
                          <strong>{formatCurrency(holding.averageCost)}</strong>
                        </div>
                      ))
                    ) : (
                      <span className="pv-kicker">No open holdings</span>
                    )}
                    {detail.watchlist.length ? (
                      <div className="pv-meta-row">
                        <span className="pv-kicker">Watchlist symbols</span>
                        <strong>{detail.watchlist.map((item) => item.symbol).join(', ')}</strong>
                      </div>
                    ) : null}
                  </div>
                </AppCard>

                <AppCard>
                  <SectionHeader
                    title="Sessions + orders"
                    subtitle="Quick read-only visibility into login activity and open conditional orders."
                  />
                  <div className="pv-stack" style={{ gap: '12px' }}>
                    <div className="pv-meta-row">
                      <span className="pv-kicker">Active sessions</span>
                      <strong>{detail.activeSessionsCount}</strong>
                    </div>
                    <div className="pv-meta-row">
                      <span className="pv-kicker">Open conditional orders</span>
                      <strong>{detail.activeConditionalOrdersCount}</strong>
                    </div>
                    {detail.activeSessions.length ? (
                      detail.activeSessions.map((session) => (
                        <div key={session.sessionId} className="pv-meta-row">
                          <span className="pv-kicker">{session.deviceName}</span>
                          <strong>{formatDateTime(session.expiresAt)}</strong>
                        </div>
                      ))
                    ) : (
                      <span className="pv-kicker">No active refresh sessions</span>
                    )}
                    {detail.activeConditionalOrders.length ? (
                      detail.activeConditionalOrders.map((order) => (
                        <div key={order.id} className="pv-meta-row">
                          <span className="pv-kicker">
                            {order.side} {order.symbol}
                          </span>
                          <strong>{order.status}</strong>
                        </div>
                      ))
                    ) : (
                      <span className="pv-kicker">No open conditional orders</span>
                    )}
                  </div>
                </AppCard>
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: '18px',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                }}
              >
                <AppCard>
                  <SectionHeader
                    title="Recent trades"
                    subtitle="Most recent execution ledger for support investigation."
                  />
                  {detail.recentTrades.length ? (
                    <div className="pv-stack" style={{ gap: '12px' }}>
                      {detail.recentTrades.map((trade) => (
                        <div key={trade.tradeId} className="pv-meta-row">
                          <span className="pv-kicker">
                            {trade.side} {trade.symbol} · {formatShares(trade.quantity)} sh
                          </span>
                          <strong>{formatDateTime(trade.executedAt)}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No trades yet"
                      description="This user has not executed any paper trades."
                    />
                  )}
                </AppCard>

                <AppCard>
                  <SectionHeader
                    title="Recent notifications"
                    subtitle="Latest backend-owned support signals for this account."
                  />
                  {detail.recentNotifications.length ? (
                    <div className="pv-stack" style={{ gap: '12px' }}>
                      {detail.recentNotifications.map((notification) => (
                        <div key={notification.id} className="pv-meta-row">
                          <span className="pv-kicker">{notification.title}</span>
                          <strong>{notification.read ? 'Read' : 'Unread'}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No notifications yet"
                      description="No order or account lifecycle events have been recorded for this user."
                    />
                  )}
                </AppCard>
              </div>
            </div>
          ) : null}
        </AppCard>
      </section>
    </main>
  );
}
